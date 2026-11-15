import type { CashInRow, CashOutRow, PaymentRow, Project } from '../types';
import { cashflowOf, todayIso } from './costing';

/**
 * Cashflow & payment tracking, from the "Cashflow & Payment Tracker" workbook:
 *   outstanding receivable = Σ outstanding on cash-in rows not Paid
 *   outstanding payable    = Σ (amount − paid) on payments not Paid / Cancelled
 *   monthly cash in / out  = Σ by the month of the row's date (one year at a time)
 */

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
export const isOpen = (r: { status: string }) => r.status !== 'Paid' && r.status !== 'Cancelled';
export const balanceOf = (r: PaymentRow) => n(r.amount) - n(r.paid);

export function daysOverdue(r: PaymentRow, today = todayIso()): number {
  if (!r.due || !isOpen(r)) return 0;
  return Math.max(0, Math.floor((Date.parse(today) - Date.parse(r.due)) / 86_400_000));
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface Tagged<T> {
  row: T;
  project: Project;
}

export interface CashSummary {
  cashIn: number;
  cashOut: number;
  net: number;
  receivable: number;
  payable: number;
  months: { label: string; cashIn: number; cashOut: number; net: number; outIn: number; outPay: number }[];
  byCategory: Map<string, number>;
  byPriority: Map<string, number>;
  byProject: { project: Project; receivable: number; payable: number; net: number }[];
  toChase: Tagged<PaymentRow>[];
  years: number[];
}

export function summarize(projects: Project[], year: number): CashSummary {
  const pays: Tagged<PaymentRow>[] = [];
  const ins: Tagged<CashInRow>[] = [];
  const outs: Tagged<CashOutRow>[] = [];
  for (const p of projects) {
    const c = cashflowOf(p);
    c.payments.forEach((row) => pays.push({ row, project: p }));
    c.cashIn.forEach((row) => ins.push({ row, project: p }));
    c.cashOut.forEach((row) => outs.push({ row, project: p }));
  }
  const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);
  const inMonth = (d: string, m: number) => !!d && Number(d.slice(0, 4)) === year && Number(d.slice(5, 7)) === m + 1;

  const months = MONTHS.map((label, m) => {
    const cashIn = sum(ins.filter((x) => inMonth(x.row.date, m)), (x) => n(x.row.received));
    const cashOut = sum(outs.filter((x) => inMonth(x.row.date, m)), (x) => n(x.row.amount));
    return {
      label,
      cashIn,
      cashOut,
      net: cashIn - cashOut,
      outIn: sum(ins.filter((x) => inMonth(x.row.date, m) && x.row.status !== 'Paid'), (x) => n(x.row.outstanding)),
      outPay: sum(pays.filter((x) => inMonth(x.row.due, m) && isOpen(x.row)), (x) => balanceOf(x.row)),
    };
  });

  const byCategory = new Map<string, number>();
  outs.forEach((x) => byCategory.set(x.row.category || 'Others', (byCategory.get(x.row.category || 'Others') ?? 0) + n(x.row.amount)));
  const byPriority = new Map<string, number>();
  pays.filter((x) => isOpen(x.row)).forEach((x) => byPriority.set(x.row.priority, (byPriority.get(x.row.priority) ?? 0) + balanceOf(x.row)));

  const byProject = projects
    .map((project) => {
      const c = cashflowOf(project);
      return {
        project,
        receivable: sum(c.cashIn.filter((r) => r.status !== 'Paid'), (r) => n(r.outstanding)),
        payable: sum(c.payments.filter(isOpen), balanceOf),
        net: sum(c.cashIn, (r) => n(r.received)) - sum(c.cashOut, (r) => n(r.amount)),
      };
    })
    .filter((x) => x.receivable || x.payable || x.net);

  const years = new Set<number>([new Date().getFullYear()]);
  [...ins.map((x) => x.row.date), ...outs.map((x) => x.row.date), ...pays.map((x) => x.row.due)].forEach((d) => d && years.add(Number(d.slice(0, 4))));

  const cashIn = sum(ins, (x) => n(x.row.received));
  const cashOut = sum(outs, (x) => n(x.row.amount));
  return {
    cashIn,
    cashOut,
    net: cashIn - cashOut,
    receivable: sum(ins.filter((x) => x.row.status !== 'Paid'), (x) => n(x.row.outstanding)),
    payable: sum(pays.filter((x) => isOpen(x.row)), (x) => balanceOf(x.row)),
    months,
    byCategory,
    byPriority,
    byProject,
    toChase: pays.filter((x) => isOpen(x.row)).sort((a, b) => (a.row.due || '9').localeCompare(b.row.due || '9')),
    years: [...years].sort((a, b) => b - a),
  };
}
