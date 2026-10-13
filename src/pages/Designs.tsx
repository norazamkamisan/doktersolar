import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProjects } from '../lib/store';
import { energyFor, layoutPanels } from '../lib/solar';
import { num, relative } from '../lib/format';
import { Empty, PageHeader, StatusBadge } from '../components/ui';
import SolarMap from '../components/SolarMap';

export default function Designs() {
  const projects = useProjects();
  const designed = useMemo(() => projects.filter((p) => p.design.roof.length >= 3).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [projects]);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <PageHeader title="Designs" subtitle={`${designed.length} roof layouts`} />
      {designed.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {designed.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}/design`} className="card group overflow-hidden transition hover:shadow-md">
              <div className="pointer-events-none">
                <SolarMap
                  center={p.lat != null && p.lng != null ? [p.lat, p.lng] : null}
                  roof={p.design.roof}
                  panels={layoutPanels(p.design).panels}
                  staticView
                  className="h-48 !rounded-none"
                />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900 group-hover:text-brand-600">{p.customerName}</p>
                  <StatusBadge status={p.status} />
                </div>
                <p className="mt-0.5 truncate text-sm text-slate-500">{p.address}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    ['Size', `${num(p.systemKw, 2)} kWp`],
                    ['Panels', String(p.panelCount)],
                    ['kWh/yr', num(energyFor(p).annualKwh)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-slate-50 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">{k}</p>
                      <p className="text-sm font-semibold tabular-nums text-slate-900">{v}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-400">Updated {relative(p.updatedAt)}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Empty title="No designs yet">Open a project and draw a roof on the Design tab.</Empty>
      )}
    </div>
  );
}
