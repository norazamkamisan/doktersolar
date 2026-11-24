// Vercel Function: site visit photos in the owner's Google Drive (server/google-photos.mjs).
//   GET    /api/photos?project=ID               → { connected, photos: [{ slot, fileId, modifiedTime }] }
//   GET    /api/photos?project=ID&file=FILE_ID  → the JPEG
//   POST   /api/photos?project=ID&slot=KEY&label=…  (body: the JPEG, ≤ 4 MB) → { fileId }
//   DELETE /api/photos?project=ID&slot=KEY      → moves it to the Drive bin
// Behind the site login; salespeople only for their own projects.
import { driveConfig, readFile } from '../server/drive-store.mjs';
import { parseData } from '../server/data-merge.mjs';
import { canSeeProject } from '../server/access.mjs';
import { SIGNED_OUT, json, sessionOf, stillValid } from '../server/auth.mjs';
import { getPhoto, listPhotos, oauthConfig, putPhoto, trashPhoto } from '../server/google-photos.mjs';

const MAX_BYTES = 4 * 1024 * 1024; // Vercel's request limit is 4.5 MB
const SLOT = /^[A-Za-z0-9_-]{1,40}$/;

/** Who is asking, the project, and the Google connection, or an error response. */
async function context(request) {
  const me = await sessionOf(request);
  if (!me) return { res: json(401, SIGNED_OUT) };
  const drive = driveConfig();
  const oauth = oauthConfig();
  if (!drive) return { res: json(503, { error: 'Google Drive storage is not set up.' }) };
  const data = parseData(await readFile(drive));
  if (!stillValid(me, data)) return { res: json(401, SIGNED_OUT) };
  const url = new URL(request.url);
  const projectId = url.searchParams.get('project') ?? '';
  const project = data.projects.find((p) => p?.id === projectId);
  const google = data.google?.refreshToken && oauth ? data.google : null;
  if (!google) return { res: json(200, { connected: false, photos: [] }), notConnected: true };
  // a project not uploaded yet (just created offline): try again later
  if (!project) return { res: json(404, { error: 'Project not saved yet.' }) };
  if (!canSeeProject(project, me)) return { res: json(403, { error: 'Not your project.' }) };
  return { url, project, google, oauth };
}

export async function GET(request) {
  try {
    const c = await context(request);
    if (c.res) return c.res;
    const fileId = c.url.searchParams.get('file');
    if (fileId) {
      const bytes = await getPhoto(c.oauth, c.google, fileId, c.project.id);
      if (!bytes) return json(404, { error: 'Photo not found.' });
      return new Response(bytes, { status: 200, headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400' } });
    }
    return json(200, { connected: true, photos: await listPhotos(c.oauth, c.google, c.project.id) });
  } catch (err) {
    return json(502, { error: err.message });
  }
}

export async function POST(request) {
  try {
    const c = await context(request);
    if (c.notConnected) return json(409, { error: 'Google Drive is not connected for photos.' });
    if (c.res) return c.res;
    const slot = c.url.searchParams.get('slot') ?? '';
    if (!SLOT.test(slot)) return json(400, { error: 'Bad photo slot.' });
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length) return json(400, { error: 'Empty photo.' });
    if (bytes.length > MAX_BYTES) return json(413, { error: 'Photo is too large.' });
    const label = (c.url.searchParams.get('label') ?? slot).slice(0, 80);
    const fileId = await putPhoto(c.oauth, c.google, c.project, slot, bytes, label);
    return json(200, { fileId });
  } catch (err) {
    return json(502, { error: err.message });
  }
}

export async function DELETE(request) {
  try {
    const c = await context(request);
    if (c.notConnected) return json(200, { ok: true });
    if (c.res) return c.res;
    const slot = c.url.searchParams.get('slot') ?? '';
    if (!SLOT.test(slot)) return json(400, { error: 'Bad photo slot.' });
    await trashPhoto(c.oauth, c.google, c.project.id, slot);
    return json(200, { ok: true });
  } catch (err) {
    return json(502, { error: err.message });
  }
}
