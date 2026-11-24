import { useSyncExternalStore } from 'react';
import type { Project, Settings } from '../types';

/**
 * Keeps this browser's projects and settings in step with the shared copy in Google Drive
 * (via /api/data). The browser copy stays the working copy, so the app works offline; changes
 * are remembered here until the server has them.
 *
 * Where /api/data isn't set up (local development, or no Drive configured) everything stays
 * in this browser, as before.
 */

export type SyncState = 'connecting' | 'local' | 'syncing' | 'saved' | 'offline' | 'error';
export interface SyncStatus {
  state: SyncState;
  /** when the shared copy was last saved (by anyone) */
  savedAt: string | null;
  message?: string;
  /** changes on this device not yet saved to Drive */
  pendingCount: number;
}

/** Who is signed in: the admin (site password) or a salesperson (their own login). */
export interface Me {
  role: 'admin' | 'sales';
  salespersonId: string | null;
}

interface ServerData {
  configured: boolean;
  me?: Me;
  error?: string;
  savedAt?: string | null;
  settings?: Settings | null;
  projects?: Project[];
  deleted?: Record<string, string>;
  /** whether site visit photos go to Google Drive (and to whose account, for the admin) */
  photos?: PhotosCloud;
}

export interface PhotosCloud {
  connected: boolean;
  email: string;
}

interface Host {
  getProjects: () => Project[];
  getSettings: () => Settings;
  /** replace local data without recording it as a change */
  apply: (projects: Project[], settings?: Settings) => void;
}

const PENDING_KEY = 'doktersolar.sync.v1';
const PUSH_DELAY_MS = 1200;
const RETRY_MS = 30_000;
const PULL_MIN_INTERVAL_MS = 15_000;
/** keep each upload well under the hosting limit (4.5 MB) */
const MAX_BATCH_CHARS = 1_500_000;

interface Pending {
  upsert: string[];
  remove: string[];
  settings: boolean;
  /** this device has merged with the shared copy at least once */
  synced: boolean;
  /** who the local copy belongs to ("admin" or "sales:<id>"); another user's data is cleared on sign-in */
  owner?: string;
}

function loadPending(): Pending {
  try {
    const raw = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null');
    if (raw && Array.isArray(raw.upsert) && Array.isArray(raw.remove)) {
      return { upsert: raw.upsert, remove: raw.remove, settings: !!raw.settings, synced: !!raw.synced, owner: raw.owner };
    }
  } catch {
    /* start fresh */
  }
  return { upsert: [], remove: [], settings: false, synced: false };
}

const upsert = new Set<string>();
const remove = new Set<string>();
let settingsPending = false;
let synced = false;
let owner: string | undefined;
{
  const p = loadPending();
  p.upsert.forEach((id) => upsert.add(id));
  p.remove.forEach((id) => remove.add(id));
  settingsPending = p.settings;
  synced = p.synced;
  owner = p.owner;
}

function savePending() {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ upsert: [...upsert], remove: [...remove], settings: settingsPending, synced, owner }));
  } catch {
    /* storage full: the in-memory list still works for this session */
  }
}

/** bumped on every local change, so an upload only clears what hasn't changed since */
const versions = new Map<string, number>();
let settingsVersion = 0;
const bump = (id: string) => versions.set(id, (versions.get(id) ?? 0) + 1);

let host: Host | null = null;
let configured = false;
let busy = false;
let again = false;
let pushTimer: ReturnType<typeof setTimeout> | undefined;
let lastPull = 0;

let status: SyncStatus = { state: 'connecting', savedAt: null, pendingCount: 0 };
const listeners = new Set<() => void>();
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch, pendingCount: upsert.size + remove.size + (settingsPending ? 1 : 0) };
  listeners.forEach((l) => l());
}

let me: Me = { role: 'admin', salespersonId: null };

/** Who is signed in (the admin until the server says otherwise, e.g. in local development). */
export function useMe(): Me {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => me,
  );
}
export const currentMe = () => me;

