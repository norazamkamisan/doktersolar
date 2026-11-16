import type { CashInRow, CashOutRow, PaymentRow, PayStatus, PriceItem, Priority, Project, ProjectCosting, Settings } from '../types';
import { PAY_STATUSES, PRIORITIES } from '../types';
import { DEFAULT_SCENARIOS, cashflowOf, newRowId } from './costing';

/**
 * Brings data across from the claude.ai "Quotation, Margin & Cashflow" app (its "Export for
 * DokterSolar" button). Quotations linked to a DokterSolar project become that project's
 * costing; cashflow rows follow their quotation's project; prices go to the price list.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = Record<string, any>;

export interface ImportPlan {
  costings: { project: Project; costing: ProjectCosting; quoteNo: string }[];
  cashflows: { project: Project; payments: PaymentRow[]; cashIn: CashInRow[]; cashOut: CashOutRow[] }[];
  prices: PriceItem[];
  newCategories: string[];
  newUnits: string[];
  skipped: string[];
}

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown) => (v == null ? '' : String(v));
const pct = (fraction: unknown) => Math.round(n(fraction) * 100 * 10000) / 10000;
const status = (v: unknown): PayStatus => ((PAY_STATUSES as readonly string[]).includes(str(v)) ? (str(v) as PayStatus) : 'Not Paid');
const priority = (v: unknown): Priority => ((PRIORITIES as readonly string[]).includes(str(v)) ? (str(v) as Priority) : 'Medium');

export function planImport(text: string, projects: Project[], settings: Settings): ImportPlan {
  let data: Any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That is not the export file. In the Quotation app, use “Export for DokterSolar” and paste or choose that file.');
  }
  if (!data || data.format !== 'psp-quote-app.v1') throw new Error('That file is not an export from the Quotation, Margin & Cashflow app.');

  const byId = new Map(projects.map((p) => [p.id, p]));
  const quotes: Any[] = Array.isArray(data.quotes) ? data.quotes : [];
  const skipped: string[] = [];
  const projectOfQuoteName = new Map<string, Project>();
  const costings: ImportPlan['costings'] = [];
  const cats = new Set<string>();
  const units = new Set<string>();

  for (const q of quotes) {
    const info: Any = q.info ?? {};
    const project = info.dsId ? byId.get(info.dsId) : undefined;
    if (!project) {
      skipped.push(`Quotation ${str(info.quoteNo)} “${str(info.name)}”: not linked to a DokterSolar project you can see`);
      continue;
    }
    projectOfQuoteName.set(str(info.name), project);
    const items = (Array.isArray(q.items) ? q.items : []).map((it: Any) => {
      cats.add(str(it.cat));
      units.add(str(it.unit));
      return {
        id: str(it.id) || newRowId(),
        description: str(it.desc),
        category: str(it.cat) || 'Others',
        unit: str(it.unit) || 'LS',
        qty: n(it.qty),
        rate: n(it.rate),
        ...(it.markup == null || it.markup === '' ? {} : { markupPct: pct(it.markup) }),
        remarks: str(it.remarks),
      };
    });
    costings.push({
      project,
      quoteNo: str(info.quoteNo),
      costing: {
        items,
        markupPct: pct(info.markup ?? 0.2),
        contingencyPct: pct(info.contingency ?? 0.05),
        sstPct: pct(info.tax ?? 0.08),
        priceFrom: n(info.fixedPrice) > 0 ? 'proposal' : 'markup',
        scenarios: Array.isArray(q.scenarios) && q.scenarios.length ? q.scenarios.map((s: Any) => ({ name: str(s.name), markupPct: pct(s.markup) })) : DEFAULT_SCENARIOS,
        ...(info.targetMargin == null || info.targetMargin === '' ? {} : { targetMarginPct: pct(info.targetMargin) }),
      },
    });
  }

  const cf: Any = data.cashflow ?? data.cf ?? {};
  const groups = new Map<string, ImportPlan['cashflows'][number]>();
  const groupFor = (projectName: unknown, what: string) => {
    const project = projectOfQuoteName.get(str(projectName));
    if (!project) {
      skipped.push(`${what} for “${str(projectName) || 'no project'}”: no linked quotation`);
      return null;
    }
    let g = groups.get(project.id);
    if (!g) groups.set(project.id, (g = { project, payments: [], cashIn: [], cashOut: [] }));
    return g;
  };
  for (const r of Array.isArray(cf.payments) ? cf.payments : []) {
    if (r.sample) continue;
    groupFor(r.project, `Payment to ${str(r.payee)}`)?.payments.push({
      id: str(r.id) || newRowId(),
      due: str(r.due),
      payee: str(r.payee),
      category: str(r.cat) || 'Others',
      description: str(r.desc),
      ref: str(r.ref),
      amount: n(r.amt),
      status: status(r.status),
      paid: n(r.paid),
      priority: priority(r.priority),
      remarks: str(r.remarks),
    });
  }
  for (const r of Array.isArray(cf.cashIn) ? cf.cashIn : []) {
    if (r.sample) continue;
    groupFor(r.project, `Cash in “${str(r.ref)}”`)?.cashIn.push({
      id: str(r.id) || newRowId(),
      date: str(r.date),
      ref: str(r.ref),
      received: n(r.amt),
      outstanding: n(r.outstanding),
      status: status(r.status),
      remarks: str(r.remarks),
    });
  }
  for (const r of Array.isArray(cf.cashOut) ? cf.cashOut : []) {
    if (r.sample) continue;
    groupFor(r.project, `Cash out to ${str(r.payee)}`)?.cashOut.push({
      id: str(r.id) || newRowId(),
      date: str(r.date),
      payee: str(r.payee),
      category: str(r.cat) || 'Others',
      description: str(r.desc),
      amount: n(r.amt),
      ...(r.status ? { status: status(r.status) } : {}),
      method: str(r.method),
      remarks: str(r.remarks),
    });
  }

  const prices: PriceItem[] = (Array.isArray(data.prices) ? data.prices : []).map((x: Any) => {
    cats.add(str(x.cat));
    units.add(str(x.uom));
    return {
      id: str(x.id) || newRowId(),
      category: str(x.cat) || 'Others',
      item: str(x.item),
      uom: str(x.uom),
      price: x.price == null || x.price === '' ? null : n(x.price),
      supplier: str(x.supplier),
      note: str(x.note),
      updated: str(x.date),
    };
  });

  return {
    costings,
    cashflows: [...groups.values()],
    prices,
    newCategories: [...cats].filter((c) => c && !settings.costCategories.includes(c)),
    newUnits: [...units].filter((u) => u && !settings.costUnits.includes(u)),
    skipped,
  };
}

/** Rows already on the project (same id) are replaced; others are added. */
export function mergeCashflow(p: Project, g: ImportPlan['cashflows'][number]) {
  const c = cashflowOf(p);
  const merge = <T extends { id: string }>(old: T[], add: T[]) => [...old.filter((r) => !add.some((a) => a.id === r.id)), ...add];
  return { payments: merge(c.payments, g.payments), cashIn: merge(c.cashIn, g.cashIn), cashOut: merge(c.cashOut, g.cashOut) };
}
