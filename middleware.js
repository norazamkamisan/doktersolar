// Vercel Routing Middleware: password-protects the app.
//
// Runs on Vercel's edge before every request, so protected pages and APIs are
// never served without a valid session. Set SITE_PASSWORD in Vercel → Project →
// Settings → Environment Variables. Changing it signs everyone out.
//
// Public without a password:
//   /proposals/<id>   shared customer proposal links
//   /assets/*, /favicon.svg, /_vercel/*   static files and Vercel analytics
//
// Not run by `npm run dev` / `vite preview`; local development stays open.

import { next } from '@vercel/functions';

const COOKIE = 'ds_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const FAILED_LOGIN_DELAY_MS = 800; // slows down password guessing

const enc = new TextEncoder();

/* ------------------------------------------------------------------ */
/* Routing                                                             */
/* ------------------------------------------------------------------ */

export function isPublicPath(path) {
  return (
    path.startsWith('/assets/') ||
    path.startsWith('/_vercel/') ||
    path === '/favicon.svg' ||
    path === '/robots.txt' ||
    /^\/proposals\/[^/]+\/?$/.test(path) // a single shared proposal, not the /proposals list
  );
}

/** Only allow same-site relative paths as post-login destinations. */
export function safeNext(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/home';
  if (value.startsWith('/login') || value.startsWith('/logout') || value.startsWith('/api/')) return '/home';
  return value;
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (isPublicPath(path)) return next();

  const password = process.env.SITE_PASSWORD;
  if (!password) return notConfigured(path); // fail closed

  if (path === '/api/login') {
    return request.method === 'POST' ? login(request, password) : text(405, 'Method not allowed');
  }
  if (path === '/logout') return logout();

  const authed = await hasValidSession(request, password);

  if (path === '/login') {
    if (authed) return redirect(safeNext(url.searchParams.get('next')));
    return loginPage({ next: safeNext(url.searchParams.get('next')), error: url.searchParams.has('error') });
  }

  if (authed) return next();

  if (path.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Sign in required.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
  return redirect(`/login?next=${encodeURIComponent(path + url.search)}`);
}

/* ------------------------------------------------------------------ */
/* Sessions: "v1.<expiry>.<HMAC-SHA256(password, expiry)>"             */
/* ------------------------------------------------------------------ */

function b64url(buf) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(key, message) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', k, enc.encode(message)));
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSession(password, now = Date.now()) {
  const exp = Math.floor(now / 1000) + MAX_AGE;
  return `v1.${exp}.${await hmac(password, `ds-session.v1.${exp}`)}`;
}

export async function verifySession(token, password, now = Date.now()) {
  const [v, expStr, sig] = (token ?? '').split('.');
  const exp = Number(expStr);
  if (v !== 'v1' || !sig || !Number.isFinite(exp) || exp * 1000 <= now) return false;
  return safeEqual(sig, await hmac(password, `ds-session.v1.${exp}`));
}

function readCookie(request, name) {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

async function hasValidSession(request, password) {
  return verifySession(readCookie(request, COOKIE), password);
}

async function passwordMatches(input, password) {
  // Compare MACs rather than raw strings, so timing doesn't leak the password.
  const [a, b] = await Promise.all([hmac('ds-login-check', String(input)), hmac('ds-login-check', password)]);
  return safeEqual(a, b);
}

/* ------------------------------------------------------------------ */
/* Handlers                                                            */
/* ------------------------------------------------------------------ */

async function login(request, password) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return text(400, 'Bad request');
  }
  const dest = safeNext(form.get('next'));
  if (!(await passwordMatches(form.get('password') ?? '', password))) {
    await new Promise((r) => setTimeout(r, FAILED_LOGIN_DELAY_MS));
    return redirect(`/login?error=1&next=${encodeURIComponent(dest)}`);
  }
  const token = await createSession(password);
  return redirect(dest, { 'Set-Cookie': `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax` });
}

function logout() {
  return redirect('/login', { 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` });
}

function redirect(location, extra = {}) {
  return new Response(null, { status: 303, headers: { Location: location, 'Cache-Control': 'no-store', ...extra } });
}

function text(status, body) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}

function notConfigured(path) {
  if (path.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Login is not configured (SITE_PASSWORD is missing).' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
  return html(
    503,
    page(
      'Not available',
      `<h1>Login isn’t set up yet</h1>
       <p class="muted">This site is password-protected, but no password has been configured.
       The owner needs to set <code>SITE_PASSWORD</code> in the hosting settings.</p>`,
    ),
  );
}

/* ------------------------------------------------------------------ */
/* Login page (self-contained: works before the app bundle loads)      */
/* ------------------------------------------------------------------ */

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const LOGO = `<svg viewBox="0 0 32 32" width="44" height="44" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#f97316"/><circle cx="16" cy="13" r="5" fill="#fff"/><g stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M16 4v2M8 13H6M26 13h-2M9.6 6.6l1.4 1.4M22.4 6.6 21 8"/></g><path d="M8 22h16M11 26h10M16 19v9" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>`;

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} · DokterSolar</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;
    font-family:Inter,ui-sans-serif,system-ui,"Segoe UI",Roboto,sans-serif;background:#f8fafc;color:#1e293b}
  .card{width:100%;max-width:380px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px 28px;
    box-shadow:0 1px 2px rgba(15,23,42,.04),0 8px 24px rgba(15,23,42,.06)}
  .brand{display:flex;align-items:center;gap:10px;margin-bottom:24px;font-size:22px;font-weight:600;letter-spacing:-.01em;color:#0f172a}
  .brand span{color:#f97316}
  h1{margin:0 0 6px;font-size:20px;font-weight:600;color:#0f172a}
  .muted{margin:0 0 20px;font-size:14px;line-height:1.5;color:#64748b}
  label{display:block;margin-bottom:6px;font-size:12px;font-weight:500;color:#64748b}
  input{width:100%;padding:10px 12px;font:inherit;font-size:15px;border:1px solid #e2e8f0;border-radius:8px;outline:none}
  input:focus{border-color:#fb923c;box-shadow:0 0 0 3px #ffedd5}
  button{width:100%;margin-top:16px;padding:10px 14px;font:inherit;font-size:15px;font-weight:500;color:#fff;
    background:#f97316;border:0;border-radius:8px;cursor:pointer}
  button:hover{background:#ea580c}
  button:focus-visible{outline:2px solid #fb923c;outline-offset:2px}
  .error{margin:0 0 16px;padding:10px 12px;font-size:14px;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:8px}
  code{font-size:13px;background:#f1f5f9;padding:1px 5px;border-radius:4px}
  .foot{margin-top:20px;font-size:12px;color:#94a3b8;text-align:center}
</style>
</head>
<body>
<main class="card">
  <div class="brand">${LOGO}<div>Dokter<span>Solar</span></div></div>
  ${body}
</main>
</body>
</html>`;
}

function loginPage({ next: dest, error }) {
  return html(
    error ? 401 : 200,
    page(
      'Sign in',
      `<h1>Sign in</h1>
       <p class="muted">Enter the password to open the DokterSolar workspace.</p>
       ${error ? '<p class="error" role="alert">That password isn’t right. Please try again.</p>' : ''}
       <form method="post" action="/api/login">
         <input type="hidden" name="next" value="${escapeHtml(dest)}">
         <label for="password">Password</label>
         <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
         <button type="submit">Sign in</button>
       </form>
       <p class="foot">Shared proposal links open without a password.</p>`,
    ),
  );
}

function html(status, body) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY' },
  });
}
