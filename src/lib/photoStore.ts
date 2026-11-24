/**
 * Site visit photos.
 *
 * Every photo is kept in this browser's IndexedDB (so the checklist works offline). When the admin
 * has connected Google Drive for photos (Settings), photos are also uploaded to the owner's Drive
 * (api/photos.js) and downloaded on other devices:
 *   - a photo taken here is uploaded in the background (and retried later if offline);
 *   - photos in Drive that this device doesn't have, or has an older copy of, are downloaded;
 *   - a photo deleted on another device (it was uploaded, but is no longer in Drive) is removed here.
 * Each photo is shrunk to fit 1600 px and saved as JPEG first.
 */
import { useEffect, useState } from 'react';
import { usePhotosCloud } from './sync';

const DB = 'doktersolar-photos';
const PHOTOS = 'photos';
/** per photo: { fileId?, modifiedTime?, uploaded: boolean } */
const META = 'meta';

interface Meta {
  uploaded: boolean;
  fileId?: string;
  modifiedTime?: string;
  label?: string;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PHOTOS)) db.createObjectStore(PHOTOS);
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const keyOf = (projectId: string, slot: string) => `${projectId}:${slot}`;
const range = (projectId: string) => IDBKeyRange.bound(`${projectId}:`, `${projectId}:￿`);

/** Shrink a photo to fit maxSide × maxSide and return a JPEG blob. */
export function shrinkPhoto(file: File, maxSide = 1600): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Not a valid image'));
    };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / img.width, maxSide / img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not save the photo'))), 'image/jpeg', 0.8);
    };
    img.src = url;
  });
}

async function localPhotos(projectId: string): Promise<Record<string, { blob: Blob; meta: Meta }>> {
  const keys = (await tx(PHOTOS, 'readonly', (s) => s.getAllKeys(range(projectId)))) as string[];
  const out: Record<string, { blob: Blob; meta: Meta }> = {};
  for (const k of keys) {
    const blob = (await tx(PHOTOS, 'readonly', (s) => s.get(k))) as Blob | undefined;
    const meta = ((await tx(META, 'readonly', (s) => s.get(k))) as Meta | undefined) ?? { uploaded: false };
    if (blob) out[k.slice(projectId.length + 1)] = { blob, meta };
  }
  return out;
}

const putLocal = async (projectId: string, slot: string, blob: Blob, meta: Meta) => {
  await tx(PHOTOS, 'readwrite', (s) => s.put(blob, keyOf(projectId, slot)));
  await tx(META, 'readwrite', (s) => s.put(meta, keyOf(projectId, slot)));
};
const dropLocal = async (projectId: string, slot: string) => {
  await tx(PHOTOS, 'readwrite', (s) => s.delete(keyOf(projectId, slot)));
  await tx(META, 'readwrite', (s) => s.delete(keyOf(projectId, slot)));
};

/* ------------------------------------------------------------------ */
/* Google Drive (api/photos.js)                                        */
/* ------------------------------------------------------------------ */

async function upload(projectId: string, slot: string, blob: Blob, label: string): Promise<string> {
  const q = new URLSearchParams({ project: projectId, slot, label });
  const res = await fetch(`/api/photos?${q}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Upload failed (${res.status})`);
  return body.fileId as string;
}

/** Photos waiting to upload, across projects (for the status line). */
let pendingUploads = 0;

/**
 * Bring this device and Drive in step for one project. Returns false when photos aren't going
 * to Drive (not connected, or no server).
 */
