import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useProjects, useSettings } from '../lib/store';
import { energyFor, financialsFor } from '../lib/solar';
import { date, money, num } from '../lib/format';
import { Empty, PageHeader, StatusBadge } from '../components/ui';

export default function Proposals() {
  const projects = useProjects();
  const { currency } = useSettings();
  const rows = useMemo(
    () =>
      projects
        .filter((p) => p.systemKw > 0)
        .map((p) => {
          const e = energyFor(p);
          return { p, e, f: financialsFor(p, e.annualKwh) };
        })
        .sort((a, b) => (b.p.proposalSentAt ?? b.p.updatedAt).localeCompare(a.p.proposalSentAt ?? a.p.updatedAt)),
    [projects],
  );

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <PageHeader title="Proposals" subtitle="Every project with a designed system has a proposal ready to share." />
      {rows.length ? (
        <>
        {/* phones: stacked cards */}
        <ul className="card divide-y divide-slate-100 md:hidden">
          {rows.map(({ p, f }) => (
            <li key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/projects/${p.id}/proposal`} className="font-medium text-slate-900 hover:text-brand-600">
                  {p.customerName}
                </Link>
                <StatusBadge status={p.status} />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                {[
                  ['Size', `${num(p.systemKw, 2)} kWp`],
                  ['Price', money(f.systemCost, currency)],
                  ['Payback', f.paybackYears ? `${num(f.paybackYears, 1)} yrs` : '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-slate-500">{k}</dt>
                    <dd className="font-medium tabular-nums text-slate-800">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">Sent {date(p.proposalSentAt)}</span>
                <Link to={`/proposals/${p.id}`} className="btn-secondary !py-1.5">
                  <ExternalLink className="h-4 w-4" /> View
                </Link>
              </div>
            </li>
          ))}
        </ul>
        {/* md and up: table */}
        <div className="card hidden overflow-x-auto md:block">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Customer</th>
                <th className="th text-right">Size</th>
                <th className="th text-right">Price</th>
                <th className="th text-right">Payback</th>
                <th className="th">Status</th>
                <th className="th">Sent</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ p, f }) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="td">
                    <Link to={`/projects/${p.id}/proposal`} className="font-medium text-slate-900 hover:text-brand-600">
                      {p.customerName}
                    </Link>
                  </td>
                  <td className="td text-right tabular-nums">{num(p.systemKw, 2)} kWp</td>
                  <td className="td text-right tabular-nums">{money(f.systemCost, currency)}</td>
                  <td className="td text-right tabular-nums">{f.paybackYears ? `${num(f.paybackYears, 1)} yrs` : '—'}</td>
                  <td className="td">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="td text-slate-500">{date(p.proposalSentAt)}</td>
                  <td className="td text-right">
                    <Link to={`/proposals/${p.id}`} className="btn-ghost !py-1">
                      <ExternalLink className="h-4 w-4" /> View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : (
        <Empty title="No proposals yet">Design a system for a project to generate its proposal.</Empty>
      )}
    </div>
  );
}
