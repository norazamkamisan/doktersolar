// Sign-in sessions and password hashing, shared by middleware.js (edge) and the API functions (Node).
// Uses only Web Crypto, which both runtimes have.
//
// Session cookie "ds_session":
//   v2.<base64url(JSON {r: 'admin'|'sales', u: userId, v: credentialVersion, e: expirySeconds})>.<HMAC-SHA256>
//   v1.<expiry>.<HMAC>   older admin-only sessions, still accepted as admin until they expire
// Both are signed with SITE_PASSWORD, so changing it signs everyone out.

export const COOKIE = 'ds_session';
export const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64url(buf) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function hmac(key, message) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', k, enc.encode(message)));
}

export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The admin password check: compare MACs rather than raw strings, so timing doesn't leak the password. */
export async function passwordMatches(input, password) {
  const [a, b] = await Promise.all([hmac('ds-login-check', String(input ?? '')), hmac('ds-login-check', String(password))]);
  return safeEqual(a, b);
}

/**
 * @param {string} secret SITE_PASSWORD
 * @param {{ role: 'admin' | 'sales', userId?: string, version?: string }} who
 */
export async function createSession(secret, who = { role: 'admin' }, now = Date.now()) {
  const payload = b64url(enc.encode(JSON.stringify({ r: who.role, u: who.userId ?? '', v: who.version ?? '', e: Math.floor(now / 1000) + MAX_AGE })));
  return `v2.${payload}.${await hmac(secret, `ds-session.v2.${payload}`)}`;
}

/** @returns {Promise<{ role: 'admin' | 'sales', userId: string, version: string } | null>} */
export async function verifySession(token, secret, now = Date.now()) {
  const parts = String(token ?? '').split('.');
  if (parts[0] === 'v1' && parts.length === 3) {
    const exp = Number(parts[1]);
    if (!Number.isFinite(exp) || exp * 1000 <= now) return null;
    return safeEqual(parts[2], await hmac(secret, `ds-session.v1.${exp}`)) ? { role: 'admin', userId: '', version: '' } : null;
  }
  if (parts[0] !== 'v2' || parts.length !== 3) return null;
  if (!safeEqual(parts[2], await hmac(secret, `ds-session.v2.${parts[1]}`))) return null;
  let p;
  try {
    p = JSON.parse(dec.decode(fromB64url(parts[1])));
  } catch {
    return null;
  }
  if (!p || !Number.isFinite(p.e) || p.e * 1000 <= now) return null;
  if (p.r === 'admin') return { role: 'admin', userId: '', version: '' };
  if (p.r === 'sales' && typeof p.u === 'string' && p.u) return { role: 'sales', userId: p.u, version: String(p.v ?? '') };
  return null;
}

export function readCookie(request, name = COOKIE) {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/** Only allow same-site relative paths as post-login destinations. */
export function safeNext(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/home';
  if (value.startsWith('/login') || value.startsWith('/logout') || value.startsWith('/api/')) return '/home';
  return value;
}

export const sessionCookie = (token) => `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`;
export const clearCookie = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

/* ------------------------------------------------------------------ */
/* Salesperson passwords: PBKDF2-SHA256                                */
/* ------------------------------------------------------------------ */

const ITERATIONS = 100_000;

/** @returns {Promise<{ salt: string, hash: string, iterations: number }>} */
export async function hashPassword(password, salt = b64url(crypto.getRandomValues(new Uint8Array(16))), iterations = ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations }, key, 256);
  return { salt, hash: b64url(bits), iterations };
}

export async function verifyPassword(password, stored) {
  if (!stored?.salt || !stored?.hash) return false;
  const { hash } = await hashPassword(password, stored.salt, stored.iterations || ITERATIONS);
  return safeEqual(hash, stored.hash);
}
