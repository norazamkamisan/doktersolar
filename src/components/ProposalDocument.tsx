import { forwardRef, useMemo } from 'react';
import type { Project, Settings } from '../types';
import { MONTHS, energyFor, financialsFor, layoutPanels } from '../lib/solar';
import { date, money, num } from '../lib/format';
import SolarMap from './SolarMap';
import { LogoMark } from './Logo';
import { CashflowChart, MonthlyProductionChart } from './Charts';
import { CATEGORY_LABEL } from '../lib/billAnalysis';

export type DocSettings = Omit<Settings, 'logo'> & { logo?: string | null };

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${accent ? 'text-brand-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

/** The customer's current TNB bill, and what it could look like with solar. */
function BillSection({ project: p, currency, monthlySaving, wide }: { project: Project; currency: string; monthlySaving: number; wide: boolean }) {
  const b = p.bill!;
  const history = b.history.filter((h) => h.kwh !== null);
  const maxKwh = Math.max(1, ...history.map((h) => h.kwh!));
  // the fixed retail charge stays on the bill even when solar covers all the energy
  const after = Math.max(b.charges.retailRm ?? 0, p.monthlyBill - monthlySaving);
  return (
    <section className="avoid-break mt-6">
      <h2 className="mb-3 text-lg font-semibold text-slate-900">Your electricity today</h2>
      <div className={`grid gap-4 ${wide ? 'grid-cols-2' : 'md:grid-cols-2'}`}>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {[
                ['TNB account', b.accountNo],
                ['Tariff', b.tariff ? `${b.tariff} (${CATEGORY_LABEL[b.category].toLowerCase()})` : CATEGORY_LABEL[b.category]],
                ['Average use', p.monthlyKwh ? `${num(p.monthlyKwh)} kWh per month` : null],
                ['Average bill', p.monthlyBill > 0 ? `${money(p.monthlyBill, currency)} per month` : null],
                ['Rate you pay', `${money(p.energy.tariff, currency, 3)} per kWh`],
                ['Maximum demand', b.maxDemandKw !== null ? `${num(b.maxDemandKw, 1)} kW` : null],
                ['Existing solar', b.nem ? 'Yes, on NEM (bill shows grid use only)' : null],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <tr key={k}>
                    <td className="w-2/5 bg-slate-50 px-4 py-2 font-medium text-slate-600">{k}</td>
                    <td className="px-4 py-2 text-slate-800">{v}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-4">
          {history.length > 1 && (
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Recent use (kWh)</p>
              <div className="flex h-24 items-end gap-2">
                {history.map((h) => (
                  <div key={h.month} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] tabular-nums text-slate-500">{num(h.kwh!)}</span>
                    <div className="w-full rounded-t bg-brand-400" style={{ height: `${Math.max(4, (h.kwh! / maxKwh) * 64)}px` }} />
                    <span className="text-[10px] text-slate-500">{h.month.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {p.systemKw > 0 && p.monthlyBill > 0 && !b.nem && (
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Bill today" value={`${money(p.monthlyBill, currency)}/mo`} />
              <Metric label="With solar, about" value={`${money(after, currency)}/mo`} accent />
            </div>
          )}
        </div>
      </div>
      {b.nem && (
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          You already have solar under NEM, so your bill shows only the power bought from TNB after your existing panels. The
          savings below assume the new system replaces that grid power at your current rate; credits for power exported beyond
          your own use are limited under NEM, so we will confirm the final size at the site survey.
        </p>
      )}
    </section>
  );
}

/** Each direct child of the <article> becomes one unbreakable block in the downloaded PDF (see lib/pdf.ts). */
/**
 * `forExport`: fixed desktop layout (no screen-width breakpoints, no card frame), used for the
 * off-screen copy that becomes the downloaded PDF, so phones and desktops get the same document.
 */
const ProposalDocument = forwardRef<HTMLElement, { project: Project; settings: DocSettings; forExport?: boolean }>(function ProposalDocument(
  { project: p, settings: s, forExport = false },
  ref,
) {
  /** pick the responsive classes on screen, or their desktop equivalents for export */
  const r = (screen: string, exported: string) => (forExport ? exported : screen);
  const layout = useMemo(() => layoutPanels(p.design), [p.design]);
  const energy = energyFor(p);
  const fin = financialsFor(p, energy.annualKwh);
  const issued = p.proposalSentAt ?? p.updatedAt;
  const validUntil = new Date(new Date(issued).getTime() + 30 * 86400000).toISOString();
  const center = p.lat != null && p.lng != null ? ([p.lat, p.lng] as [number, number]) : null;

  return (
    <article
      ref={ref}
      className={r('print-page mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10', 'bg-white px-2 py-1')}
    >
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
      <section className={`avoid-break grid gap-6 py-6 ${r('sm:grid-cols-2', 'grid-cols-2')}`}>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Prepared for</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{p.customerName}</p>
          <p className="text-sm text-slate-600">{p.address}</p>
          <p className="text-sm text-slate-600">{[p.email, p.phone].filter(Boolean).join(' · ')}</p>
        </div>
        <div className={r('sm:text-right', 'text-right')}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Prepared by</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{s.companyName}</p>
          <p className="text-sm text-slate-600">{s.companyEmail}</p>
          <p className="text-sm text-slate-600">{s.companyPhone}</p>
        </div>
      </section>

      {/* headline */}
      <section className="avoid-break rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 p-6 text-white">
        <p className="text-sm text-brand-100">Your recommended system</p>
        <p className={`mt-1 font-semibold tracking-tight ${r('text-3xl sm:text-4xl', 'text-4xl')}`}>
          {num(p.systemKw, 2)} kWp · {p.panelCount} panels
        </p>
        <p className="mt-2 text-sm text-brand-50">
          Estimated to generate <strong>{num(energy.annualKwh)} kWh</strong> per year,{' '}
          {energy.consumptionKwh > 0 && (
            <>
              covering about <strong>{num(Math.min(energy.offsetPct, 999))}%</strong> of your electricity use and{' '}
            </>
          )}
          saving around <strong>{money(fin.firstYearSavings, s.currency)}</strong> in the first year.
        </p>
      </section>

      {p.bill && <BillSection project={p} currency={s.currency} monthlySaving={fin.firstYearSavings / 12} wide={forExport} />}

      {/* map */}
      <section className="avoid-break mt-6">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Panel layout</h2>
        {p.design.roof.length >= 3 ? (
          <SolarMap center={center} roof={p.design.roof} panels={layout.panels} staticView className={r('h-[340px] sm:h-[400px]', 'h-[400px]')} />
        ) : (
          <p className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">Roof layout not yet drawn.</p>
        )}
      </section>

      {/* key numbers */}
      <section className={`avoid-break mt-6 grid gap-3 ${r('grid-cols-2 md:grid-cols-4', 'grid-cols-4')}`}>
        <Metric label="System size" value={`${num(p.systemKw, 2)} kWp`} />
        <Metric label="Annual production" value={`${num(energy.annualKwh)} kWh`} />
        <Metric label="System cost" value={money(fin.systemCost, s.currency)} />
        <Metric label="Payback" value={fin.paybackYears ? `${num(fin.paybackYears, 1)} years` : '> 25 years'} accent />
        <Metric label="Year-1 savings" value={money(fin.firstYearSavings, s.currency)} />
        <Metric label="25-yr savings" value={money(fin.savings25, s.currency)} accent />
        <Metric label="Net 25-yr return" value={money(fin.netSavings25, s.currency)} />
        <Metric label="Bill offset" value={energy.consumptionKwh > 0 ? `${num(energy.offsetPct)}%` : '—'} />
      </section>

      {/* charts */}
      <section className={`mt-8 grid gap-6 ${r('md:grid-cols-2', 'grid-cols-2')}`}>
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
                ['Production model', energy.source === 'pvwatts' ? 'PVWatts v8 by NLR (location weather data)' : `${p.energy.peakSunHours} peak sun hours × 365 × 0.8 performance ratio`],
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
      <section className={`avoid-break mt-8 grid gap-8 ${r('sm:grid-cols-2', 'grid-cols-2')}`}>
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
});

export default ProposalDocument;
