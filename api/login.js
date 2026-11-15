// Vercel Function: sign in.  POST /api/login  (form: loginId, password, next)
//   - Login ID empty or "admin": the site password (SITE_PASSWORD) → admin.
//   - Otherwise a salesperson's login from the Google Drive data file → sales.
// Sets the session cookie and redirects; wrong details go back to /login?error=1.
import { driveConfig, readFile } from '../server/drive-store.mjs';
import { parseData } from '../server/data-merge.mjs';
import { findLogin } from '../server/access.mjs';
import { createSession, passwordMatches, safeNext, sessionCookie, verifyPassword } from '../server/session.mjs';

const FAILED_LOGIN_DELAY_MS = 800; // slows down password guessing

const redirect = (location, extra = {}) => new Response(null, { status: 303, headers: { Location: location, 'Cache-Control': 'no-store', ...extra } });

async function fail(dest, reason = '1') {
  await new Promise((r) => setTimeout(r, FAILED_LOGIN_DELAY_MS));
  return redirect(`/login?error=${reason}&next=${encodeURIComponent(dest)}`);
}

export async function POST(request) {
  const secret = process.env.SITE_PASSWORD;
  if (!secret) return new Response('Login is not configured (SITE_PASSWORD is missing).', { status: 503 });
  let form;
  try {
    form = await request.formData();
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const dest = safeNext(form.get('next'));
  const loginId = String(form.get('loginId') ?? '').trim();
  const password = String(form.get('password') ?? '');

  if (!loginId || loginId.toLowerCase() === 'admin') {
    if (!(await passwordMatches(password, secret))) return fail(dest);
    return redirect(dest, { 'Set-Cookie': sessionCookie(await createSession(secret, { role: 'admin' })) });
  }

  let cfg;
  try {
    cfg = driveConfig();
  } catch {
    cfg = null;
  }
  if (!cfg) return fail(dest);
  let user;
  try {
    user = findLogin(parseData(await readFile(cfg)).users, loginId);
  } catch {
    return fail(dest, 'unavailable');
  }
  if (!user || !(await verifyPassword(password, user))) return fail(dest);
  return redirect(dest, { 'Set-Cookie': sessionCookie(await createSession(secret, { role: 'sales', userId: user.id, version: user.ver })) });
}

export function GET() {
  return new Response('Method not allowed', { status: 405 });
}
