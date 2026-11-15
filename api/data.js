// Vercel Function: the shared project data, stored as one JSON file in Google Drive.
//   GET  /api/data   → { configured, savedAt, settings, projects, deleted }
//   POST /api/data   { upsert: Project[], remove: string[], settings? } → { ok, savedAt }
// Behind the site password (middleware.js). See server/drive-store.mjs for setup.
import { driveConfig, readFile, writeFile } from '../server/drive-store.mjs';
import { applyChanges, parseData } from '../server/data-merge.mjs';

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function config() {
  try {
    return { config: driveConfig() };
  } catch (err) {
    return { error: err.message };
  }
}

export async function GET() {
  const { config: cfg, error } = config();
  if (error) return json(500, { configured: true, error });
  if (!cfg) return json(200, { configured: false });
  try {
    return json(200, { configured: true, ...parseData(await readFile(cfg)) });
  } catch (err) {
    return json(502, { configured: true, error: err.message });
  }
}

export async function POST(request) {
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
    const next = applyChanges(parseData(await readFile(cfg)), changes);
    await writeFile(cfg, JSON.stringify(next));
    return json(200, { ok: true, savedAt: next.savedAt });
  } catch (err) {
    return json(502, { error: err.message });
  }
}
