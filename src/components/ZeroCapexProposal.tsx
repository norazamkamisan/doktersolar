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
import slideProfile from '../assets/zerocapex/slide-profile.jpg';
import slidePortfolio from '../assets/zerocapex/slide-portfolio.jpg';
import slideExperience from '../assets/zerocapex/slide-experience.jpg';
import slideSupport from '../assets/zerocapex/slide-support.jpg';

/** 16:9 slide, laid out at this size and scaled to fit the screen. */
export const SLIDE_W = 960;
export const SLIDE_H = 540;

const NAVY = '#0a2c38';
const INK = '#0e2a33';
const TEAL = '#097d74';
const TINT = '#edf4f2';
const GOLD = '#e5b941';
const FONT = 'Arial, "Helvetica Neue", Helvetica, system-ui, sans-serif';

const GAMA = {
  name: 'GAMA ENERGY SDN BHD',
  /** Gama Energy is PSP Group's SEDA-registered solar PV investor (RPVI) */
  tagline: 'Pelabur Solar PV Berdaftar SEDA (RPVI) · PSP Group of Companies',
  phone: '06-765 5666',
  whatsapp: '+60116299-7515 (WhatsApp sahaja)',
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

function ImageSlide({ src, n, forExport }: { src: string; n: number; forExport: boolean }) {
  return (
    <Slide forExport={forExport}>
      <img src={src} alt="" className="absolute inset-0 h-full w-full" />
      <PageNo n={n} />
    </Slide>
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
  const name = p.customerName || 'Pelanggan';
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
        <h1 className="mt-14 text-[42px] font-bold leading-[1.08]">
          CADANGAN
          <br />
          TENAGA
          <br />
          SOLAR
        </h1>
        <SiteName name={name} place={place} className="mt-9" />
        <p className="mt-auto text-[10px]">Your Energy Solution Partner</p>
        <p className="mt-4 text-[10.5px] font-bold" style={{ color: GOLD }}>
          {GAMA.web}
        </p>
      </Cover>

      {/* 2–4. Company profile, portfolio, experience */}
      <ImageSlide src={slideProfile} n={2} forExport={forExport} />
      <ImageSlide src={slidePortfolio} n={3} forExport={forExport} />
      <ImageSlide src={slideExperience} n={4} forExport={forExport} />

      {/* 5. Proposed system */}
      <Slide forExport={forExport}>
        <Heading eyebrow="Cadangan awal sistem solar tanpa modal awal" title={`Sistem solar untuk ${name}`} />
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
            <p className="flex h-full items-center justify-center p-6 text-center text-[12px] text-slate-500">Lokasi tapak belum ditetapkan.</p>
          )}
        </div>
        <p className="absolute text-[10px] leading-snug" style={{ left: 40, top: 462, width: 460 }}>
          {layout.faces.length ? 'Susun atur panel ialah cadangan awal di atas imej satelit.' : 'Kedudukan panel belum ditentukan.'} Jenama, model dan
          susun atur akan dimuktamadkan selepas kajian tapak.
        </p>
        <div className="absolute" style={{ left: 520, top: 108, width: 404 }}>
          <p className="text-[50px] font-bold leading-none" style={{ color: TEAL }}>
            {fmt(zc.panelCount, 0)}
          </p>
          <p className="mt-2 text-[14px]">panel {fmt(p.design.panelWattage, 0)} W dalam senario konsep</p>
          <table className="mt-6 w-full border-collapse text-[12.5px]">
            <thead>
              <tr style={{ background: TEAL }}>
                <th className={th}>Perkara</th>
                <th className={th}>Cadangan awal</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Kapasiti panel (DC)', `${fmt(p.systemKw, 2)} kWp`],
                ['Inverter (AC)', `Sekitar ${fmt(inverterKw, 0)} kW*`],
                ['Ruang panel sahaja', `Sekitar ${fmt(areaM2, 0)} m²*`],
                ['Penghasilan tahun pertama', `${fmt(y1.generationKwh, 0)} kWh`],
                ['Kaedah pembiayaan', 'Tanpa modal awal (Zero Capex)'],
              ].map(([k, v], i) => (
                <tr key={k} className="border-b border-slate-200" style={{ background: i % 2 ? '#fff' : TINT }}>
                  <td className="px-3 py-2">{k}</td>
                  <td className="px-3 py-2">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-[10px] leading-snug">
            *Saiz konsep, bukan ukuran bumbung. Kapasiti akhir bergantung pada beban siang, permintaan maksimum, ruang dan struktur bumbung, kebenaran
            pengurusan serta kelulusan.
          </p>
        </div>
        <PageNo n={5} />
      </Slide>

      {/* 6. Savings simulation (Zero Capex model) */}
      <Slide forExport={forExport}>
        <Heading eyebrow={`Simulasi awal berdasarkan bil sekitar ${rm(p.monthlyBill, 0)} sebulan`} title="Penjimatan dan manfaat alam sekitar" />
        <table className="absolute border-collapse text-[11.5px]" style={{ left: 28, top: 102, width: 600 }}>
          <thead>
            <tr style={{ background: TEAL }}>
              <th className={th}>Perkara</th>
              <th className={th}>Asas pengiraan</th>
              <th className={th}>Anggaran</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Penghasilan tahun pertama', `${fmt(p.systemKw, 2)} kWp, susut ${pct(ZERO_CAPEX.degradation, 1)} setahun`, `${fmt(y1.generationKwh)} kWh`],
              [
                zc.tou ? 'Caj tenaga TNB (puncak / luar puncak)' : 'Caj tenaga TNB',
                `${zc.tariffName}, naik ${pct(ZERO_CAPEX.escalation)} setahun`,
                `${rateText} /kWh`,
              ],
              ['Kadar solar tetap', `${zc.tou ? 'Caj luar puncak' : 'Caj tenaga'} − ${pct(ZERO_CAPEX.ppaDiscount)}, tiada kenaikan`, `${rm(m.ppaRate, 4)} /kWh`],
              [
                'Penjimatan tahun 1',
                `Caj tenaga ${rm(y1.peakRm + y1.offPeakRm, 0)} + AFA ${rm(y1.afaRm, 0)} + KWTBB ${rm(y1.kwtbbRm, 0)}`,
                `${rm(y1.totalRm)} / tahun`,
              ],
              [`Jumlah penjimatan ${years} tahun`, `Purata ${rm(m.averageMonthlyRm)} sebulan`, rm(m.totalSavingsRm)],
            ].map(([a, b, c], i) => (
              <tr key={a} className="border-b border-slate-200" style={{ background: i % 2 ? '#fff' : TINT }}>
                <td className="px-3 py-[9px] align-middle">{a}</td>
                <td className="px-3 py-[9px] align-middle">{b}</td>
                <td className="whitespace-nowrap px-3 py-[9px] align-middle font-bold">{c}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="absolute space-y-2.5 text-[10.5px] leading-snug" style={{ left: 30, top: 392, width: 596 }}>
          <p>
            <strong>Tanpa modal awal:</strong> <strong>Gama Energy (RPVI berdaftar SEDA)</strong> menanggung kos sistem, pemasangan dan O&amp;M. Pelanggan membayar kadar solar tetap bagi tenaga solar
            yang digunakan sahaja. Penjimatan = (caj tenaga TNB − kadar solar) × kWh solar, ditambah AFA dan KWTBB.
          </p>
          <p>
            Andaian: {fmt(ZERO_CAPEX.peakShare * 12, 0)}/12 penghasilan solar dalam waktu puncak; caj tenaga TNB naik {pct(ZERO_CAPEX.escalation)} setahun;
            AFA {fmt(m.inputs.afaRate * 100, 2)} sen/kWh tidak dinaikkan; KWTBB {pct(ZERO_CAPEX.kwtbb, 1)} daripada penjimatan caj tenaga.
          </p>
        </div>
        <div className="absolute" style={{ left: 660, top: 104, width: 270 }}>
          <p className="text-[30px] font-bold leading-none" style={{ color: TEAL }}>
            {rm(m.year1MonthlyRm)}
          </p>
          <p className="mt-2 text-[13px] leading-snug">anggaran penjimatan sebulan pada tahun pertama</p>
          <p className="mt-5 text-[10px] font-bold uppercase" style={{ color: TEAL }}>
            Manfaat tahun pertama
          </p>
          {[
            [`${fmt(y1.generationKwh)} kWh`, 'anggaran tenaga solar'],
            [`${fmt(m.co2Kg / 1000)} tan CO2`, 'potensi pelepasan dielakkan'],
            [`${fmt(m.forestM2, 0)} m²`, 'setara kawasan hutan'],
            [`${fmt(m.oilLitre, 0)} liter`, 'setara minyak dijimatkan'],
          ].map(([v, l]) => (
            <div key={l} className="mt-2.5 text-[12px] leading-snug">
              <p className="font-bold">{v}</p>
              <p>{l}</p>
            </div>
          ))}
          <p className="mt-4 text-[9px] leading-snug">
            Faktor: {ZERO_CAPEX.co2Kg} kg CO2, {ZERO_CAPEX.forestM2} m² hutan dan {ZERO_CAPEX.oilLitre} liter minyak bagi setiap kWh solar.
          </p>
        </div>
        <p className="absolute text-[8.5px]" style={{ left: 30, bottom: 16, width: 800 }}>
          Asas kadar: ST, Jadual Tarif 2025-2027. Penjimatan sebenar bergantung pada prestasi, penggunaan dan syarat PPA. Tertakluk kepada tawaran pelabur.
        </p>
        <PageNo n={6} />
      </Slide>

      {/* 7. 20-year savings table (Zero Capex sheet) */}
      <Slide forExport={forExport}>
        <Heading eyebrow="Tanpa modal awal: anggaran penjimatan tenaga" title={`Jadual penjimatan ${years} tahun`} />
        <table className="absolute border-collapse text-[9.5px] tabular-nums" style={{ left: 30, top: 96, width: 900 }}>
          <thead>
            <tr className="text-white" style={{ background: TEAL }}>
              {[
                'Tahun',
                'Penghasilan solar (kWh)',
                'Puncak (kWh)',
                'Penjimatan puncak (RM)',
                'Luar puncak (kWh)',
                'Penjimatan luar puncak (RM)',
                'Penjimatan AFA (RM)',
                'Penjimatan KWTBB (RM)',
                'Jumlah penjimatan (RM)',
                'Terkumpul (RM)',
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
              <td className="px-2 py-1">Jumlah</td>
              <td className="px-2 py-1 text-right">{fmt(m.totalKwh)}</td>
              <td colSpan={6} />
              <td className="px-2 py-1 text-right">{fmt(m.totalSavingsRm)}</td>
              <td />
            </tr>
          </tbody>
        </table>
        <div className="absolute text-[8.5px] leading-snug" style={{ left: 30, bottom: 14, width: 820 }}>
          <p>
            **Pengiraan berdasarkan kenaikan tarif TNB {pct(ZERO_CAPEX.escalation)} setahun dan jaminan {pct(ZERO_CAPEX.guarantee)} daripada jangkaan
            penghasilan di atas. Kadar solar tetap {rm(m.ppaRate, 4)}/kWh.
          </p>
          <p>**Pengiraan berdasarkan nilai AFA TNB semasa ({rm(m.inputs.afaRate, 4)}/kWh).</p>
        </div>
        <PageNo n={7} />
      </Slide>

      {/* 8. Schedule, maintenance and warranties */}
      <ImageSlide src={slideSupport} n={8} forExport={forExport} />

      {/* 9. Thank you */}
      <Cover split={568} photo={coverPanels} forExport={forExport}>
        <h1 className="mt-12 text-[36px] font-bold leading-[1.1]">
          CADANGAN
          <br />
          TENAGA SOLAR
        </h1>
        <SiteName name={name} place={place} className="mt-5" />
        <p className="mt-4 text-[12.5px]">Terima kasih atas pertimbangan pihak tuan/puan.</p>
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
