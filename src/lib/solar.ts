import type { DesignSettings, LatLng, Project, RoofFace } from '../types';
import { TNB_TARIFF_NAME, tnbBill, tnbKwhForBill, type TnbOptions, type TnbTariffId } from './tnbTariff';

/* ------------------------------------------------------------------ */
/* Roof faces                                                          */
/* ------------------------------------------------------------------ */

/** Every drawn roof face of a design (the first lives in roof/tilt/azimuth). */
export function roofFaces(d: DesignSettings): RoofFace[] {
  const first: RoofFace[] = d.roof.length >= 3 ? [{ roof: d.roof, tilt: d.tilt, azimuth: d.azimuth }] : [];
  return [...first, ...(d.extraRoofs ?? []).filter((f) => f.roof.length >= 3)];
}

/** Design fields for a new list of roof faces (keeps tilt/azimuth when the last face goes). */
export function facesPatch(faces: RoofFace[]): Partial<DesignSettings> {
  if (!faces.length) return { roof: [], extraRoofs: [] };
  const [first, ...rest] = faces;
  return { roof: first.roof, tilt: first.tilt, azimuth: first.azimuth, extraRoofs: rest };
}

export const hasRoof = (d: DesignSettings) => roofFaces(d).length > 0;

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const compass = (az: number) => COMPASS[Math.round((((az % 360) + 360) % 360) / 45) % 8];

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

export interface FaceLayout {
  panels: LatLng[][];
  roofAreaM2: number;
  /** roof surface area, corrected for pitch */
  slopedAreaM2: number;
}

export interface PanelLayout extends FaceLayout {
  /** per roof face, in roofFaces() order */
  faces: (FaceLayout & RoofFace)[];
}

const MAX_PANELS_HARD = 3000;

/**
 * Lay out panels on every roof face. Panel size, orientation, setback and gap are shared;
 * each face has its own tilt and azimuth. "Max panels" caps the total, filling faces in order.
 */
export function layoutPanels(d: DesignSettings): PanelLayout {
  let left = d.maxPanels > 0 ? d.maxPanels : Infinity;
  const faces = roofFaces(d).map((f) => {
    const l = layoutFace(f, d);
    const panels = l.panels.slice(0, Math.max(0, left));
    left -= panels.length;
    return { ...f, ...l, panels };
  });
  return {
    faces,
    panels: faces.flatMap((f) => f.panels),
    roofAreaM2: faces.reduce((s, f) => s + f.roofAreaM2, 0),
    slopedAreaM2: faces.reduce((s, f) => s + f.slopedAreaM2, 0),
  };
}

/**
 * Fill one roof polygon with a regular grid of panel rectangles.
 * Rows run perpendicular to the azimuth (the direction panels face).
 * On a pitched roof, the plan-view length of each panel shrinks by cos(tilt).
 * Several grid offsets are tried and the one fitting the most panels wins.
 */
function layoutFace(face: RoofFace, d: DesignSettings): FaceLayout {
  const roofAreaM2 = polygonAreaM2(face.roof);
  const slopedAreaM2 = roofAreaM2 / Math.max(0.2, Math.cos(rad(face.tilt)));
  if (face.roof.length < 3) return { panels: [], roofAreaM2, slopedAreaM2 };

  const origin = centroid(face.roof);
  const az = rad(face.azimuth);
  const c = Math.cos(az);
  const s = Math.sin(az);
  // rotate world (x east, y north) into (u along-row, v up/down-slope)
  const toUV = ([x, y]: XY): XY => [x * c - y * s, x * s + y * c];
  const fromUV = ([u, v]: XY): XY => [c * u + s * v, -s * u + c * v];

  const poly = face.roof.map((p) => toUV(toLocal(p, origin)));
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
  const pv = pvSloped * Math.cos(rad(Math.min(Math.max(face.tilt, 0), 80)));
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
  const consumptionKwh = annualUsageKwh(p);
  return {
    annualKwh,
    monthlyKwh,
    source: usePv ? 'pvwatts' : 'simple',
    consumptionKwh,
    offsetPct: consumptionKwh > 0 ? (annualKwh / consumptionKwh) * 100 : 0,
  };
}

