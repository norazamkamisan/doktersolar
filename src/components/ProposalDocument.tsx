import { forwardRef, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Car, House, Plane, TreeDeciduous, UtilityPole } from 'lucide-react';
import type { Project, Settings } from '../types';
import {
  TARIFF_LABEL,
  billYear,
  compass,
  currentAfaSen,
  degradationText,
  energyFor,
  environmentFor,
  financialsFor,
  layoutPanels,
  maxDemandOf,
  tariffModelOf,
  tnbIdOf,
  touPeakPctOf,
} from '../lib/solar';
import { TNB_2025, tnbTariffRows } from '../lib/tnbTariff';
import { DEFAULT_SETTINGS } from '../lib/defaults';
import { money, num } from '../lib/format';
import { fillTerms, inverterLine, issuedAt, longDate, panelLine, paragraphs, quoteFor, quoteNumber, shortName, validUntil } from '../lib/proposal';
import { CATEGORY_LABEL } from '../lib/billAnalysis';
import SolarMap from './SolarMap';
import { LogoMark } from './Logo';
import { AnnualSavingsChart, BillCompareChart, CumulativeBillSavingsChart, CumulativeNetChart, DailyGenUseChart, GREEN } from './ProposalCharts';

export type DocSettings = Omit<Settings, 'logo' | 'coverImage' | 'caseStudies'> & Partial<Pick<Settings, 'logo' | 'coverImage' | 'caseStudies'>>;

/** A4 at 96 dpi: the size of each page in the downloaded PDF. */
export const PAGE_W = 794;
export const PAGE_H = 1123;
const PAD_X = 40;
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Renders children with the measured width of this box (charts need a pixel width). */
function Measured({ children, fixed }: { children: (width: number) => ReactNode; fixed?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fixed ?? 0);
  useLayoutEffect(() => {
    if (fixed || !ref.current) return;
    const el = ref.current;
    const update = () => setWidth(Math.floor(el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fixed]);
  return <div ref={ref}>{width > 0 && children(width)}</div>;
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mb-5 text-center text-2xl font-light tracking-tight text-slate-800">{children}</h2>;
}

function BigStat({ value, unit, label, green = false }: { value: string; unit?: string; label: string; green?: boolean }) {
  return (
    <div className="px-2 text-center">
      <p className={`text-2xl font-light tabular-nums ${green ? '' : 'text-slate-900'}`} style={green ? { color: GREEN } : undefined}>
        {value}
        {unit && <span className="ml-0.5 text-xs">{unit}</span>}
      </p>
      <p className="mt-1 text-xs leading-snug" style={green ? { color: GREEN } : undefined}>
        {label}
      </p>
    </div>
  );
}

function PanelIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 5h14l2 10H3z" />
      <path d="M4 10h16M9 5l-1 10M15 5l1 10M12 15v4M8 19h8" />
    </svg>
  );
}

function FlowBox({ label, children, off = false }: { label: string; children: ReactNode; off?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`flex h-12 w-12 items-center justify-center rounded ${off ? 'bg-slate-200 text-slate-500' : 'text-white'}`} style={off ? undefined : { background: GREEN }}>
        {children}
      </div>
      <span className="text-[10px] font-semibold tracking-wide text-slate-700">{label}</span>
    </div>
  );
}

