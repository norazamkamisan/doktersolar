/**
 * Read the data on a TNB (Tenaga Nasional Berhad) e-bill PDF.
 *
 * Works on positioned text runs from pdf.js (see pdfText.ts), because the bill is laid out in
 * columns: values are read from directly under their labels, and table rows from the same
 * baseline. Pure functions with type-only imports, so they can be tested with Node.
 */

/** A positioned text run (PDF points; y grows upwards). */
export interface BillRun {
  text: string;
  x: number;
  y: number;
  w: number;
}

export type BillCategory = 'residential' | 'commercial' | 'industrial';

export interface BillHistoryMonth {
  /** e.g. "Sep 2026" */
  month: string;
  rm: number | null;
  kwh: number | null;
}

export interface TnbBill {
  fileName?: string;
  customerName: string;
  postalAddress: string;
  premiseAddress: string;
  accountNo: string;
  invoiceNo: string;
  /** ISO dates (yyyy-mm-dd) */
  billDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  periodDays: number | null;
  dueDate: string | null;
  readingType: string;
  tariff: string;
  category: BillCategory;
  deposit: number | null;
  totalDue: number | null;
  previousBalance: number | null;
  currentCharge: number | null;
  usageKwh: number | null;
  charges: {
    energyRate: number | null;
    energyRm: number | null;
    afaRm: number | null;
    capacityRate: number | null;
    capacityRm: number | null;
    networkRate: number | null;
    networkRm: number | null;
    retailRm: number | null;
    /** rebates and incentives (negative) */
    rebatesRm: number | null;
    maxDemandRm: number | null;
    /** "Caj Penggunaan Bulan Semasa" */
    usageChargeRm: number | null;
    serviceTaxRm: number | null;
    kwtbbRm: number | null;
    lateSurchargeRm: number | null;
  };
  history: BillHistoryMonth[];
  averageKwh: number | null;
  meterNo: string;
  importKwh: number | null;
  exportKwh: number | null;
  maxDemandKw: number | null;
  kvarh: number | null;
  declaredLoadKw: number | null;
  powerFactor: number | null;
  nem: { certificateNo: string; balanceKwh: number | null } | null;
  warnings: string[];
}

/* ------------------------------------------------------------------ */
/* Small parsers                                                       */
/* ------------------------------------------------------------------ */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mac: 3, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7,
  ogo: 8, ogos: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dis: 12, dec: 12,
};
const EN_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "RM124,190.74", "−0.02", "1,571.00" → number */
/** warning shown when the bill masks the customer's name (until one is typed in) */
export const NAME_HIDDEN = 'Customer name is hidden on this bill; please type it in.';

