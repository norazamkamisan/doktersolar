/**
 * TNB domestic electricity bill, tariff from 1 July 2025 (Domestic General and Domestic ToU).
 * Self-contained (no imports) so the tests can load it directly with Node.
 *
 * Per month, for the month's total kWh:
 * - energy charge: one rate for all kWh, higher when the month is above 1,500 kWh
 *   (ToU: separate peak / off-peak rates);
 * - capacity and network charges for all kWh;
 * - retail charge RM10, waived at 800 kWh and below;
 * - AFA (Automatic Fuel Adjustment) at the month's rate for all kWh, waived at 800 kWh and below;
 * - Energy Efficiency Incentive (a rebate per kWh) at 1,000 kWh and below.
 * Taxes (SST, KWTBB) are not included.
 */

export interface TnbOptions {
  /** Domestic ToU: share of use in the peak period (2pm–10pm Mon–Fri), %. Leave out for Domestic General. */
  touPeakPct?: number;
  /** AFA rate for the month, sen/kWh (can be negative) */
  afaSen: number;
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
  /** sen/kWh */
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
};

/** Energy Efficiency Incentive rate for a month's use, sen/kWh (0 above 1,000 kWh). */
export function eeiRateSen(kwh: number): number {
  if (kwh <= 0) return 0;
  const band = TNB_2025.eei.find(([upTo]) => Math.ceil(kwh) <= upTo);
  return band ? band[1] : 0;
}

/** Average energy charge for the month, sen/kWh. */
export function energyRateSen(kwh: number, touPeakPct?: number): number {
  const high = kwh > TNB_2025.highAboveKwh;
  if (touPeakPct == null) return high ? TNB_2025.energyHigh : TNB_2025.energyLow;
  const peak = Math.min(100, Math.max(0, touPeakPct)) / 100;
  const [pk, op] = high ? [TNB_2025.touPeakHigh, TNB_2025.touOffPeakHigh] : [TNB_2025.touPeakLow, TNB_2025.touOffPeakLow];
  return pk * peak + op * (1 - peak);
}

/** The month's bill in RM for `kwh` used from the grid. */
export function tnbDomesticBill(kwh: number, opts: TnbOptions): TnbBill {
  const k = Math.max(0, kwh);
  const waived = k <= TNB_2025.waiverUpToKwh;
  const energy = (k * energyRateSen(k, opts.touPeakPct)) / 100;
  const capacity = (k * TNB_2025.capacity) / 100;
  const network = (k * TNB_2025.network) / 100;
  const retail = k > 0 && !waived ? TNB_2025.retail : 0;
  const afa = waived ? 0 : (k * opts.afaSen) / 100;
  const eei = (k * eeiRateSen(k)) / 100;
  const total = Math.max(0, energy + capacity + network + retail + afa + eei);
  return { kwh: k, energy, capacity, network, retail, afa, eei, total };
}

/** Monthly kWh that gives a bill of `rm` (inverse of tnbDomesticBill). */
export function tnbKwhForBill(rm: number, opts: TnbOptions): number {
  if (rm <= 0) return 0;
  let lo = 0;
  let hi = 100000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (tnbDomesticBill(mid, opts).total < rm) lo = mid;
    else hi = mid;
  }
  return Math.round(hi);
}
