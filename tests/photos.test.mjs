// Site visit photos in Google Drive: connecting, uploading, listing, downloading and who may do
// what, against a fake Google (no network). Run with: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createSession } from '../server/session.mjs';
import { applyChanges, emptyData, parseData } from '../server/data-merge.mjs';
import { visibleData } from '../server/access.mjs';
import { GET as connectGet, makeState } from '../api/google-connect.js';
import { GET as callbackGet, checkState } from '../api/google-callback.js';
import { DELETE as photoDelete, GET as photoGet, POST as photoPost } from '../api/photos.js';
import { GET as dataGet } from '../api/data.js';

const SECRET = 'site-password-for-tests';
const SITE = 'https://doktersolar.example';
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });

/* ------------------------------------------------------------------ */
/* Fake Google: the data file, OAuth and the user's Drive              */
/* ------------------------------------------------------------------ */

let dataText;
let files; // id → { name, mimeType, parents, appProperties, trashed, bytes }
let nextId;
let lastAuthCode;

function matches(f, q) {
  if (/trashed=false/.test(q) && f.trashed) return false;
  if (/mimeType='application\/vnd\.google-apps\.folder'/.test(q) && f.mimeType !== 'application/vnd.google-apps.folder') return false;
  for (const [, k, v] of q.matchAll(/key='([^']+)' and value='([^']+)'/g)) if (f.appProperties?.[k] !== v) return false;
  return true;
}

async function parseMultipart(body) {
  const buf = new Uint8Array(await body.arrayBuffer());
  const text = new TextDecoder('latin1').decode(buf);
  const boundary = text.slice(2, text.indexOf('\r\n'));
  const jsonStart = text.indexOf('\r\n\r\n') + 4;
  const meta = JSON.parse(text.slice(jsonStart, text.indexOf(`\r\n--${boundary}`, jsonStart)));
  const imgHead = text.indexOf('\r\n\r\n', text.indexOf(`--${boundary}`, jsonStart)) + 4;
  const imgEnd = text.lastIndexOf(`\r\n--${boundary}--`);
  return { meta, bytes: buf.slice(imgHead, imgEnd) };
}

beforeEach(() => {
  process.env.SITE_PASSWORD = SECRET;
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({ client_email: 'robot@example.iam.gserviceaccount.com', private_key: privateKey });
  process.env.DRIVE_FILE_ID = 'file123';
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'client-id';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'client-secret';
  dataText = JSON.stringify(applyChanges(emptyData(), { upsert: [{ id: 'a', customerName: 'Aminah', salespersonId: 'sp1', updatedAt: '2026-11-01' }, { id: 'b', customerName: 'Bala', salespersonId: 'sp2', updatedAt: '2026-11-01' }] }));
  files = new Map();
  nextId = 1;
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url));
    const method = init.method ?? 'GET';
    if (u.href.startsWith('https://oauth2.googleapis.com/token')) {
      const p = new URLSearchParams(String(init.body));
      if (p.get('grant_type') === 'authorization_code') {
        lastAuthCode = p.get('code');
        const idToken = `x.${Buffer.from(JSON.stringify({ email: 'owner@example.com' })).toString('base64url')}.y`;
        return Response.json({ access_token: 'user-tok', refresh_token: 'refresh-1', expires_in: 3600, id_token: idToken });
      }
      return Response.json({ access_token: p.get('grant_type') === 'refresh_token' ? 'user-tok' : 'robot-tok', expires_in: 3600 });
    }
    // the shared data file (service account)
    if (u.pathname === '/upload/drive/v3/files/file123') return (dataText = String(init.body)), Response.json({ id: 'file123' });
    if (u.pathname === '/drive/v3/files/file123') return new Response(dataText);
    // the user's photos (OAuth)
    assert.equal(init.headers?.Authorization, 'Bearer user-tok', 'photos use the owner’s token');
    if (u.pathname === '/drive/v3/files' && method === 'GET') {
      const q = u.searchParams.get('q');
      const list = [...files.entries()].filter(([, f]) => matches(f, q)).map(([id, f]) => ({ id, name: f.name, appProperties: f.appProperties, modifiedTime: '2026-11-24T00:00:00Z' }));
      return Response.json({ files: list.slice(0, Number(u.searchParams.get('pageSize') ?? 100)) });
    }
    if (u.pathname === '/drive/v3/files' && method === 'POST') {
      const id = `f${nextId++}`;
      files.set(id, { ...JSON.parse(String(init.body)), trashed: false });
      return Response.json({ id });
    }
    if (u.pathname === '/upload/drive/v3/files' && method === 'POST') {
      const { meta, bytes } = await parseMultipart(init.body);
      const id = `f${nextId++}`;
      files.set(id, { ...meta, bytes, trashed: false });
      return Response.json({ id });
    }
    const up = u.pathname.match(/^\/upload\/drive\/v3\/files\/(\w+)$/);
    if (up && method === 'PATCH') {
      const { bytes } = await parseMultipart(init.body);
      files.get(up[1]).bytes = bytes;
      return Response.json({ id: up[1] });
    }
    const one = u.pathname.match(/^\/drive\/v3\/files\/(\w+)$/);
    if (one) {
      const f = files.get(one[1]);
      if (!f) return new Response('{}', { status: 404 });
      if (method === 'PATCH') return Object.assign(f, JSON.parse(String(init.body))), Response.json({ id: one[1] });
      if (u.searchParams.get('alt') === 'media') return new Response(f.bytes);
      return Response.json({ appProperties: f.appProperties, trashed: f.trashed });
    }
    return new Response('unexpected ' + u.href, { status: 500 });
  };
});

