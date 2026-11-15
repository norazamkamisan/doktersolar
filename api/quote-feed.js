// Vercel Function: projects for the claude.ai Quotation app to sync from.
//   GET /api/quote-feed                      → Proposal Sent, Won and Installed projects
//   GET /api/quote-feed?status=all           → every project you can see
//   GET /api/quote-feed?status=Won,Installed → just those stages
//   GET /api/quote-feed?id=os-1,os-2         → just those projects
// Behind the site login (middleware.js); salespeople only get their own projects.
import { driveConfig, readFile } from '../server/drive-store.mjs';
import { parseData } from '../server/data-merge.mjs';
import { visibleData } from '../server/access.mjs';
import { SIGNED_OUT, json, sessionOf, stillValid } from '../server/auth.mjs';
import { buildFeed } from '../server/quote-feed.mjs';

const list = (v) =>
  (v ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export async function GET(request) {
  const me = await sessionOf(request);
  if (!me) return json(401, SIGNED_OUT);
  let cfg;
  try {
    cfg = driveConfig();
  } catch (err) {
    return json(500, { error: err.message });
  }
  if (!cfg) return json(503, { error: 'Google Drive storage is not set up.' });
  try {
    const data = parseData(await readFile(cfg));
    if (!stillValid(me, data)) return json(401, SIGNED_OUT);
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const feed = buildFeed(visibleData(data, me), {
      statuses: status === 'all' ? 'all' : list(status),
      ids: list(url.searchParams.get('id')),
    });
    return json(200, feed, { 'Cache-Control': 'no-store' });
  } catch (err) {
    return json(502, { error: err.message });
  }
}
