// Who may see and change what in the shared data file (pure functions, tested in tests/access.test.mjs).
//
// - admin (SITE_PASSWORD): everything; manages salesperson logins.
// - sales (own login): only projects whose salespersonId is theirs; can't change settings, can't
//   take over or delete someone else's project. Login records (password hashes) never leave the server.

/**
 * The data a user is sent: never the login records or the Google connection (only whether photos
 * go to Google Drive); salespeople only get their own projects.
 */
export function visibleData(data, me) {
  // eslint-disable-next-line no-unused-vars
  const { users, google, ...rest } = data;
  const photos = { connected: !!google?.refreshToken, email: me.role === 'admin' ? google?.email ?? '' : '' };
  if (me.role === 'admin') return { ...rest, photos };
  return { ...rest, photos, projects: rest.projects.filter((p) => p && p.salespersonId === me.userId) };
}

/** Whether this user may see (and add photos to) a project. */
export const canSeeProject = (project, me) => !!project && (me.role === 'admin' || project.salespersonId === me.userId);

/**
 * Keep only the changes this user may make. Returns the allowed changes and the ids refused
 * (so the app can stop retrying them).
 */
export function allowedChanges(data, changes, me) {
  const upsert = Array.isArray(changes.upsert) ? changes.upsert : [];
  const remove = Array.isArray(changes.remove) ? changes.remove : [];
  if (me.role === 'admin') return { changes: { upsert, remove, settings: changes.settings }, rejected: [] };

  const byId = new Map(data.projects.map((p) => [p.id, p]));
  const ownsExisting = (id) => !byId.has(id) || byId.get(id).salespersonId === me.userId;
  const rejected = [];
  const okUpsert = [];
  for (const p of upsert) {
    if (p && typeof p.id === 'string' && p.salespersonId === me.userId && ownsExisting(p.id)) okUpsert.push(p);
    else if (p && typeof p.id === 'string') rejected.push(p.id);
  }
  const okRemove = [];
  for (const id of remove) {
    if (typeof id !== 'string') continue;
    // only their own projects; removing an id that doesn't exist is harmless, but isn't theirs to tombstone
    if (byId.has(id) && byId.get(id).salespersonId === me.userId) okRemove.push(id);
    else rejected.push(id);
  }
  // settings are the admin's
  return { changes: { upsert: okUpsert, remove: okRemove }, rejected };
}

/** Find a salesperson's login by login ID (case-insensitive). */
export function findLogin(users, loginId) {
  const id = String(loginId ?? '').trim().toLowerCase();
  if (!id) return null;
  return (users ?? []).find((u) => u.loginId?.toLowerCase() === id) ?? null;
}

/** Login IDs: letters, digits, dot, dash, underscore; 2–40 characters; "admin" is taken. */
export function validLoginId(loginId) {
  const id = String(loginId ?? '').trim();
  if (!/^[A-Za-z0-9._-]{2,40}$/.test(id)) return 'Login ID must be 2–40 letters, numbers, dots, dashes or underscores.';
  if (id.toLowerCase() === 'admin') return '"admin" is reserved for the site password.';
  return null;
}
