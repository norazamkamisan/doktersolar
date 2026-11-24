// Vercel Routing Middleware: password-protects the app.
//
// Runs on Vercel's edge before every request, so protected pages and APIs are
// never served without a valid session. Set SITE_PASSWORD in Vercel → Project →
// Settings → Environment Variables. Changing it signs everyone out.
//
// Signing in happens in api/login.js: the admin with SITE_PASSWORD, salespeople with their own
// login ID and password. Sessions are checked here (server/session.mjs); what each user may see
// is enforced by the API functions (server/access.mjs).
//
// Public without a password:
//   /proposals/<id>   shared customer proposal links
//   /assets/*, /favicon.svg, /_vercel/*   static files and Vercel analytics
//   /manifest.webmanifest, /icons/*        app install details and icons (phones fetch them without the cookie)
//   /api/login                             the sign-in form posts here (api/login.js)
//   /privacy                               privacy policy (served here, linked from Google's consent screen)
//
// Not run by `npm run dev` / `vite preview`; local development stays open.

import { next } from '@vercel/functions';
import { clearCookie, createSession, readCookie, safeNext, verifySession } from './server/session.mjs';

// re-exported for the tests
export { createSession, safeNext, verifySession };

/* ------------------------------------------------------------------ */
/* Routing                                                             */
/* ------------------------------------------------------------------ */

export function isPublicPath(path) {
  return (
    path.startsWith('/assets/') ||
    path.startsWith('/_vercel/') ||
    path === '/favicon.svg' ||
    path === '/manifest.webmanifest' ||
    path.startsWith('/icons/') ||
    path === '/robots.txt' ||
    path === '/api/login' ||
    /^\/proposals\/[^/]+\/?$/.test(path) // a single shared proposal, not the /proposals list
  );
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // the privacy policy is public (Google's sign-in consent screen links to it)
  if (path === '/privacy' || path === '/privacy/') return privacyPage();
  if (isPublicPath(path)) return next();

  const password = process.env.SITE_PASSWORD;
  if (!password) return notConfigured(path); // fail closed

  if (path === '/logout') return logout();

  const authed = !!(await verifySession(readCookie(request), password));

  if (path === '/login') {
    if (authed) return redirect(safeNext(url.searchParams.get('next')));
    return loginPage({ next: safeNext(url.searchParams.get('next')), error: url.searchParams.get('error') });
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
/* Handlers                                                            */
/* ------------------------------------------------------------------ */

function logout() {
  return redirect('/login', { 'Set-Cookie': clearCookie() });
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
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#f97316">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="DokterSolar">
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
  const message =
    error === 'unavailable'
      ? 'Sign-in is unavailable right now (the data store couldn’t be reached). Please try again shortly.'
      : 'That login ID or password isn’t right. Please try again.';
  return html(
    error ? 401 : 200,
    page(
      'Sign in',
      `<h1>Sign in</h1>
       <p class="muted">Salespeople: use the login ID and password from your admin. Admin: leave Login ID empty (or type admin) and use the site password.</p>
       ${error ? `<p class="error" role="alert">${message}</p>` : ''}
       <form method="post" action="/api/login">
         <input type="hidden" name="next" value="${escapeHtml(dest)}">
         <label for="loginId">Login ID</label>
         <input id="loginId" name="loginId" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" style="margin-bottom:14px">
         <label for="password">Password</label>
         <input id="password" name="password" type="password" autocomplete="current-password" required>
         <button type="submit">Sign in</button>
       </form>
       <p class="foot">Shared proposal links open without a password.</p>`,
    ),
  );
}

function privacyPage() {
  return html(
    200,
    page(
      'Privacy policy',
      `<h1>Privacy policy</h1>
       <p class="muted">DokterSolar is a private workspace for a solar installer's own team. It is not a public service.</p>
       <h2 style="font-size:15px;margin:18px 0 6px">What it stores</h2>
       <p class="muted">Customer projects, proposals and site visit checklists entered by the team, kept in the company's own Google Drive. Site visit photos are uploaded to a "DokterSolar photos" folder in the company's Google Drive.</p>
       <h2 style="font-size:15px;margin:18px 0 6px">Google account access</h2>
       <p class="muted">When the company connects its Google Drive for photos, DokterSolar asks only for the <code>drive.file</code> permission: it can create and manage the files it makes itself, and cannot see any other files in that Drive. The connection can be removed at any time in Settings, or from the Google account's security settings.</p>
       <h2 style="font-size:15px;margin:18px 0 6px">Sharing</h2>
       <p class="muted">Data is not sold or shared with anyone. A customer sees only the proposal link they are sent.</p>
       <h2 style="font-size:15px;margin:18px 0 6px">Contact</h2>
       <p class="muted">Questions: contact the company that sent you the proposal.</p>`,
    ),
  );
}

function html(status, body) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY' },
  });
}
