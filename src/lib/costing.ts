import type { CostItem, CostScenario, Project, ProjectCashflow, ProjectCosting, Settings } from '../types';
import { netSystemPrice } from './solar';

/**
 * Cost build-up behind a quotation, from the "Quotation & Margin Calculator" workbook:
 *   direct cost = qty × rate; selling = direct × (1 + markup); contingency = direct × contingency %
 *   selling before SST = Σ selling + contingency; final = selling (less discount) + SST
 *   gross profit = selling before SST (after discount) − (direct + contingency)   (SST is not profit)
 *
 * With priceFrom 'proposal' the final quotation is the project's proposal price (SST included)
 * and one markup is worked out so the items add up to it.
 */

export const DEFAULT_SCENARIOS: CostScenario[] = [
  { name: 'Conservative', markupPct: 10 },
  { name: 'Standard', markupPct: 20 },
  { name: 'Aggressive', markupPct: 30 },
  { name: 'Custom', markupPct: 15 },
];

export function defaultCosting(s: Settings): ProjectCosting {
  return {
    items: [],
    markupPct: s.markupPct ?? 20,
    contingencyPct: s.contingencyPct ?? 5,
    sstPct: s.sstPct ?? 8,
    priceFrom: 'proposal',
    scenarios: DEFAULT_SCENARIOS.map((x) => ({ ...x })),
  };
}

export function costingOf(p: Project, s: Settings): ProjectCosting {
  return p.costing ?? defaultCosting(s);
}

export function emptyCashflow(): ProjectCashflow {
  return { payments: [], cashIn: [], cashOut: [] };
}

export function cashflowOf(p: Project): ProjectCashflow {
  const c = p.cashflow;
  return c ? { payments: c.payments ?? [], cashIn: c.cashIn ?? [], cashOut: c.cashOut ?? [] } : emptyCashflow();
}

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

export interface CostRow extends CostItem {
  direct: number;
  /** markup actually used, as a fraction */
  mk: number;
  selling: number;
}

export interface CostingResult {
  rows: CostRow[];
  direct: number;
  contingency: number;
  costAfterContingency: number;
  /** Σ selling + contingency, before discount */
  sellBeforeTax: number;
  discount: number;
  /** after discount, before SST */
  subtotal: number;
  sst: number;
  final: number;
  profit: number;
  /** profit ÷ subtotal (both without SST) */
  margin: number;
  /** set when the price comes from the proposal: the one markup every item uses, as a fraction */
  fixedMarkup: number | null;
  proposalPrice: number;
  avgMarkup: number;
  byCategory: Map<string, { direct: number; selling: number }>;
  scenarios: { name: string; markupPct: number; selling: number; final: number; profit: number; margin: number }[];
}

