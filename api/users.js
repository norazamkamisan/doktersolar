// Vercel Function: salesperson logins (admin only).
//   GET    /api/users             → { users: [{ id, loginId, hasPassword }] }   (never the password hashes)
//   POST   /api/users  { id, loginId, password? } → set a salesperson's login ID and/or password
//   DELETE /api/users?id=…        → remove a salesperson's login
// `id` is the salesperson's id from Settings → Sales team. Changing a login ID or password signs
// that person out everywhere. Stored in the Google Drive data file (server/data-merge.mjs).
import { driveConfig, readFile, writeFile } from '../server/drive-store.mjs';
import { parseData } from '../server/data-merge.mjs';
import { findLogin, validLoginId } from '../server/access.mjs';
import { SIGNED_OUT, json, sessionOf } from '../server/auth.mjs';
import { b64url, hashPassword } from '../server/session.mjs';

const MIN_PASSWORD = 6;

async function setup(request) {
  const me = await sessionOf(request);
  if (!me) return { res: json(401, SIGNED_OUT) };
  if (me.role !== 'admin') return { res: json(403, { error: 'Only the admin can manage logins.' }) };
  let cfg;
  try {
    cfg = driveConfig();
  } catch (err) {
    return { res: json(500, { error: err.message }) };
  }
  if (!cfg) return { res: json(503, { error: 'Logins need Google Drive storage to be set up.' }) };
  return { cfg };
}

const listOf = (users) => users.map((u) => ({ id: u.id, loginId: u.loginId, hasPassword: !!u.hash }));
const newVersion = () => b64url(crypto.getRandomValues(new Uint8Array(9)));

export async function GET(request) {
  const { res, cfg } = await setup(request);
  if (res) return res;
  try {
    return json(200, { users: listOf(parseData(await readFile(cfg)).users) });
  } catch (err) {
    return json(502, { error: err.message });
  }
}

export async function POST(request) {
  const { res, cfg } = await setup(request);
  if (res) return res;
  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Bad request.' });
  }
  const id = String(body?.id ?? '');
  const loginId = String(body?.loginId ?? '').trim();
  const password = body?.password == null ? null : String(body.password);
  if (!id) return json(400, { error: 'Missing salesperson.' });
  const bad = validLoginId(loginId);
  if (bad) return json(400, { error: bad });
  if (password != null && password.length < MIN_PASSWORD) return json(400, { error: `Password must be at least ${MIN_PASSWORD} characters.` });

  try {
    const data = parseData(await readFile(cfg));
    const taken = findLogin(data.users, loginId);
    if (taken && taken.id !== id) return json(409, { error: `Login ID "${loginId}" is already used by someone else.` });
    const existing = data.users.find((u) => u.id === id);
    if (!existing && password == null) return json(400, { error: 'Set a password for the new login.' });

    const changedId = !existing || existing.loginId !== loginId;
    const user = { ...(existing ?? { id }), loginId };
    if (password != null) Object.assign(user, await hashPassword(password));
    if (changedId || password != null) user.ver = newVersion(); // signs them out everywhere
    data.users = [...data.users.filter((u) => u.id !== id), user];
    await writeFile(cfg, JSON.stringify(data));
    return json(200, { users: listOf(data.users) });
  } catch (err) {
    return json(502, { error: err.message });
  }
}

export async function DELETE(request) {
  const { res, cfg } = await setup(request);
  if (res) return res;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json(400, { error: 'Missing salesperson.' });
  try {
    const data = parseData(await readFile(cfg));
    data.users = data.users.filter((u) => u.id !== id);
    await writeFile(cfg, JSON.stringify(data));
    return json(200, { users: listOf(data.users) });
  } catch (err) {
    return json(502, { error: err.message });
  }
}
