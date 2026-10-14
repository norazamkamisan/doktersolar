import type { Project, PvWattsResult, Settings } from '../types';

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
  /** true when only a shortened version of the address was found */
  approximate: boolean;
}

/**
 * Candidate queries: the full address, then with leading parts removed
 * ("Lot G-03, Jalan X, Seremban" → "Jalan X, Seremban"). At least two parts are always kept,
 * so a lone street name can't be matched to a different town.
 */
export function addressVariants(address: string): string[] {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  const variants = [parts.join(', ')];
  for (let i = 1; parts.length - i >= 2; i++) variants.push(parts.slice(i).join(', '));
  return variants;
}

/**
 * Free geocoding via OpenStreetMap Nominatim. Tries shorter versions of the address if the
 * full one isn't found, at most one request per second (Nominatim's usage policy), and gives
 * up after `timeoutMs` in total so a slow service can never block the UI.
 */
export async function geocode(address: string, timeoutMs = 8000): Promise<GeocodeResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const variants = addressVariants(address);
    for (let i = 0; i < variants.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 1100));
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(variants[i])}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
      const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
      if (data.length) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name, approximate: i > 0 };
      }
    }
    return null;
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new Error('The address lookup took too long. Try again in a moment.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Calls our serverless function (Vercel or Netlify), which holds the NREL key server-side. */
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
  const res = await fetch(`/api/pvwatts?${q}`);
  const text = await res.text();
  let body: { annual?: number; monthly?: number[]; error?: string } = {};
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error('PVWatts function is not available here (run with `vercel dev`, or use the deployed site).');
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

// Two fragment formats:
//   #z=<base64url(deflate-raw(JSON))>   compressed, about half the length (current)
//   #d=<base64url(JSON)>                uncompressed (older links, and browsers without CompressionStream)

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipeBytes(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function buildPayload(p: Project, s: Settings): SharePayload {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { logo: _logo, ...rest } = s;
  const roundedRoof = p.design.roof.map(([a, b]) => [+a.toFixed(7), +b.toFixed(7)] as [number, number]);
  return { p: { ...p, notes: '', design: { ...p.design, roof: roundedRoof } }, s: rest };
}

/** The `#z=…` (or `#d=…`) fragment that carries a proposal. */
export async function shareFragment(p: Project, s: Settings): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(buildPayload(p, s)));
  if (typeof CompressionStream !== 'undefined') {
    try {
      return `#z=${bytesToBase64Url(await pipeBytes(json, new CompressionStream('deflate-raw')))}`;
    } catch {
      /* fall through to the uncompressed format */
    }
  }
  return `#d=${bytesToBase64Url(json)}`;
}

export async function shareUrl(p: Project, s: Settings): Promise<string> {
  return `${window.location.origin}/proposals/${p.id}${await shareFragment(p, s)}`;
}

export async function readSharePayload(hash: string): Promise<SharePayload | null> {
  const m = hash.match(/(?:^#|&)([zd])=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    let bytes = base64UrlToBytes(m[2]);
    if (m[1] === 'z') bytes = await pipeBytes(bytes, new DecompressionStream('deflate-raw'));
    return JSON.parse(new TextDecoder().decode(bytes)) as SharePayload;
  } catch {
    return null;
  }
}

/**
 * Share a proposal link. On phones this opens the native share sheet (WhatsApp, email, …);
 * elsewhere it copies to the clipboard. Returns what happened.
 */
export async function shareProposal(
  p: Project,
  s: Pick<Settings, 'companyName'>,
  url?: string,
): Promise<'shared' | 'copied' | 'cancelled'> {
  url ??= await shareUrl(p, s as Settings);
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
  if (coarsePointer && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: `Solar proposal for ${p.customerName}`, text: `Your solar proposal from ${s.companyName}`, url });
      return 'shared';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'cancelled';
      /* share sheet unavailable: fall back to copying */
    }
  }
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    window.prompt('Copy this link:', url);
  }
  return 'copied';
}
