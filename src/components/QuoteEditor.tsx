import type { Project, ProjectQuote, Settings } from '../types';
import { updateProject } from '../lib/store';
import { money, num } from '../lib/format';
import { suggestInverterKw } from '../lib/proposal';

/** Per-project quotation details on the Proposal tab. Empty boxes use the worked-out defaults. */
export default function QuoteEditor({ project: p, settings: s }: { project: Project; settings: Settings }) {
  const q = p.quote ?? {};
  const set = (patch: Partial<ProjectQuote>) => updateProject(p.id, (cur) => ({ quote: { ...cur.quote, ...patch } }));
  const numOrUndef = (v: string) => (v.trim() === '' ? undefined : Math.max(0, Number(v)));
  const defaultPrice = p.systemKw * 1000 * p.energy.pricePerWatt;
  const cur = s.currency;

  const box = (label: string, value: number | string | undefined, placeholder: string, onChange: (v: string) => void, suffix?: string, type = 'number') => (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          className={`input ${suffix ? 'pr-14' : ''}`}
          type={type}
          inputMode={type === 'number' ? 'decimal' : undefined}
          min={0}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>}
      </div>
    </div>
  );

  return (
    <section className="card no-print p-4 sm:p-5">
      <h3 className="font-semibold text-slate-900">Quotation</h3>
      <p className="mb-4 text-sm text-slate-500">Leave a box empty to use the suggested value shown in grey.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {box('Inverter model', q.inverterModel, `e.g. S5-GR3P5K`, (v) => set({ inverterModel: v || undefined }), undefined, 'text')}
        {box('Inverter rating (total)', q.inverterKw, num(suggestInverterKw(p.systemKw), 1), (v) => set({ inverterKw: numOrUndef(v) }), 'kW')}
        {box('Number of inverters', q.inverterQty, '1', (v) => set({ inverterQty: numOrUndef(v) && Math.round(numOrUndef(v)!) }))}
        {box('Total system price', q.systemPrice, num(defaultPrice, 2), (v) => set({ systemPrice: numOrUndef(v) }), cur === 'MYR' ? 'RM' : cur)}
        {box('Discount / rebate', q.discount, '0', (v) => set({ discount: numOrUndef(v) }), cur === 'MYR' ? 'RM' : cur)}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Suggested price: {num(p.systemKw, 2)} kWp × {money(p.energy.pricePerWatt, cur, 2)}/W = {money(defaultPrice, cur, 2)} (price per watt is on the Energy tab).
      </p>
    </section>
  );
}
