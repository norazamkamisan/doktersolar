import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { PriceItem } from '../types';
import { updateSettings, useSettings } from '../lib/store';
import { useMe } from '../lib/sync';
import { date, money } from '../lib/format';
import { categoryColor, newRowId, todayIso } from '../lib/costing';
import { PageHeader } from '../components/ui';
import { DeleteCell, NumCell, SelectCell, TextCell } from '../components/Cells';

/** Supplier prices used to build up project costings. The admin keeps it up to date. */
export default function PriceListPage() {
  const s = useSettings();
  const me = useMe();
  const canEdit = me.role === 'admin';
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [pricedOnly, setPricedOnly] = useState(false);

  const list = s.priceList;
  const set = (id: string, patch: Partial<PriceItem>) =>
    updateSettings({ priceList: list.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const add = () =>
    updateSettings({
      priceList: [{ id: newRowId(), category: cat || s.costCategories[0] || 'Others', item: 'New item', uom: 'Nos', price: null, supplier: '', note: '', updated: '' }, ...list],
    });

  const cats = [...new Set([...s.costCategories, ...list.map((x) => x.category)])];
  const rows = list.filter(
    (x) =>
      (!cat || x.category === cat) &&
      (!pricedOnly || x.price != null) &&
      (!q || `${x.item} ${x.supplier} ${x.note}`.toLowerCase().includes(q.toLowerCase())),
  );
  const priced = list.filter((x) => x.price != null);
  const latest = priced.map((x) => x.updated).filter(Boolean).sort().pop();

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <PageHeader
        title="Price list"
        subtitle={canEdit ? 'Latest supplier prices for Solar EPCC jobs. Changing a price updates its date. Use them on a project’s Costing tab.' : 'Latest supplier prices, kept by your admin.'}
        actions={
          canEdit && (
            <button className="btn-primary" onClick={add}>
              <Plus className="h-4 w-4" /> Add item
            </button>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Items', String(list.length)],
          ['With price', String(priced.length)],
          ['Waiting RFQ', String(list.length - priced.length)],
          ['Latest update', latest ? date(latest) : '—'],
        ].map(([l, v]) => (
          <div key={l} className="card px-4 py-3">
            <p className="text-xs text-slate-500">{l}</p>
            <p className="text-lg font-semibold tabular-nums text-slate-900">{v}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" type="search" placeholder="Search item or supplier" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search price list" />
        <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {cats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={pricedOnly} onChange={(e) => setPricedOnly(e.target.checked)} /> Priced only
        </label>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {['Category', 'Item', 'UOM', 'Unit price', 'Supplier', 'Stock / notes', 'Updated', ''].map((h, i) => (
                <th key={h + i} className={`whitespace-nowrap px-3 py-2 font-medium ${i === 3 ? 'text-right' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((x, i) => (
              <tr key={x.id}>
                <td className="whitespace-nowrap px-3 py-1.5">
                  {canEdit ? (
                    <SelectCell label={`Category ${i + 1}`} value={x.category} options={cats} onChange={(v) => set(x.id, { category: v })} />
                  ) : (
                    <>
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: categoryColor(x.category, cats.indexOf(x.category)) }} />
                      {x.category}
                    </>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {canEdit ? <TextCell className="min-w-[260px]" label={`Item ${i + 1}`} value={x.item} onChange={(v) => set(x.id, { item: v })} /> : x.item}
                </td>
                <td className="px-2 py-1.5">
                  {canEdit ? <SelectCell label={`UOM ${i + 1}`} value={x.uom} options={s.costUnits} onChange={(v) => set(x.id, { uom: v })} /> : x.uom}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {canEdit ? (
                    <NumCell label={`Price ${i + 1}`} value={x.price} placeholder="RFQ" onChange={(v) => set(x.id, { price: v, updated: v == null ? '' : todayIso() })} />
                  ) : x.price == null ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">RFQ</span>
                  ) : (
                    money(x.price, s.currency, 2)
                  )}
                </td>
                <td className="px-2 py-1.5">
                  {canEdit ? <TextCell label={`Supplier ${i + 1}`} value={x.supplier} onChange={(v) => set(x.id, { supplier: v })} /> : x.supplier}
                </td>
                <td className="px-2 py-1.5 text-slate-500">
                  {canEdit ? <TextCell className="min-w-[180px]" label={`Notes ${i + 1}`} value={x.note} onChange={(v) => set(x.id, { note: v })} /> : x.note}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5">
                  {x.price == null ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">RFQ</span>
                  ) : x.updated ? (
                    date(x.updated)
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-2 py-1.5">{canEdit && <DeleteCell label={`Remove ${x.item}`} onDelete={() => updateSettings({ priceList: list.filter((y) => y.id !== x.id) })} />}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                  {list.length ? 'No items match.' : canEdit ? 'No prices yet. Add items, or import them in Settings → Import from the Quotation app.' : 'No prices yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
