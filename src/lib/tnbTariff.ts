/**
 * TNB electricity bills, tariffs from 1 July 2025: Domestic and Non-Domestic (Low, Medium and
 * High Voltage), each General or Time of Use. Self-contained (no imports) so the tests can load
 * it directly with Node. Taxes (SST, KWTBB) are not included.
 *
 * Domestic, per month, for the month's total kWh:
 * - energy charge: one rate for all kWh, higher above 1,500 kWh (ToU: peak / off-peak rates);
 * - capacity and network charges per kWh;
 * - retail charge RM10 and AFA, both waived at 800 kWh and below;
 * - Energy Efficiency Incentive (rebate per kWh) at 1,000 kWh and below.
 *
 * Non-Domestic:
 * - Low Voltage: energy, capacity and network charges per kWh, retail RM20, and an Energy
 *   Efficiency Incentive of 11 sen/kWh at 200 kWh and below;
 * - Medium / High Voltage: energy charge per kWh, capacity and network charges per kW of maximum
 *   demand (ToU: of maximum demand in the peak period), retail RM200 / RM250;
 * - AFA for all kWh (no waiver).
 */

export type TnbTariffId = 'dom' | 'dom-tou' | 'lv' | 'lv-tou' | 'mv' | 'mv-tou' | 'hv' | 'hv-tou';

export interface TnbOptions {
  /** Domestic General when left out (Domestic ToU if `touPeakPct` is given) */
  tariff?: TnbTariffId;
  /** ToU tariffs: share of use in the peak period, % */
  touPeakPct?: number;
  /** AFA rate for the month, sen/kWh (can be negative) */
  afaSen: number;
  /** Medium / High Voltage: maximum demand for the month, kW */
  maxDemandKw?: number;
}

export interface TnbBill {
  kwh: number;
  energy: number;
  capacity: number;
  network: number;
  retail: number;
  afa: number;
  eei: number;
  total: number;
}

export const TNB_2025 = {
  effectiveFrom: '1 July 2025',
  /* Domestic, sen/kWh */
  energyLow: 27.03,
  energyHigh: 37.03,
  touPeakLow: 28.52,
  touOffPeakLow: 24.43,
  touPeakHigh: 38.52,
  touOffPeakHigh: 34.43,
  capacity: 4.55,
  network: 12.85,
  /** RM/month */
  retail: 10,
  /** above this many kWh a month, the higher energy rates apply */
  highAboveKwh: 1500,
  /** at or below this, retail charge and AFA are waived */
  waiverUpToKwh: 800,
  /** Energy Efficiency Incentive: [up to kWh, sen/kWh] for monthly use of 1,000 kWh and below */
  eei: [
    [200, -25.0],
    [250, -24.5],
    [300, -22.5],
    [350, -21.0],
    [400, -17.0],
    [450, -14.5],
    [500, -12.0],
    [550, -10.5],
    [600, -9.0],
    [650, -7.5],
    [700, -5.5],
    [750, -4.5],
    [800, -4.0],
    [850, -2.5],
    [900, -1.0],
    [1000, -0.5],
  ] as [number, number][],

  /* Non-Domestic */
  lv: {
    /** sen/kWh */
    energy: 27.03,
    touPeak: 28.52,
    touOffPeak: 24.43,
    capacity: 8.83,
    network: 14.82,
    /** RM/month */
    retail: 20,
    /** Energy Efficiency Incentive at 200 kWh and below, sen/kWh */
    eeiUpToKwh: 200,
    eei: -11,
  },
  mv: {
    /** sen/kWh */
    energy: 29.83,
    touPeak: 31.32,
    touOffPeak: 27.23,
    /** RM per kW of maximum demand per month (ToU: in the peak period) */
    capacityKw: 29.43,
    networkKw: 59.84,
    touCapacityKw: 30.19,
    touNetworkKw: 66.87,
    /** RM/month */
    retail: 200,
  },
  hv: {
    energy: 43.03,
    touPeak: 44.52,
    touOffPeak: 40.43,
    capacityKw: 16.68,
    networkKw: 14.53,
    touCapacityKw: 21.76,
    touNetworkKw: 23.06,
    retail: 250,
  },
};

