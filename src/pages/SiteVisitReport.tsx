import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useProject, useSettings } from '../lib/store';
import { CHECKLIST, LV_LIMITS, type ChecklistSection } from '../lib/siteVisit';
import { usePhotos } from '../lib/photoStore';
import { lvCheck, valueOf } from '../components/SiteVisit';
import { num } from '../lib/format';
import { Empty } from '../components/ui';
import type { Project, Settings } from '../types';
import guideImage from '../assets/site-visit-guide.png';

const cell = 'border border-slate-700 px-2 py-1.5 align-middle';

function Page({ s, children }: { s: Settings; children: React.ReactNode }) {
  return (
    <section className="sv-page mx-auto mb-4 bg-white p-[12mm] text-[12px] leading-snug text-slate-900 shadow-sm print:mb-0 print:p-0 print:shadow-none" style={{ maxWidth: '210mm' }}>
      <header className="mb-3 flex items-center justify-between gap-3 border-b-2 border-[#135466] pb-2 font-bold text-[#135466]">
        <span className="flex items-center gap-2">
          {s.logo && <img src={s.logo} alt="" className="h-8 max-w-[120px] object-contain" />}
          {s.companyName}
        </span>
        <span>PRELIMINARY SITE VISIT CHECKLIST</span>
      </header>
      {children}
      <footer className="mt-4 border-t border-slate-400 pt-1.5 text-[10px] text-slate-500">{s.companyName} • Preliminary survey for feasibility review</footer>
    </section>
  );
}

