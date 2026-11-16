import type { CashInRow, CashOutRow, PaymentRow, PayStatus, Project } from '../types';
import { cashflowOf, todayIso } from './costing';

/**
 * Cashflow & payment tracking, from the "Cashflow & Payment Tracker" workbook. Only money that has
 * actually moved counts as cash, so the figures show the real cash position:
 *   cash in                = received on rows marked Paid (or the received part of Partial)
 *   outstanding receivable = everything else on rows not Paid / Cancelled
 *   cash out               = cash-out rows marked Paid
 *   outstanding payable    = open Payment Tracker balances + unpaid cash-out rows the tracker
 *                            doesn't already hold (same payee), so nothing is counted twice
 *   monthly cash in / out  = Σ by the month of the row's date (one year at a time)
 */

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
export const isOpen = (r: { status: string }) => r.status !== 'Paid' && r.status !== 'Cancelled';
export const balanceOf = (r: PaymentRow) => n(r.amount) - n(r.paid);

/** Cash actually received on a cash-in row. */
export const cashInReceived = (r: CashInRow) => (r.status === 'Paid' || r.status === 'Partial' ? n(r.received) : 0);
/** Still to collect on a cash-in row: a Not Paid row's "received" figure hasn't arrived yet. */
export const cashInOutstanding = (r: CashInRow) =>
  r.status === 'Paid' || r.status === 'Cancelled' ? 0 : n(r.outstanding) + (r.status === 'Partial' ? 0 : n(r.received));

/** A cash-out row's status; rows saved before statuses existed are Paid unless dated after today. */
export const cashOutStatus = (r: CashOutRow, today = todayIso()): PayStatus => r.status ?? (r.date && r.date > today ? 'Not Paid' : 'Paid');
export const cashOutPaid = (r: CashOutRow, today = todayIso()) => (cashOutStatus(r, today) === 'Paid' ? n(r.amount) : 0);
const cashOutOpen = (r: CashOutRow, today = todayIso()) => {
  const st = cashOutStatus(r, today);
  return st !== 'Paid' && st !== 'Cancelled' ? n(r.amount) : 0;
};

/** Bills still to pay for one project. */
export function payableOf(payments: PaymentRow[], outs: CashOutRow[], today = todayIso()): number {
  const open = payments.filter((p) => isOpen(p) && !outs.some((o) => cashOutPaid(o, today) > 0 && o.payee && o.payee === p.payee));
  const extra = outs.filter((o) => cashOutOpen(o, today) > 0 && !open.some((p) => p.payee === o.payee));
  return open.reduce((a, p) => a + Math.max(0, balanceOf(p)), 0) + extra.reduce((a, o) => a + cashOutOpen(o, today), 0);
}

/** When a cash-in row's status changes, move the money between "received" and "outstanding". */
export function cashInStatusPatch(r: CashInRow, status: PayStatus): Partial<CashInRow> {
  if (status === 'Paid') return { status, received: n(r.received) > 0 ? n(r.received) : n(r.outstanding), outstanding: 0 };
  if (status !== 'Partial' && status !== 'Cancelled' && n(r.received) > 0) return { status, received: 0, outstanding: n(r.outstanding) + n(r.received) };
  return { status };
}

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

export function summarize(projects: Project[], year: number, today = todayIso()): CashSummary {
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
    const cashIn = sum(ins.filter((x) => inMonth(x.row.date, m)), (x) => cashInReceived(x.row));
    const cashOut = sum(outs.filter((x) => inMonth(x.row.date, m)), (x) => cashOutPaid(x.row, today));
    return {
      label,
      cashIn,
      cashOut,
      net: cashIn - cashOut,
      outIn: sum(ins.filter((x) => inMonth(x.row.date, m)), (x) => cashInOutstanding(x.row)),
      outPay: sum(projects, (p) => {
        const c = cashflowOf(p);
        return payableOf(c.payments.filter((r) => inMonth(r.due, m)), c.cashOut.filter((r) => inMonth(r.date, m)), today);
      }),
    };
  });

  const byCategory = new Map<string, number>();
  outs.forEach((x) => {
    const v = cashOutPaid(x.row, today);
    if (v) byCategory.set(x.row.category || 'Others', (byCategory.get(x.row.category || 'Others') ?? 0) + v);
  });
  const byPriority = new Map<string, number>();
  pays.filter((x) => isOpen(x.row)).forEach((x) => byPriority.set(x.row.priority, (byPriority.get(x.row.priority) ?? 0) + balanceOf(x.row)));

  const byProject = projects
    .map((project) => {
      const c = cashflowOf(project);
      return {
        project,
        receivable: sum(c.cashIn, cashInOutstanding),
        payable: payableOf(c.payments, c.cashOut, today),
        net: sum(c.cashIn, cashInReceived) - sum(c.cashOut, (r) => cashOutPaid(r, today)),
      };
    })
    .filter((x) => x.receivable || x.payable || x.net);

  const years = new Set<number>([new Date().getFullYear()]);
  [...ins.map((x) => x.row.date), ...outs.map((x) => x.row.date), ...pays.map((x) => x.row.due)].forEach((d) => d && years.add(Number(d.slice(0, 4))));

  const cashIn = sum(ins, (x) => cashInReceived(x.row));
  const cashOut = sum(outs, (x) => cashOutPaid(x.row, today));
  return {
    cashIn,
    cashOut,
    net: cashIn - cashOut,
    receivable: sum(ins, (x) => cashInOutstanding(x.row)),
    payable: sum(projects, (p) => {
      const c = cashflowOf(p);
      return payableOf(c.payments, c.cashOut, today);
    }),
    months,
    byCategory,
    byPriority,
    byProject,
    toChase: pays.filter((x) => isOpen(x.row)).sort((a, b) => (a.row.due || '9').localeCompare(b.row.due || '9')),
    years: [...years].sort((a, b) => b - a),
  };
}
