// Salesperson logins: sessions, passwords, who sees what, and the API functions against a fake
// Google Drive (no network). Run with: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createSession, hashPassword, verifyPassword, verifySession } from '../server/session.mjs';
import { allowedChanges, findLogin, validLoginId, visibleData } from '../server/access.mjs';
import { applyChanges, emptyData, parseData } from '../server/data-merge.mjs';
import { POST as loginPost } from '../api/login.js';
import { GET as dataGet, POST as dataPost } from '../api/data.js';
import { DELETE as usersDelete, GET as usersGet, POST as usersPost } from '../api/users.js';

const SECRET = 'site-password-for-tests';
const SITE = 'https://doktersolar.example';
const p = (id, salespersonId, extra = {}) => ({ id, salespersonId, updatedAt: '2026-11-01T00:00:00.000Z', ...extra });

/* ------------------------------------------------------------------ */
/* Fake Google Drive: one file held in memory                          */
/* ------------------------------------------------------------------ */

let driveText = '';
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });

beforeEach(() => {
  process.env.SITE_PASSWORD = SECRET;
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({ client_email: 'robot@example.iam.gserviceaccount.com', private_key: privateKey });
  process.env.DRIVE_FILE_ID = 'file123';
  driveText = '';
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('oauth2.googleapis.com/token')) return Response.json({ access_token: 'tok', expires_in: 3600 });
    if (u.includes('/upload/drive/v3/files/file123')) {
      driveText = String(init.body);
      return Response.json({ id: 'file123' });
    }
    if (u.includes('/drive/v3/files/file123')) return new Response(driveText, { status: 200 });
    return new Response('not found', { status: 404 });
  };
});

const cookieFor = async (who) => `ds_session=${await createSession(SECRET, who)}`;
const req = (path, cookie, init = {}) => new Request(SITE + path, { ...init, headers: { ...(init.headers ?? {}), ...(cookie ? { cookie } : {}) } });
const login = (loginId, password) => loginPost(new Request(SITE + '/api/login', { method: 'POST', body: new URLSearchParams({ loginId, password, next: '/home' }) }));
const sessionFrom = (res) => res.headers.get('set-cookie')?.split(';')[0];

/* ------------------------------------------------------------------ */
/* Pure parts                                                          */
/* ------------------------------------------------------------------ */

test('sessions carry the role and user, and reject tampering', async () => {
  const token = await createSession(SECRET, { role: 'sales', userId: 'sp1', version: 'v1x' });
  assert.deepEqual(await verifySession(token, SECRET), { role: 'sales', userId: 'sp1', version: 'v1x' });
  const [v, payload, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ r: 'admin', u: '', v: '', e: 9999999999 })).toString('base64url');
  assert.equal(await verifySession(`${v}.${forged}.${sig}`, SECRET), null); // can't promote yourself to admin
  assert.equal(await verifySession(`${v}.${payload}.${sig}`, 'other-secret'), null);
});

test('passwords are hashed with a salt and verified', async () => {
  const a = await hashPassword('hunter22');
  const b = await hashPassword('hunter22');
  assert.notEqual(a.hash, b.hash); // different salts
  assert.equal(await verifyPassword('hunter22', a), true);
  assert.equal(await verifyPassword('hunter23', a), false);
  assert.equal(await verifyPassword('x', null), false);
});

test('login IDs', () => {
  assert.equal(validLoginId('ija'), null);
  assert.match(validLoginId('admin'), /reserved/);
  assert.match(validLoginId('a'), /2–40/);
  assert.match(validLoginId('has space'), /2–40/);
  assert.equal(findLogin([{ id: 'x', loginId: 'Ija' }], ' IJA ')?.id, 'x');
  assert.equal(findLogin([{ id: 'x', loginId: 'ija' }], ''), null);
});

test('salespeople see only their own projects, and never the logins', () => {
  const data = { ...emptyData(), projects: [p('a', 'sp1'), p('b', 'sp2'), p('c', undefined)], users: [{ id: 'sp1', hash: 'secret' }] };
  const mine = visibleData(data, { role: 'sales', userId: 'sp1' });
  assert.deepEqual(mine.projects.map((x) => x.id), ['a']);
  assert.equal('users' in mine, false);
  const all = visibleData(data, { role: 'admin' });
  assert.equal(all.projects.length, 3);
  assert.equal('users' in all, false);
});

test("salespeople can't change settings, or others' projects", () => {
  const data = { ...emptyData(), projects: [p('a', 'sp1'), p('b', 'sp2')] };
  const me = { role: 'sales', userId: 'sp1' };
  const { changes, rejected } = allowedChanges(
    data,
    {
      upsert: [p('a', 'sp1', { v: 2 }), p('new', 'sp1'), p('b', 'sp1') /* take over */, p('x', 'sp2') /* for someone else */],
      remove: ['a', 'b', 'nope'],
      settings: { companyName: 'Hacked' },
    },
    me,
  );
  assert.deepEqual(changes.upsert.map((x) => x.id), ['a', 'new']);
  assert.deepEqual(changes.remove, ['a']);
  assert.equal(changes.settings, undefined);
  assert.deepEqual(rejected.sort(), ['b', 'b', 'nope', 'x'].sort());
});

