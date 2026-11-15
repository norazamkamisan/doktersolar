// Works out who is calling an API function from the session cookie (see server/session.mjs).
import { readCookie, verifySession } from './session.mjs';

export const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });

/** The signed-in user from the cookie, or null. Salespeople still need checking against the data file (`stillValid`). */
export async function sessionOf(request) {
  const secret = process.env.SITE_PASSWORD;
  // Local development (`vercel dev` without a password) is open, as the middleware leaves it.
  if (!secret) return { role: 'admin', userId: '', version: '' };
  return verifySession(readCookie(request), secret);
}

/** A salesperson's session ends when their login is removed or its password / login ID changes. */
export function stillValid(me, data) {
  if (!me) return false;
  if (me.role === 'admin') return true;
  const u = (data.users ?? []).find((x) => x.id === me.userId);
  return !!u && u.ver === me.version;
}

export const SIGNED_OUT = { error: 'Signed out. Reload the page to sign in again.' };
