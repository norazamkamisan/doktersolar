import { forwardRef, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Project } from '../types';
import { layoutPanels } from '../lib/solar';
import { suggestInverterKw } from '../lib/proposal';
import { ZERO_CAPEX } from '../lib/zeroCapex';
import { townAndState, zeroCapexFor } from '../lib/zeroCapexProject';
import SolarMap from './SolarMap';
import logo from '../assets/zerocapex/logo.png';
import coverField from '../assets/zerocapex/cover-field.jpg';
import coverPanels from '../assets/zerocapex/cover-panels.jpg';
import certSsm from '../assets/zerocapex/cert-ssm.jpg';
import certCidb1 from '../assets/zerocapex/cert-cidb-1.jpg';
import certCidb2 from '../assets/zerocapex/cert-cidb-2.jpg';
import certSeda from '../assets/zerocapex/cert-seda.jpg';
import certTnb from '../assets/zerocapex/cert-tnb.jpg';
import certSt from '../assets/zerocapex/cert-st.jpg';
import awardBumiputera from '../assets/zerocapex/award-bumiputera.jpg';
import awardRichworks from '../assets/zerocapex/award-richworks.jpg';
import sitePasar from '../assets/zerocapex/site-pasar-besar-seremban.jpg';
import siteIdw from '../assets/zerocapex/site-idw.jpg';
import siteFelda from '../assets/zerocapex/site-felda.jpg';
import siteSigc from '../assets/zerocapex/site-sigc.jpg';
import siteResidential from '../assets/zerocapex/site-residential.jpg';
import siteSurau from '../assets/zerocapex/site-surau-ar-rawdhah.jpg';
import siteAsSalihin from '../assets/zerocapex/site-madrasah-as-salihin.jpg';
import siteIbnRazak from '../assets/zerocapex/site-madrasah-ibn-razak.jpg';

/** 16:9 slide, laid out at this size and scaled to fit the screen. */
export const SLIDE_W = 960;
export const SLIDE_H = 540;

const NAVY = '#0a2c38';
const INK = '#0e2a33';
const TEAL = '#097d74';
const TINT = '#edf4f2';
const GOLD = '#e5b941';
const SAND = '#f3f2ee';
const FONT = 'Arial, "Helvetica Neue", Helvetica, system-ui, sans-serif';

const GAMA = {
  name: 'GAMA ENERGY SDN BHD',
  /** Gama Energy is PSP Group's SEDA-registered solar PV investor (RPVI) */
  tagline: 'SEDA-Registered Solar PV Investor (RPVI) · PSP Group of Companies',
  phone: '06-765 5666',
  whatsapp: '+60116299-7515 (WhatsApp only)',
  email: 'info@mygamaenergy.com',
  web: 'www.mygamaenergy.com',
  address: 'Lot 3-01, Plaza Seremban Utara, Jalan Tun Dr. Ismail,\n70200 Seremban, Negeri Sembilan.',
};

const fmt = (v: number, d = 2) => v.toLocaleString('en-MY', { minimumFractionDigits: d, maximumFractionDigits: d });
const rm = (v: number, d = 2) => `RM${fmt(v, d)}`;

/** One slide: fixed 960 × 540 layout, scaled down to the available width on screen. */
function Slide({ children, forExport, bg = '#fff' }: { children: ReactNode; forExport: boolean; bg?: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    if (forExport || !outer.current) return;
    const el = outer.current;
    const update = () => setScale(Math.min(1, el.clientWidth / SLIDE_W));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [forExport]);

  const slide = (
    <div
      data-pdf-page
      className="zc-slide relative overflow-hidden"
      style={{ width: SLIDE_W, height: SLIDE_H, background: bg, fontFamily: FONT, color: INK, transform: forExport ? undefined : `scale(${scale})`, transformOrigin: 'top left' }}
    >
      {children}
    </div>
  );
  if (forExport) return slide;
  return (
    <div ref={outer} className="zc-slide-outer mx-auto w-full max-w-[960px] overflow-hidden border border-slate-200 bg-white shadow-sm" style={{ height: SLIDE_H * scale }}>
      {slide}
    </div>
  );
}

