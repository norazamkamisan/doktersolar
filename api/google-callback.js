// Vercel Function: Google sends the admin back here after the consent screen.
//   GET /api/google-callback?code=…&state=…  → saves the connection, back to Settings
// Register https://<site>/api/google-callback as an authorised redirect URI on the OAuth client.
import { driveConfig, readFile, writeFile } from '../server/drive-store.mjs';
import { parseData } from '../server/data-merge.mjs';
import { exchangeCode, oauthConfig } from '../server/google-photos.mjs';
import { sessionOf } from '../server/auth.mjs';
import { hmac, safeEqual } from '../server/session.mjs';

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

export async function checkState(state, secret, now = Date.now()) {
  const [t, sig] = String(state ?? '').split('.');
  const age = now - Number(t);
  if (!sig || !Number.isFinite(age) || age < 0 || age > STATE_MAX_AGE_MS) return false;
  return safeEqual(sig, await hmac(secret, `ds-google-state.${t}`));
}

const back = (msg) => new Response(null, { status: 303, headers: { Location: `/settings?photos=${encodeURIComponent(msg)}#photos`, 'Cache-Control': 'no-store' } });

export async function GET(request) {
  const url = new URL(request.url);
  const me = await sessionOf(request);
  if (!me || me.role !== 'admin') return back('Sign in as the admin, then connect again.');
  if (url.searchParams.get('error')) return back(`Google said: ${url.searchParams.get('error')}. Nothing was changed.`);
  if (!(await checkState(url.searchParams.get('state'), process.env.SITE_PASSWORD ?? 'dev'))) return back('That connection link expired. Please try again.');
  const oauth = oauthConfig();
  const drive = driveConfig();
  if (!oauth || !drive) return back('Google Drive is not fully set up in Vercel.');
  try {
    const { refreshToken, email } = await exchangeCode(oauth, request, url.searchParams.get('code'));
    const data = parseData(await readFile(drive));
    data.google = { refreshToken, email, connectedAt: new Date().toISOString() };
    await writeFile(drive, JSON.stringify(data));
    return back('connected');
  } catch (err) {
    return back(err.message);
  }
}
