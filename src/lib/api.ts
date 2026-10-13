import type { Project, PvWattsResult, Settings } from '../types';

/** Free geocoding via OpenStreetMap Nominatim (max ~1 request/second). */
export async function geocode(address: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name };
}

/** Calls our Netlify Function, which holds the NREL key server-side. */
export async function fetchPvWatts(p: Project): Promise<PvWattsResult> {
  if (p.lat == null || p.lng == null) throw new Error('Project has no location yet.');
  if (p.systemKw <= 0) throw new Error('Design a system first (no panels placed).');
  const q = new URLSearchParams({
    lat: String(p.lat),
    lon: String(p.lng),
    system_capacity: p.systemKw.toFixed(3),
    tilt: String(p.design.tilt),
    azimuth: String(p.design.azimuth),
  });
  const res = await fetch(`/.netlify/functions/pvwatts?${q}`);
  const text = await res.text();
  let body: { annual?: number; monthly?: number[]; error?: string } = {};
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error('PVWatts function is not available here (run with `netlify dev` or deploy to Netlify).');
  }
  if (!res.ok || body.error) throw new Error(body.error ?? `PVWatts request failed (${res.status})`);
  return { annual: body.annual!, monthly: body.monthly!, fetchedAt: new Date().toISOString() };
}

/* ------------------------------------------------------------------ */
/* Shareable proposal links                                            */
/* Data lives in localStorage, so a share link carries the proposal    */
/* itself in the URL (base64url JSON) and works on any device.         */
/* ------------------------------------------------------------------ */

export interface SharePayload {
  p: Project;
  s: Omit<Settings, 'logo'>;
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string): string {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function shareUrl(p: Project, s: Settings): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { logo: _logo, ...rest } = s;
  const roundedRoof = p.design.roof.map(([a, b]) => [+a.toFixed(7), +b.toFixed(7)] as [number, number]);
  const payload: SharePayload = { p: { ...p, notes: '', design: { ...p.design, roof: roundedRoof } }, s: rest };
  return `${window.location.origin}/proposals/${p.id}#d=${toBase64Url(JSON.stringify(payload))}`;
}

export function readSharePayload(hash: string): SharePayload | null {
  const m = hash.match(/d=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    return JSON.parse(fromBase64Url(m[1])) as SharePayload;
  } catch {
    return null;
  }
}
