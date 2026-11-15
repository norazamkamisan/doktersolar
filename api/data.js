// Vercel Function: the shared project data, stored as one JSON file in Google Drive.
//   GET  /api/data   → { configured, me, savedAt, settings, projects, deleted }
//   POST /api/data   { upsert: Project[], remove: string[], settings? } → { ok, savedAt, rejected }
// Behind the site login (middleware.js). Salespeople see and change only their own projects
// (server/access.mjs); login records never leave the server. See server/drive-store.mjs for setup.
import { driveConfig, readFile, writeFile } from '../server/drive-store.mjs';
import { applyChanges, parseData } from '../server/data-merge.mjs';
import { allowedChanges, visibleData } from '../server/access.mjs';
import { SIGNED_OUT, json, sessionOf, stillValid } from '../server/auth.mjs';

function config() {
  try {
    return { config: driveConfig() };
  } catch (err) {
    return { error: err.message };
  }
}

const meOut = (me) => ({ role: me.role, salespersonId: me.userId || null });

export async function GET(request) {
  const me = await sessionOf(request);
  if (!me) return json(401, SIGNED_OUT);
  const { config: cfg, error } = config();
  if (error) return json(500, { configured: true, error });
  if (!cfg) return json(200, { configured: false, me: meOut(me) });
  try {
    const data = parseData(await readFile(cfg));
    if (!stillValid(me, data)) return json(401, SIGNED_OUT);
    return json(200, { configured: true, me: meOut(me), ...visibleData(data, me) });
  } catch (err) {
    return json(502, { configured: true, error: err.message });
  }
}

export async function POST(request) {
  const me = await sessionOf(request);
  if (!me) return json(401, SIGNED_OUT);
  const { config: cfg, error } = config();
  if (error) return json(500, { error });
  if (!cfg) return json(503, { error: 'Google Drive storage is not set up.' });
  let changes;
  try {
    changes = await request.json();
  } catch {
    return json(400, { error: 'Bad request.' });
  }
  if (!changes || typeof changes !== 'object' || (changes.upsert && !Array.isArray(changes.upsert)) || (changes.remove && !Array.isArray(changes.remove))) {
    return json(400, { error: 'Bad request.' });
  }
  try {
    // Read, merge and write back, so changes from other devices since our last read are kept.
    const data = parseData(await readFile(cfg));
    if (!stillValid(me, data)) return json(401, SIGNED_OUT);
    const { changes: allowed, rejected } = allowedChanges(data, changes, me);
    const next = applyChanges(data, allowed);
    await writeFile(cfg, JSON.stringify(next));
    return json(200, { ok: true, savedAt: next.savedAt, rejected });
  } catch (err) {
    return json(502, { error: err.message });
  }
}
