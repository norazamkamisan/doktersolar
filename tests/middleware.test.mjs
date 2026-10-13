// Tests for middleware.js (password protection). Run with: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import middleware, { createSession, isPublicPath, safeNext, verifySession } from '../middleware.js';

const PASSWORD = 'test-password-for-unit-tests';
const SITE = 'https://doktersolar.example';

const isPassThrough = (res) => res.headers.get('x-middleware-next') === '1';
const get = (path, cookie) => middleware(new Request(SITE + path, { headers: cookie ? { cookie } : {} }));
const postLogin = (password, next = '/home') =>
  middleware(new Request(SITE + '/api/login', { method: 'POST', body: new URLSearchParams({ password, next }) }));

beforeEach(() => {
  process.env.SITE_PASSWORD = PASSWORD;
});

test('public paths pass through without a session', async () => {
  for (const path of ['/proposals/demo-3', '/proposals/demo-3/', '/assets/index-abc.js', '/favicon.svg', '/_vercel/insights/script.js']) {
    assert.ok(isPassThrough(await get(path)), path);
  }
});

test('the proposals list is not public, only single proposals are', () => {
  assert.equal(isPublicPath('/proposals'), false);
  assert.equal(isPublicPath('/proposals/'), false);
  assert.equal(isPublicPath('/proposals/demo-3'), true);
  assert.equal(isPublicPath('/proposals/demo-3/extra'), false);
});

test('protected pages redirect to /login and keep the destination', async () => {
  const res = await get('/projects/demo-3/design?x=1');
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/login?next=' + encodeURIComponent('/projects/demo-3/design?x=1'));
});

test('protected APIs return 401 JSON instead of redirecting', async () => {
  const res = await get('/api/pvwatts?lat=1&lon=1&system_capacity=1');
  assert.equal(res.status, 401);
  assert.match(res.headers.get('content-type'), /json/);
});

test('login page renders with the escaped destination', async () => {
  const res = await get('/login?next=' + encodeURIComponent('/home"><script>'));
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /name="password"/);
  assert.doesNotMatch(body, /<script>/); // unsafe "next" values are replaced with /home
});

test('wrong password redirects back with an error and sets no cookie', async () => {
  const res = await postLogin('nope', '/projects');
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/login?error=1&next=%2Fprojects');
  assert.equal(res.headers.get('set-cookie'), null);
});

test('correct password sets a secure session cookie and redirects to next', async () => {
  const res = await postLogin(PASSWORD, '/projects/demo-3/energy');
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/projects/demo-3/energy');
  const cookie = res.headers.get('set-cookie');
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert.ok(cookie.includes(flag), flag);

  const session = cookie.split(';')[0];
  assert.ok(isPassThrough(await get('/projects/demo-3/energy', session)));
  assert.ok(isPassThrough(await get('/api/pvwatts', session)));
});

test('signed-in users visiting /login are sent on to the app', async () => {
  const session = `ds_session=${await createSession(PASSWORD)}`;
  const res = await get('/login?next=%2Fsettings', session);
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/settings');
});

test('logout clears the cookie', async () => {
  const res = await get('/logout');
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/login');
  assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
});

test('sessions are rejected when tampered with, expired, or the password changes', async () => {
  const token = await createSession(PASSWORD);
  assert.equal(await verifySession(token, PASSWORD), true);
  assert.equal(await verifySession(token.slice(0, -2) + 'xx', PASSWORD), false);
  assert.equal(await verifySession(token, 'a-new-password'), false);
  assert.equal(await verifySession(token, PASSWORD, Date.now() + 31 * 24 * 3600 * 1000), false);
  assert.equal(await verifySession('garbage', PASSWORD), false);
  assert.equal(await verifySession(null, PASSWORD), false);
});

test('open-redirect attempts fall back to /home', () => {
  for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/api/login', '/logout', null]) {
    assert.equal(safeNext(bad), '/home', String(bad));
  }
  assert.equal(safeNext('/projects?q=a'), '/projects?q=a');
});

test('without SITE_PASSWORD the site fails closed', async () => {
  delete process.env.SITE_PASSWORD;
  assert.equal((await get('/home')).status, 503);
  assert.equal((await get('/api/pvwatts')).status, 503);
  assert.ok(isPassThrough(await get('/proposals/demo-3'))); // shared proposals still work
});