function PageNo({ n }: { n: number }) {
  return (
    <span className="absolute text-[12px] font-bold" style={{ right: 36, bottom: 16, color: TEAL }}>
      {String(n).padStart(2, '0')}
    </span>
  );
}

/** Eyebrow, title and logo, as on the company's slides. */
function Heading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <>
      <img src={logo} alt="" className="absolute" style={{ right: 36, top: 18, width: 42, height: 42 }} />
      <p className="absolute text-[9.5px] font-bold uppercase tracking-wide" style={{ left: 40, top: 22, color: TEAL, right: 100 }}>
        {eyebrow}
      </p>
      <h2 className="absolute text-[26px] font-bold leading-tight" style={{ left: 40, top: 48, right: 100 }}>
        {title}
      </h2>
    </>
  );
}

/** Small teal heading over a block of content. */
function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[12px] font-bold uppercase" style={{ color: TEAL }}>
      {children}
    </p>
  );
}

function Cover({ split, photo, forExport, children }: { split: number; photo: string; forExport: boolean; children: ReactNode }) {
  return (
    <Slide forExport={forExport} bg={NAVY}>
      <img src={photo} alt="" className="absolute top-0 h-full object-cover" style={{ left: split, width: SLIDE_W - split }} />
      <div className="absolute inset-y-0 left-0 flex flex-col text-white" style={{ width: split, padding: '30px 30px 26px 32px', background: NAVY }}>
        <p className="text-[10px] font-bold" style={{ color: GOLD }}>
          {GAMA.name}
        </p>
        <p className="mt-1 text-[9px] text-white/80">{GAMA.tagline}</p>
        {children}
      </div>
    </Slide>
  );
}

function SiteName({ name, place, className = '' }: { name: string; place: string; className?: string }) {
  return (
    <div className={`text-[15px] font-bold leading-snug ${className}`}>
      <p className="line-clamp-2">{name}</p>
      {place && <p className="line-clamp-1">{place}</p>}
    </div>
  );
}

const th = 'px-3 py-2.5 text-left text-[11px] font-bold uppercase text-white';