async function syncProject(projectId: string): Promise<boolean> {
  const res = await fetch(`/api/photos?project=${encodeURIComponent(projectId)}`, { cache: 'no-store' });
  if (!(res.headers.get('content-type') ?? '').includes('json')) return false; // local development
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.connected) return false;
  const remote = new Map<string, { fileId: string; modifiedTime: string }>((body.photos ?? []).map((p: { slot: string; fileId: string; modifiedTime: string }) => [p.slot, p]));
  const local = await localPhotos(projectId);
  let changed = false;

  for (const [slot, { blob, meta }] of Object.entries(local)) {
    const r = remote.get(slot);
    if (!meta.uploaded) {
      pendingUploads++;
      try {
        const fileId = await upload(projectId, slot, blob, meta.label ?? slot);
        await tx(META, 'readwrite', (s) => s.put({ ...meta, uploaded: true, fileId, modifiedTime: r?.modifiedTime }, keyOf(projectId, slot)));
      } finally {
        pendingUploads--;
      }
    } else if (!r) {
      // uploaded before, gone from Drive now: deleted on another device
      await dropLocal(projectId, slot);
      changed = true;
    }
  }
  for (const [slot, r] of remote) {
    const have = local[slot];
    if (have && (!have.meta.uploaded || have.meta.modifiedTime === r.modifiedTime || !have.meta.modifiedTime)) {
      if (have.meta.uploaded && !have.meta.modifiedTime) await tx(META, 'readwrite', (s) => s.put({ ...have.meta, modifiedTime: r.modifiedTime }, keyOf(projectId, slot)));
      continue;
    }
    const img = await fetch(`/api/photos?project=${encodeURIComponent(projectId)}&file=${encodeURIComponent(r.fileId)}`);
    if (!img.ok) continue;
    await putLocal(projectId, slot, await img.blob(), { uploaded: true, fileId: r.fileId, modifiedTime: r.modifiedTime });
    changed = true;
  }
  if (changed) notify(projectId);
  return true;
}

/* ------------------------------------------------------------------ */
/* Saving and deleting                                                 */
/* ------------------------------------------------------------------ */

export async function savePhoto(projectId: string, slot: string, file: File, label = slot): Promise<void> {
  const blob = await shrinkPhoto(file);
  await putLocal(projectId, slot, blob, { uploaded: false, label });
  notify(projectId);
  // upload in the background; if it fails (offline), the next sync retries
  void syncProject(projectId)
    .then(() => notify(projectId))
    .catch(() => notify(projectId));
}

export async function deletePhoto(projectId: string, slot: string): Promise<void> {
  const meta = (await tx(META, 'readonly', (s) => s.get(keyOf(projectId, slot)))) as Meta | undefined;
  await dropLocal(projectId, slot);
  notify(projectId);
  if (meta?.uploaded) {
    await fetch(`/api/photos?project=${encodeURIComponent(projectId)}&slot=${encodeURIComponent(slot)}`, { method: 'DELETE' }).catch(() => undefined);
  }
}

const listeners = new Map<string, Set<() => void>>();
function notify(projectId: string) {
  listeners.get(projectId)?.forEach((l) => l());
}

export interface PhotosState {
  urls: Record<string, string>;
  ready: boolean;
  error: string;
  /** photos on this device not in Google Drive yet */
  waiting: number;
  /** last sync problem with Drive, if any */
  cloudError: string;
}

/** A project's photos as object URLs (slot → url), kept up to date and synced with Drive when connected. */
export function usePhotos(projectId: string): PhotosState {
  const cloud = usePhotosCloud();
  const [state, setState] = useState<PhotosState>({ urls: {}, ready: false, error: '', waiting: 0, cloudError: '' });
  useEffect(() => {
    let alive = true;
    let current: string[] = [];
    const load = () =>
      localPhotos(projectId)
        .then((photos) => {
          if (!alive) return;
          current.forEach((u) => URL.revokeObjectURL(u));
          const urls: Record<string, string> = {};
          for (const [slot, { blob }] of Object.entries(photos)) urls[slot] = URL.createObjectURL(blob);
          current = Object.values(urls);
          const waiting = Object.values(photos).filter((p) => !p.meta.uploaded).length;
          setState((s) => ({ ...s, urls, ready: true, error: '', waiting }));
        })
        .catch(() => alive && setState((s) => ({ ...s, ready: true, error: 'Photos are not available in this browser (private mode?).' })));
    load();
    const set = listeners.get(projectId) ?? new Set();
    set.add(load);
    listeners.set(projectId, set);

    const sync = () => {
      if (!cloud.connected) return;
      syncProject(projectId)
        .then(() => alive && setState((s) => ({ ...s, cloudError: '' })))
        .catch((err) => alive && setState((s) => ({ ...s, cloudError: (err as Error).message })))
        .finally(load);
    };
    sync();
    window.addEventListener('online', sync);
    return () => {
      alive = false;
      set.delete(load);
      window.removeEventListener('online', sync);
      current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [projectId, cloud.connected]);
  return state;
}

export const photosUploading = () => pendingUploads;
