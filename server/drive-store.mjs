// Reads and writes the shared data file in Google Drive with a service account.
//
// Environment (Vercel → Project → Settings → Environment Variables):
//   GOOGLE_SERVICE_ACCOUNT_KEY  the service account's JSON key, pasted whole
//   DRIVE_FILE_ID               id of the data file in your Drive, shared with the service
//                               account's email as Editor
//
// The file is created and owned by you (so it uses your Drive storage and keeps version
// history); the service account only edits it. No Google libraries needed: the OAuth token
// comes from a JWT signed with node:crypto.

import { createSign } from 'node:crypto';

const SCOPE = 'https://www.googleapis.com/auth/drive';
let cachedToken = null; // { token, expiresAt }

export function driveConfig() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const fileId = process.env.DRIVE_FILE_ID?.trim();
  if (!keyJson || !fileId) return null;
  let key;
  try {
    key = JSON.parse(keyJson);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON. Paste the whole key file.');
  }
  if (!key.client_email || !key.private_key) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is missing client_email or private_key.');
  return { key, fileId };
}

const b64url = (input) => Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function accessToken(key) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = key.token_uri || 'https://oauth2.googleapis.com/token';
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(
    JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: tokenUri, iat: now, exp: now + 3600 }),
  )}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(key.private_key);
  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(signature)}` }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`Google sign-in failed: ${body.error_description || body.error || res.status}`);
  cachedToken = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

async function driveError(res, action) {
  const body = await res.json().catch(() => ({}));
  const reason = body.error?.message || res.statusText;
  if (res.status === 404) return new Error(`Drive file not found. Check DRIVE_FILE_ID and that the file is shared with the service account (${action}).`);
  if (res.status === 403) return new Error(`No permission to ${action} the Drive file. Share it with the service account as Editor. (${reason})`);
  return new Error(`Google Drive ${action} failed (${res.status}): ${reason}`);
}

export async function readFile({ key, fileId }) {
  const token = await accessToken(key);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw await driveError(res, 'read');
  return res.text();
}

export async function writeFile({ key, fileId }, text) {
  const token = await accessToken(key);
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media&supportsAllDrives=true&fields=id`,
    { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: text },
  );
  if (!res.ok) throw await driveError(res, 'save');
}