/** Solar → home → grid flow for one situation (arrows drawn as an SVG overlay). */
function Flow({ title, mode }: { title: string; mode: 'excess' | 'partial' | 'night' }) {
  const g = GREEN;
  return (
    <div className="px-3">
      <p className="mb-3 text-sm text-slate-800">{title}</p>
      <div className="relative mx-auto h-40 w-full max-w-[220px]">
        <svg viewBox="0 0 220 160" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <marker id={`ah-${mode}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 10 5 0 10z" fill={g} />
            </marker>
          </defs>
          {mode !== 'night' && <path d="M50 112 H95 V72" fill="none" stroke={g} strokeWidth="2" markerEnd={`url(#ah-${mode})`} />}
          {mode === 'excess' && <path d="M50 118 H160" fill="none" stroke={g} strokeWidth="2" markerEnd={`url(#ah-${mode})`} />}
          {mode !== 'excess' && <path d="M170 112 H125 V72" fill="none" stroke={g} strokeWidth="2" markerEnd={`url(#ah-${mode})`} />}
        </svg>
        <div className="absolute left-1/2 top-0 -translate-x-1/2">
          <FlowBox label="HOME">
            <House className="h-6 w-6" />
          </FlowBox>
        </div>
        <div className="absolute bottom-2 left-0">
          <FlowBox label="SOLAR" off={mode === 'night'}>
            <PanelIcon />
          </FlowBox>
        </div>
        <div className="absolute bottom-2 right-0">
          <FlowBox label="GRID">
            <UtilityPole className="h-6 w-6" />
          </FlowBox>
        </div>
      </div>
    </div>
  );
}

/**
 * The customer proposal, laid out as A4 pages in the style of the company's own proposals:
 * cover, about us, recommended system, performance, how it works, bill savings, financial impact,
 * quotation, case studies and terms. Pages without content (no "About us" text, no case studies,
 * no terms) are left out.
 *
 * `forExport`: fixed A4 page size and desktop layout, for the off-screen copy that becomes the
 * downloaded PDF (each page becomes one PDF page, see lib/pdf.ts).
 */
const ProposalDocument = forwardRef<HTMLElement, { project: Project; settings: DocSettings; forExport?: boolean }>(function ProposalDocument(
  { project: p, settings: docSettings, forExport = false },
  ref,
) {
  // share links made before newer settings existed don't carry them
  const s = { ...DEFAULT_SETTINGS, ...docSettings } as Settings;
  const r = (screen: string, exported: string) => (forExport ? exported : screen);
  const contentW = PAGE_W - PAD_X * 2;

  const layout = useMemo(() => layoutPanels(p.design), [p.design]);
  const energy = energyFor(p);
  const fin = financialsFor(p, energy);
  const qi = quoteFor(p, s);
  const months = billYear(p, energy.monthlyKwh, 1, s.fixedCharge);
  const env = environmentFor(p, energy.annualKwh);
  const hasUse = energy.consumptionKwh > 0;
  const solarYear1 = months.reduce((t, m) => t + m.solarKwh, 0);
  const offsetPct = hasUse ? Math.min(100, (solarYear1 / energy.consumptionKwh) * 100) : 0;
  const center = p.lat != null && p.lng != null ? ([p.lat, p.lng] as [number, number]) : null;
  const startYear = new Date(issuedAt(p)).getFullYear();
  const cur = s.currency;
  const first = shortName(p.customerName);
  const avgBefore = months.reduce((t, m) => t + m.billBefore, 0) / 12;
  const avgAfter = months.reduce((t, m) => t + m.billAfter, 0) / 12;
  const payback = fin.paybackYears;
  const paybackText = payback == null ? 'over 25 years' : `${Math.floor(payback)} years, ${Math.round((payback % 1) * 12)} months`;
  const preparedBy = s.userName;
  const contactLine = [s.userEmail || s.companyEmail, s.userPhone || s.companyPhone].filter(Boolean).join(' - ');

  /* ------------------------------ pages ------------------------------ */
  const pages: { key: string; body: ReactNode }[] = [];

  pages.push({
    key: 'cover',
    body: (
      <div className="flex h-full flex-col">
        <div className={`grid gap-4 text-xs leading-relaxed text-slate-800 ${r('sm:grid-cols-3', 'grid-cols-3')}`}>
          <div>
            <p className="font-bold">Prepared by: {preparedBy}</p>
            {s.userPhone && <p>{s.userPhone}</p>}
            {s.userEmail && <p>{s.userEmail}</p>}
          </div>
          <div>
            <p className="font-bold">For: {first}</p>
            <p>{p.address}</p>
          </div>
          <div className={r('sm:text-right', 'text-right')}>
            <p>Quote #: {quoteNumber(p)}</p>
            <p>Valid until: {longDate(validUntil(p))}</p>
          </div>
        </div>
        <div className="mx-auto mt-8 w-full overflow-hidden" style={{ maxWidth: 680 }}>
          {s.coverImage ? (
            <img src={s.coverImage} alt="" className="h-[280px] w-full object-cover" />
          ) : (
            <div className="relative h-[280px] w-full overflow-hidden" style={{ background: 'linear-gradient(135deg,#0f3d5e 0%,#1e6fa3 55%,#8fd3ff 100%)' }}>
              <div className="absolute right-10 top-8 h-24 w-24 rounded-full bg-amber-300 opacity-90 blur-[2px]" />
              <div className="absolute inset-x-0 bottom-0 h-32" style={{ background: 'repeating-linear-gradient(100deg,#123a5c 0 34px,#1d4f7a 34px 36px)', transform: 'skewY(-6deg) translateY(30px)' }} />
            </div>
          )}
        </div>
        <h1 className="mt-6 text-center text-2xl font-light text-slate-800">Solar Energy System Proposal</h1>
        <div className="mt-6 space-y-4 text-sm text-slate-800">
          <p>Dear {first},</p>
          {paragraphs(s.coverLetter).map((t, i) => (
            <p key={i} className="whitespace-pre-line">
              {t}
            </p>
          ))}
          <p>
            Best Regards,
            <br />
            {preparedBy}
            <br />
            <strong>{s.companyName}</strong>
          </p>
        </div>
        <div className={`mt-auto grid gap-2 pt-10 text-[10px] leading-relaxed text-slate-700 ${r('sm:grid-cols-2', 'grid-cols-2')}`}>
          <div>
            <p className="font-bold">{s.companyName}</p>
            <p className="whitespace-pre-line">{s.companyAddress}</p>
          </div>
          <div>
            {s.companyPhone && <p>Phone: {s.companyPhone}</p>}
            {s.companyEmail && <p>Email: {s.companyEmail}</p>}
            {s.companyWebsite && <p>Web: {s.companyWebsite}</p>}
          </div>
        </div>
      </div>
    ),
  });

  if (s.aboutUs.trim()) {
    pages.push({
      key: 'about',
      body: (
        <div className="space-y-3 text-xs leading-relaxed text-slate-800">
          {paragraphs(s.aboutUs).map((t, i) => (
            <p key={i} className="whitespace-pre-line">
              {t}
            </p>
          ))}
        </div>
      ),
    });
  }

  const warranties = [
    `${s.panelWarrantyYears} Year Panel Product Warranty`,
    `${s.performanceWarrantyYears} Year Panel Performance Warranty`,
    `${s.inverterWarrantyYears} Year Inverter Product Warranty`,
  ].join(', ');

  pages.push({
    key: 'system',
    body: (
      <div>
        <H2>Recommended System Option</H2>
        <div className={`grid divide-slate-200 ${r('grid-cols-2 gap-y-4 sm:grid-cols-4 sm:divide-x', 'grid-cols-4 divide-x')}`}>
          <BigStat value={num(p.systemKw, 2)} unit="kW" label="System Size" />
          <BigStat value={money(fin.firstYearSavings, cur)} label="Estimated Annual Energy Bill Savings" />
          <BigStat value={money(qi.totalPrice, cur)} label="Total System Price" />
          <BigStat value={money(qi.netPrice, cur)} label="Net System Price" green />
        </div>
        <div className="mt-6">
          {layout.faces.length ? (
            <SolarMap center={center} roofs={layout.faces.map((f) => f.roof)} panels={layout.panels} staticView className="h-[320px] !rounded-none" />
          ) : (
            <p className="bg-slate-50 p-6 text-center text-sm text-slate-500">Roof layout not yet drawn.</p>
          )}
        </div>
        <h3 className="mt-6 text-center text-xl font-light text-slate-800">Your Solution</h3>
        <div className={`mt-3 grid gap-4 ${r('sm:grid-cols-2', 'grid-cols-2')}`}>
          <div className="border border-slate-200 p-3 text-xs leading-relaxed text-slate-800">
            <p className="mb-1 text-sm">Solar Panels</p>
            {qi.panelBrand && <p className="font-bold">{qi.panelBrand}</p>}
            <p>
              <strong>{num(p.systemKw, 3)} kW</strong> Total Module Power
            </p>
            <p>
              <strong>
                {p.panelCount} x {num(p.design.panelWattage)} Watt Panels
              </strong>
              {qi.panelModel && ` (${qi.panelModel})`}
            </p>
            <p>
              <strong>{num(energy.annualKwh)} kWh</strong> per year
            </p>
          </div>
          <div className="border border-slate-200 p-3 text-xs leading-relaxed text-slate-800">
            <p className="mb-1 text-sm">Inverter</p>
            {qi.inverterBrand && <p className="font-bold">{qi.inverterBrand}</p>}
            <p>
              <strong>{num(qi.inverterKw, 1)} kW</strong> Total Inverter Rating
            </p>
            <p>
              {qi.inverterQty} x {qi.inverterModel || `${num(qi.inverterKw / qi.inverterQty, 1)} kW inverter`}
            </p>
          </div>
        </div>
        <p className="mt-4 text-center text-[10px] text-slate-500">Warranties: {warranties}</p>
      </div>
    ),
  });

  const orientations = layout.faces.length
    ? layout.faces.map((f) => `${f.panels.length} ${f.panels.length === 1 ? 'panel' : 'panels'} with Azimuth ${f.azimuth} (${compass(f.azimuth)}) and Slope ${f.tilt}`).join('; ')
    : `Azimuth ${p.design.azimuth} and Slope ${p.design.tilt}`;

  pages.push({
    key: 'performance',
    body: (
      <div>
        <H2>System Performance</H2>
        <div className={`grid items-center gap-4 ${r('sm:grid-cols-[150px_minmax(0,1fr)]', 'grid-cols-[150px_minmax(0,1fr)]')}`}>
          <BigStat value={hasUse ? `${num(offsetPct)}%` : '—'} label="Energy From Solar" />
          <div className="min-w-0">
            <div className="mb-1 flex justify-center gap-6 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <i className="inline-block h-2.5 w-2.5" style={{ background: GREEN }} /> New System Generation (kWh/day)
              </span>
              {hasUse && (
                <span className="flex items-center gap-1">
                  <i className="inline-block h-2.5 w-2.5 bg-slate-300" /> Consumption (kWh/day)
                </span>
              )}
            </div>
            <Measured fixed={forExport ? contentW - 166 : undefined}>
              {(w) => <DailyGenUseChart width={w} data={months.map((m, i) => ({ label: m.month, gen: m.solarKwh / DAYS[i], use: m.usageKwh / DAYS[i] }))} />}
            </Measured>
          </div>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
          System Performance Assumptions: Output Calculator:{' '}
          {energy.source === 'pvwatts' ? 'PVWatts v8 (location weather data)' : `${p.energy.peakSunHours} peak sun hours × 365 × 0.8 performance ratio`}. Panel
          Orientations: {orientations}. Panel degradation: {degradationText(p.energy)}.
        </p>

        <H2>
          <span className="mt-8 block">Environmental Benefits</span>
        </H2>
        <p className="-mt-3 text-center text-xs text-slate-700">Solar has no emissions. It just silently generates pure, clean energy.</p>
        <div className="mt-4 h-28 w-full" style={{ background: 'linear-gradient(120deg,#2e7d32 0%,#66bb6a 45%,#c5e1a5 100%)' }} aria-hidden="true">
          <div className="flex h-full items-center justify-center gap-10 text-white/90">
            <TreeDeciduous className="h-14 w-14" />
            <TreeDeciduous className="h-20 w-20" />
            <TreeDeciduous className="h-14 w-14" />
          </div>
        </div>
        <div className={`mt-5 grid gap-4 ${r('sm:grid-cols-[2fr_3fr]', 'grid-cols-[2fr_3fr]')}`}>
          <div className="border border-slate-200 p-3">
            <p className="mb-2 text-center text-xs text-slate-700">Each Year</p>
            <div className="grid grid-cols-2">
              <BigStat value={hasUse ? num(offsetPct) : '—'} unit="%" label="Consumption Offset" />
              <BigStat value={num(env.co2TonsPerYear, 1)} unit="tons" label="of CO₂ reduced per year" />
            </div>
          </div>
          <div className="border border-slate-200 p-3">
            <p className="mb-2 text-center text-xs text-slate-700">Over System Lifetime (25 years)</p>
            <div className="grid grid-cols-3">
              <div className="text-center">
                <Car className="mx-auto mb-1 h-4 w-4 text-slate-400" />
                <BigStat value={num(env.carKm)} unit="km" label="Car distance avoided" />
              </div>
              <div className="text-center">
                <TreeDeciduous className="mx-auto mb-1 h-4 w-4 text-slate-400" />
                <BigStat value={num(env.trees)} label="Trees planted" />
              </div>
              <div className="text-center">
                <Plane className="mx-auto mb-1 h-4 w-4 text-slate-400" />
                <BigStat value={num(env.flights)} label="Long haul flights avoided" />
              </div>
            </div>
          </div>
        </div>
        <p className="mt-2 text-[9px] text-slate-400">
          Based on about 0.76 kg of CO₂ per kWh from the Malaysian grid; equivalents are approximate.
        </p>
      </div>
    ),
  });

  pages.push({
    key: 'how',
    body: (
      <div>
        <H2>How your system works</H2>
        <div className={`grid divide-slate-200 ${r('gap-6 sm:grid-cols-3 sm:gap-0 sm:divide-x', 'grid-cols-3 divide-x')}`}>
          <Flow title="Generating Excess Solar" mode="excess" />
          <Flow title="Partially Offset Usage" mode="partial" />
          <Flow title="Night" mode="night" />
        </div>
        <div className={`mt-6 grid gap-4 text-xs leading-relaxed text-slate-600 ${r('sm:grid-cols-3', 'grid-cols-3')}`}>
          <p>On sunny days the panels make more power than your home uses. Your home runs on solar and the extra goes to the grid, earning credit on your bill.</p>
          <p>When your home needs more than the panels are making, solar covers part of it and the rest comes from the grid.</p>
          <p>At night your home uses grid power as usual, with credits from the day reducing what you pay.</p>
        </div>
      </div>
    ),
  });

  const model = tariffModelOf(p);
  const tariffLabel = TARIFF_LABEL[model];
  const tariffName =
    model === 'flat'
      ? p.bill
        ? `${p.bill.tariff ? `${p.bill.tariff} — ` : ''}${CATEGORY_LABEL[p.bill.category]}`
        : 'Flat rate'
      : `Tenaga Nasional Berhad (TNB) ${tariffLabel.replace(/^TNB /, '')} (from ${TNB_2025.effectiveFrom})`;
  const tnbId = tnbIdOf(model);
  const tariffRows: [string, string][] = tnbId
    ? tnbTariffRows(tnbId, { touPeakPct: touPeakPctOf(p), afaSen: currentAfaSen(), maxDemandKw: maxDemandOf(p) })
    : [
        ['Energy Charge (average rate)', `${money(p.energy.tariff, cur, 3)} / kWh`],
        ['Fixed Charge', `${money(s.fixedCharge, cur, 2)} / month`],
      ];
  const cumulativeBill: { year: number; value: number }[] = [];
  {
    let total = 0;
    for (let y = 1; y <= 25; y++) {
      total += fin.cashflow[y].savings;
      if ([1, 5, 10, 15, 20, 25].includes(y)) cumulativeBill.push({ year: y, value: total });
    }
  }
  const cell = 'px-1.5 py-1 text-right tabular-nums';

  pages.push({
    key: 'bill',
    body: (
      <div>
        <H2>Electricity Bill Savings</H2>
        <div className={`grid gap-6 ${r('sm:grid-cols-2', 'grid-cols-2')} [&>*]:min-w-0`}>
          <div>
            <p className="mb-2 text-center text-sm text-slate-800">First Year Monthly Bill Savings</p>
            {hasUse ? (
              <Measured fixed={forExport ? contentW / 2 - 12 : undefined}>{(w) => <BillCompareChart width={w} before={avgBefore} after={avgAfter} currency={cur} />}</Measured>
            ) : (
              <p className="bg-slate-50 p-6 text-center text-xs text-slate-500">Add the customer's monthly bill or usage to compare bills.</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-center text-sm text-slate-800">Cumulative Bill Savings</p>
            <p className="text-center text-xs font-semibold text-slate-800">Lifetime Bill Savings {money(fin.savings25, cur)}</p>
            <Measured fixed={forExport ? contentW / 2 - 12 : undefined}>{(w) => <CumulativeBillSavingsChart width={w} data={cumulativeBill} currency={cur} />}</Measured>
          </div>
        </div>
        <div className={r("mt-5 overflow-x-auto", "mt-5")}>
          <table className={`w-full border-collapse text-[10px] text-slate-700 ${r("min-w-[620px]", "")}`}>
            <thead>
              <tr className="bg-green-50 align-bottom text-slate-800">
                {[
                  'Month',
                  'Solar Generation (kWh)',
                  'Grid Consumption before new system (kWh)',
                  'Grid Consumption after new system (kWh)',
                  `Utility Bill before new system (${cur === 'MYR' ? 'RM' : cur})`,
                  `Utility Bill after new system (${cur === 'MYR' ? 'RM' : cur})`,
                  'Energy Credit carried forward (kWh)',
                  `Estimated Savings (${cur === 'MYR' ? 'RM' : cur})`,
                ].map((h, i) => (
                  <th key={h} className={`px-1.5 py-2 font-semibold ${i ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {months.map((m) => (
                <tr key={m.month}>
                  <td className="px-1.5 py-1">{m.month}</td>
                  <td className={cell}>{num(m.solarKwh)}</td>
                  <td className={cell}>{hasUse ? num(m.usageKwh) : '—'}</td>
                  <td className={cell}>{hasUse ? num(m.gridAfterKwh) : '—'}</td>
                  <td className={cell}>{hasUse ? num(m.billBefore) : '—'}</td>
                  <td className={cell}>{hasUse ? num(m.billAfter) : '—'}</td>
                  <td className={cell}>{hasUse ? num(m.creditKwh) : '—'}</td>
                  <td className={cell}>{num(m.savings)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 space-y-2 text-[10px] leading-relaxed text-slate-500">
          <p>
            Your projected energy cost is calculated by considering a {p.energy.escalation}% increase in energy cost each year. This estimate is based
            on your current energy costs and the position and orientation of your roof.{' '}
            {hasUse
              ? `Projections are based on usage of ${num(energy.consumptionKwh)} kWh per year (${num(energy.consumptionKwh / 12)} kWh per month), assuming the ${tariffLabel} tariff.`
              : 'No usage was given, so every kWh of solar is counted as a saving at the average rate.'}{' '}
            Solar beyond your own use is exported, and its kWh offset grid use in later months of the same year (net energy metering). Taxes
            (SST, KWTBB) are not included.
          </p>
          <p>Your electricity tariff rates may change as a result of installing the system. You should contact your electricity retailer for further information.</p>
        </div>
        <table className="mt-4 w-full border border-slate-200 text-[11px] text-slate-800">
          <tbody className="divide-y divide-slate-200">
            <tr className="bg-slate-100">
              <td colSpan={2} className="px-3 py-1.5 font-semibold">
                Proposed Tariff Details - {tariffName}
              </td>
            </tr>
            {tariffRows.map(([k, v]) => (
              <tr key={k}>
                <td className="w-1/2 px-3 py-1 font-semibold">{k}</td>
                <td className="px-3 py-1">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  });

  const cumulativeNet = fin.cashflow.slice(1).map((c) => ({ year: startYear + c.year - 1, value: c.cumulative }));
  const annual = [{ year: startYear, value: -fin.systemCost }, ...fin.cashflow.slice(1).map((c) => ({ year: startYear + c.year - 1, value: c.savings }))];
  const half = forExport ? contentW / 2 - 12 : undefined;

  pages.push({
    key: 'financial',
    body: (
      <div>
        <H2>Net Financial Impact Cash Purchase</H2>
        <div className="flex flex-wrap items-start justify-center gap-4 text-center">
          <BigStat value={money(fin.savings25, cur)} label="Utility Bill Savings" />
          <span className="pt-1 text-2xl font-light text-slate-500">-</span>
          <BigStat value={money(fin.systemCost, cur)} label="Net System Cost" />
          <span className="pt-1 text-2xl font-light text-slate-500">=</span>
          <BigStat value={money(fin.netSavings25, cur)} label="Estimated Net Savings" green />
        </div>
        <div className={`mt-8 grid gap-6 ${r('sm:grid-cols-2', 'grid-cols-2')} [&>*]:min-w-0`}>
          <div>
            <p className="mb-1 text-center text-sm text-slate-800">Cumulative Savings</p>
            <p className="text-center text-[10px] font-semibold text-slate-800">
              Net Savings {money(fin.netSavings25, cur)} · Payback {paybackText}
            </p>
            <Measured fixed={half}>{(w) => <CumulativeNetChart width={w} data={cumulativeNet} currency={cur} />}</Measured>
          </div>
          <div>
            <p className="mb-1 text-center text-sm text-slate-800">Annual Savings</p>
            <p className="text-center text-[10px] font-semibold text-slate-800">First bar: initial investment</p>
            <Measured fixed={half}>{(w) => <AnnualSavingsChart width={w} data={annual} currency={cur} />}</Measured>
          </div>
        </div>
        <p className="mt-4 text-[10px] leading-relaxed text-slate-500">
          Estimates do not include replacement costs of equipment not covered by a warranty. Components may need replacement after their warranty
          period.
        </p>
      </div>
    ),
  });

  const rowCls = 'border-b border-slate-200';
  pages.push({
    key: 'quote',
    body: (
      <div className="text-xs text-slate-800">
        <H2>Quotation</H2>
        <p className="mb-3 text-base">Payment Option: Cash Purchase</p>
        <table className="w-full border border-slate-200">
          <tbody>
            <tr className={rowCls}>
              <td colSpan={2} className="px-3 py-3 leading-relaxed">
                {panelLine(p, qi)}
                <br />
                {inverterLine(qi)}
              </td>
            </tr>
            <tr className={rowCls}>
              <td className="w-3/5 px-3 py-2.5">Total System Price</td>
              <td className="px-3 py-2.5">{money(qi.totalPrice, cur, 2)}</td>
            </tr>
            {qi.discount > 0 && (
              <tr className={rowCls}>
                <td className="px-3 py-2.5">Discount</td>
                <td className="px-3 py-2.5">-{money(qi.discount, cur, 2)}</td>
              </tr>
            )}
            <tr className={`${rowCls} bg-slate-100 font-bold`}>
              <td className="px-3 py-2.5">Purchase Price</td>
              <td className="px-3 py-2.5">{money(qi.netPrice, cur, 2)}</td>
            </tr>
            {qi.depositPct > 0 && (
              <tr className="bg-slate-100 font-bold">
                <td className="px-3 py-2.5">Deposit Payable</td>
                <td className="px-3 py-2.5">{money(qi.deposit, cur, 2)}</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="mt-2 text-[10px] text-slate-500">{s.quoteNote}</p>
        <p className="text-[10px] text-slate-500">This proposal is valid until {longDate(validUntil(p))}.</p>

        {qi.depositPct > 0 && (
          <>
            <p className="mb-2 mt-5 text-center text-sm">Payment Milestones</p>
            <table className="w-full border border-slate-200">
              <tbody>
                <tr className={rowCls}>
                  <td className="w-2/5 px-3 py-2.5">Deposit ({qi.depositPct}%)</td>
                  <td className="px-3 py-2.5">{money(qi.deposit, cur, 2)}</td>
                </tr>
                <tr className={rowCls}>
                  <td className="px-3 py-2.5">Final Payment Milestone</td>
                  <td className="px-3 py-2.5">{money(qi.balance, cur, 2)}</td>
                </tr>
                <tr className="bg-slate-100 font-bold">
                  <td className="px-3 py-2.5">Total</td>
                  <td className="px-3 py-2.5">{money(qi.netPrice, cur, 2)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        <div className="mt-8 border border-slate-200 p-4">
          <p className="mb-3 text-center text-xl font-light">Quote Acceptance</p>
          <p>I have read &amp; accept the terms and conditions.</p>
          <div className="mt-6 flex items-end gap-3">
            <span>Signature</span>
            <span className="h-6 flex-1 border-b border-slate-400" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-6">
            {['Name', 'Date'].map((l) => (
              <div key={l} className="flex items-end gap-3">
                <span>{l}</span>
                <span className="h-6 flex-1 border-b border-slate-400" />
              </div>
            ))}
          </div>
          {s.paymentDetails.trim() && (
            <div className="mt-6">
              <p className="font-bold">Payment Details</p>
              <p className="mt-1 whitespace-pre-line">{s.paymentDetails}</p>
            </div>
          )}
        </div>
      </div>
    ),
  });

  const studies = (s.caseStudies ?? []).filter((c) => c.title.trim() || c.text.trim());
  if (studies.length) {
    pages.push({
      key: 'cases',
      body: (
        <div>
          <H2>Case Studies</H2>
          <div className="space-y-6">
            {studies.map((c, i) => (
              <div key={i} className="border-b border-slate-200 pb-5 text-xs leading-relaxed text-slate-800">
                {c.title && <p className="mb-2 text-base">{c.title}</p>}
                {paragraphs(c.text).map((t, j) => (
                  <p key={j} className="mb-2 whitespace-pre-line">
                    {t}
                  </p>
                ))}
                {c.image && <img src={c.image} alt="" className="mx-auto mt-2 max-h-[300px] max-w-full object-contain" />}
              </div>
            ))}
          </div>
        </div>
      ),
    });
  }

  if (s.terms.trim()) {
    pages.push({
      key: 'terms',
      body: (
        <div className="space-y-3 text-xs leading-relaxed text-slate-800">
          {paragraphs(fillTerms(s.terms, p, s, qi)).map((t, i) => {
            const [head, ...rest] = t.split('\n');
            const isHeading = rest.length > 0 && head.trim().endsWith(':');
            return isHeading ? (
              <div key={i}>
                <p className="font-bold">{head}</p>
                <p className="mt-1 whitespace-pre-line">{rest.join('\n')}</p>
              </div>
            ) : (
              <p key={i} className="whitespace-pre-line">
                {t}
              </p>
            );
          })}
          <p className="pt-4 text-[10px] text-slate-500">
            Estimates are indicative and based on satellite measurements and typical weather; actual production and savings depend on shading,
            weather, consumption patterns and tariff changes. Final pricing is subject to a site survey.
          </p>
        </div>
      ),
    });
  }

  const total = pages.length;
  return (
    <article ref={ref} className={r('space-y-6', '')} data-proposal>
      {pages.map((pg, i) => (
        <section
          key={pg.key}
          data-pdf-page
          className={`proposal-page flex flex-col bg-white ${r('mx-auto max-w-[794px] border border-slate-200 px-5 py-6 shadow-sm sm:px-10 sm:py-8', '')}`}
          style={forExport ? { width: PAGE_W, height: PAGE_H, padding: `28px ${PAD_X}px 22px`, overflow: 'hidden' } : undefined}
        >
          <header className="mb-6 flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
            {s.logo ? (
              <img src={s.logo} alt={s.companyName} className="h-12 max-w-[180px] object-contain" />
            ) : (
              <div className="flex items-center gap-2">
                <LogoMark className="h-9 w-9" />
                <span className="text-lg font-semibold text-slate-900">{s.companyName}</span>
              </div>
            )}
            <p className="text-right text-[10px] text-slate-700">Proposal for {p.customerName}</p>
          </header>
          <div className="flex-1">{pg.body}</div>
          <footer className="mt-6 flex items-center justify-between gap-4 border-t border-slate-200 pt-2 text-[9px] text-slate-500">
            <span>
              {s.companyName}
              {preparedBy ? ` - ${preparedBy}` : ''}
              {contactLine ? `   ${contactLine}` : ''}
            </span>
            <span className="shrink-0">
              Page {i + 1} / {total}
            </span>
          </footer>
        </section>
      ))}
    </article>
  );
});

export default ProposalDocument;