const cookie = async (who) => `ds_session=${await createSession(SECRET, who)}`;
const req = (path, c, init = {}) => new Request(SITE + path, { ...init, headers: { ...(init.headers ?? {}), ...(c ? { cookie: c } : {}) } });
const jpeg = (n) => new Uint8Array([0xff, 0xd8, n, 1, 2, 3, 0x0d, 0x0a, 0xff, 0xd9]);

async function connect() {
  const admin = await cookie({ role: 'admin' });
  const res = await connectGet(req('/api/google-connect', admin));
  const loc = new URL(res.headers.get('location'));
  assert.equal(loc.origin, 'https://accounts.google.com');
  assert.equal(loc.searchParams.get('redirect_uri'), `${SITE}/api/google-callback`);
  assert.match(loc.searchParams.get('scope'), /drive\.file/);
  const back = await callbackGet(req(`/api/google-callback?code=abc&state=${encodeURIComponent(loc.searchParams.get('state'))}`, admin));
  assert.equal(back.headers.get('location'), '/settings?photos=connected#photos');
  return admin;
}

test('the admin connects Google Drive; the token stays on the server', async () => {
  const admin = await connect();
  assert.equal(lastAuthCode, 'abc');
  assert.equal(parseData(dataText).google.refreshToken, 'refresh-1');
  const body = await (await dataGet(req('/api/data', admin))).json();
  assert.deepEqual(body.photos, { connected: true, email: 'owner@example.com' });
  assert.doesNotMatch(JSON.stringify(body), /refresh-1/);
  const sales = await (await dataGet(req('/api/data', await cookie({ role: 'sales', userId: 'sp1', version: '' })))).json().catch(() => null);
  assert.equal(JSON.stringify(sales ?? {}).includes('refresh-1'), false);
});

test('callbacks with a forged or old state are refused', async () => {
  assert.equal(await checkState(await makeState(SECRET), SECRET), true);
  assert.equal(await checkState(await makeState('other'), SECRET), false);
  assert.equal(await checkState(await makeState(SECRET, Date.now() - 11 * 60 * 1000), SECRET), false);
  const admin = await cookie({ role: 'admin' });
  const res = await callbackGet(req('/api/google-callback?code=abc&state=123.forged', admin));
  assert.match(res.headers.get('location'), /expired/);
  assert.equal(parseData(dataText).google, undefined);
});