/** System size needed to cover the customer's use (or the bill's target share of it) with the simple model. */
export function recommendedKw(p: Pick<Project, 'monthlyBill' | 'monthlyKwh' | 'energy' | 'bill'>): number {
  if (p.energy.peakSunHours <= 0) return 0;
  const share = (p.bill?.targetOffsetPct ?? 100) / 100;
  return (annualUsageKwh(p) * share) / (p.energy.peakSunHours * 365 * PERFORMANCE_RATIO);
}

/**
 * Share of the original output a panel still gives in year `y` (1 = first year), as panel
 * warranties state it: the first-year loss, then a fixed loss each further year.
 */
export function outputFactor(e: Pick<Project['energy'], 'firstYearDegradation' | 'degradation'>, y: number): number {
  const first = e.firstYearDegradation ?? e.degradation;
  return Math.max(0, 1 - first / 100 - (e.degradation / 100) * (y - 1));
}

/** "1% in the first year, then 0.42% per year" */
export function degradationText(e: Pick<Project['energy'], 'firstYearDegradation' | 'degradation'>): string {
  const first = e.firstYearDegradation ?? e.degradation;
  return first === e.degradation ? `${first}% per year` : `${first}% in the first year, then ${e.degradation}% per year`;
}

/** Price before any discount: the quoted price, or kWp × price per watt. */
export function totalSystemPrice(p: Project): number {
  const q = p.quote?.systemPrice;
  return q != null && q > 0 ? q : p.systemKw * 1000 * p.energy.pricePerWatt;
}

/** What the customer pays: total price less any discount or rebate. */
export function netSystemPrice(p: Project): number {
  return Math.max(0, totalSystemPrice(p) - (p.quote?.discount ?? 0));
}

/* ------------------------------------------------------------------ */
/* Electricity bills                                                   */
/* ------------------------------------------------------------------ */

/** The current TNB AFA rate (sen/kWh), kept in step with Settings by the store. */
let afaSen = 3.6;
export function setAfaSen(v: number) {
  afaSen = Number.isFinite(v) ? v : 0;
}
export const currentAfaSen = () => afaSen;

/** 'tnb' / 'tnb-tou' are the Domestic tariffs (their stored names); the rest are Non-Domestic. */
export type TariffModel = 'tnb' | 'tnb-tou' | 'lv' | 'lv-tou' | 'mv' | 'mv-tou' | 'hv' | 'hv-tou' | 'flat';

const TNB_ID: Record<Exclude<TariffModel, 'flat'>, TnbTariffId> = {
  tnb: 'dom',
  'tnb-tou': 'dom-tou',
  lv: 'lv',
  'lv-tou': 'lv-tou',
  mv: 'mv',
  'mv-tou': 'mv-tou',
  hv: 'hv',
  'hv-tou': 'hv-tou',
};

export const tnbIdOf = (m: TariffModel): TnbTariffId | null => (m === 'flat' ? null : TNB_ID[m]);

export const TARIFF_LABEL: Record<TariffModel, string> = {
  tnb: `TNB ${TNB_TARIFF_NAME.dom}`,
  'tnb-tou': `TNB ${TNB_TARIFF_NAME['dom-tou']}`,
  lv: `TNB ${TNB_TARIFF_NAME.lv}`,
  'lv-tou': `TNB ${TNB_TARIFF_NAME['lv-tou']}`,
  mv: `TNB ${TNB_TARIFF_NAME.mv}`,
  'mv-tou': `TNB ${TNB_TARIFF_NAME['mv-tou']}`,
  hv: `TNB ${TNB_TARIFF_NAME.hv}`,
  'hv-tou': `TNB ${TNB_TARIFF_NAME['hv-tou']}`,
  flat: 'Flat rate',
};

/**
 * The TNB non-domestic tariff a scanned bill points to: by the voltage named in the tariff
 * (Rendah / Sederhana / Tinggi, or the older B / C / D / E codes), else Medium Voltage when the
 * bill has a maximum demand, else Low Voltage. ToU when the tariff says so.
 */
