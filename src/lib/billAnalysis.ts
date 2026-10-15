/**
 * Turn a parsed TNB bill into the numbers a proposal needs.
 * Pure function (type-only imports) so it can be tested with Node.
 */
import { NAME_HIDDEN, type BillCategory, type TnbBill } from './tnbBill';

export const CATEGORY_LABEL: Record<BillCategory, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Factory / industrial',
};

/**
 * Share of yearly use to cover with solar, by default. Homes can export surplus under NEM;
 * shops and factories mostly use power in the daytime, so they're sized for self-consumption.
 */
export const DEFAULT_TARGET_OFFSET: Record<BillCategory, number> = {
  residential: 100,
  commercial: 80,
  industrial: 70,
};

export interface BillAnalysis {
  /** average monthly use, kWh */
  monthlyKwh: number;
  /** how monthlyKwh was worked out */
  monthlySource: 'average on bill' | '6-month history' | 'this bill';
  /** RM per kWh actually paid, excluding the fixed retail charge; null if usage is too low to tell */
  effectiveTariff: number | null;
  /** average of the bill's monthly charges, RM (for NEM customers this is after their existing solar) */
  averageBillRm: number | null;
  targetOffsetPct: number;
  recommendedKw: number;
  recommendedPanels: number;
  /** estimated first-year production of the recommended system, kWh */
  annualKwh: number;
  notes: string[];
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

export function analyseBill(
  bill: TnbBill,
  opts: { peakSunHours: number; panelWattage: number; targetOffsetPct?: number; performanceRatio?: number },
): BillAnalysis {
  const notes: string[] = [];
  const pr = opts.performanceRatio ?? 0.8;

  const historyKwh = bill.history.map((h) => h.kwh).filter((k): k is number => k !== null && k > 0);
  let monthlyKwh: number;
  let monthlySource: BillAnalysis['monthlySource'];
  if (bill.averageKwh && bill.averageKwh > 0) {
    monthlyKwh = bill.averageKwh;
    monthlySource = 'average on bill';
  } else if (historyKwh.length) {
    monthlyKwh = historyKwh.reduce((a, b) => a + b, 0) / historyKwh.length;
    monthlySource = '6-month history';
  } else {
    monthlyKwh = bill.usageKwh ?? 0;
    monthlySource = 'this bill';
  }
  monthlyKwh = Math.round(monthlyKwh);

  const c = bill.charges;
  const usage = bill.usageKwh ?? 0;
  const effectiveTariff =
    usage >= 50 && c.usageChargeRm !== null
      ? round((c.usageChargeRm - (c.retailRm ?? 0) + (c.serviceTaxRm ?? 0) + (c.kwtbbRm ?? 0)) / usage, 4)
      : null;

  const rms = bill.history.map((h) => h.rm).filter((r): r is number => r !== null);
  const averageBillRm = rms.length ? round(rms.reduce((a, b) => a + b, 0) / rms.length) : null;

  const targetOffsetPct = opts.targetOffsetPct ?? DEFAULT_TARGET_OFFSET[bill.category];
  const yearlyTarget = monthlyKwh * 12 * (targetOffsetPct / 100);
  let rawKw = opts.peakSunHours > 0 && monthlyKwh >= 50 ? yearlyTarget / (opts.peakSunHours * 365 * pr) : 0;
  // Shops and factories: keep peak solar output within the site's recorded maximum demand,
  // so the power is used on site rather than exported.
  const cappedAtDemand = bill.category !== 'residential' && !!bill.maxDemandKw && rawKw > bill.maxDemandKw;
  if (cappedAtDemand) rawKw = bill.maxDemandKw!;
  const recommendedPanels = rawKw > 0 ? (cappedAtDemand ? Math.floor : Math.ceil)((rawKw * 1000) / opts.panelWattage) : 0;
  const recommendedKw = round((recommendedPanels * opts.panelWattage) / 1000, 3);
  const annualKwh = Math.round(recommendedKw * opts.peakSunHours * 365 * pr);

  if (monthlyKwh < 50) notes.push('Usage is very low, so no system is recommended.');
  if (bill.nem) {
    notes.push(
      'Already on NEM with solar: the bill only shows power taken from the grid, so a new system would add to the existing one.',
    );
  }
  if (bill.category === 'residential') {
    notes.push('Homes on the tiered domestic tariff save most on their highest-priced units, so savings may beat this estimate.');
  }
  if (bill.category !== 'residential' && !cappedAtDemand && recommendedKw > 0) {
    notes.push(`Sized to cover ${targetOffsetPct}% of yearly use, matching typical daytime demand. Check the load profile on site.`);
  }
  if (cappedAtDemand) {
    notes.push(
      `Limited to the ${bill.maxDemandKw} kW maximum demand on the bill, so solar power is used on site rather than exported. Check TNB's current NEM limits for this tariff.`,
    );
  }

  return { monthlyKwh, monthlySource, effectiveTariff, averageBillRm, targetOffsetPct, recommendedKw, recommendedPanels, annualKwh, notes };
}

/** Project fields filled in from a scanned bill (see createProject / updateProject). */
export function billProjectFields(bill: TnbBill, a: BillAnalysis) {
  const facts = [
    `Created from TNB bill${bill.accountNo ? ` for account ${bill.accountNo}` : ''}${bill.billDate ? ` dated ${bill.billDate}` : ''}.`,
    bill.tariff && `Tariff: ${bill.tariff} (${CATEGORY_LABEL[bill.category].toLowerCase()}).`,
    `Average use ${a.monthlyKwh.toLocaleString()} kWh/month (${a.monthlySource}).`,
    ...bill.warnings.filter((w) => w !== NAME_HIDDEN),
  ].filter(Boolean);
  return {
    monthlyBill: Math.round(a.averageBillRm ?? bill.currentCharge ?? 0),
    monthlyKwh: a.monthlyKwh > 0 ? a.monthlyKwh : undefined,
    importedKw: a.recommendedKw > 0 ? a.recommendedKw : undefined,
    bill: { ...bill, scannedAt: new Date().toISOString(), targetOffsetPct: a.targetOffsetPct },
    energy: a.effectiveTariff ? { tariff: a.effectiveTariff } : {},
    notes: facts.join('\n'),
  };
}