/** A table with a teal header row and tinted alternate rows. */
function TealTable({ head, rows, className = '', style, cell = 'px-3 py-2' }: { head: string[]; rows: ReactNode[][]; className?: string; style?: React.CSSProperties; cell?: string }) {
  return (
    <table className={`border-collapse ${className}`} style={style}>
      <thead>
        <tr style={{ background: TEAL }}>
          {head.map((h) => (
            <th key={h} className={th}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-slate-200" style={{ background: i % 2 ? '#fff' : TINT }}>
            {r.map((c, j) => (
              <td key={j} className={`${cell} align-middle`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const PROJECTS: [string, string, string][] = [
  ['PRIMA PORT DICKSON', 'CREAM SOLAR PROGRAM', 'IN PROGRESS'],
  ['YAYASAN NEGERI SEMBILAN (YNS)', 'ATAP SOLAR PROGRAM', 'IN PROGRESS'],
  ['NUSAJAYA & VILLA BESTARI (JB)', 'NEM SOLAR PROGRAM', 'IN PROGRESS'],
  ['PUSAT PERUBATAN UNIVERSITI MALAYA (PPUM)', 'ATAP SOLAR PROGRAM', 'IN PROGRESS'],
  ['YAYASAN PERSAUDARAAN ISLAM (YASAR)', 'ATAP SOLAR PROGRAM', 'IN PROGRESS'],
];

const CERTS: [string, string][] = [
  [certSsm, 'SSM'],
  [certCidb1, 'CIDB'],
  [certCidb2, 'CIDB'],
  [certSeda, 'SEDA'],
  [certTnb, 'TNB'],
  [certSt, 'Energy Commission'],
];

const SITES: [string, string, string[]][] = [
  [sitePasar, 'Pasar Besar Seremban', ['Seremban, Negeri Sembilan', '336.60 kWp', 'Investor: GSPARX Sdn Bhd']],
  [siteIdw, 'IDW Design & Build', ['Shah Alam, Selangor', '49.50 kWp']],
  [siteFelda, 'FELDA Buildings', ['Johor Bahru, Kerteh, Raja Alias, Kuantan, Alor Setar and Jengka']],
  [siteSigc, 'SIGC Residences', ['SIGC residential project']],
  [siteResidential, 'Residential Projects', ['Sendayan, Shah Alam, Alor Setar, Masai, Bandar Seri Iskandar, Seberang Jaya']],
  [siteSurau, 'Surau Ar-Rawdhah', ['Shah Alam, Selangor', '4.86 kWp']],
  [siteAsSalihin, 'Madrasah As Salihin', ['Ampangan, Negeri Sembilan', '31.98 kWp']],
  [siteIbnRazak, 'Madrasah Ibn Razak (IREC)', ['Simpang Pertang, Negeri Sembilan', '14.76 kWp']],
];

/**
 * The Zero Capex proposal for Commercial & Industrial customers (bills of RM10,000 a month and
 * more): the company's slide deck, with the system, the savings simulation and the 20-year
 * savings table worked out with the Zero Capex financial model (lib/zeroCapex.ts).
 */
const ZeroCapexProposal = forwardRef<HTMLElement, { project: Project; forExport?: boolean }>(function ZeroCapexProposal({ project: p, forExport = false }, ref) {
  const zc = zeroCapexFor(p);
  const m = zc.model;
  const y1 = m.years[0];
  const layout = useMemo(() => layoutPanels(p.design), [p.design]);
  const center = p.lat != null && p.lng != null ? ([p.lat, p.lng] as [number, number]) : null;
  const name = p.customerName || 'Customer';
  const place = townAndState(p.address);
  const inverterKw = p.quote?.inverterKw ?? suggestInverterKw(p.systemKw);
  const areaM2 = Math.round(zc.panelAreaM2 / 10) * 10;
  const rateText = zc.tou ? `${rm(m.inputs.peakRate, 4)} / ${rm(m.inputs.offPeakRate, 4)}` : rm(m.inputs.peakRate, 4);
  const years = ZERO_CAPEX.years;
  const pct = (v: number, d = 0) => `${fmt(v * 100, d)}%`;

  return (
    <article ref={ref} className={forExport ? '' : 'space-y-4'} data-proposal>
      {/* 1. Cover */}
      <Cover split={434} photo={coverField} forExport={forExport}>
        <h1 className="mt-12 text-[42px] font-bold leading-[1.08]">
          SOLAR
          <br />
          ENERGY
          <br />
          PROPOSAL
        </h1>
        <SiteName name={name} place={place} className="mt-9" />
        <p className="mt-auto text-[10px]">Your Energy Solution Partner</p>
        <p className="mt-4 text-[10.5px] font-bold" style={{ color: GOLD }}>
          {GAMA.web}
        </p>
      </Cover>

      {/* 2. Company profile */}
      <Slide forExport={forExport}>
        <Heading eyebrow="Company profile and services" title="Gama Energy at a glance" />
        {[
          ['13', 'years of renewable energy experience'],
          ['3', 'core teams of fewer than 25 members'],
          ['50', 'support agents'],
        ].map(([n, l], i) => (
          <div key={l} className="absolute" style={{ left: 40 + i * 300, top: 106, width: 230 }}>
            <p className="text-[38px] font-bold leading-none" style={{ color: TEAL }}>
              {n}
            </p>
            <p className="mt-2 text-[12.5px] leading-snug">{l}</p>
          </div>
        ))}
        <div className="absolute" style={{ left: 40, top: 214, width: 410 }}>
          <Kicker>End-to-end services</Kicker>
          <p className="text-[16px] leading-snug">
            System design, procurement, installation, testing and commissioning, and maintenance for the life of the system.
          </p>
          <p className="mt-3 text-[12px] leading-snug">Quality and safety involve equipment suppliers, investors, installers and customers.</p>
        </div>
        <div className="absolute space-y-2 text-[12px] leading-snug" style={{ left: 507, top: 214, width: 413 }}>
          <Kicker>Direction and values</Kicker>
          <p>
            <strong>Mission:</strong> customers first and the best value, aiming for zero-capex installations at 100 or more factories.
          </p>
          <p>
            <strong>Vision:</strong> a global waqf organisation listed on the NYSE/LSE in smart cities, microgrids and green technology.
          </p>
          <p className="pt-2">
            <strong>Siddiq</strong> - truthful and fair &nbsp; <strong>Amanah</strong> - trustworthy
            <br />
            <strong>Tabligh</strong> - sharing benefits &nbsp; <strong>Fathonah</strong> - wise and always learning
          </p>
        </div>
        <div className="absolute space-y-3 px-4 py-4 text-[11px] leading-snug" style={{ left: 38, top: 414, width: 882, background: SAND }}>
          <p>
            <strong>Group network:</strong> Pumar Solar Power (holding company), Sunview (partner), Green Magnitude, Gama Energy and Pumar Machineries
            (associate companies).
          </p>
          <p>
            <strong>Office:</strong> Lot 3-01, Plaza Seremban Utara, Jalan Tun Dr. Ismail, 70200 Seremban, Negeri Sembilan.
          </p>
        </div>
        <PageNo n={2} />
      </Slide>

      {/* 3. Portfolio and credentials */}
      <Slide forExport={forExport}>
        <Heading eyebrow="Project portfolio, certificates and achievements" title="Current projects and credentials" />
        <TealTable
          head={['No.', 'Project', 'Program', 'Status']}
          rows={PROJECTS.map(([a, b, c], i) => [i + 1, a, b, <span className="whitespace-nowrap">{c}</span>])}
          className="absolute text-[12px]"
          style={{ left: 28, top: 104, width: 560 }}
          cell="px-3 py-[11px]"
        />
        <div className="absolute grid grid-cols-3 gap-x-[30px] gap-y-2" style={{ left: 615, top: 104, width: 295 }}>
          {CERTS.map(([src, label], i) => (
            <div key={i}>
              <img src={src} alt={label} className="h-[107px] w-[75px] border border-slate-800 object-cover" />
              <p className="mt-1 whitespace-nowrap text-[8.5px] font-bold" style={{ color: TEAL }}>
                {label}
              </p>
            </div>
          ))}
        </div>
        <div className="absolute flex gap-6" style={{ left: 615, top: 384 }}>
          {[
            [awardBumiputera, 'Bumiputera Best Brand Award 2022', 135],
            [awardRichworks, 'RichWorks Top 50 SME Award 2021', 119],
          ].map(([src, label, w]) => (
            <div key={label as string} style={{ width: w as number }}>
              <img src={src as string} alt="" className="h-[70px] w-full object-cover" />
              <p className="mt-1.5 text-[9px] font-bold leading-tight">{label}</p>
            </div>
          ))}
        </div>
        <PageNo n={3} />
      </Slide>

      {/* 4. Experience */}
      <Slide forExport={forExport}>
        <Heading eyebrow="Commercial, residential and community buildings" title="Experience across many sites" />
        {SITES.map(([src, title, lines], i) => (
          <div key={title} className="absolute" style={{ left: 40 + (i % 4) * 225, top: i < 4 ? 108 : 296, width: 207 }}>
            <img src={src} alt="" className="h-[103px] w-full object-cover" />
            <p className="mt-2 text-[12px] font-bold">{title}</p>
            {lines.map((l) => (
              <p key={l} className="text-[9.5px] leading-snug">
                {l}
              </p>
            ))}
          </div>
        ))}
        <PageNo n={4} />
      </Slide>

      {/* 5. Proposed system */}
      <Slide forExport={forExport}>
        <Heading eyebrow="Initial zero-capex solar system proposal" title={`Solar system for ${name}`} />
        <div className="absolute overflow-hidden bg-slate-100" style={{ left: 50, top: 108, width: 440, height: 340 }}>
          {layout.faces.length || center ? (
            <SolarMap
              center={center}
              roofs={layout.faces.map((f) => f.roof)}
              panels={layout.panels}
              staticView
              className="!h-[340px] !rounded-none"
            />
          ) : (
            <p className="flex h-full items-center justify-center p-6 text-center text-[12px] text-slate-500">Site location not yet set.</p>
          )}
        </div>
        <p className="absolute text-[10px] leading-snug" style={{ left: 40, top: 462, width: 460 }}>
          {layout.faces.length ? 'The panel layout is an initial proposal on satellite imagery.' : 'Panel positions are not yet decided.'} Brand, model
          and layout will be finalised after the site survey.
        </p>
        <div className="absolute" style={{ left: 520, top: 108, width: 404 }}>
          <p className="text-[50px] font-bold leading-none" style={{ color: TEAL }}>
            {fmt(zc.panelCount, 0)}
          </p>
          <p className="mt-2 text-[14px]">{fmt(p.design.panelWattage, 0)} W panels in the concept scenario</p>
          <TealTable
            head={['Item', 'Initial proposal']}
            rows={[
              ['Panel capacity (DC)', `${fmt(p.systemKw, 2)} kWp`],
              ['Inverter (AC)', `About ${fmt(inverterKw, 0)} kW*`],
              ['Panel area only', `About ${fmt(areaM2, 0)} m²*`],
              ['First-year generation', `${fmt(y1.generationKwh, 0)} kWh`],
              ['Financing', 'Zero capex (no upfront cost)'],
            ]}
            className="mt-6 w-full text-[12.5px]"
          />
          <p className="mt-4 text-[10px] leading-snug">
            *Concept size, not a roof measurement. Final capacity depends on daytime load, maximum demand, roof space and structure, management consent and
            approvals.
          </p>
        </div>
        <PageNo n={5} />
      </Slide>

      {/* 6. Savings simulation (Zero Capex model) */}
      <Slide forExport={forExport}>
        <Heading eyebrow={`Initial simulation based on a bill of about ${rm(p.monthlyBill, 0)} a month`} title="Savings and environmental benefits" />
        <TealTable
          head={['Item', 'Basis', 'Estimate']}
          rows={[
            ['First-year generation', `${fmt(p.systemKw, 2)} kWp, ${pct(ZERO_CAPEX.degradation, 1)} degradation a year`, `${fmt(y1.generationKwh)} kWh`],
            [zc.tou ? 'TNB energy charge (peak / off-peak)' : 'TNB energy charge', `${zc.tariffName}, rising ${pct(ZERO_CAPEX.escalation)} a year`, `${rateText} /kWh`],
            ['Fixed solar rate', `${zc.tou ? 'Off-peak charge' : 'Energy charge'} − ${pct(ZERO_CAPEX.ppaDiscount)}, no increase`, `${rm(m.ppaRate, 4)} /kWh`],
            ['Year 1 savings', `Energy charge ${rm(y1.peakRm + y1.offPeakRm, 0)} + AFA ${rm(y1.afaRm, 0)} + KWTBB ${rm(y1.kwtbbRm, 0)}`, `${rm(y1.totalRm)} / year`],
            [`Total savings over ${years} years`, `Average ${rm(m.averageMonthlyRm)} a month`, rm(m.totalSavingsRm)],
          ].map(([a, b, c]) => [a, b, <strong className="whitespace-nowrap">{c}</strong>])}
          className="absolute text-[11.5px]"
          style={{ left: 28, top: 102, width: 600 }}
          cell="px-3 py-[9px]"
        />
        <div className="absolute space-y-2.5 text-[10.5px] leading-snug" style={{ left: 30, top: 392, width: 596 }}>
          <p>
            <strong>Zero capex:</strong> <strong>Gama Energy (SEDA-registered RPVI)</strong> bears the system, installation and O&amp;M costs. The customer
            pays a fixed solar rate only for the solar energy used. Savings = (TNB energy charge − solar rate) × solar kWh, plus AFA and KWTBB.
          </p>
          <p>
            Assumptions: {fmt(ZERO_CAPEX.peakShare * 12, 0)}/12 of solar generation in peak hours; TNB energy charge rising {pct(ZERO_CAPEX.escalation)} a
            year; AFA {fmt(m.inputs.afaRate * 100, 2)} sen/kWh not escalated; KWTBB {pct(ZERO_CAPEX.kwtbb, 1)} of the energy-charge savings.
          </p>
        </div>
        <div className="absolute" style={{ left: 660, top: 104, width: 270 }}>
          <p className="text-[30px] font-bold leading-none" style={{ color: TEAL }}>
            {rm(m.year1MonthlyRm)}
          </p>
          <p className="mt-2 text-[13px] leading-snug">estimated monthly savings in the first year</p>
          <p className="mt-5 text-[10px] font-bold uppercase" style={{ color: TEAL }}>
            First-year benefits
          </p>
          {[
            [`${fmt(y1.generationKwh)} kWh`, 'estimated solar energy'],
            [`${fmt(m.co2Kg / 1000)} tonnes CO2`, 'potential emissions avoided'],
            [`${fmt(m.forestM2, 0)} m²`, 'equivalent forest area'],
            [`${fmt(m.oilLitre, 0)} litres`, 'equivalent oil saved'],
          ].map(([v, l]) => (
            <div key={l} className="mt-2.5 text-[12px] leading-snug">
              <p className="font-bold">{v}</p>
              <p>{l}</p>
            </div>
          ))}
          <p className="mt-4 text-[9px] leading-snug">
            Factors: {ZERO_CAPEX.co2Kg} kg CO2, {ZERO_CAPEX.forestM2} m² of forest and {ZERO_CAPEX.oilLitre} litres of oil per kWh of solar.
          </p>
        </div>
        <p className="absolute text-[8.5px]" style={{ left: 30, bottom: 16, width: 800 }}>
          Rate basis: Energy Commission (ST), Tariff Schedule 2025-2027. Actual savings depend on performance, consumption and PPA terms. Subject to the
          investor's offer.
        </p>
        <PageNo n={6} />
      </Slide>

      {/* 7. 20-year savings table (Zero Capex sheet) */}
      <Slide forExport={forExport}>
        <Heading eyebrow="Zero capex: estimated energy savings" title={`${years}-year savings table`} />
        <table className="absolute border-collapse text-[9.5px] tabular-nums" style={{ left: 30, top: 96, width: 900 }}>
          <thead>
            <tr className="text-white" style={{ background: TEAL }}>
              {[
                'Year',
                'Solar generation (kWh)',
                'Peak (kWh)',
                'Peak savings (RM)',
                'Off-peak (kWh)',
                'Off-peak savings (RM)',
                'AFA savings (RM)',
                'KWTBB savings (RM)',
                'Total savings (RM)',
                'Cumulative (RM)',
              ].map((h, i) => (
                <th key={h} className={`px-2 py-1.5 align-bottom font-bold leading-tight ${i ? 'text-right' : 'text-left'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.years.map((y, i) => (
              <tr key={y.year} style={{ background: i % 2 ? '#fff' : TINT }}>
                <td className="px-2 py-px">{y.year}</td>
                {[y.generationKwh, y.peakKwh, y.peakRm, y.offPeakKwh, y.offPeakRm, y.afaRm, y.kwtbbRm].map((v, j) => (
                  <td key={j} className="px-2 py-px text-right">
                    {fmt(v)}
                  </td>
                ))}
                <td className="px-2 py-px text-right font-bold">{fmt(y.totalRm)}</td>
                <td className="px-2 py-px text-right">{fmt(y.cumulativeRm)}</td>
              </tr>
            ))}
            <tr className="font-bold" style={{ borderTop: `2px solid ${TEAL}` }}>
              <td className="px-2 py-1">Total</td>
              <td className="px-2 py-1 text-right">{fmt(m.totalKwh)}</td>
              <td colSpan={6} />
              <td className="px-2 py-1 text-right">{fmt(m.totalSavingsRm)}</td>
              <td />
            </tr>
          </tbody>
        </table>
        <div className="absolute text-[8.5px] leading-snug" style={{ left: 30, bottom: 14, width: 820 }}>
          <p>
            **Calculation based on a {pct(ZERO_CAPEX.escalation)} yearly TNB tariff increase and a {pct(ZERO_CAPEX.guarantee)} guarantee of the expected
            generation above. Fixed solar rate {rm(m.ppaRate, 4)}/kWh.
          </p>
          <p>**Calculation based on the current TNB AFA value ({rm(m.inputs.afaRate, 4)}/kWh).</p>
        </div>
        <PageNo n={7} />
      </Slide>

      {/* 8. Schedule, maintenance and warranties */}
      <Slide forExport={forExport}>
        <Heading eyebrow="Schedule and system support summary" title="Delivery, care and warranties" />
        <p className="absolute text-[10.5px] font-bold uppercase" style={{ left: 40, top: 100, color: TEAL }}>
          Estimated 9-month schedule
        </p>
        {[
          ['01-03', 'Site study, design and approvals'],
          ['04-05', 'Procurement and site preparation'],
          ['06-08', 'Installation and inspection'],
          ['09', 'Testing, metering and start of operation'],
        ].map(([n, l], i) => (
          <div key={n} className="absolute" style={{ left: 40 + i * 227, top: 122, width: 200 }}>
            <p className="text-[25px] font-bold leading-none">{n}</p>
            <p className="mt-2 text-[12px] leading-snug">{l}</p>
          </div>
        ))}
        <div className="absolute text-[13px] leading-snug" style={{ left: 40, top: 220, width: 400 }}>
          <Kicker>Maintenance</Kicker>
          <p>
            <strong>Twice a year:</strong> performance review, visual inspection, protection devices, cable connections, inverter, meter and report.
          </p>
          <p className="mt-3">
            <strong>Once a year:</strong> panel cleaning and structural inspection. The owner provides the water supply.
          </p>
          <div className="mt-8 text-[11px] leading-snug">
            <p>
              <strong>Zero capex:</strong> the investor bears O&amp;M for the whole contract.
            </p>
            <p>
              <strong>Outright purchase:</strong> RM120/kWp/year, subject to agreement.
            </p>
            <p>Panel cleaning scope follows the maintenance agreement.</p>
          </div>
        </div>
        <div className="absolute" style={{ left: 490, top: 220, width: 430 }}>
          <Kicker>Warranty and support</Kicker>
          <TealTable
            head={['Component', 'Period / support']}
            rows={[
              ['Panel performance / panel product', '30 years / 12 years'],
              ['Inverter / structure', '5 or 10 years / 2 years'],
              ['BESS, if applicable', '5 years'],
              ['Monitoring / SARE insurance', '24 hours / 21 years*'],
            ]}
            className="w-full text-[12px]"
            cell="px-3 py-2.5"
          />
          <p className="mt-4 text-[9.5px] leading-snug">
            *Subject to manufacturer terms, insurance policy and the final agreement. Panel performance warranty: 84.8% in year 25 and 80% in year 30.
          </p>
        </div>
        <PageNo n={8} />
      </Slide>

      {/* 9. Thank you */}
      <Cover split={568} photo={coverPanels} forExport={forExport}>
        <h1 className="mt-12 text-[36px] font-bold leading-[1.1]">
          SOLAR ENERGY
          <br />
          PROPOSAL
        </h1>
        <SiteName name={name} place={place} className="mt-5" />
        <p className="mt-4 text-[12.5px]">Thank you for your consideration.</p>
        <p className="mt-5 text-[22px] font-bold" style={{ color: GOLD }}>
          {GAMA.phone}
        </p>
        <p className="mt-2 text-[11.5px] font-bold">{GAMA.whatsapp}</p>
        <p className="mt-3 text-[11px]">{GAMA.email}</p>
        <p className="mt-1 text-[11px]">{GAMA.web}</p>
        <p className="mt-auto whitespace-pre-line text-[9px] leading-snug">{GAMA.address}</p>
      </Cover>
    </article>
  );
});

export default ZeroCapexProposal;
