import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import type { Settings } from '../types';
import { updateProject, updateSettings, useProjects, useSettings } from '../lib/store';
import { mergeCashflow, planImport, type ImportPlan } from '../lib/importQuoteApp';
import { NumberField } from './ui';

const LISTS: { key: keyof Pick<Settings, 'costCategories' | 'costUnits' | 'cashCategories' | 'payMethods'>; label: string }[] = [
  { key: 'costCategories', label: 'Cost categories' },
  { key: 'costUnits', label: 'Units' },
  { key: 'cashCategories', label: 'Cashflow categories' },
  { key: 'payMethods', label: 'Payment methods' },
];

/** Settings → Costing & cashflow: defaults, dropdown lists and the import from the claude.ai app. */
export default function CostingSettings() {
  const s = useSettings();
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-semibold text-slate-900">Costing &amp; cashflow</h2>
      <p className="mb-5 text-sm text-slate-500">Defaults for new cost build-ups and the dropdown lists on the Costing and Cashflow tabs.</p>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <NumberField label="SST" suffix="%" value={s.sstPct} onChange={(v) => updateSettings({ sstPct: v })} />
        <NumberField label="Default markup" suffix="%" value={s.markupPct} onChange={(v) => updateSettings({ markupPct: v })} />
        <NumberField label="Contingency" suffix="%" value={s.contingencyPct} onChange={(v) => updateSettings({ contingencyPct: v })} />
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {LISTS.map(({ key, label }) => (
          <ListField key={key} label={label} value={s[key]} onChange={(v) => updateSettings({ [key]: v })} />
        ))}
      </div>
      <ImportFromQuoteApp />
    </section>
  );
}

function ListField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join('\n'));
  return (
    <div>
      <label className="label">{label} <span className="font-normal text-slate-400">(one per line)</span></label>
      <textarea
        className="input min-h-[120px] font-mono text-xs"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const next = [...new Set(text.split('\n').map((x) => x.trim()).filter(Boolean))];
          setText(next.join('\n'));
          if (next.join('\n') !== value.join('\n')) onChange(next);
        }}
      />
    </div>
  );
}

function ImportFromQuoteApp() {
  const s = useSettings();
  const projects = useProjects();
  const [text, setText] = useState('');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const check = (t: string) => {
    setDone('');
    try {
      setPlan(planImport(t, projects, s));
      setError('');
    } catch (e) {
      setPlan(null);
      setError((e as Error).message);
    }
  };

  const apply = () => {
    if (!plan) return;
    for (const c of plan.costings) updateProject(c.project.id, { costing: c.costing });
    for (const g of plan.cashflows) updateProject(g.project.id, (p) => ({ cashflow: mergeCashflow(p, g) }));
    const patch: Partial<Settings> = {};
    if (plan.prices.length) {
      const names = new Set(plan.prices.map((x) => x.item.toLowerCase()));
      patch.priceList = [...plan.prices, ...s.priceList.filter((x) => !names.has(x.item.toLowerCase()))];
    }
    if (plan.newCategories.length) patch.costCategories = [...s.costCategories, ...plan.newCategories];
    if (plan.newUnits.length) patch.costUnits = [...s.costUnits, ...plan.newUnits];
    if (Object.keys(patch).length) updateSettings(patch);
    setDone(
      `Imported ${plan.costings.length} costing${plan.costings.length === 1 ? '' : 's'}, cashflow for ${plan.cashflows.length} project${plan.cashflows.length === 1 ? '' : 's'} and ${plan.prices.length} prices.`,
    );
    setPlan(null);
    setText('');
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <h3 className="font-medium text-slate-900">Import from the Quotation app</h3>
      <p className="mb-3 text-sm text-slate-500">
        In the claude.ai “Quotation, Margin &amp; Cashflow” app, click <b>Export for DokterSolar</b>, then paste the copied text here or choose the
        downloaded file. Quotations linked to a DokterSolar project become its costing, their cashflow rows go to the same project, and the prices
        replace matching items in the price list.
      </p>
      <textarea
        className="input min-h-[90px] font-mono text-xs"
        placeholder='{"format":"psp-quote-app.v1", …}'
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim()) check(e.target.value);
          else setPlan(null);
        }}
        aria-label="Export from the Quotation app"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json,.txt"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const t = await f.text();
            setText(t);
            check(t);
          }}
        />
        <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> Choose file
        </button>
        <button className="btn-primary" disabled={!plan || (!plan.costings.length && !plan.cashflows.length && !plan.prices.length)} onClick={apply}>
          Import
        </button>
        {done && <span className="text-sm font-medium text-emerald-700">{done}</span>}
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      {plan && (
        <div className="mt-3 rounded-lg bg-white p-3 text-sm ring-1 ring-slate-200">
          <p className="font-medium text-slate-800">Ready to import:</p>
          <ul className="mt-1 list-inside list-disc text-slate-600">
            {plan.costings.map((c) => (
              <li key={c.project.id}>
                Costing {c.quoteNo} → <b>{c.project.customerName}</b> ({c.costing.items.length} items, price from {c.costing.priceFrom === 'proposal' ? 'proposal' : 'markup'})
              </li>
            ))}
            {plan.cashflows.map((g) => (
              <li key={'cf' + g.project.id}>
                Cashflow → <b>{g.project.customerName}</b>: {g.payments.length} payments, {g.cashIn.length} cash in, {g.cashOut.length} cash out
              </li>
            ))}
            <li>{plan.prices.length} price-list items</li>
          </ul>
          {plan.skipped.length > 0 && (
            <>
              <p className="mt-2 font-medium text-amber-800">Left out:</p>
              <ul className="list-inside list-disc text-amber-800">
                {plan.skipped.slice(0, 8).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
