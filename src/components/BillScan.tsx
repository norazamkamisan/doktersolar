import { useRef, useState } from 'react';
import { AlertTriangle, FileText, Loader2 } from 'lucide-react';
import type { BillCategory, TnbBill } from '../lib/tnbBill';
import { CATEGORY_LABEL, type BillAnalysis } from '../lib/billAnalysis';
import { date, money, num } from '../lib/format';

/** Read a TNB bill PDF in the browser (nothing is uploaded) and parse it. */
async function scanBill(file: File): Promise<TnbBill> {
  const [{ pdfToRuns }, { isTnbBill, parseTnbBill }] = await Promise.all([import('../lib/pdfText'), import('../lib/tnbBill')]);
  let pages;
  try {
    pages = await pdfToRuns(file);
  } catch {
    throw new Error("Couldn't open that file. Choose the PDF bill downloaded from myTNB.");
  }
  if (!pages.some((pg) => pg.some((r) => r.text.trim()))) {
    throw new Error('This PDF has no readable text (it may be a photo or scan). Use the PDF bill downloaded from myTNB.');
  }
  if (!isTnbBill(pages)) throw new Error("This doesn't look like a TNB electricity bill.");
  return parseTnbBill(pages, file.name);
}

export function ScanBillButton({
  onScanned,
  variant = 'panel',
  label = 'Scan a TNB bill (PDF)',
}: {
  onScanned: (bill: TnbBill) => void;
  variant?: 'panel' | 'button';
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      onScanned(await scanBill(file));
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };

  const icon = busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />;
  return (
    <div>
      <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onFile} />
      {variant === 'panel' ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/50 p-4 text-left transition hover:border-brand-400 hover:bg-brand-50"
        >
          <span className="text-brand-600">{icon}</span>
          <span>
            <span className="block font-medium text-slate-900">{busy ? 'Reading the bill…' : label}</span>
            <span className="block text-xs text-slate-500">
              Fills in the customer, usage and tariff, and sizes the system. The PDF stays on this device.
            </span>
          </span>
        </button>
      ) : (
        <button type="button" className="btn-secondary" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {busy ? 'Reading…' : label}
        </button>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function BillWarnings({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="note">
      {warnings.map((w) => (
        <li key={w} className="flex gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {w}
        </li>
      ))}
    </ul>
  );
}

/** Category and target offset inputs, plus the resulting recommended system. */
export function BillSizing({
  analysis: a,
  category,
  onCategory,
  onOffset,
  panelWattage,
  idPrefix,
}: {
  analysis: BillAnalysis;
  category: BillCategory;
  onCategory: (c: BillCategory) => void;
  onOffset: (pct: number) => void;
  panelWattage: number;
  idPrefix: string;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${idPrefix}-cat`}>Customer type</label>
          <select id={`${idPrefix}-cat`} className="input" value={category} onChange={(e) => onCategory(e.target.value as BillCategory)}>
            {(Object.keys(CATEGORY_LABEL) as BillCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`${idPrefix}-offset`}>Cover this much of yearly use (%)</label>
          <input
            id={`${idPrefix}-offset`}
            className="input"
            type="number"
            inputMode="numeric"
            min={10}
            max={150}
            step={5}
            value={a.targetOffsetPct}
            onChange={(e) => onOffset(Math.min(150, Math.max(0, Number(e.target.value) || 0)))}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-4">
        {[
          ['Average use', `${num(a.monthlyKwh)} kWh/mo`],
          ['Rate paid', a.effectiveTariff ? `${money(a.effectiveTariff, 'MYR', 3)}/kWh` : '—'],
          ['Recommended', a.recommendedKw > 0 ? `${num(a.recommendedKw, 2)} kWp` : '—'],
          ['Panels', a.recommendedPanels > 0 ? `${a.recommendedPanels} × ${panelWattage} W` : '—'],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-xs text-slate-500">{k}</p>
            <p className="font-semibold tabular-nums text-slate-900">{v}</p>
          </div>
        ))}
      </div>
      {a.notes.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
          {a.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const rm = (v: number | null, dp = 2) => (v === null ? null : money(v, 'MYR', dp));
const kwh = (v: number | null) => (v === null ? null : `${num(v)} kWh`);
const rate = (v: number | null) => (v === null ? null : `${num(v * 100, 2)} sen/kWh`);

/** Everything captured from the bill, grouped; empty fields are left out. */
export function BillDetails({ bill: b }: { bill: TnbBill }) {
  const c = b.charges;
  const groups: [string, [string, string | null | undefined][]][] = [
    [
      'Account',
      [
        ['Customer name', b.customerName || 'Hidden on bill'],
        ['Account no.', b.accountNo],
        ['Invoice no.', b.invoiceNo],
        ['Premise address', b.premiseAddress],
        ['Postal address', b.postalAddress !== b.premiseAddress ? b.postalAddress : null],
        ['Tariff', b.tariff],
        ['Customer type', CATEGORY_LABEL[b.category]],
        ['Deposit', rm(b.deposit)],
      ],
    ],
    [
      'This bill',
      [
        ['Bill date', b.billDate && date(b.billDate)],
        ['Period', b.periodStart && b.periodEnd ? `${date(b.periodStart)} to ${date(b.periodEnd)}${b.periodDays ? ` (${b.periodDays} days)` : ''}` : null],
        ['Reading', b.readingType],
        ['Electricity used', kwh(b.usageKwh)],
        ['Previous balance', rm(b.previousBalance)],
        ['Current charges', rm(b.currentCharge)],
        ['Total due', rm(b.totalDue)],
        ['Due date', b.dueDate && date(b.dueDate)],
      ],
    ],
    [
      'Charges',
      [
        ['Energy', c.energyRm === null ? null : `${rm(c.energyRm)}${c.energyRate !== null ? ` at ${rate(c.energyRate)}` : ''}`],
        ['Fuel adjustment (AFA)', rm(c.afaRm)],
        ['Capacity', c.capacityRm === null ? null : `${rm(c.capacityRm)}${c.capacityRate !== null ? ` at ${rate(c.capacityRate)}` : ''}`],
        ['Network', c.networkRm === null ? null : `${rm(c.networkRm)}${c.networkRate !== null ? ` at ${rate(c.networkRate)}` : ''}`],
        ['Retail', rm(c.retailRm)],
        ['Maximum demand', rm(c.maxDemandRm)],
        ['Rebates & incentives', rm(c.rebatesRm)],
        ['Usage charge', rm(c.usageChargeRm)],
        ['Service tax', rm(c.serviceTaxRm)],
        ['KWTBB (renewable fund)', rm(c.kwtbbRm)],
        ['Late payment charge', rm(c.lateSurchargeRm)],
      ],
    ],
    [
      'Meter',
      [
        ['Meter no.', b.meterNo],
        ['Imported from grid', kwh(b.importKwh)],
        ['Exported to grid', kwh(b.exportKwh)],
        ['Maximum demand', b.maxDemandKw === null ? null : `${num(b.maxDemandKw, 1)} kW`],
        ['Reactive energy', b.kvarh === null ? null : `${num(b.kvarh)} kVARh`],
        ['Declared load', b.declaredLoadKw === null ? null : `${num(b.declaredLoadKw, 2)} kW`],
        ['Power factor', b.powerFactor === null ? null : num(b.powerFactor, 2)],
        ['NEM certificate', b.nem?.certificateNo],
        ['NEM credit balance', b.nem ? kwh(b.nem.balanceKwh) : null],
      ],
    ],
  ];

  return (
    <div className="space-y-4 text-sm">
      {groups.map(([title, rows]) => {
        const shown = rows.filter(([, v]) => v);
        if (!shown.length) return null;
        return (
          <div key={title}>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
            <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {shown.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-3 py-1.5">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="whitespace-pre-line text-right font-medium text-slate-800 tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
      {b.history.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Past months</h4>
          <table className="w-full overflow-hidden rounded-lg border border-slate-200 text-right tabular-nums">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium">Month</th>
                <th className="px-3 py-1.5 font-medium">kWh</th>
                <th className="px-3 py-1.5 font-medium">Bill</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {b.history.map((h) => (
                <tr key={h.month}>
                  <td className="px-3 py-1.5 text-left text-slate-600">{h.month}</td>
                  <td className="px-3 py-1.5">{h.kwh === null ? '—' : num(h.kwh)}</td>
                  <td className="px-3 py-1.5">{rm(h.rm) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {b.averageKwh !== null && <p className="mt-1 text-xs text-slate-500">Average shown on bill: {num(b.averageKwh)} kWh/month</p>}
        </div>
      )}
    </div>
  );
}
