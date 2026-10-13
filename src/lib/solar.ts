import type { DesignSettings, EnergySettings, LatLng, Project } from '../types';

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

const R = 6378137; // WGS84 equatorial radius, metres
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

type XY = [number, number];

/** Equirectangular projection around an origin — accurate enough for a single roof. */
function toLocal([lat, lng]: LatLng, [lat0, lng0]: LatLng): XY {
  return [rad(lng - lng0) * R * Math.cos(rad(lat0)), rad(lat - lat0) * R];
}

function toLatLng([x, y]: XY, [lat0, lng0]: LatLng): LatLng {
  return [lat0 + deg(y / R), lng0 + deg(x / (R * Math.cos(rad(lat0))))];
}

export function centroid(pts: LatLng[]): LatLng {
  const n = pts.length || 1;
  return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
}

function shoelace(pts: XY[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/** Plan-view (as seen from above) area of a lat/lng polygon in m². */
export function polygonAreaM2(pts: LatLng[]): number {
  if (pts.length < 3) return 0;
  const o = centroid(pts);
  return shoelace(pts.map((p) => toLocal(p, o)));
}

function pointInPolygon([x, y]: XY, poly: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment([px, py]: XY, [ax, ay]: XY, [bx, by]: XY): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distToEdges(p: XY, poly: XY[]): number {
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, distToSegment(p, poly[i], poly[(i + 1) % poly.length]));
  return d;
}

export interface PanelLayout {
  panels: LatLng[][];
  roofAreaM2: number;
  /** roof surface area, corrected for pitch */
  slopedAreaM2: number;
}

const MAX_PANELS_HARD = 3000;

/**
 * Fill a roof polygon with a regular grid of panel rectangles.
 * Rows run perpendicular to the azimuth (the direction panels face).
 * On a pitched roof, the plan-view length of each panel shrinks by cos(tilt).
 * Several grid offsets are tried and the one fitting the most panels wins.
 */
export function layoutPanels(d: DesignSettings): PanelLayout {
  const roofAreaM2 = polygonAreaM2(d.roof);
  const slopedAreaM2 = roofAreaM2 / Math.max(0.2, Math.cos(rad(d.tilt)));
  if (d.roof.length < 3) return { panels: [], roofAreaM2, slopedAreaM2 };

  const origin = centroid(d.roof);
  const az = rad(d.azimuth);
  const c = Math.cos(az);
  const s = Math.sin(az);
  // rotate world (x east, y north) into (u along-row, v up/down-slope)
  const toUV = ([x, y]: XY): XY => [x * c - y * s, x * s + y * c];
  const fromUV = ([u, v]: XY): XY => [c * u + s * v, -s * u + c * v];

  const poly = d.roof.map((p) => toUV(toLocal(p, origin)));
  const us = poly.map((p) => p[0]);
  const vs = poly.map((p) => p[1]);
  const minU = Math.min(...us);
  const maxU = Math.max(...us);
  const minV = Math.min(...vs);
  const maxV = Math.max(...vs);

  const long = Math.max(d.panelWidth, d.panelHeight);
  const short = Math.min(d.panelWidth, d.panelHeight);
  const pu = d.orientation === 'portrait' ? short : long;
  const pvSloped = d.orientation === 'portrait' ? long : short;
  const pv = pvSloped * Math.cos(rad(Math.min(Math.max(d.tilt, 0), 80)));
  const stepU = pu + d.gap;
  const stepV = pv + d.gap;
  if (stepU <= 0 || stepV <= 0) return { panels: [], roofAreaM2, slopedAreaM2 };

  const fits = (u0: number, v0: number): boolean => {
    const corners: XY[] = [
      [u0, v0],
      [u0 + pu, v0],
      [u0 + pu, v0 + pv],
      [u0, v0 + pv],
    ];
    for (const k of corners) {
      if (!pointInPolygon(k, poly)) return false;
      if (d.setback > 0 && distToEdges(k, poly) < d.setback) return false;
    }
    // reject if a roof vertex pokes into the panel (concave roofs)
    for (const [u, v] of poly) if (u > u0 && u < u0 + pu && v > v0 && v < v0 + pv) return false;
    return true;
  };

  let best: XY[] = [];
  const offsets = [0, 0.25, 0.5, 0.75];
  for (const ou of offsets) {
    for (const ov of offsets) {
      const found: XY[] = [];
      for (let v0 = minV + ov * stepV; v0 + pv <= maxV; v0 += stepV) {
        for (let u0 = minU + ou * stepU; u0 + pu <= maxU; u0 += stepU) {
          if (fits(u0, v0)) found.push([u0, v0]);
          if (found.length >= MAX_PANELS_HARD) break;
        }
        if (found.length >= MAX_PANELS_HARD) break;
      }
      if (found.length > best.length) best = found;
    }
  }

  if (d.maxPanels > 0) best = best.slice(0, d.maxPanels);

  const panels = best.map(([u0, v0]) =>
    (
      [
        [u0, v0],
        [u0 + pu, v0],
        [u0 + pu, v0 + pv],
        [u0, v0 + pv],
      ] as XY[]
    ).map((k) => toLatLng(fromUV(k), origin)),
  );
  return { panels, roofAreaM2, slopedAreaM2 };
}

export function systemKw(panelCount: number, wattage: number): number {
  return (panelCount * wattage) / 1000;
}

/* ------------------------------------------------------------------ */
/* Energy                                                              */
/* ------------------------------------------------------------------ */

export const PERFORMANCE_RATIO = 0.8;
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function simpleAnnualKwh(kw: number, peakSunHours: number): number {
  return kw * peakSunHours * 365 * PERFORMANCE_RATIO;
}

/**
 * Split an annual total into months. Uses day counts plus a gentle seasonal
 * curve whose strength grows with distance from the equator.
 */
export function monthlySplit(annual: number, lat: number | null): number[] {
  const l = lat ?? 0;
  const amp = Math.min(0.4, (Math.abs(l) / 90) * 0.7);
  const peak = l >= 0 ? 5.5 : 11.5; // mid-year peak in the north, Dec/Jan in the south
  const w = DAYS.map((days, m) => days * (1 + amp * Math.cos((2 * Math.PI * (m - peak)) / 12)));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => (annual * x) / sum);
}

export interface EnergyResult {
  annualKwh: number;
  monthlyKwh: number[];
  source: 'pvwatts' | 'simple';
  consumptionKwh: number;
  offsetPct: number;
}

export function energyFor(p: Project): EnergyResult {
  const e = p.energy;
  const usePv = e.usePvWatts && !!e.pvwatts;
  const annualKwh = usePv ? e.pvwatts!.annual : simpleAnnualKwh(p.systemKw, e.peakSunHours);
  const monthlyKwh = usePv ? e.pvwatts!.monthly : monthlySplit(annualKwh, p.lat);
  const consumptionKwh = e.tariff > 0 ? (p.monthlyBill * 12) / e.tariff : 0;
  return {
    annualKwh,
    monthlyKwh,
    source: usePv ? 'pvwatts' : 'simple',
    consumptionKwh,
    offsetPct: consumptionKwh > 0 ? (annualKwh / consumptionKwh) * 100 : 0,
  };
}

/** System size needed to cover the customer's bill with the simple model. */
export function recommendedKw(monthlyBill: number, e: Pick<EnergySettings, 'tariff' | 'peakSunHours'>): number {
  if (e.tariff <= 0 || e.peakSunHours <= 0) return 0;
  return (monthlyBill * 12) / e.tariff / (e.peakSunHours * 365 * PERFORMANCE_RATIO);
}

export interface Financials {
  systemCost: number;
  firstYearSavings: number;
  savings25: number;
  netSavings25: number;
  paybackYears: number | null;
  /** cumulative net cash position at end of each year 0..25 */
  cashflow: { year: number; cumulative: number; savings: number }[];
}

export function financialsFor(p: Project, annualKwh: number): Financials {
  const e = p.energy;
  const systemCost = p.systemKw * 1000 * e.pricePerWatt;
  let cumulative = -systemCost;
  let total = 0;
  let paybackYears: number | null = null;
  const cashflow = [{ year: 0, cumulative, savings: 0 }];
  for (let y = 1; y <= 25; y++) {
    const prod = annualKwh * Math.pow(1 - e.degradation / 100, y - 1);
    const tariff = e.tariff * Math.pow(1 + e.escalation / 100, y - 1);
    const savings = prod * tariff;
    const before = cumulative;
    cumulative += savings;
    total += savings;
    if (paybackYears === null && cumulative >= 0 && savings > 0) {
      paybackYears = y - 1 + -before / savings;
    }
    cashflow.push({ year: y, cumulative, savings });
  }
  if (systemCost === 0) paybackYears = null;
  return {
    systemCost,
    firstYearSavings: cashflow[1].savings,
    savings25: total,
    netSavings25: total - systemCost,
    paybackYears,
    cashflow,
  };
}
