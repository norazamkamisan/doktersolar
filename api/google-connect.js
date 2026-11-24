// Vercel Function: connect / disconnect the owner's Google Drive for site visit photos (admin only).
//   GET    /api/google-connect   → redirects to Google's consent screen
//   DELETE /api/google-connect   → forgets the connection (photos already in Drive stay there)
// See server/google-photos.mjs.
import { driveConfig, readFile, writeFile } from '../server/drive-store.mjs';
import { parseData } from '../server/data-merge.mjs';
import { authUrl, oauthConfig } from '../server/google-photos.mjs';
import { SIGNED_OUT, json, sessionOf } from '../server/auth.mjs';
import { hmac } from '../server/session.mjs';

/** A short-lived signed value that the callback checks, so only this admin's request is accepted. */
export async function makeState(secret, now = Date.now()) {
  const t = String(now);
  return `${t}.${await hmac(secret, `ds-google-state.${t}`)}`;
}

const back = (msg) => new Response(null, { status: 303, headers: { Location: `/settings?photos=${encodeURIComponent(msg)}#photos`, 'Cache-Control': 'no-store' } });

export async function GET(request) {
  const me = await sessionOf(request);
  if (!me) return json(401, SIGNED_OUT);
  if (me.role !== 'admin') return back('Only the admin can connect Google Drive.');
  const cfg = oauthConfig();
  if (!cfg) return back('GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET are not set in Vercel yet.');
  return new Response(null, { status: 303, headers: { Location: authUrl(cfg, request, await makeState(process.env.SITE_PASSWORD ?? 'dev')), 'Cache-Control': 'no-store' } });
}

export async function DELETE(request) {
  const me = await sessionOf(request);
  if (!me) return json(401, SIGNED_OUT);
  if (me.role !== 'admin') return json(403, { error: 'Only the admin can disconnect Google Drive.' });
  const cfg = driveConfig();
  if (!cfg) return json(503, { error: 'Google Drive storage is not set up.' });
  try {
    const data = parseData(await readFile(cfg));
    delete data.google;
    await writeFile(cfg, JSON.stringify(data));
    return json(200, { ok: true });
  } catch (err) {
    return json(502, { error: err.message });
  }
}