export function nonDomesticTariffFor(bill: NonNullable<Project['bill']>): TariffModel {
  const t = `${bill.tariff ?? ''}`;
  const tou = /\bToU\b|Masa Penggunaan|Time of Use/i.test(t);
  let level: 'lv' | 'mv' | 'hv';
  if (/Tinggi|High Voltage|\bE3\b|\bF3\b/i.test(t)) level = 'hv';
  else if (/Sederhana|Medium Voltage|\bC[12]\b|\bE[12]\b|\bF[12]\b/i.test(t)) level = 'mv';
  else if (/Rendah|Low Voltage|\bB\b|\bD\b/i.test(t)) level = 'lv';
  else level = (bill.maxDemandKw ?? 0) > 0 ? 'mv' : 'lv';
  return (tou ? `${level}-tou` : level) as TariffModel;
}

/** The chosen tariff; otherwise TNB Domestic, or the matching Non-Domestic tariff for a shop or factory bill. */
export function tariffModelOf(p: Pick<Project, 'energy' | 'bill'>): TariffModel {
  if (p.energy.tariffModel) return p.energy.tariffModel;
  return p.bill && p.bill.category !== 'residential' ? nonDomesticTariffFor(p.bill) : 'tnb';
}

const DEFAULT_TOU_PEAK_PCT = 50;
export const touPeakPctOf = (p: Pick<Project, 'energy'>) => p.energy.touPeakPct ?? DEFAULT_TOU_PEAK_PCT;
export const isTouModel = (m: TariffModel) => m.endsWith('-tou');
export const usesMaxDemandModel = (m: TariffModel) => m.startsWith('mv') || m.startsWith('hv');

/** Maximum demand for Medium / High Voltage bills, kW: entered on the Energy tab, else from the scanned bill. */
export const maxDemandOf = (p: Pick<Project, 'energy' | 'bill'>) => p.energy.maxDemandKw ?? p.bill?.maxDemandKw ?? 0;

/** Options for the TNB bill of this project. */
export function tnbOptionsOf(p: Pick<Project, 'energy' | 'bill'>): TnbOptions | null {
  const m = tariffModelOf(p);
  const id = tnbIdOf(m);
  if (!id) return null;
  return { tariff: id, afaSen, touPeakPct: isTouModel(m) ? touPeakPctOf(p) : undefined, maxDemandKw: usesMaxDemandModel(m) ? maxDemandOf(p) : undefined };
}

/** A month's bill for `kwh` from the grid, at today's prices; `fixedCharge` applies to the flat rate only. */
export function monthBill(p: Pick<Project, 'energy' | 'bill'>, kwh: number, fixedCharge = 0): number {
  const opts = tnbOptionsOf(p);
  if (!opts) return fixedCharge + Math.max(0, kwh) * p.energy.tariff;
  return tnbBill(kwh, opts).total;
}

/** Yearly electricity use: from the scanned bill when there is one, else worked back from the monthly bill. */
export function annualUsageKwh(p: Pick<Project, 'monthlyBill' | 'monthlyKwh' | 'energy' | 'bill'>): number {
  if (p.monthlyKwh && p.monthlyKwh > 0) return p.monthlyKwh * 12;
  if (p.monthlyBill <= 0) return 0;
  const opts = tnbOptionsOf(p);
  if (opts) return tnbKwhForBill(p.monthlyBill, opts) * 12;
  return p.energy.tariff > 0 ? (p.monthlyBill * 12) / p.energy.tariff : 0;
}

export interface BillMonth {
  month: string;
  /** solar generation, kWh */
  solarKwh: number;
  /** electricity used, kWh */
  usageKwh: number;
  /** grid use before solar, kWh (= usage) */
  gridBeforeKwh: number;
  /** grid use with solar after using carried credit, kWh */
  gridAfterKwh: number;
  billBefore: number;
  billAfter: number;
  /** exported kWh carried to later months */
  creditKwh: number;
  savings: number;
}

/**
 * One year of monthly bills with and without solar. Use is spread over the months by their number
 * of days. Solar first covers that month's use; extra solar is exported and its kWh offset grid
 * use in later months of the same year (net energy metering); credit left at the end of the year
 * is lost. Each bill is then worked out on the kWh actually bought from the grid, so tariff bands,
 * the retail charge and AFA waivers and the Energy Efficiency Incentive follow the lower use.
 * Prices rise by the escalation rate each year. With no known use, every kWh of solar counts as a
 * saving at the average rate.
 */