export const TNB_TARIFF_NAME: Record<TnbTariffId, string> = {
  dom: 'Domestic General',
  'dom-tou': 'Domestic ToU',
  lv: 'Non-Domestic Low Voltage General',
  'lv-tou': 'Non-Domestic Low Voltage ToU',
  mv: 'Non-Domestic Medium Voltage General',
  'mv-tou': 'Non-Domestic Medium Voltage ToU',
  hv: 'Non-Domestic High Voltage General',
  'hv-tou': 'Non-Domestic High Voltage ToU',
};

const isTou = (id: TnbTariffId) => id.endsWith('-tou');
const levelOf = (id: TnbTariffId) => id.replace('-tou', '') as 'dom' | 'lv' | 'mv' | 'hv';
/** Medium and High Voltage charge capacity and network per kW of maximum demand */
export const usesMaxDemand = (id: TnbTariffId) => levelOf(id) === 'mv' || levelOf(id) === 'hv';

const blend = (peak: number, offPeak: number, peakPct = 50) => {
  const share = Math.min(100, Math.max(0, peakPct)) / 100;
  return peak * share + offPeak * (1 - share);
};

const tariffOf = (opts: TnbOptions): TnbTariffId => opts.tariff ?? (opts.touPeakPct != null ? 'dom-tou' : 'dom');

/** Domestic Energy Efficiency Incentive rate for a month's use, sen/kWh (0 above 1,000 kWh). */
export function eeiRateSen(kwh: number): number {
  if (kwh <= 0) return 0;
  const band = TNB_2025.eei.find(([upTo]) => Math.ceil(kwh) <= upTo);
  return band ? band[1] : 0;
}

/** Average energy charge for the month, sen/kWh. */
export function energyRateSen(kwh: number, opts: Pick<TnbOptions, 'tariff' | 'touPeakPct'> = {}): number {
  const id = tariffOf({ ...opts, afaSen: 0 });
  const level = levelOf(id);
  if (level === 'dom') {
    const high = kwh > TNB_2025.highAboveKwh;
    if (!isTou(id)) return high ? TNB_2025.energyHigh : TNB_2025.energyLow;
    return high ? blend(TNB_2025.touPeakHigh, TNB_2025.touOffPeakHigh, opts.touPeakPct) : blend(TNB_2025.touPeakLow, TNB_2025.touOffPeakLow, opts.touPeakPct);
  }
  const t = TNB_2025[level];
  return isTou(id) ? blend(t.touPeak, t.touOffPeak, opts.touPeakPct) : t.energy;
}

/** The month's bill in RM for `kwh` bought from the grid. */
export function tnbBill(kwh: number, opts: TnbOptions): TnbBill {
  const k = Math.max(0, kwh);
  const id = tariffOf(opts);
  const level = levelOf(id);
  const energy = (k * energyRateSen(k, { tariff: id, touPeakPct: opts.touPeakPct })) / 100;
  let capacity: number;
  let network: number;
  let retail: number;
  let afa = (k * opts.afaSen) / 100;
  let eei = 0;
  if (level === 'dom') {
    const waived = k <= TNB_2025.waiverUpToKwh;
    capacity = (k * TNB_2025.capacity) / 100;
    network = (k * TNB_2025.network) / 100;
    retail = k > 0 && !waived ? TNB_2025.retail : 0;
    if (waived) afa = 0;
    eei = (k * eeiRateSen(k)) / 100;
  } else if (level === 'lv') {
    const t = TNB_2025.lv;
    capacity = (k * t.capacity) / 100;
    network = (k * t.network) / 100;
    retail = t.retail;
    eei = k > 0 && Math.ceil(k) <= t.eeiUpToKwh ? (k * t.eei) / 100 : 0;
  } else {
    const t = TNB_2025[level];
    const md = Math.max(0, opts.maxDemandKw ?? 0);
    capacity = md * (isTou(id) ? t.touCapacityKw : t.capacityKw);
    network = md * (isTou(id) ? t.touNetworkKw : t.networkKw);
    retail = t.retail;
  }
  const total = Math.max(0, energy + capacity + network + retail + afa + eei);
  return { kwh: k, energy, capacity, network, retail, afa, eei, total };
}