test('salespeople cannot connect Google Drive', async () => {
  const sales = await cookie({ role: 'sales', userId: 'sp1', version: '' });
  assert.match((await connectGet(req('/api/google-connect', sales))).headers.get('location'), /Only%20the%20admin/);
});

test('photos upload into a project folder, list, download, replace and go to the bin', async () => {
  const admin = await connect();
  const up = (n) => photoPost(req('/api/photos?project=a&slot=front&label=Front%20view', admin, { method: 'POST', body: jpeg(n) }));
  const first = await (await up(1)).json();
  assert.ok(first.fileId);
  const folder = [...files.values()].find((f) => f.appProperties?.ds === 'project');
  assert.equal(folder.name, 'Aminah (a)');
  assert.equal(files.get(first.fileId).name, 'Front view.jpg');

  let list = await (await photoGet(req('/api/photos?project=a', admin))).json();
  assert.deepEqual(list.photos.map((p) => p.slot), ['front']);
  const bytes = new Uint8Array(await (await photoGet(req(`/api/photos?project=a&file=${first.fileId}`, admin))).arrayBuffer());
  assert.deepEqual([...bytes], [...jpeg(1)]);

  // replacing keeps the same file
  const second = await (await up(2)).json();
  assert.equal(second.fileId, first.fileId);
  assert.deepEqual([...files.get(first.fileId).bytes], [...jpeg(2)]);

  await photoDelete(req('/api/photos?project=a&slot=front', admin, { method: 'DELETE' }));
  assert.equal(files.get(first.fileId).trashed, true);
  list = await (await photoGet(req('/api/photos?project=a', admin))).json();
  assert.deepEqual(list.photos, []);
});

test("salespeople only reach their own projects' photos", async () => {
  const admin = await connect();
  const theirs = await (await photoPost(req('/api/photos?project=b&slot=front', admin, { method: 'POST', body: jpeg(9) }))).json();
  const sp1 = await cookie({ role: 'sales', userId: 'sp1', version: '' });
  // stillValid needs their login record
  const d = parseData(dataText);
  d.users = [{ id: 'sp1', loginId: 'ija', ver: '' }];
  dataText = JSON.stringify(d);

  assert.equal((await photoPost(req('/api/photos?project=a&slot=front', sp1, { method: 'POST', body: jpeg(3) }))).status, 200);
  assert.equal((await photoPost(req('/api/photos?project=b&slot=front', sp1, { method: 'POST', body: jpeg(3) }))).status, 403);
  assert.equal((await photoGet(req('/api/photos?project=b', sp1))).status, 403);
  // a file id from someone else's project, asked for through their own project, is refused
  assert.equal((await photoGet(req(`/api/photos?project=a&file=${theirs.fileId}`, sp1))).status, 404);
});

test('without a connection, photos report not connected and uploads are refused', async () => {
  const admin = await cookie({ role: 'admin' });
  assert.deepEqual(await (await photoGet(req('/api/photos?project=a', admin))).json(), { connected: false, photos: [] });
  assert.equal((await photoPost(req('/api/photos?project=a&slot=front', admin, { method: 'POST', body: jpeg(1) }))).status, 409);
  assert.deepEqual(visibleData(parseData(dataText), { role: 'admin' }).photos, { connected: false, email: '' });
});

test('bad slots and empty or unknown projects are refused', async () => {
  const admin = await connect();
  assert.equal((await photoPost(req('/api/photos?project=a&slot=../x', admin, { method: 'POST', body: jpeg(1) }))).status, 400);
  assert.equal((await photoPost(req('/api/photos?project=a&slot=front', admin, { method: 'POST', body: new Uint8Array() }))).status, 400);
  assert.equal((await photoPost(req('/api/photos?project=zzz&slot=front', admin, { method: 'POST', body: jpeg(1) }))).status, 404);
});