let photosCloud: PhotosCloud = { connected: false, email: '' };
/** Whether site visit photos are saved to Google Drive (Settings → Photos in Google Drive). */
export function usePhotosCloud(): PhotosCloud {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => photosCloud,
  );
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

/* ------------------------------------------------------------------ */
/* Recording changes (called by the store)                             */
/* ------------------------------------------------------------------ */

export function noteProjectChanges(changed: string[], removed: string[]) {
  for (const id of changed) {
    upsert.add(id);
    remove.delete(id);
    bump(id);
  }
  for (const id of removed) {
    remove.add(id);
    upsert.delete(id);
    bump(id);
  }
  if (!changed.length && !removed.length) return;
  savePending();
  schedulePush();
}

export function noteSettingsChange() {
  if (me.role === 'sales') return; // settings are the admin's; the server ignores them from salespeople
  settingsPending = true;
  settingsVersion++;
  savePending();
  schedulePush();
}

function schedulePush(delay = PUSH_DELAY_MS) {
  if (!configured) return setStatus({});
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void push(), delay);
  setStatus({ state: 'syncing' });
}

/* ------------------------------------------------------------------ */
/* Server                                                              */
/* ------------------------------------------------------------------ */

async function fetchData(): Promise<ServerData | null> {
  const res = await fetch('/api/data', { headers: { Accept: 'application/json' }, cache: 'no-store' });
  // local dev serves the app's index.html for unknown paths: treat as "no server storage"
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) return null;
  const body = (await res.json()) as ServerData & { error?: string };
  if (res.status === 401) throw new Error('Signed out. Reload the page to sign in again.');
  return body;
}

const newer = (a?: string, b?: string) => String(a ?? '') > String(b ?? '');