/** Domestic bill (kept for callers that only deal with homes). */
export function tnbDomesticBill(kwh: number, opts: TnbOptions): TnbBill {
  return tnbBill(kwh, { ...opts, tariff: opts.tariff ?? (opts.touPeakPct != null ? 'dom-tou' : 'dom') });
}

/** Monthly kWh that gives a bill of `rm` (inverse of tnbBill). */
export function tnbKwhForBill(rm: number, opts: TnbOptions): number {
  if (rm <= tnbBill(0, opts).total) return 0;
  let lo = 0;
  let hi = 10_000_000;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (tnbBill(mid, opts).total < rm) lo = mid;
    else hi = mid;
  }
  return Math.round(hi);
}

/** The rates of a tariff as rows for a table: [charge, rate]. */
export function tnbTariffRows(id: TnbTariffId, opts: { touPeakPct?: number; afaSen: number; maxDemandKw?: number }): [string, string][] {
  const sen = (v: number) => `${v.toFixed(2)} sen / kWh`;
  const rm = (v: number, unit: string) => `RM ${v.toFixed(2)} / ${unit}`;
  const level = levelOf(id);
  const tou = isTou(id);
  const afa: [string, string] = [`AFA${level === 'dom' ? ' (waived at 800 kWh and below)' : ''}`, `${opts.afaSen.toFixed(2)} sen / kWh (changes monthly)`];
  const peakShare: [string, string][] = tou ? [['Share of use in the peak period (assumed)', `${Math.round(opts.touPeakPct ?? 50)}%`]] : [];
  if (level === 'dom') {
    return [
      ...((tou
        ? [
            ['Energy Charge, peak (2pm–10pm Mon–Fri), 1,500 kWh and below', sen(TNB_2025.touPeakLow)],
            ['Energy Charge, off-peak, 1,500 kWh and below', sen(TNB_2025.touOffPeakLow)],
            ['Energy Charge, peak, above 1,500 kWh', sen(TNB_2025.touPeakHigh)],
            ['Energy Charge, off-peak, above 1,500 kWh', sen(TNB_2025.touOffPeakHigh)],
          ]
        : [
            ['Energy Charge, 1,500 kWh and below per month', sen(TNB_2025.energyLow)],
            ['Energy Charge, above 1,500 kWh per month', sen(TNB_2025.energyHigh)],
          ]) as [string, string][]),
      ...peakShare,
      ['Capacity Charge', sen(TNB_2025.capacity)],
      ['Network Charge', sen(TNB_2025.network)],
      ['Retail Charge (waived at 800 kWh and below)', rm(TNB_2025.retail, 'month')],
      afa,
      ['Energy Efficiency Incentive (1,000 kWh and below)', 'rebate of 0.5 – 25 sen / kWh, larger for lower use'],
    ];
  }
  const energyRows: [string, string][] =
    level === 'lv' || level === 'mv' || level === 'hv'
      ? tou
        ? [
            ['Energy Charge, peak period', sen(TNB_2025[level].touPeak)],
            ['Energy Charge, off-peak period', sen(TNB_2025[level].touOffPeak)],
          ]
        : [['Energy Charge', sen(TNB_2025[level].energy)]]
      : [];
  if (level === 'lv') {
    const t = TNB_2025.lv;
    return [
      ...energyRows,
      ...peakShare,
      ['Capacity Charge', sen(t.capacity)],
      ['Network Charge', sen(t.network)],
      ['Retail Charge', rm(t.retail, 'month')],
      afa,
      [`Energy Efficiency Incentive (${t.eeiUpToKwh} kWh and below)`, sen(t.eei)],
    ];
  }
  const t = TNB_2025[level];
  const per = tou ? 'kW of maximum demand in the peak period' : 'kW of maximum demand';
  return [
    ...energyRows,
    ...peakShare,
    [`Capacity Charge, per ${per}`, rm(tou ? t.touCapacityKw : t.capacityKw, 'kW')],
    [`Network Charge, per ${per}`, rm(tou ? t.touNetworkKw : t.networkKw, 'kW')],
    ['Maximum demand (assumed unchanged with solar)', opts.maxDemandKw ? `${Math.round(opts.maxDemandKw)} kW` : 'not given'],
    ['Retail Charge', rm(t.retail, 'month')],
    afa,
  ];
}
