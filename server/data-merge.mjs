// Merge rules for the shared data file (pure functions, tested in tests/data-merge.test.mjs).
//
// File shape:
//   { format: 'doktersolar.v1', savedAt, settings, projects: Project[], deleted: { [id]: deletedAtIso },
//     users: salesperson logins (see server/access.mjs; never sent to the app) }
//
// Each project carries `updatedAt`; the newer copy wins. Deleted projects leave a tombstone so a
// device that was offline can't bring them back with an older copy.

export const FORMAT = 'doktersolar.v1';
const MAX_TOMBSTONES = 5000;

export function emptyData() {
  return { format: FORMAT, savedAt: null, settings: null, projects: [], deleted: {}, users: [] };
}

/** Parse the file's text; an empty or unrelated file counts as empty data. */
export function parseData(text) {
  if (!text || !text.trim()) return emptyData();
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('The Google Drive data file is not valid JSON.');
  }
  if (!raw || typeof raw !== 'object' || raw.format !== FORMAT) return emptyData();
  return {
    format: FORMAT,
    savedAt: raw.savedAt ?? null,
    settings: raw.settings ?? null,
    projects: Array.isArray(raw.projects) ? raw.projects : [],
    deleted: raw.deleted && typeof raw.deleted === 'object' ? raw.deleted : {},
    users: Array.isArray(raw.users) ? raw.users : [],
  };
}

const newer = (a, b) => String(a ?? '') > String(b ?? '');

/**
 * Apply one client's changes: `upsert` projects (kept only if not older than the stored copy or
 * its tombstone), `remove` ids, and optionally replace `settings`.
 */
export function applyChanges(data, { upsert = [], remove = [], settings } = {}, now = new Date().toISOString()) {
  const byId = new Map(data.projects.map((p) => [p.id, p]));
  const deleted = { ...data.deleted };

  for (const p of upsert) {
    if (!p || typeof p.id !== 'string') continue;
    const current = byId.get(p.id);
    if (current && newer(current.updatedAt, p.updatedAt)) continue;
    if (deleted[p.id] && !newer(p.updatedAt, deleted[p.id])) continue;
    byId.set(p.id, p);
    delete deleted[p.id];
  }
  for (const id of remove) {
    if (typeof id !== 'string') continue;
    byId.delete(id);
    deleted[id] = now;
  }

  // keep the newest tombstones only
  const tombs = Object.entries(deleted);
  const trimmed =
    tombs.length > MAX_TOMBSTONES ? Object.fromEntries(tombs.sort((a, b) => b[1].localeCompare(a[1])).slice(0, MAX_TOMBSTONES)) : deleted;

  return {
    format: FORMAT,
    savedAt: now,
    settings: settings === undefined ? data.settings : settings,
    projects: [...byId.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))),
    deleted: trimmed,
    users: data.users ?? [],
  };
}