/** Fetch the shared copy and merge it with this browser's copy. */
export async function pull(force = false): Promise<void> {
  if (!host || busy) return;
  if (!force && Date.now() - lastPull < PULL_MIN_INTERVAL_MS) return;
  lastPull = Date.now();
  busy = true;
  try {
    const data = await fetchData();
    if (!data || !data.configured) {
      configured = false;
      return setStatus({ state: 'local', message: undefined });
    }
    if (data.error) throw new Error(data.error);
    configured = true;

    // Who is signed in. If this device last held someone else's data (e.g. a shared laptop), start
    // from the server's copy instead of merging, so nobody sees or uploads another user's projects.
    let fresh = false;
    if (data.me) {
      const changedUser = data.me.role !== me.role || data.me.salespersonId !== me.salespersonId;
      me = data.me;
      if (data.photos && (data.photos.connected !== photosCloud.connected || data.photos.email !== photosCloud.email)) photosCloud = data.photos;
      const key = me.role === 'admin' ? 'admin' : `sales:${me.salespersonId}`;
      if (owner !== key) {
        if (owner || me.role === 'sales') {
          upsert.clear();
          remove.clear();
          settingsPending = false;
          synced = false;
          fresh = true;
        }
        owner = key;
      }
      if (changedUser) setStatus({});
    }

    const server = data.projects ?? [];
    const deleted = data.deleted ?? {};
    const local = fresh ? [] : host.getProjects();
    const localById = new Map(local.map((p) => [p.id, p]));
    const byId = new Map(server.map((p) => [p.id, p]));

    if (!synced) {
      // First time on this device: keep anything here that the shared copy doesn't have yet
      // (except the demo projects, once real data exists), then upload it.
      for (const p of local) {
        // a fresh browser re-creates the demo projects; never let those replace shared data
        if (p.id.startsWith('demo-') && (server.length > 0 || deleted[p.id] || me.role === 'sales')) continue;
        // a salesperson only keeps (and uploads) their own projects
        if (me.role === 'sales' && p.salespersonId !== me.salespersonId) continue;
        const s = byId.get(p.id);
        if (s && !newer(p.updatedAt, s.updatedAt)) continue;
        if (!s && deleted[p.id] && !newer(p.updatedAt, deleted[p.id])) continue;
        byId.set(p.id, p);
        upsert.add(p.id);
      }
      if (!data.settings && me.role === 'admin') settingsPending = true;
      synced = true;
    } else {
      // Keep this device's changes that haven't been uploaded yet.
      for (const id of upsert) {
        const p = localById.get(id);
        if (p) byId.set(id, p);
      }
    }
    for (const id of remove) byId.delete(id);

    const projects = [...byId.values()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    host.apply(projects, !settingsPending && data.settings ? data.settings : undefined);
    savePending();
    setStatus({ state: 'saved', savedAt: data.savedAt ?? null, message: undefined });
  } catch (err) {
    setStatus(navigator.onLine ? { state: 'error', message: (err as Error).message } : { state: 'offline', message: undefined });
  } finally {
    busy = false;
  }
  if (upsert.size || remove.size || settingsPending) void push();
}

/** Upload this device's changes. */
async function push(): Promise<void> {
  if (!host || !configured) return;
  if (busy) {
    again = true;
    return;
  }
  if (!upsert.size && !remove.size && !settingsPending) return setStatus({ state: 'saved' });
  busy = true;
  setStatus({ state: 'syncing' });
  try {
    const local = new Map(host.getProjects().map((p) => [p.id, p]));
    const sentVersions = new Map<string, number>();
    const items: Project[] = [];
    for (const id of upsert) {
      const p = local.get(id);
      if (p) items.push(p);
      sentVersions.set(id, versions.get(id) ?? 0);
    }
    const removing = [...remove];
    removing.forEach((id) => sentVersions.set(id, versions.get(id) ?? 0));
    const sentSettings = settingsPending ? settingsVersion : -1;

    // split large uploads (e.g. the first sync of a big import)
    const batches: Project[][] = [[]];
    let size = 0;
    for (const p of items) {
      const n = JSON.stringify(p).length;
      if (size + n > MAX_BATCH_CHARS && batches[batches.length - 1].length) {
        batches.push([]);
        size = 0;
      }
      batches[batches.length - 1].push(p);
      size += n;
    }

    let savedAt: string | null = null;
    const rejected = new Set<string>();
    for (let i = 0; i < batches.length; i++) {
      const body: Record<string, unknown> = { upsert: batches[i] };
      if (i === batches.length - 1) {
        body.remove = removing;
        if (sentSettings >= 0) body.settings = host.getSettings();
      }
      const res = await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || `Saving failed (${res.status}).`);
      savedAt = out.savedAt ?? savedAt;
      (Array.isArray(out.rejected) ? out.rejected : []).forEach((id: string) => rejected.add(id));
    }

    // clear what was uploaded, unless it changed again meanwhile
    for (const [id, v] of sentVersions) {
      if ((versions.get(id) ?? 0) !== v) continue;
      upsert.delete(id);
      remove.delete(id);
    }
    if (sentSettings === settingsVersion) settingsPending = false;
    // Changes the server refused (projects that aren't this salesperson's): stop retrying, and drop
    // any such project from this device.
    if (rejected.size) {
      rejected.forEach((id) => {
        upsert.delete(id);
        remove.delete(id);
      });
      const kept = host.getProjects().filter((p) => !rejected.has(p.id) || p.salespersonId === me.salespersonId);
      host.apply(kept);
    }
    savePending();
    setStatus({ state: 'saved', savedAt, message: undefined });
  } catch (err) {
    setStatus(navigator.onLine ? { state: 'error', message: (err as Error).message } : { state: 'offline', message: undefined });
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void push(), RETRY_MS);
  } finally {
    busy = false;
  }
  if (again) {
    again = false;
    void push();
  }
}

/** Retry now (e.g. from the status indicator). */
export function syncNow() {
  if (configured) void push().then(() => pull(true));
  else void pull(true);
}

export function startSync(h: Host) {
  host = h;
  void pull(true);
  window.addEventListener('online', () => syncNow());
  window.addEventListener('focus', () => void pull());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void pull();
    else if (configured && (upsert.size || remove.size || settingsPending)) {
      clearTimeout(pushTimer);
      void push();
    }
  });
}