function Answers({ sec, p, s }: { sec: ChecklistSection; p: Project; s: Settings }) {
  if (!sec.fields.length) return null;
  return (
    <table className="mb-3 w-full border-collapse">
      <thead>
        <tr className="bg-[#d9edf4] text-center">
          <th className={`${cell} w-1/3`}>Item</th>
          <th className={cell}>Description</th>
        </tr>
      </thead>
      <tbody>
        {sec.fields.map((f) => {
          const v = valueOf(p, s, f.key);
          return (
            <tr key={f.key} className="break-inside-avoid">
              <th scope="row" className={`${cell} text-left font-normal`}>
                {f.label}
              </th>
              <td className={cell}>
                {f.kind === 'text' ? (
                  <span className="text-[#074a98]">{typeof v === 'string' ? v : ''}</span>
                ) : (
                  <span className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {f.options.map((o) => (
                      <span key={o} className="whitespace-nowrap">
                        {Array.isArray(v) && v.includes(o) ? '☑' : '☐'} {o}
                      </span>
                    ))}
                    {f.other && (
                      <span className="text-[#074a98]">{String(valueOf(p, s, `${f.key}Other`) || '')}</span>
                    )}
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Photos({ sec, urls }: { sec: ChecklistSection; urls: Record<string, string> }) {
  if (!sec.photos) return null;
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {sec.photos.map((ph) => (
        <div key={ph.key} className="break-inside-avoid border border-slate-500 p-2">
          <p className="text-[11px]">{ph.label}</p>
          {urls[ph.key] ? (
            <img src={urls[ph.key]} alt={ph.label} className="mx-auto mt-1 block max-h-[170px] max-w-full" />
          ) : (
            <div className="mt-1 h-[90px]" />
          )}
        </div>
      ))}
    </div>
  );
}

/** /site-visit/:id — the filled-in checklist laid out for printing or saving as PDF. */
export default function SiteVisitReport() {
  const { id } = useParams();
  const p = useProject(id);
  const s = useSettings();
  const { urls } = usePhotos(id ?? '');

  if (!p) {
    return (
      <div className="p-6">
        <Empty title="Project not found">
          <Link to="/projects" className="text-brand-600">
            Back to projects
          </Link>
        </Empty>
      </div>
    );
  }

  const lv = lvCheck(p);
  const byId = Object.fromEntries(CHECKLIST.map((c) => [c.id, c]));

  return (
    <div className="min-h-full bg-slate-200 py-4 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 px-4">
        <Link to={`/projects/${p.id}/design`} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Back to project
        </Link>
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </button>
      </div>

      <Page s={s}>
        <h1 className="mb-1 text-[22px] font-bold">Site Visit Checklist</h1>
        <p className="mb-3 text-slate-600">
          {p.customerName}
          {p.address ? ` · ${p.address}` : ''}
          {p.systemKw > 0 ? ` · designed ${num(p.systemKw, 2)} kWp` : ''}
        </p>
        <h2 className="mb-1 text-[15px] font-bold">{byId.participants.title}</h2>
        <Answers sec={byId.participants} p={p} s={s} />
        <h2 className="mb-1 text-[15px] font-bold">{byId.grid.title}</h2>
        <Answers sec={byId.grid} p={p} s={s} />
        <table className="mb-2 w-full table-fixed border-collapse text-center">
          <thead>
            <tr className="bg-[#d9edf4]">
              <th className={cell}>TNB Meter</th>
              <th className={cell}>TNB &amp; Client's MSB Name</th>
              <th className={cell}>Fuse Rating / CT Ratio (A)</th>
              <th className={cell}>Limit Kapasiti Solar (kW) = rating × 60%</th>
            </tr>
          </thead>
          <tbody>
            {LV_LIMITS.map((r) => {
              const names = p.siteVisit?.lvNames?.[r.rating] ?? {};
              const sel = p.siteVisit?.lvRating === r.rating;
              return (
                <tr key={r.rating} className={sel ? 'bg-amber-50 font-bold' : undefined}>
                  <td className={`${cell} text-[#074a98]`}>{names.meter ?? ''}</td>
                  <td className={`${cell} text-[#074a98]`}>{names.msb ?? ''}</td>
                  <td className={cell}>
                    {sel ? '☑ ' : ''}
                    {r.rating}
                  </td>
                  <td className={cell}>{num(r.limitKw, 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-[10px] text-slate-600">
          For MV, refer to maximum demand (MD) on the client's TNB bill.
          {lv && ` Selected: ${lv.rating}, limit ${num(lv.limitKw, 2)} kW; designed ${num(p.systemKw, 2)} kWp${lv.over ? ' (ABOVE THE LIMIT)' : ' (within the limit)'}.`}
        </p>
      </Page>

      <Page s={s}>
        <h2 className="mb-2 text-[15px] font-bold">Site Visit Details Guide</h2>
        <img src={guideImage} alt="Site visit details guide" className="block w-full" />
      </Page>

      <Page s={s}>
        <h2 className="mb-1 text-[15px] font-bold">{byId.roof.title}</h2>
        <p className="mb-2">{byId.roof.intro}</p>
        <Answers sec={byId.roof} p={p} s={s} />
      </Page>
      <Page s={s}>
        <h2 className="mb-2 text-[15px] font-bold">3. Roof Evidence</h2>
        <Photos sec={byId.roof} urls={urls} />
      </Page>

      <Page s={s}>
        <h2 className="mb-1 text-[15px] font-bold">{byId.electrical.title}</h2>
        <Answers sec={byId.electrical} p={p} s={s} />
      </Page>
      <Page s={s}>
        <h2 className="mb-2 text-[15px] font-bold">4. Electrical Evidence</h2>
        <Photos sec={byId.electrical} urls={urls} />
      </Page>

      <Page s={s}>
        {['data', 'hse', 'special'].map((k) => (
          <div key={k}>
            <h2 className="mb-1 text-[15px] font-bold">{byId[k].title}</h2>
            <Answers sec={byId[k]} p={p} s={s} />
          </div>
        ))}
        <Photos sec={byId.special} urls={urls} />
        <h2 className="mb-1 mt-3 text-[15px] font-bold">{byId.remarks.title}</h2>
        <div className="min-h-[100px] whitespace-pre-line border border-slate-500 p-2 text-[#074a98]">{p.siteVisit?.remarks ?? ''}</div>
        <table className="mt-3 w-full border-collapse">
          <tbody>
            <tr>
              <th scope="row" className={`${cell} w-1/3 text-left font-normal`}>
                Prepared by
              </th>
              <td className={`${cell} text-[#074a98]`}>{String(valueOf(p, s, 'conductedBy') || '')}</td>
            </tr>
            <tr>
              <th scope="row" className={`${cell} text-left font-normal`}>
                Date
              </th>
              <td className={`${cell} text-[#074a98]`}>{String(valueOf(p, s, 'date') || '')}</td>
            </tr>
          </tbody>
        </table>
      </Page>
    </div>
  );
}