test('login records survive merges', () => {
  const data = { ...emptyData(), users: [{ id: 'sp1', loginId: 'ija' }] };
  const next = applyChanges(data, { upsert: [p('a', 'sp1')] });
  assert.deepEqual(next.users, data.users);
  assert.deepEqual(parseData(JSON.stringify(next)).users, data.users);
});

/* ------------------------------------------------------------------ */
/* API functions with the fake Drive                                   */
/* ------------------------------------------------------------------ */

test('admin creates a login; the salesperson signs in and sees only their projects', async () => {
  driveText = JSON.stringify(applyChanges(emptyData(), { upsert: [p('a', 'sp1'), p('b', 'sp2'), p('c')] }));
  const admin = await cookieFor({ role: 'admin' });

  // admin sets up a login for salesperson sp1
  let res = await usersPost(req('/api/users', admin, { method: 'POST', body: JSON.stringify({ id: 'sp1', loginId: 'ija', password: 'secret1' }) }));
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).users, [{ id: 'sp1', loginId: 'ija', hasPassword: true }]);
  assert.doesNotMatch(driveText, /secret1/); // only a hash is stored

  // wrong password, then right one
  res = await login('ija', 'nope');
  assert.equal(res.headers.get('location'), '/login?error=1&next=%2Fhome');
  res = await login('IJA', 'secret1');
  assert.equal(res.status, 303);
  const sales = sessionFrom(res);
  assert.ok(sales);

  // sees only project a; no login records in the response
  res = await dataGet(req('/api/data', sales));
  const body = await res.json();
  assert.deepEqual(body.projects.map((x) => x.id), ['a']);
  assert.deepEqual(body.me, { role: 'sales', salespersonId: 'sp1' });
  assert.equal('users' in body, false);

  // can save their own project, not someone else's
  res = await dataPost(req('/api/data', sales, { method: 'POST', body: JSON.stringify({ upsert: [p('a', 'sp1', { name: 'mine' }), p('b', 'sp1')], settings: { x: 1 } }) }));
  assert.deepEqual((await res.json()).rejected, ['b']);
  const stored = parseData(driveText);
  assert.equal(stored.projects.find((x) => x.id === 'a').name, 'mine');
  assert.equal(stored.projects.find((x) => x.id === 'b').salespersonId, 'sp2');
  assert.equal(stored.settings, null);

  // salespeople can't manage logins
  assert.equal((await usersGet(req('/api/users', sales))).status, 403);

  // the admin still sees everything
  res = await dataGet(req('/api/data', admin));
  assert.equal((await res.json()).projects.length, 3);
});

test('changing a password or removing a login signs the salesperson out', async () => {
  driveText = JSON.stringify(emptyData());
  const admin = await cookieFor({ role: 'admin' });
  await usersPost(req('/api/users', admin, { method: 'POST', body: JSON.stringify({ id: 'sp1', loginId: 'ija', password: 'secret1' }) }));
  const sales = sessionFrom(await login('ija', 'secret1'));
  assert.equal((await dataGet(req('/api/data', sales))).status, 200);

  await usersPost(req('/api/users', admin, { method: 'POST', body: JSON.stringify({ id: 'sp1', loginId: 'ija', password: 'secret2' }) }));
  assert.equal((await dataGet(req('/api/data', sales))).status, 401);
  assert.equal(sessionFrom(await login('ija', 'secret1')), undefined); // old password no longer works

  const again = sessionFrom(await login('ija', 'secret2'));
  await usersDelete(req('/api/users?id=sp1', admin, { method: 'DELETE' }));
  assert.equal((await dataGet(req('/api/data', again))).status, 401);
});

test('login IDs must be unique and valid; passwords at least 6 characters', async () => {
  driveText = JSON.stringify(emptyData());
  const admin = await cookieFor({ role: 'admin' });
  const post = (b) => usersPost(req('/api/users', admin, { method: 'POST', body: JSON.stringify(b) }));
  assert.equal((await post({ id: 'sp1', loginId: 'ija', password: 'secret1' })).status, 200);
  assert.equal((await post({ id: 'sp2', loginId: 'IJA', password: 'secret2' })).status, 409);
  assert.equal((await post({ id: 'sp2', loginId: 'admin', password: 'secret2' })).status, 400);
  assert.equal((await post({ id: 'sp2', loginId: 'amin', password: '123' })).status, 400);
  assert.equal((await post({ id: 'sp2', loginId: 'amin' })).status, 400); // new login needs a password
});

test('the admin signs in with the site password, with or without "admin" as login ID', async () => {
  for (const id of ['', 'admin', 'Admin']) {
    const res = await login(id, SECRET);
    assert.equal(res.status, 303);
    assert.deepEqual(await verifySession(sessionFrom(res).split('=')[1], SECRET), { role: 'admin', userId: '', version: '' });
  }
  assert.equal(sessionFrom(await login('admin', 'wrong')), undefined);
});
