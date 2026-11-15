import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjects, useSettings } from '../lib/store';
import { date, money } from '../lib/format';
import { categoryColor, cashflowOf, PRIORITY_COLORS } from '../lib/costing';
import { balanceOf, daysOverdue, summarize } from '../lib/cashflow';
import { Empty, PageHeader } from '../components/ui';
import { KpiTile } from '../components/Cells';
import { MoneyDonut, NetLine, TwoSeriesBars } from '../components/CostCharts';

/** Company cashflow across every job: money in, money out, what's owed both ways. */
export default function CashflowPage() {
  const s = useSettings();
  const all = useProjects();
  const withCash = useMemo(() => all.filter((p) => {
    const c = cashflowOf(p);
    return c.payments.length || c.cashIn.length || c.cashOut.length;
  }), [all]);
  const [projectId, setProjectId] = useState('');
  const [yearPick, setYear] = useState<number | null>(null);
  const scope = projectId ? withCash.filter((p) => p.id === projectId) : withCash;
  const yearsAll = summarize(scope, new Date().getFullYear()).years;
  const year = yearPick ?? yearsAll[0] ?? new Date().getFullYear();
  const sum = useMemo(() => summarize(scope, year), [scope, year]);
  const cur = s.currency;
  const rm = (v: number) => money(v, cur, 2);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <PageHeader
        title="Cashflow"
        subtitle="Pantau duit masuk, duit keluar, baki claim dan bayaran supplier/subcon. Enter rows on each project's Cashflow tab."
        actions={
          <>
            <select className="input w-auto max-w-[280px]" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Project">
              <option value="">All projects ({withCash.length})</option>
              {withCash.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.customerName}
                </option>
              ))}
            </select>
            <select className="input w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
              {yearsAll.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </>
        }
      />

      {!withCash.length ? (
        <Empty title="No cashflow yet">Open a project and use its Cashflow tab to record payments, cash in and cash out.</Empty>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KpiTile tone="green" label="Total cash in" value={rm(sum.cashIn)} sub="claims, VO & customer payments" />
            <KpiTile tone="red" label="Total cash out" value={rm(sum.cashOut)} sub="actual payments made" />
            <KpiTile tone="blue" label="Net cashflow" value={rm(sum.net)} sub={`Cash position: ${sum.net >= 0 ? 'POSITIVE' : 'NEGATIVE'}`} />
            <KpiTile tone="violet" label="Outstanding receivable" value={rm(sum.receivable)} sub="still to collect" />
            <KpiTile tone="orange" label="Outstanding payable" value={rm(sum.payable)} sub="unpaid to suppliers / subcon / crew" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-4">
              <h3 className="mb-2 font-semibold text-slate-900">Cash in vs cash out <span className="text-xs font-normal text-slate-500">{year}</span></h3>
              <TwoSeriesBars
                currency={cur}
                data={sum.months.map((m) => ({ name: m.label, cashIn: m.cashIn, cashOut: m.cashOut }))}
                series={[
                  { key: 'cashIn', label: 'Cash in', color: '#10b981' },
                  { key: 'cashOut', label: 'Cash out', color: '#ef4444' },
                ]}
              />
            </section>
            <section className="card p-4">
              <h3 className="mb-2 font-semibold text-slate-900">Net cashflow trend <span className="text-xs font-normal text-slate-500">{year}</span></h3>
              <NetLine currency={cur} data={sum.months.map((m) => ({ name: m.label, net: m.net }))} />
            </section>
            <section className="card p-4">
              <h3 className="mb-2 font-semibold text-slate-900">Cash out by category</h3>
              <MoneyDonut currency={cur} data={[...sum.byCategory.entries()].map(([k, v], i) => ({ name: k, value: v, color: categoryColor(k, i) }))} />
            </section>
            <section className="card p-4">
              <h3 className="mb-2 font-semibold text-slate-900">Outstanding payable <span className="text-xs font-normal text-slate-500">by priority</span></h3>
              <MoneyDonut
                currency={cur}
                hole={false}
                data={['Critical', 'High', 'Medium', 'Low'].map((k) => ({ name: k, value: sum.byPriority.get(k) ?? 0, color: PRIORITY_COLORS[k] }))}
              />
            </section>
            {!projectId && sum.byProject.length > 0 && (
              <section className="card p-4 lg:col-span-2">
                <h3 className="mb-2 font-semibold text-slate-900">Receivable vs payable <span className="text-xs font-normal text-slate-500">by project</span></h3>
                <TwoSeriesBars
                  currency={cur}
                  data={sum.byProject.map((x) => ({ name: x.project.customerName.slice(0, 22), receivable: x.receivable, payable: x.payable }))}
                  series={[
                    { key: 'receivable', label: 'Receivable', color: '#8b5cf6' },
                    { key: 'payable', label: 'Payable', color: '#f97316' },
                  ]}
                />
              </section>
            )}
          </div>

          <section className="card p-4">
            <h3 className="mb-3 font-semibold text-slate-900">Monthly cashflow {year}</h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {['Month', 'Cash in', 'Cash out', 'Net', 'Outstanding in', 'Outstanding payable', 'Status'].map((h, i) => (
                      <th key={h} className={`whitespace-nowrap px-3 py-2 font-medium ${i > 0 && i < 6 ? 'text-right' : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sum.months.map((m) => (
                    <tr key={m.label}>
                      <td className="px-3 py-2">{m.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{rm(m.cashIn)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{rm(m.cashOut)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${m.net < 0 ? 'text-rose-600' : ''}`}>{rm(m.net)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{rm(m.outIn)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{rm(m.outPay)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                            m.net >= 0 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'
                          }`}
                        >
                          {m.net >= 0 ? 'OK' : 'WATCH'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card p-4">
            <h3 className="mb-3 font-semibold text-slate-900">Payments to chase <span className="text-xs font-normal text-slate-500">not paid, earliest due first</span></h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {['Due', 'Project', 'Payee', 'Description', 'Priority', 'Balance', 'Overdue'].map((h, i) => (
                      <th key={h} className={`whitespace-nowrap px-3 py-2 font-medium ${i >= 5 ? 'text-right' : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sum.toChase.slice(0, 15).map(({ row, project }) => {
                    const od = daysOverdue(row);
                    return (
                      <tr key={project.id + row.id}>
                        <td className="whitespace-nowrap px-3 py-2">{row.due ? date(row.due) : '—'}</td>
                        <td className="px-3 py-2">
                          <Link to={`/projects/${project.id}/cashflow`} className="text-brand-600 hover:underline">
                            {project.customerName}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{row.payee}</td>
                        <td className="px-3 py-2">{row.description}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: PRIORITY_COLORS[row.priority] }} />
                          {row.priority}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{rm(balanceOf(row))}</td>
                        <td className="px-3 py-2 text-right">
                          {od ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">{od} d</span> : '0'}
                        </td>
                      </tr>
                    );
                  })}
                  {!sum.toChase.length && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                        Nothing outstanding.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
