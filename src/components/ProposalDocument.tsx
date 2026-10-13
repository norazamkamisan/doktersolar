import { useMemo } from 'react';
import type { Project, Settings } from '../types';
import { MONTHS, energyFor, financialsFor, layoutPanels } from '../lib/solar';
import { date, money, num } from '../lib/format';
import SolarMap from './SolarMap';
import { LogoMark } from './Logo';
import { CashflowChart, MonthlyProductionChart } from './Charts';

type DocSettings = Omit<Settings, 'logo'> & { logo?: string | null };

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${accent ? 'text-brand-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

export default function ProposalDocument({ project: p, settings: s }: { project: Project; settings: DocSettings }) {
  const layout = useMemo(() => layoutPanels(p.design), [p.design]);
  const energy = energyFor(p);
  const fin = financialsFor(p, energy.annualKwh);
  const issued = p.proposalSentAt ?? p.updatedAt;
  const validUntil = new Date(new Date(issued).getTime() + 30 * 86400000).toISOString();
  const center = p.lat != null && p.lng != null ? ([p.lat, p.lng] as [number, number]) : null;

  return (
    <article className="print-page mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      {/* header */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3">
          {s.logo ? (
            <img src={s.logo} alt={s.companyName} className="h-12 max-w-[200px] object-contain" />
          ) : (
            <>
              <LogoMark className="h-11 w-11" />
              <span className="text-2xl font-semibold tracking-tight text-slate-900">{s.companyName}</span>
            </>
          )}
        </div>
        <div className="text-right text-sm text-slate-500">
          <p className="text-lg font-semibold text-slate-900">Solar Proposal</p>
          <p>Ref. {p.id.toUpperCase()}</p>
          <p>Issued {date(issued)}</p>
          <p>Valid until {date(validUntil)}</p>
        </div>
      </header>

      {/* customer */}
      <section className="avoid-break grid gap-6 py-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Prepared for</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{p.customerName}</p>
          <p className="text-sm text-slate-600">{p.address}</p>
          <p className="text-sm text-slate-600">{[p.email, p.phone].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Prepared by</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{s.companyName}</p>
          <p className="text-sm text-slate-600">{s.companyEmail}</p>
          <p className="text-sm text-slate-600">{s.companyPhone}</p>
        </div>
      </section>

      {/* headline */}
      <section className="avoid-break rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 p-6 text-white">
        <p className="text-sm text-brand-100">Your recommended system</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {num(p.systemKw, 2)} kWp · {p.panelCount} panels
        </p>
        <p className="mt-2 text-sm text-brand-50">
          Estimated to generate <strong>{num(energy.annualKwh)} kWh</strong> per year, covering about{' '}
          <strong>{num(Math.min(energy.offsetPct, 999))}%</strong> of your electricity use and saving around{' '}
          <strong>{money(fin.firstYearSavings, s.currency)}</strong> in the first year.
        </p>
      </section>

      {/* map */}
      <section className="avoid-break mt-6">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Panel layout</h2>
        {p.design.roof.length >= 3 ? (
          <SolarMap center={center} roof={p.design.roof} panels={layout.panels} staticView className="h-[340px] sm:h-[400px]" />
        ) : (
          <p className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">Roof layout not yet drawn.</p>
        )}
      </section>

      {/* key numbers */}
      <section className="avoid-break mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="System size" value={`${num(p.systemKw, 2)} kWp`} />
        <Metric label="Annual production" value={`${num(energy.annualKwh)} kWh`} />
        <Metric label="System cost" value={money(fin.systemCost, s.currency)} />
        <Metric label="Payback" value={fin.paybackYears ? `${num(fin.paybackYears, 1)} years` : '> 25 years'} accent />
        <Metric label="Year-1 savings" value={money(fin.firstYearSavings, s.currency)} />
        <Metric label="25-yr savings" value={money(fin.savings25, s.currency)} accent />
        <Metric label="Net 25-yr return" value={money(fin.netSavings25, s.currency)} />
        <Metric label="Bill offset" value={`${num(energy.offsetPct)}%`} />
      </section>

      {/* charts */}
      <section className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="avoid-break">
          <h2 className="text-base font-semibold text-slate-900">Monthly production</h2>
          <p className="mb-3 text-xs text-slate-500">Estimated kWh per month</p>
          <MonthlyProductionChart data={energy.monthlyKwh.map((kwh, i) => ({ label: MONTHS[i], kwh }))} />
        </div>
        <div className="avoid-break">
          <h2 className="text-base font-semibold text-slate-900">Cumulative savings</h2>
          <p className="mb-3 text-xs text-slate-500">Net of system cost, over 25 years</p>
          <CashflowChart data={fin.cashflow} currency={s.currency} />
        </div>
      </section>

      {/* system details */}
      <section className="avoid-break mt-8">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">System details & assumptions</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {[
                ['Solar panels', `${p.panelCount} × ${p.design.panelWattage} W (${p.design.panelWidth} × ${p.design.panelHeight} m, ${p.design.orientation})`],
                ['Tilt / azimuth', `${p.design.tilt}° / ${p.design.azimuth}°`],
                ['Production model', energy.source === 'pvwatts' ? 'NREL PVWatts v8 (location weather data)' : `${p.energy.peakSunHours} peak sun hours × 365 × 0.8 performance ratio`],
                ['Electricity tariff', `${money(p.energy.tariff, s.currency, 3)} per kWh, rising ${p.energy.escalation}% per year`],
                ['Panel degradation', `${p.energy.degradation}% per year`],
                ['Current monthly bill', money(p.monthlyBill, s.currency)],
                ['Installed price', `${money(p.energy.pricePerWatt, s.currency, 2)} per watt`],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td className="w-1/3 bg-slate-50 px-4 py-2.5 font-medium text-slate-600">{k}</td>
                  <td className="px-4 py-2.5 text-slate-800">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* acceptance */}
      <section className="avoid-break mt-8 grid gap-8 sm:grid-cols-2">
        {['Customer signature', 'Date'].map((l) => (
          <div key={l}>
            <div className="h-12 border-b border-slate-300" />
            <p className="mt-1 text-xs text-slate-500">{l}</p>
          </div>
        ))}
      </section>

      <footer className="mt-8 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-400">
        Estimates are indicative and based on satellite measurements and typical weather; actual production and savings depend on
        shading, weather, consumption patterns and tariff changes. Final pricing is subject to a site survey. Proposal generated with
        DokterSolar.
      </footer>
    </article>
  );
}
