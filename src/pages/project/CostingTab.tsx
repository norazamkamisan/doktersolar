import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Plus } from 'lucide-react';
import type { CostItem, Project, ProjectCosting, Settings } from '../../types';
import { updateProject, useSettings } from '../../lib/store';
import { money, num } from '../../lib/format';
import {
  MARGIN_STYLE,
  SCENARIO_COLORS,
  calcCosting,
  categoryColor,
  costingOf,
  marginVsTarget,
  newRowId,
} from '../../lib/costing';
import { NumCell, SelectCell, TextCell, DeleteCell, KpiTile } from '../../components/Cells';
import { ColorBars, MoneyDonut, PairedBars } from '../../components/CostCharts';

const pct = (v: number, d = 1) => `${num(v * 100, d)}%`;

export function patchCosting(p: Project, s: Settings, patch: Partial<ProjectCosting> | ((c: ProjectCosting) => Partial<ProjectCosting>)) {
  updateProject(p.id, (prev) => {
    const c = costingOf(prev, s);
    return { costing: { ...c, ...(typeof patch === 'function' ? patch(c) : patch) } };
  });
}

export default function CostingTab({ project: p }: { project: Project }) {
  const s = useSettings();
  const cur = s.currency;
  const c = costingOf(p, s);
  const r = useMemo(() => calcCosting(p, s), [p, s]);
  const rm = (v: number) => money(v, cur, 2);
  const { level, label: marginLabel } = marginVsTarget(r.margin, c.targetMarginPct);
  const fixed = r.fixedMarkup !== null;

  const setItem = (id: string, patch: Partial<CostItem>) =>
    patchCosting(p, s, (cc) => ({ items: cc.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  const addItem = (it?: Partial<CostItem>) =>
    patchCosting(p, s, (cc) => ({
      items: [...cc.items, { id: newRowId(), description: '', category: s.costCategories[0] ?? 'Others', unit: 'LS', qty: 1, rate: 0, remarks: '', ...it }],
    }));

  const cats = [...r.byCategory.entries()].filter(([, v]) => v.direct || v.selling);
  const allCats = [...new Set([...s.costCategories, ...r.byCategory.keys()])];
  const color = (k: string) => categoryColor(k, allCats.indexOf(k));

  return (
    <div className="space-y-5">
      {/* where the price comes from */}
      <section className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0 text-sm">
          <p className="font-medium text-slate-800">Final quotation</p>
          <p className="text-slate-500">
            {fixed ? (
              <>
                Taken from this project&apos;s proposal: <b className="text-slate-800">{rm(r.proposalPrice)}</b> Total System Price
                {p.quote?.discount ? ' less discount' : ''}, SST included. Every item uses one worked-out markup of{' '}
                <b className={r.fixedMarkup! < 0 ? 'text-rose-600' : 'text-slate-800'}>{pct(r.fixedMarkup!)}</b>.
              </>
            ) : c.priceFrom === 'proposal' ? (
              <>This project has no proposal price yet, so the price is built up from markups. Set it on the Proposal tab.</>
            ) : (
              <>Built up from item markups, plus {num(c.sstPct, 1)}% SST.</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input w-auto"
            value={c.priceFrom}
            onChange={(e) => patchCosting(p, s, { priceFrom: e.target.value as ProjectCosting['priceFrom'] })}
            aria-label="Price from"
          >
            <option value="proposal">Use proposal price</option>
            <option value="markup">Build up from markup</option>
          </select>
          <Link to={`/projects/${p.id}/proposal`} className="btn-secondary">
            Proposal
          </Link>
        </div>
      </section>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile tone="blue" label="Final Quotation" value={rm(r.final)} sub={`incl. SST ${rm(r.sst)}`} />
        <KpiTile tone="violet" label="Total Cost" value={rm(r.costAfterContingency)} sub={`direct ${rm(r.direct)} + contingency ${rm(r.contingency)}`} />
        <KpiTile tone="green" label="Estimated Profit" value={rm(r.profit)} sub="gross, excl. SST" />
        <KpiTile
          tone={level === 'good' ? 'green' : level === 'bad' ? 'red' : 'amber'}
          label="Profit Margin"
          value={pct(r.margin)}
          sub={marginLabel}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="card px-4 py-3">
          <label htmlFor="target-margin" className="text-xs text-slate-500">Target margin %</label>
          <div className="flex items-center gap-1">
            <input
              id="target-margin"
              className="input h-8 w-full px-2 py-1 text-lg font-semibold tabular-nums"
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              max={100}
              placeholder="15"
              value={c.targetMarginPct ?? ''}
              onChange={(e) => patchCosting(p, s, { targetMarginPct: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
            <span className="text-slate-500">%</span>
          </div>
        </div>
        {[
          ['Cost items', String(r.rows.filter((x) => x.description.trim() || x.direct).length)],
          ['Avg markup', pct(r.avgMarkup)],
          ['Contingency', `${num(c.contingencyPct, 1)}%`],
          ['SST', `${num(c.sstPct, 1)}%`],
        ].map(([l, v]) => (
          <div key={l} className="card px-4 py-3">
            <p className="text-xs text-slate-500">{l}</p>
            <p className="text-lg font-semibold tabular-nums text-slate-900">{v}</p>
          </div>
        ))}
      </div>

      {/* charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h3 className="mb-2 font-semibold text-slate-900">Direct cost vs selling <span className="text-xs font-normal text-slate-500">by category</span></h3>
          <PairedBars currency={cur} first="Direct cost" second="Selling" data={cats.map(([k, v]) => ({ name: k, a: v.direct, b: v.selling, color: color(k) }))} />
        </section>
        <section className="card p-4">
          <h3 className="mb-2 font-semibold text-slate-900">Cost breakdown <span className="text-xs font-normal text-slate-500">share of direct cost</span></h3>
          <MoneyDonut currency={cur} data={cats.map(([k, v]) => ({ name: k, value: v.direct, color: color(k) }))} />
        </section>
        <section className="card p-4">
          <h3 className="mb-2 font-semibold text-slate-900">Pricing scenarios <span className="text-xs font-normal text-slate-500">gross profit (light) vs final quote</span></h3>
          <PairedBars
            currency={cur}
            first="Gross profit"
            second="Final quote"
            data={r.scenarios.map((x, i) => ({ name: `${x.name} (${num(x.markupPct)}%)`, a: x.profit, b: x.final, color: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }))}
          />
        </section>
        <section className="card p-4">
          <h3 className="mb-2 font-semibold text-slate-900">Where the quotation goes</h3>
          <MoneyDonut
            currency={cur}
            hole={false}
            data={[
              { name: 'Direct cost', value: r.direct, color: '#3b82f6' },
              { name: 'Contingency', value: r.contingency, color: '#f59e0b' },
              { name: 'Gross profit', value: Math.max(0, r.profit), color: '#10b981' },
              { name: 'SST', value: r.sst, color: '#ec4899' },
            ]}
          />
        </section>
      </div>

      {/* items */}
      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-900">Cost items</h3>
          <div className="flex flex-wrap gap-2">
            <PricePicker settings={s} onPick={addItem} />
            <button className="btn-primary" onClick={() => addItem()}>
              <Plus className="h-4 w-4" /> Add item
            </button>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {['No.', 'Description', 'Category', 'Unit', 'Qty', 'Rate', 'Direct cost', 'Markup %', 'Selling', 'Remarks', ''].map((h, i) => (
                  <th key={h + i} className={`whitespace-nowrap px-2 py-2 font-medium ${[4, 5, 6, 7, 8].includes(i) ? 'text-right' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {r.rows.map((it, i) => (
                <tr key={it.id}>
                  <td className="px-2 py-1 tabular-nums text-slate-500">{i + 1}</td>
                  <td className="px-1 py-1">
                    <TextCell className="min-w-[220px]" label={`Description ${i + 1}`} value={it.description} onChange={(v) => setItem(it.id, { description: v })} />
                  </td>
                  <td className="px-1 py-1">
                    <SelectCell label={`Category ${i + 1}`} value={it.category} options={s.costCategories} onChange={(v) => setItem(it.id, { category: v })} />
                  </td>
                  <td className="px-1 py-1">
                    <SelectCell label={`Unit ${i + 1}`} value={it.unit} options={s.costUnits} onChange={(v) => setItem(it.id, { unit: v })} />
                  </td>
                  <td className="px-1 py-1">
                    <NumCell label={`Qty ${i + 1}`} value={it.qty} onChange={(v) => setItem(it.id, { qty: v ?? 0 })} />
                  </td>
                  <td className="px-1 py-1">
                    <NumCell label={`Rate ${i + 1}`} value={it.rate} onChange={(v) => setItem(it.id, { rate: v ?? 0 })} />
                  </td>
                  <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums">{rm(it.direct)}</td>
                  <td className="px-1 py-1">
                    <NumCell
                      label={`Markup ${i + 1}`}
                      value={fixed ? null : it.markupPct ?? null}
                      placeholder={num(it.mk * 100, 1)}
                      disabled={fixed}
                      onChange={(v) => setItem(it.id, { markupPct: v ?? undefined })}
                    />
                  </td>
                  <td className="whitespace-nowrap px-2 py-1 text-right font-medium tabular-nums">{rm(it.selling)}</td>
                  <td className="px-1 py-1">
                    <TextCell className="min-w-[150px]" label={`Remarks ${i + 1}`} value={it.remarks} onChange={(v) => setItem(it.id, { remarks: v })} />
                  </td>
                  <td className="px-1 py-1">
                    <DeleteCell label={`Remove item ${i + 1}`} onDelete={() => patchCosting(p, s, (cc) => ({ items: cc.items.filter((x) => x.id !== it.id) }))} />
                  </td>
                </tr>
              ))}
              {!r.rows.length && (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-slate-500">
                    No cost items yet. Add panels, inverter, mounting, cables and labour from the price list.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50 font-semibold">
              <tr>
                <td colSpan={6} className="px-2 py-2">
                  Total
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{rm(r.direct)}</td>
                <td />
                <td className="px-2 py-2 text-right tabular-nums">{rm(r.rows.reduce((a, x) => a + x.selling, 0))}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* rates + summary */}
        <section className="card p-4">
          <h3 className="mb-3 font-semibold text-slate-900">Rates</h3>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ['Default markup', 'markupPct'],
                ['Contingency', 'contingencyPct'],
                ['SST', 'sstPct'],
              ] as const
            ).map(([l, k]) => (
              <div key={k}>
                <label className="label">{l} %</label>
                <NumCell label={l} value={c[k]} disabled={k === 'markupPct' && fixed} onChange={(v) => patchCosting(p, s, { [k]: v ?? 0 })} />
              </div>
            ))}
          </div>
          <dl className="mt-4 divide-y divide-dashed divide-slate-200 text-sm">
            {[
              ['Total direct cost', r.direct],
              [`Contingency (${num(c.contingencyPct, 1)}%)`, r.contingency],
              ['Cost after contingency', r.costAfterContingency],
              ['Total selling before SST', r.sellBeforeTax],
              ...(r.discount ? [['Discount', -r.discount] as [string, number]] : []),
              ['Subtotal before SST', r.subtotal],
              [`SST (${num(c.sstPct, 1)}%)`, r.sst],
            ].map(([l, v]) => (
              <div key={String(l)} className="flex justify-between py-2">
                <dt className="text-slate-500">{l}</dt>
                <dd className="tabular-nums">{rm(Number(v))}</dd>
              </div>
            ))}
            <div className="flex justify-between py-2 text-base font-semibold">
              <dt>Final quotation</dt>
              <dd className="tabular-nums text-brand-600">{rm(r.final)}</dd>
            </div>
            <div className="flex justify-between py-2 font-semibold">
              <dt>Estimated gross profit</dt>
              <dd className="tabular-nums">{rm(r.profit)}</dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-slate-500">Gross margin</dt>
              <dd className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${MARGIN_STYLE[level]}`}>{pct(r.margin)}</dd>
            </div>
          </dl>
        </section>

        {/* simulator */}
        <section className="card p-4">
          <h3 className="mb-1 font-semibold text-slate-900">Margin simulator</h3>
          <p className="mb-3 text-xs text-slate-500">Same direct cost and contingency, different markups. Margin colours: red under 10%, amber 10–15%, green 15% and up.</p>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2 font-medium">Scenario</th>
                  <th className="px-2 py-2 text-right font-medium">Markup %</th>
                  <th className="px-2 py-2 text-right font-medium">Final quote</th>
                  <th className="px-2 py-2 text-right font-medium">Profit</th>
                  <th className="px-2 py-2 text-right font-medium">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {r.scenarios.map((x, i) => (
                  <tr key={i}>
                    <td className="px-1 py-1">
                      <TextCell
                        label={`Scenario ${i + 1}`}
                        value={x.name}
                        onChange={(v) => patchCosting(p, s, (cc) => ({ scenarios: cc.scenarios.map((y, j) => (j === i ? { ...y, name: v } : y)) }))}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <NumCell
                        label={`Scenario ${i + 1} markup`}
                        value={x.markupPct}
                        onChange={(v) => patchCosting(p, s, (cc) => ({ scenarios: cc.scenarios.map((y, j) => (j === i ? { ...y, markupPct: v ?? 0 } : y)) }))}
                      />
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums">{rm(x.final)}</td>
                    <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums">{rm(x.profit)}</td>
                    <td className="px-2 py-1 text-right">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${MARGIN_STYLE[marginVsTarget(x.margin, c.targetMarginPct).level]}`}>{pct(x.margin)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3">
            <ColorBars
              format={(v) => `${num(v, 1)}%`}
              data={r.scenarios.map((x, i) => ({ name: x.name, value: Math.round(x.margin * 1000) / 10, color: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }))}
            />
          </div>
        </section>
      </div>

      <QuotationSummary project={p} settings={s} />
    </div>
  );
}

function PricePicker({ settings: s, onPick }: { settings: Settings; onPick: (it: Partial<CostItem>) => void }) {
  const [v, setV] = useState('');
  if (!s.priceList.length) {
    return (
      <Link to="/prices" className="btn-secondary">
        Price list is empty
      </Link>
    );
  }
  const groups = [...new Set(s.priceList.map((x) => x.category))];
  return (
    <select
      className="input w-auto max-w-[320px]"
      value={v}
      aria-label="Add from price list"
      onChange={(e) => {
        const it = s.priceList.find((x) => x.id === e.target.value);
        setV('');
        if (it)
          onPick({
            description: it.item,
            category: it.category,
            unit: it.uom || 'Nos',
            qty: 1,
            rate: it.price ?? 0,
            remarks: it.price == null ? 'RFQ – price needed' : it.supplier ? `Supplier: ${it.supplier}` : '',
          });
      }}
    >
      <option value="">+ Add from price list…</option>
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {s.priceList
            .filter((x) => x.category === g)
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.item} — {x.price == null ? 'RFQ' : money(x.price, s.currency, 2)}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

function QuotationSummary({ project: p, settings: s }: { project: Project; settings: Settings }) {
  const r = calcCosting(p, s);
  const rm = (v: number) => money(v, s.currency, 2);
  const [copied, setCopied] = useState(false);
  const rows = r.rows.filter((x) => x.description.trim() || x.direct);
  const text = [
    `QUOTATION – ${p.customerName}`,
    p.address,
    `System: ${num(p.systemKw, 2)} kWp`,
    '',
    ...rows.map((x, i) => `${i + 1}. ${x.description} | ${num(x.qty, 2)} ${x.unit} | ${rm(x.selling)}`),
    r.contingency ? `Contingency: ${rm(r.contingency)}` : '',
    r.discount ? `Discount: -${rm(r.discount)}` : '',
    r.sst ? `SST: ${rm(r.sst)}` : '',
    `TOTAL: ${rm(r.final)}`,
  ]
    .filter((l, i, a) => l !== '' || a[i - 1] !== '')
    .join('\n');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      alert(text);
    }
  };
  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">Quotation summary</h3>
        <button className="btn-secondary" onClick={copy}>
          <Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy as text'}
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">No.</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 font-medium">Unit</th>
              <th className="px-3 py-2 text-right font-medium">Selling amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((x, i) => (
              <tr key={x.id}>
                <td className="px-3 py-2 tabular-nums">{i + 1}</td>
                <td className="px-3 py-2">{x.description}</td>
                <td className="px-3 py-2">{x.category}</td>
                <td className="px-3 py-2 text-right tabular-nums">{num(x.qty, 2)}</td>
                <td className="px-3 py-2">{x.unit}</td>
                <td className="px-3 py-2 text-right tabular-nums">{rm(x.selling)}</td>
              </tr>
            ))}
            {r.contingency > 0 && <SumRow label="Contingency" value={rm(r.contingency)} />}
            {r.discount > 0 && <SumRow label="Discount" value={`-${rm(r.discount)}`} />}
            {r.sst > 0 && <SumRow label={`SST (${num(costingOf(p, s).sstPct, 1)}%)`} value={rm(r.sst)} />}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold">
            <tr>
              <td />
              <td colSpan={4} className="px-3 py-2">
                Final quotation value
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-brand-600">{rm(r.final)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td />
      <td className="px-3 py-2 text-slate-600" colSpan={4}>
        {label}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{value}</td>
    </tr>
  );
}
