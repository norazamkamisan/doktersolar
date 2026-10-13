import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudSun, Loader2 } from 'lucide-react';
import type { Project } from '../../types';
import { updateEnergy, useSettings } from '../../lib/store';
import { fetchPvWatts } from '../../lib/api';
import { MONTHS, PERFORMANCE_RATIO, energyFor, financialsFor } from '../../lib/solar';
import { money, num } from '../../lib/format';
import { NumberField, StatCard } from '../../components/ui';
import { CashflowChart, MonthlyProductionChart } from '../../components/Charts';

export default function EnergyTab({ project: p }: { project: Project }) {
  const { currency } = useSettings();
  const e = p.energy;
  const energy = energyFor(p);
  const fin = financialsFor(p, energy.annualKwh);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const runPvWatts = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await fetchPvWatts(p);
      updateEnergy(p.id, { pvwatts: r, usePvWatts: true });
    } catch (x) {
      setErr((x as Error).message);
    }
    setBusy(false);
  };

  if (p.systemKw <= 0) {
    return (
      <div className="card p-8 text-center">
        <p className="font-medium text-slate-800">No system designed yet</p>
        <p className="mt-1 text-sm text-slate-500">Draw the roof in the Design tab to place panels, then come back for the energy estimate.</p>
        <Link to={`/projects/${p.id}/design`} className="btn-primary mt-4">
          Go to Design
        </Link>
      </div>
    );
  }

  const monthly = energy.monthlyKwh.map((kwh, i) => ({ label: MONTHS[i], kwh }));

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Annual production" value={`${num(energy.annualKwh)} kWh`} hint={energy.source === 'pvwatts' ? 'NREL PVWatts' : 'Simple estimate'} />
          <StatCard label="Bill offset" value={`${num(energy.offsetPct)}%`} hint={`of ~${num(energy.consumptionKwh)} kWh/yr usage`} />
          <StatCard label="Payback" value={fin.paybackYears ? `${num(fin.paybackYears, 1)} yrs` : '> 25 yrs'} hint={`System cost ${money(fin.systemCost, currency)}`} />
          <StatCard label="25-year savings" value={money(fin.savings25, currency)} hint={`Net ${money(fin.netSavings25, currency)}`} />
        </div>

        <section className="card p-5">
          <h3 className="font-semibold text-slate-900">Monthly production</h3>
          <p className="mb-4 text-xs text-slate-500">kWh per month, year 1</p>
          <MonthlyProductionChart data={monthly} />
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-xs font-medium text-slate-500">Show as table</summary>
            <div className="mt-2 grid grid-cols-3 gap-x-6 gap-y-1 sm:grid-cols-6">
              {monthly.map((m) => (
                <div key={m.label} className="flex justify-between text-xs">
                  <span className="text-slate-500">{m.label}</span>
                  <span className="tabular-nums">{num(m.kwh)}</span>
                </div>
              ))}
            </div>
          </details>
        </section>

        <section className="card p-5">
          <h3 className="font-semibold text-slate-900">Cumulative savings</h3>
          <p className="mb-4 text-xs text-slate-500">
            Net position after system cost, with {e.degradation}% annual degradation and {e.escalation}% tariff escalation
          </p>
          <CashflowChart data={fin.cashflow} currency={currency} />
        </section>
      </div>

      <aside className="space-y-4">
        <section className="card space-y-4 p-5">
          <h3 className="font-semibold text-slate-900">Assumptions</h3>
          <NumberField label="Peak sun hours" suffix="h/day" value={e.peakSunHours} min={0} step={0.1} onChange={(v) => updateEnergy(p.id, { peakSunHours: v })} />
          <NumberField label="Electricity tariff" suffix={`${currency}/kWh`} value={e.tariff} min={0} step={0.01} onChange={(v) => updateEnergy(p.id, { tariff: v })} />
          <NumberField label="Installed price" suffix={`${currency}/W`} value={e.pricePerWatt} min={0} step={0.05} onChange={(v) => updateEnergy(p.id, { pricePerWatt: v })} />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Degradation" suffix="%/yr" value={e.degradation} min={0} step={0.1} onChange={(v) => updateEnergy(p.id, { degradation: v })} />
            <NumberField label="Tariff rise" suffix="%/yr" value={e.escalation} min={0} step={0.1} onChange={(v) => updateEnergy(p.id, { escalation: v })} />
          </div>
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            Simple model: {num(p.systemKw, 2)} kWp × {e.peakSunHours} h × 365 × {PERFORMANCE_RATIO} ={' '}
            <span className="font-medium text-slate-700">{num(p.systemKw * e.peakSunHours * 365 * PERFORMANCE_RATIO)} kWh/yr</span>
          </p>
        </section>

        <section className="card space-y-3 p-5">
          <div className="flex items-center gap-2">
            <CloudSun className="h-5 w-5 text-brand-500" />
            <h3 className="font-semibold text-slate-900">NREL PVWatts</h3>
          </div>
          <p className="text-xs text-slate-500">
            Uses weather data for this location via the site's Netlify Function. Requires <code>NREL_API_KEY</code> to be set on Netlify.
          </p>
          <button className="btn-secondary w-full" onClick={runPvWatts} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {e.pvwatts ? 'Refresh PVWatts estimate' : 'Get PVWatts estimate'}
          </button>
          {err && <p className="text-xs text-red-600">{err}</p>}
          {e.pvwatts && (
            <label className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm">
              <span>
                Use PVWatts ({num(e.pvwatts.annual)} kWh/yr)
                <span className="block text-xs text-slate-500">Size may have changed since fetch — refresh to update.</span>
              </span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-500"
                checked={e.usePvWatts}
                onChange={(ev) => updateEnergy(p.id, { usePvWatts: ev.target.checked })}
              />
            </label>
          )}
        </section>
      </aside>
    </div>
  );
}
