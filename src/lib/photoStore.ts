/**
 * Site visit photos, kept in this browser's IndexedDB (they are too large to sync through the
 * shared Google Drive file). Keyed by project id and photo slot. Each photo is shrunk to fit
 * 1600 px and saved as JPEG first.
 */
import { useEffect, useState } from 'react';

const DB = 'doktersolar-photos';
const STORE = 'photos';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const keyOf = (projectId: string, slot: string) => `${projectId}:${slot}`;

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

export async function savePhoto(projectId: string, slot: string, file: File): Promise<void> {
  const blob = await shrinkPhoto(file);
  await tx('readwrite', (s) => s.put(blob, keyOf(projectId, slot)));
  notify(projectId);
}

export async function deletePhoto(projectId: string, slot: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(keyOf(projectId, slot)));
  notify(projectId);
}

/** All of a project's photos: slot → Blob. */
export async function loadPhotos(projectId: string): Promise<Record<string, Blob>> {
  const prefix = `${projectId}:`;
  const keys = (await tx('readonly', (s) => s.getAllKeys(IDBKeyRange.bound(prefix, `${prefix}￿`)))) as string[];
  const out: Record<string, Blob> = {};
  for (const k of keys) {
    const blob = (await tx('readonly', (s) => s.get(k))) as Blob | undefined;
    if (blob) out[k.slice(prefix.length)] = blob;
  }
  return out;
}

const listeners = new Map<string, Set<() => void>>();
function notify(projectId: string) {
  listeners.get(projectId)?.forEach((l) => l());
}

/** A project's photos as object URLs (slot → url), kept up to date. */
export function usePhotos(projectId: string): { urls: Record<string, string>; ready: boolean; error: string } {
  const [state, setState] = useState<{ urls: Record<string, string>; ready: boolean; error: string }>({ urls: {}, ready: false, error: '' });
  useEffect(() => {
    let alive = true;
    let current: string[] = [];
    const load = () =>
      loadPhotos(projectId)
        .then((blobs) => {
          if (!alive) return;
          current.forEach((u) => URL.revokeObjectURL(u));
          const urls: Record<string, string> = {};
          for (const [slot, b] of Object.entries(blobs)) urls[slot] = URL.createObjectURL(b);
          current = Object.values(urls);
          setState({ urls, ready: true, error: '' });
        })
        .catch(() => alive && setState({ urls: {}, ready: true, error: 'Photos are not available in this browser (private mode?).' }));
    load();
    const set = listeners.get(projectId) ?? new Set();
    set.add(load);
    listeners.set(projectId, set);
    return () => {
      alive = false;
      set.delete(load);
      current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [projectId]);
  return state;
}