export function calcCosting(p: Project, s: Settings): CostingResult {
  const c = costingOf(p, s);
  const sst = n(c.sstPct) / 100;
  const cont = n(c.contingencyPct) / 100;
  const base = c.items.map((it) => ({ ...it, direct: n(it.qty) * n(it.rate) }));
  const direct = base.reduce((a, r) => a + r.direct, 0);
  const contingency = direct * cont;
  const costAfterContingency = direct + contingency;
  const proposalPrice = netSystemPrice(p);
  const discountRm = n(p.quote?.discount);

  let fixedMarkup: number | null = null;
  if (c.priceFrom === 'proposal' && proposalPrice > 0) {
    const subtotal = proposalPrice / (1 + sst);
    fixedMarkup = direct > 0 ? (subtotal - contingency) / direct - 1 : 0;
  }
  const rows: CostRow[] = base.map((r) => {
    const mk = fixedMarkup ?? n(r.markupPct ?? c.markupPct) / 100;
    return { ...r, mk, selling: r.direct * (1 + mk) };
  });

  let sellBeforeTax: number, discount: number, subtotal: number, tax: number, final: number;
  if (fixedMarkup !== null) {
    final = proposalPrice;
    subtotal = final / (1 + sst);
    tax = final - subtotal;
    discount = 0; // the proposal price is already net of any discount
    sellBeforeTax = subtotal;
  } else {
    sellBeforeTax = rows.reduce((a, r) => a + r.selling, 0) + contingency;
    discount = Math.min(discountRm, sellBeforeTax);
    subtotal = sellBeforeTax - discount;
    tax = subtotal * sst;
    final = subtotal + tax;
  }
  const profit = subtotal - costAfterContingency;

  const counted = rows.filter((r) => r.description.trim() || r.direct > 0);
  const byCategory = new Map<string, { direct: number; selling: number }>();
  for (const r of rows) {
    const k = r.category || 'Others';
    const v = byCategory.get(k) ?? { direct: 0, selling: 0 };
    v.direct += r.direct;
    v.selling += r.selling;
    byCategory.set(k, v);
  }

  const scenarios = c.scenarios.map((sc) => {
    const selling = direct * (1 + n(sc.markupPct) / 100) + contingency;
    const fin = selling * (1 + sst);
    const prof = selling - costAfterContingency;
    return { name: sc.name, markupPct: n(sc.markupPct), selling, final: fin, profit: prof, margin: selling ? prof / selling : 0 };
  });

  return {
    rows,
    direct,
    contingency,
    costAfterContingency,
    sellBeforeTax,
    discount,
    subtotal,
    sst: tax,
    final,
    profit,
    margin: subtotal ? profit / subtotal : 0,
    fixedMarkup,
    proposalPrice,
    avgMarkup: counted.length ? counted.reduce((a, r) => a + r.mk, 0) / counted.length : 0,
    byCategory,
    scenarios,
  };
}

/** good ≥ 15 %, watch 10–15 %, bad < 10 % (the workbook's colours) */
export function marginLevel(m: number): 'good' | 'warn' | 'bad' {
  return m < 0.1 ? 'bad' : m >= 0.15 ? 'good' : 'warn';
}

/** Margin against the project's own target when it has one, else the 15% rule. */
export function marginVsTarget(m: number, targetPct?: number | null): { level: 'good' | 'warn' | 'bad'; label: string } {
  if (targetPct == null || !Number.isFinite(targetPct)) {
    const level = marginLevel(m);
    return { level, label: level === 'good' ? 'Healthy (≥15%)' : level === 'bad' ? 'Too thin (<10%)' : 'Watch (10–15%)' };
  }
  const t = targetPct / 100;
  if (m >= t) return { level: 'good', label: `On target (≥${targetPct}%)` };
  const gap = Math.round((t - m) * 1000) / 10;
  return { level: m < 0.1 ? 'bad' : 'warn', label: `Below ${targetPct}% target by ${gap} pts` };
}

export const MARGIN_STYLE = {
  good: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warn: 'bg-amber-50 text-amber-800 ring-amber-200',
  bad: 'bg-rose-50 text-rose-700 ring-rose-200',
} as const;

/** Category colours for the charts: bright, and the same on every page. */
const CAT_COLORS: Record<string, string> = {
  'PV Module': '#eab308',
  Inverter: '#0891b2',
  Mounting: '#f97316',
  'Electrical BOS': '#6366f1',
  Material: '#3b82f6',
  Labour: '#f59e0b',
  Subcon: '#8b5cf6',
  Subcontractor: '#8b5cf6',
  Machinery: '#ef4444',
  Transport: '#10b981',
  Preliminaries: '#06b6d4',
  Overhead: '#ec4899',
  Contingency: '#84cc16',
  Others: '#64748b',
};
const EXTRA = ['#14b8a6', '#a855f7', '#f43f5e', '#22c55e', '#0ea5e9', '#d946ef', '#facc15', '#fb923c'];
export function categoryColor(name: string, index = 0): string {
  return CAT_COLORS[name] ?? EXTRA[index % EXTRA.length];
}
export const PRIORITY_COLORS: Record<string, string> = { Critical: '#dc2626', High: '#f97316', Medium: '#eab308', Low: '#22c55e' };
export const SCENARIO_COLORS = ['#0ea5e9', '#8b5cf6', '#f97316', '#14b8a6', '#ec4899', '#eab308'];

export function newRowId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
