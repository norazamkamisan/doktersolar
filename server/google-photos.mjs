// Site visit photos in the owner's Google Drive.
//
// The service account that edits the data file can't own files in a personal Drive (it has no
// storage quota), so photos are uploaded as the owner instead, with OAuth:
//   - GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET: an OAuth client (Web application) with
//     the redirect URI https://<site>/api/google-callback.
//   - The admin connects once (Settings); the refresh token is kept in the data file under
//     `google` and never sent to the app (server/access.mjs strips it).
//   - Scope drive.file: the app sees only files it created: a "DokterSolar photos" folder with one
//     subfolder per project. Each photo carries appProperties { ds: 'photo', project, slot }.

const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
export const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const ROOT_NAME = 'DokterSolar photos';
const FOLDER = 'application/vnd.google-apps.folder';

export function oauthConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export const redirectUri = (request) => `${new URL(request.url).origin}/api/google-callback`;

export function authUrl(cfg, request, state) {
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri(request),
    response_type: 'code',
    scope: `${SCOPE} openid email`,
    access_type: 'offline',
    prompt: 'consent', // always return a refresh token
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH}?${q}`;
}

async function tokenRequest(params) {
  const res = await fetch(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google sign-in failed: ${body.error_description || body.error || res.status}`);
  return body;
}

/** Exchange the code from the consent screen for tokens; returns { refreshToken, email }. */
export async function exchangeCode(cfg, request, code) {
  const body = await tokenRequest({ code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: redirectUri(request), grant_type: 'authorization_code' });
  if (!body.refresh_token) throw new Error('Google did not return a refresh token. Remove DokterSolar from your Google account’s third-party access and connect again.');
  let email = '';
  try {
    email = JSON.parse(Buffer.from(String(body.id_token).split('.')[1], 'base64url').toString()).email ?? '';
  } catch {
    /* the email is only for display */
  }
  return { refreshToken: body.refresh_token, email };
}

let cached = null; // { refreshToken, token, expiresAt }

async function accessToken(cfg, google) {
  if (cached && cached.refreshToken === google.refreshToken && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const body = await tokenRequest({ refresh_token: google.refreshToken, client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: 'refresh_token' });
  cached = { refreshToken: google.refreshToken, token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return cached.token;
}

async function api(cfg, google, url, init = {}) {
  const token = await accessToken(cfg, google);
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const reason = body.error?.message || res.statusText;
    if (res.status === 401 || /invalid_grant/.test(reason)) throw new Error('The Google Drive connection for photos has expired. Connect it again in Settings.');
    throw new Error(`Google Drive photos: ${reason} (${res.status})`);
  }
  return res;
}

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function findOne(cfg, google, q) {
  const res = await api(cfg, google, `${API}/files?${new URLSearchParams({ q, fields: 'files(id,name)', pageSize: '1', spaces: 'drive' })}`);
  return (await res.json()).files?.[0] ?? null;
}

async function createFolder(cfg, google, name, parent, appProperties) {
  const res = await api(cfg, google, `${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER, ...(parent ? { parents: [parent] } : {}), appProperties }),
  });
  return (await res.json()).id;
}

/** The "DokterSolar photos" folder, created on first use. */
async function rootFolder(cfg, google) {
  const found = await findOne(cfg, google, `mimeType='${FOLDER}' and appProperties has { key='ds' and value='root' } and trashed=false`);
  return found?.id ?? createFolder(cfg, google, ROOT_NAME, null, { ds: 'root' });
}

/** A project's subfolder, named after the customer. */
async function projectFolder(cfg, google, project) {
  const found = await findOne(cfg, google, `mimeType='${FOLDER}' and appProperties has { key='dsProject' and value='${esc(project.id)}' } and trashed=false`);
  if (found) return found.id;
  const root = await rootFolder(cfg, google);
  const name = `${project.customerName || 'Project'} (${project.id})`.replace(/[\\/]/g, '-');
  return createFolder(cfg, google, name, root, { ds: 'project', dsProject: project.id });
}

const photoQuery = (projectId, slot) =>
  `appProperties has { key='ds' and value='photo' } and appProperties has { key='dsProject' and value='${esc(projectId)}' }` +
  (slot ? ` and appProperties has { key='dsSlot' and value='${esc(slot)}' }` : '') +
  ' and trashed=false';

/** A project's photos: [{ slot, fileId, modifiedTime }]. */
export async function listPhotos(cfg, google, projectId) {
  const res = await api(cfg, google, `${API}/files?${new URLSearchParams({ q: photoQuery(projectId), fields: 'files(id,appProperties,modifiedTime)', pageSize: '100', spaces: 'drive' })}`);
  return ((await res.json()).files ?? []).map((f) => ({ slot: f.appProperties?.dsSlot, fileId: f.id, modifiedTime: f.modifiedTime })).filter((f) => f.slot);
}

/** Upload (or replace) one photo; returns the file id. */
export async function putPhoto(cfg, google, project, slot, bytes, label = slot) {
  const existing = await findOne(cfg, google, photoQuery(project.id, slot));
  const boundary = `ds${Math.random().toString(36).slice(2)}`;
  const meta = existing
    ? {}
    : { name: `${label}.jpg`.replace(/[\\/]/g, '-'), parents: [await projectFolder(cfg, google, project)], appProperties: { ds: 'photo', dsProject: project.id, dsSlot: slot } };
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`;
  const body = new Blob([head, bytes, `\r\n--${boundary}--`]);
  const url = existing ? `${UPLOAD}/files/${existing.id}?uploadType=multipart&fields=id` : `${UPLOAD}/files?uploadType=multipart&fields=id`;
  const res = await api(cfg, google, url, { method: existing ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  return (await res.json()).id;
}

/** A photo's bytes, after checking it belongs to `projectId`. */
export async function getPhoto(cfg, google, fileId, projectId) {
  const meta = await (await api(cfg, google, `${API}/files/${encodeURIComponent(fileId)}?fields=appProperties,trashed`)).json();
  if (meta.trashed || meta.appProperties?.ds !== 'photo' || meta.appProperties?.dsProject !== projectId) return null;
  const res = await api(cfg, google, `${API}/files/${encodeURIComponent(fileId)}?alt=media`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Move a project's photo in `slot` to the bin (recoverable from Drive for 30 days). */
export async function trashPhoto(cfg, google, projectId, slot) {
  const existing = await findOne(cfg, google, photoQuery(projectId, slot));
  if (!existing) return false;
  await api(cfg, google, `${API}/files/${existing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
  return true;
}