export function money(s: string | undefined | null): number | null {
  if (!s) return null;
  const m = s.replace(/[−–]/g, '-').replace(/\s/g, '').match(/-?(?:RM)?-?[\d,]*\.?\d+/i);
  if (!m) return null;
  const neg = m[0].includes('-');
  const n = Number(m[0].replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

/** "01.10.2026" → "2026-10-01" */
const dmy = (s: string | undefined) => {
  const m = s?.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

/** "31 Okt 2026" → "2026-10-31" */
const malayDate = (s: string | undefined) => {
  const m = s?.match(/(\d{1,2})\s+([A-Za-z]{3,4})\s+(\d{4})/);
  const mon = m && MONTHS[m[2].toLowerCase()];
  return m && mon ? `${m[3]}-${String(mon).padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
};

/** "OGO-26" / "Apr-26" → "Aug 2026" */
const monthLabel = (s: string) => {
  const m = s.match(/([A-Za-z]{3,4})-(\d{2})/);
  const mon = m && MONTHS[m[1].toLowerCase()];
  return m && mon ? `${EN_MONTH[mon - 1]} 20${m[2]}` : s;
};

/** a table amount: "1,571.00", "-33.53", "−0.11" (excludes dates and labels from side panels) */
const AMOUNT = /^[−-]?\s*[\d,]+\.\d{2}$/;

/* ------------------------------------------------------------------ */
/* Layout helpers                                                      */
/* ------------------------------------------------------------------ */

type Page = BillRun[];

const LABELS = /^(ALAMAT POS|ALAMAT PREMIS|TARIKH BIL|TEMPOH BIL|NO\. ?INVOIS|DEPOSIT SEKURITI|NO\. AKAUN|JENIS BACAAN|TARIF|BAYARAN BAGI TEMPOH|NO\. ?SIJIL NEM|MAKLUMAT BAYARAN AKHIR|Tempoh Bil)$/;

function find(page: Page, re: RegExp): BillRun | undefined {
  return page.find((r) => re.test(r.text.trim()));
}

/** Lines of text directly under a label, in the label's column. */
function below(page: Page, label: RegExp, { maxGap = 16, maxLines = 6, width = 200 } = {}): string[] {
  const l = find(page, label);
  if (!l) return [];
  const col = page
    .filter((r) => r.y < l.y - 1 && Math.abs(r.x - l.x) <= 6 && r.x < l.x + width)
    .sort((a, b) => b.y - a.y);
  const out: string[] = [];
  let lastY = l.y;
  for (const r of col) {
    if (lastY - r.y > maxGap || out.length >= maxLines) break;
    if (LABELS.test(r.text.trim())) break;
    out.push(r.text.trim());
    lastY = r.y;
  }
  return out;
}

/** All runs on the same baseline as `run`, left of `xMax`, after the run itself. */
function sameLine(page: Page, run: BillRun, xMax = 470): string[] {
  return page
    .filter((r) => Math.abs(r.y - run.y) <= 2.5 && r.x > run.x + 1 && r.x < xMax)
    .sort((a, b) => a.x - b.x)
    .map((r) => r.text.trim());
}

/** Table row: label run → last amount on the row (the "Jumlah" column). */
function rowTotal(page: Page, label: RegExp): { label: string; total: number | null } | null {
  const run = page.find((r) => label.test(r.text.trim()) && r.x < 300);
  if (!run) return null;
  const nums = sameLine(page, run).filter((t) => AMOUNT.test(t));
  return { label: run.text.trim(), total: nums.length ? money(nums[nums.length - 1]) : null };
}

/** Sum of every row whose label matches (e.g. two AFA rows in one bill). */
function rowsTotal(page: Page, label: RegExp): number | null {
  const runs = page.filter((r) => label.test(r.text.trim()) && r.x < 300);
  if (!runs.length) return null;
  let sum = 0;
  for (const run of runs) {
    const nums = sameLine(page, run).filter((t) => AMOUNT.test(t));
    if (nums.length) sum += money(nums[nums.length - 1]) ?? 0;
  }
  return Math.round(sum * 100) / 100;
}

const rateIn = (label: string | undefined) => {
  const m = label?.match(/RM\s?(-?\d*\.\d+)\s*\/\s*kWh/i);
  return m ? Number(m[1]) : null;
};

/* ------------------------------------------------------------------ */
/* Main parser                                                         */
/* ------------------------------------------------------------------ */

export function isTnbBill(pages: Page[]): boolean {
  const text = pages.flat().map((r) => r.text).join(' ');
  return /Bil Elektrik Anda|TENAGA NASIONAL|myTNB/i.test(text) && /NO\. AKAUN/.test(text);
}

export function parseTnbBill(pages: Page[], fileName?: string): TnbBill {
  if (!isTnbBill(pages)) throw new Error("This doesn't look like a TNB electricity bill (PDF from myTNB or e-mail).");
  const p1 = pages[0] ?? [];
  const all = pages.flat();
  const detail = pages.find((pg) => find(pg, /^Jumlah Penggunaan Anda/)) ?? pages[1] ?? [];
  const meterPage = pages.find((pg) => find(pg, /^Maklumat Meter$/)) ?? detail;
  const warnings: string[] = [];

  // Header (page 1)
  const postal = below(p1, /^ALAMAT POS$/, { maxLines: 7 });
  const premise = below(pages.find((pg) => find(pg, /^ALAMAT PREMIS$/)) ?? [], /^ALAMAT PREMIS$/, { maxLines: 6 });
  const period = below(p1, /^TEMPOH BIL$/, { maxLines: 2 }).join(' ');
  const periodM = period.match(/(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{2}\.\d{2}\.\d{4})/);
  const days = period.match(/\((\d+)\s*Hari\)/i);
  const tariff = below(p1, /^TARIF$/, { maxLines: 2 }).join(' ').trim();

  const firstBelow = (re: RegExp) => below(p1, re, { maxLines: 1 })[0] ?? '';

  // Name: first postal line, unless it's a masked placeholder
  const nameLine = postal[0] ?? '';
  const customerName = /^X{5,}$/.test(nameLine.replace(/\s/g, '')) ? '' : nameLine;
  if (!customerName) warnings.push(NAME_HIDDEN);
  const addrFrom = (lines: string[], skipFirst: boolean) =>
    (skipFirst ? lines.slice(1) : lines)
      .map((l) => l.trim().replace(/^[,\s]+|[,\s]+$/g, ''))
      .filter((l) => l && !/^X+$/.test(l.replace(/\s/g, '')))
      .join(', ');

  // Summary amounts
  const amountBelow = (label: RegExp) => {
    const l = find(p1, label);
    if (!l) return null;
    const cand = p1
      .filter((r) => r.y < l.y && l.y - r.y < 60 && Math.abs(r.x + r.w / 2 - (l.x + l.w / 2)) < 70 && /\d/.test(r.text) && /^[−-]?\s*[\d,]+\.\d{2}$/.test(r.text.trim()))
      .sort((a, b) => b.y - a.y);
    return cand.length ? money(cand[0].text) : null;
  };
  const tableAmount = (label: RegExp) => {
    const l = find(p1, label);
    if (!l) return null;
    const v = p1.find((r) => Math.abs(r.y - l.y) <= 2.5 && r.x > l.x && /RM/.test(r.text));
    return v ? money(v.text) : null;
  };

  const totalDue = amountBelow(/^Jumlah Bil Anda/);
  const previousBalance = amountBelow(/^Baki Terdahulu \(RM\)$/) ?? tableAmount(/^Baki Terdahulu/);
  // "31 Okt 2026" is centred under its label rather than left-aligned
  const dueLabel = find(p1, /^Sila bayar sebelum$/);
  const dueLine = dueLabel
    ? p1
        .filter((r) => r.y < dueLabel.y && dueLabel.y - r.y < 40 && Math.abs(r.x + r.w / 2 - (dueLabel.x + dueLabel.w / 2)) < 80)
        .map((r) => r.text)
        .find((t) => /\d{1,2}\s+[A-Za-z]{3,4}\s+\d{4}/.test(t)) ?? ''
    : '';

  // Charges table
  const usageRow = rowTotal(detail, /^Jumlah Penggunaan Anda/);
  const energy = rowTotal(detail, /^Tenaga \(RM/);
  const capacity = rowTotal(detail, /^Kapasiti \(RM/);
  const network = rowTotal(detail, /^Caj Rangkaian \(RM/);
  const currentChargeRow = rowTotal(detail, /^Caj Semasa$/);
  const rebates = (rowsTotal(detail, /^(Rebat|Insentif)/i) ?? 0) || null;

  const charges: TnbBill['charges'] = {
    energyRate: rateIn(energy?.label),
    energyRm: energy?.total ?? null,
    afaRm: rowsTotal(detail, /^AFA/),
    capacityRate: rateIn(capacity?.label),
    capacityRm: capacity?.total ?? null,
    networkRate: rateIn(network?.label),
    networkRm: network?.total ?? null,
    retailRm: rowTotal(detail, /^Caj Peruncitan/)?.total ?? null,
    rebatesRm: rebates,
    maxDemandRm: rowTotal(detail, /^Caj Permintaan Maksim/i)?.total ?? null,
    usageChargeRm: rowTotal(detail, /^Caj Penggunaan Bulan Semasa/)?.total ?? null,
    serviceTaxRm: rowTotal(detail, /^Cukai Perkhidmatan/)?.total ?? null,
    kwtbbRm: rowTotal(detail, /^KWTBB/)?.total ?? null,
    lateSurchargeRm: rowTotal(detail, /^Surcaj Lewat Bayar/)?.total ?? null,
  };

  // 6-month history: RM bars on the left, kWh table on the right (when shown)
  const history: BillHistoryMonth[] = [];
  const chartTop = find(p1, /^Caj Bulanan \(RM\)/);
  if (chartTop) {
    const region = p1.filter((r) => r.y < chartTop.y && chartTop.y - r.y < 260 && r.x < 300);
    const rms = region.filter((r) => /RM[\d,]+\.\d{2}$/.test(r.text)).sort((a, b) => b.y - a.y);
    const labels = region.filter((r) => /^[A-Za-z]{3,4}-\d{2}$/.test(r.text.trim())).sort((a, b) => b.y - a.y);
    rms.forEach((r, i) => history.push({ month: labels[i] ? monthLabel(labels[i].text.trim()) : '', rm: money(r.text), kwh: null }));
  }
  const kwhRow = p1.find((r) => r.text.trim() === 'kWh' && sameLine(p1, r, 600).filter((t) => /^[\d,]+$/.test(t)).length >= 3);
  if (kwhRow) {
    const vals = sameLine(p1, kwhRow, 600).filter((t) => /^[\d,]+$/.test(t)).map((t) => money(t));
    // align from the most recent month backwards
    for (let i = 0; i < vals.length && i < history.length; i++) history[history.length - vals.length + i].kwh = vals[i];
    if (!history.length) vals.forEach((v) => history.push({ month: '', rm: null, kwh: v }));
  }
  const avgRun = find(p1, /^Purata Penggunaan Anda/);
  const averageKwh = avgRun ? money(sameLine(p1, avgRun, 600).join(' ') || avgRun.text.split(':')[1]) : null;

  // Meter table
  let meterNo = '';
  let importKwh: number | null = null;
  let exportKwh: number | null = null;
  let maxDemandKw: number | null = null;
  let kvarh: number | null = null;
  for (const m of meterPage.filter((r) => r.text.trim() === 'M')) {
    const cells = sameLine(meterPage, m, 470);
    // only the unit cell (plus "(E)"/"(I)"), not side-panel text on the same line
    const [no, , , usage, unitCell = '', next = ''] = cells;
    const unit = /^\((E|I)\)$/.test(next) ? `${unitCell} ${next}` : unitCell;
    if (!no || usage === undefined || !unit) continue;
    meterNo ||= no;
    const v = money(usage);
    if (/kVARh/i.test(unit)) kvarh = v;
    else if (/kWh\s*\(E\)/i.test(unit)) exportKwh = v;
    else if (/kWh/i.test(unit)) importKwh = v;
    else if (/^kW$/i.test(unit.trim())) maxDemandKw = v;
  }

  // Extra info block (some commercial bills)
  const infoValue = (label: RegExp) => {
    const l = find(p1, label);
    return l ? money(sameLine(p1, l, 600).find((t) => /\d/.test(t))) : null;
  };
  const declaredLoadKw = infoValue(/^Beban Diisytiharkan/);
  const powerFactor = infoValue(/^Angkadar Kuasa/);
  const peakDemand = infoValue(/^Permintaan Maksima Tertinggi/);

  // NEM (net energy metering): customer already has solar
  const nemCert = all.find((r) => /^RYT\d+/.test(r.text.trim()))?.text.trim() ?? '';
  const nemBalRun = find(p1, /^\d[\d,]*\s*kWh$/);
  const nem = nemCert ? { certificateNo: nemCert, balanceKwh: nemBalRun ? money(nemBalRun.text) : null } : null;
  if (nem) warnings.push('This customer already has solar (NEM). Grid usage on the bill is after their existing solar.');

  // Category
  const allText = all.map((r) => r.text).join(' ');
  const category: BillCategory = /^Domestik/i.test(tariff)
    ? 'residential'
    : /Perindustrian|Industri/i.test(allText) || (maxDemandKw ?? 0) >= 100
      ? 'industrial'
      : 'commercial';

  const usageKwh = usageRow?.total ?? importKwh;
  if ((usageKwh ?? 0) < 50) warnings.push('Electricity use on this bill is very low, so a solar system may not pay off.');

  return {
    fileName,
    customerName,
    postalAddress: addrFrom(postal, true),
    premiseAddress: addrFrom(premise, false) || addrFrom(postal, true),
    accountNo: firstBelow(/^NO\. AKAUN$/),
    invoiceNo: firstBelow(/^NO\. ?INVOIS$/),
    billDate: dmy(firstBelow(/^TARIKH BIL$/)),
    periodStart: dmy(periodM?.[1]),
    periodEnd: dmy(periodM?.[2]),
    periodDays: days ? Number(days[1]) : null,
    dueDate: malayDate(dueLine),
    readingType: firstBelow(/^JENIS BACAAN$/),
    tariff,
    category,
    deposit: money(firstBelow(/^DEPOSIT SEKURITI$/)),
    totalDue,
    previousBalance,
    currentCharge: currentChargeRow?.total ?? amountBelow(/^Caj Semasa \(RM\)$/),
    usageKwh,
    charges,
    history,
    averageKwh,
    meterNo,
    importKwh,
    exportKwh,
    maxDemandKw: maxDemandKw ?? peakDemand,
    kvarh,
    declaredLoadKw,
    powerFactor,
    nem,
    warnings,
  };
}