export function billYear(p: Project, monthlyGenKwh: number[], year: number, fixedCharge = 0): BillMonth[] {
  const e = p.energy;
  const rise = Math.pow(1 + e.escalation / 100, year - 1);
  const factor = outputFactor(e, year);
  const annualUse = annualUsageKwh(p);
  let creditKwh = 0;
  return monthlyGenKwh.map((g0, m) => {
    const solarKwh = g0 * factor;
    if (annualUse <= 0) {
      const savings = solarKwh * e.tariff * rise;
      return { month: MONTHS[m], solarKwh, usageKwh: 0, gridBeforeKwh: 0, gridAfterKwh: 0, billBefore: 0, billAfter: 0, creditKwh: 0, savings };
    }
    const usageKwh = (annualUse * DAYS[m]) / 365;
    let gridAfterKwh = usageKwh - solarKwh;
    if (gridAfterKwh < 0) {
      creditKwh += -gridAfterKwh;
      gridAfterKwh = 0;
    } else {
      const used = Math.min(creditKwh, gridAfterKwh);
      creditKwh -= used;
      gridAfterKwh -= used;
    }
    const billBefore = monthBill(p, usageKwh, fixedCharge) * rise;
    const billAfter = monthBill(p, gridAfterKwh, fixedCharge) * rise;
    return { month: MONTHS[m], solarKwh, usageKwh, gridBeforeKwh: usageKwh, gridAfterKwh, billBefore, billAfter, creditKwh, savings: billBefore - billAfter };
  });
}

export interface Financials {
  /** net system price (after discount) */
  systemCost: number;
  firstYearSavings: number;
  savings25: number;
  netSavings25: number;
  paybackYears: number | null;
  /** cumulative net cash position at end of each year 0..25 */
  cashflow: { year: number; cumulative: number; savings: number }[];
}

export function financialsFor(p: Project, energy: Pick<EnergyResult, 'monthlyKwh'>): Financials {
  const systemCost = netSystemPrice(p);
  let cumulative = -systemCost;
  let total = 0;
  let paybackYears: number | null = null;
  const cashflow = [{ year: 0, cumulative, savings: 0 }];
  for (let y = 1; y <= 25; y++) {
    const savings = billYear(p, energy.monthlyKwh, y).reduce((s, m) => s + m.savings, 0);
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

/* ------------------------------------------------------------------ */
/* Environmental benefits                                              */
/* ------------------------------------------------------------------ */

/** Malaysian grid emission factor, kg CO₂ per kWh (Peninsular grid, approx.) */
export const GRID_KG_CO2_PER_KWH = 0.758;
/** kg CO₂ per km for an average petrol car (approx.) */
const CAR_KG_CO2_PER_KM = 0.79;
/** kg CO₂ a tree takes up over its growing life (approx.) */
const TREE_KG_CO2 = 123;
/** tonnes CO₂ per passenger for a long-haul return flight (approx.) */
const FLIGHT_T_CO2 = 1.1;

export interface Environment {
  /** tonnes CO₂ avoided in the first year */
  co2TonsPerYear: number;
  carKm: number;
  trees: number;
  flights: number;
}

/** CO₂ avoided by the system's production over 25 years, and everyday equivalents. */
export function environmentFor(p: Project, annualKwh: number): Environment {
  let lifetimeKwh = 0;
  for (let y = 1; y <= 25; y++) lifetimeKwh += annualKwh * outputFactor(p.energy, y);
  const lifetimeKg = lifetimeKwh * GRID_KG_CO2_PER_KWH;
  return {
    co2TonsPerYear: (annualKwh * outputFactor(p.energy, 1) * GRID_KG_CO2_PER_KWH) / 1000,
    carKm: lifetimeKg / CAR_KG_CO2_PER_KM,
    trees: lifetimeKg / TREE_KG_CO2,
    flights: lifetimeKg / 1000 / FLIGHT_T_CO2,
  };
}
