import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, CheckCircle2, CloudUpload, ExternalLink, HardDrive, Printer, Trash2, TriangleAlert } from 'lucide-react';
import { usePhotosCloud } from '../lib/sync';
import type { Project, Settings } from '../types';
import { updateProject } from '../lib/store';
import { CHECKLIST, LV_LIMITS, progress, type Field, type SiteVisit, type SiteVisitValue } from '../lib/siteVisit';
import { deletePhoto, savePhoto, usePhotos } from '../lib/photoStore';
import { preparedBy } from '../lib/proposal';
import { num } from '../lib/format';
import guideImage from '../assets/site-visit-guide.png';

/** Answers prefilled from the project until someone types over them. */
export function siteVisitDefaults(p: Project, s: Settings): Record<string, string> {
  return {
    site: [p.customerName, p.address].filter(Boolean).join(', '),
    conductedBy: preparedBy(p, s).name,
    // the day the checklist was last filled in, until someone types the survey date
    date: p.siteVisit?.updatedAt ? new Date(p.siteVisit.updatedAt).toLocaleDateString('en-GB') : '',
  };
}

export function valueOf(p: Project, s: Settings, key: string): SiteVisitValue {
  const v = p.siteVisit?.values[key];
  return v ?? siteVisitDefaults(p, s)[key] ?? '';
}

function update(p: Project, patch: (sv: SiteVisit) => Partial<SiteVisit>) {
  updateProject(p.id, (cur) => {
    const sv: SiteVisit = cur.siteVisit ?? { values: {} };
    return { siteVisit: { ...sv, ...patch(sv), updatedAt: new Date().toISOString() } };
  });
}

const setValue = (p: Project, key: string, value: SiteVisitValue) => update(p, (sv) => ({ values: { ...sv.values, [key]: value } }));

/** The selected TNB meter protection and the largest system it allows, against the designed size. */
export function lvCheck(p: Project) {
  const row = LV_LIMITS.find((r) => r.rating === p.siteVisit?.lvRating);
  if (!row) return null;
  return { ...row, over: p.systemKw > row.limitKw };
}

function FieldInput({ project: p, settings: s, field: f }: { project: Project; settings: Settings; field: Field }) {
  const v = valueOf(p, s, f.key);
  if (f.kind === 'text') {
    return (
      <input
        id={`sv-${f.key}`}
        className="input"
        value={typeof v === 'string' ? v : ''}
        placeholder={f.key === 'date' ? new Date().toLocaleDateString('en-GB') : f.placeholder}
        onChange={(e) => setValue(p, f.key, e.target.value)}
      />
    );
  }
  const ticked = Array.isArray(v) ? v : [];
  const otherKey = `${f.key}Other`;
  const other = valueOf(p, s, otherKey);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {f.options.map((o) => {
        const on = ticked.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => setValue(p, f.key, on ? ticked.filter((x) => x !== o) : f.single ? [o] : [...ticked, o])}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              on ? 'border-brand-400 bg-brand-50 font-medium text-brand-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {on ? '✓ ' : ''}
            {o}
          </button>
        );
      })}
      {f.other && (
        <input
          className="input !w-auto min-w-[10rem] flex-1"
          aria-label={f.other}
          placeholder={f.other}
          value={typeof other === 'string' ? other : ''}
          onChange={(e) => setValue(p, otherKey, e.target.value)}
        />
      )}
    </div>
  );
}

function PhotoSlot({ projectId, slot, label, url }: { projectId: string; slot: string; label: string; url?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      await savePhoto(projectId, slot, file, label);
    } catch (err) {
      alert((err as Error).message);
    }
    setBusy(false);
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 p-2">
      <p className="text-xs font-medium text-slate-600">{label}</p>
      {url ? (
        <img src={url} alt={label} className="h-32 w-full rounded-lg object-cover" />
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="flex h-32 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500 hover:bg-slate-100"
          disabled={busy}
        >
          <Camera className="h-5 w-5" />
          {busy ? 'Saving…' : 'Add photo'}
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      {url && (
        <div className="flex gap-2">
          <button type="button" className="btn-secondary !px-2 !py-1 text-xs" onClick={() => ref.current?.click()} disabled={busy}>
            Replace
          </button>
          <button type="button" className="btn-ghost !px-2 !py-1 text-xs text-red-600" onClick={() => void deletePhoto(projectId, slot)} aria-label={`Remove ${label}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Design tab → Site visit: the PSP Group preliminary site visit checklist for this project. */
export default function SiteVisitChecklist({ project: p, settings: s }: { project: Project; settings: Settings }) {
  const { urls, error, waiting, cloudError } = usePhotos(p.id);
  const cloud = usePhotosCloud();
  const { done, total } = progress(p.siteVisit);
  const lv = lvCheck(p);
  const voltage = valueOf(p, s, 'voltage');
  const isMvHv = Array.isArray(voltage) && voltage.some((v) => !v.startsWith('LV'));

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="font-semibold text-slate-900">Preliminary site visit checklist</h2>
          <p className="text-sm text-slate-500">
            {done} of {total} items filled in
            {p.siteVisit?.updatedAt && ` · updated ${new Date(p.siteVisit.updatedAt).toLocaleDateString('en-GB')}`}. Answers save with the project.
          </p>
          <p className={`mt-1 flex items-center gap-1.5 text-xs ${cloudError ? 'text-red-600' : cloud.connected ? 'text-emerald-700' : 'text-slate-500'}`}>
            {cloud.connected ? <CloudUpload className="h-3.5 w-3.5" /> : <HardDrive className="h-3.5 w-3.5" />}
            {cloudError
              ? `Photos couldn't reach Google Drive: ${cloudError}`
              : cloud.connected
                ? waiting
                  ? `${waiting} photo${waiting === 1 ? '' : 's'} waiting to upload to Google Drive…`
                  : 'Photos are saved to Google Drive.'
                : 'Photos stay on this device. The admin can connect Google Drive for photos in Settings.'}
          </p>
        </div>
        <Link to={`/site-visit/${p.id}`} className="btn-primary">
          <Printer className="h-4 w-4" /> Print / Save PDF
          <ExternalLink className="h-3.5 w-3.5 opacity-70" />
        </Link>
      </div>

      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">Site visit details guide (what to measure)</summary>
        <img src={guideImage} alt="Site visit details guide: roof dimensions, roof profile, obstructions and equipment locations" className="mx-auto mt-3 w-full max-w-2xl" />
      </details>

      {CHECKLIST.map((sec) => (
        <section key={sec.id} className="card space-y-4 p-4 sm:p-5">
          <div>
            <h3 className="font-semibold text-slate-900">{sec.title}</h3>
            {sec.intro && <p className="text-sm text-slate-500">{sec.intro}</p>}
          </div>
          {sec.fields.length > 0 && (
            <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
              {sec.fields.map((f) => (
                <div key={f.key} className={f.kind === 'choice' && f.options.length > 3 ? 'lg:col-span-2' : undefined}>
                  <label className="label" htmlFor={f.kind === 'text' ? `sv-${f.key}` : undefined}>
                    {f.label}
                  </label>
                  <FieldInput project={p} settings={s} field={f} />
                </div>
              ))}
            </div>
          )}

          {sec.lvTable && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">TNB meter protection (LV sites)</p>
              <p className="text-xs text-slate-500">
                Pick the site's fuse rating or CT ratio. The largest solar system allowed is that rating × 60% (from the original survey form).
                {isMvHv && ' For MV / HV sites, refer to the maximum demand (MD) on the TNB bill instead.'}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs text-slate-500">
                      <th className="px-2 py-1.5 font-medium">This site</th>
                      <th className="px-2 py-1.5 font-medium">Fuse rating / CT ratio</th>
                      <th className="px-2 py-1.5 text-right font-medium">Solar limit (kW)</th>
                      <th className="px-2 py-1.5 font-medium">TNB meter</th>
                      <th className="px-2 py-1.5 font-medium">TNB &amp; client's MSB name</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {LV_LIMITS.map((r) => {
                      const names = p.siteVisit?.lvNames?.[r.rating] ?? {};
                      const setName = (k: 'meter' | 'msb', val: string) =>
                        update(p, (sv) => ({ lvNames: { ...sv.lvNames, [r.rating]: { ...sv.lvNames?.[r.rating], [k]: val } } }));
                      const selected = p.siteVisit?.lvRating === r.rating;
                      return (
                        <tr key={r.rating} className={selected ? 'bg-brand-50/60' : undefined}>
                          <td className="px-2 py-1">
                            <input
                              type="radio"
                              name={`lv-${p.id}`}
                              aria-label={`This site has ${r.rating}`}
                              checked={selected}
                              onChange={() => update(p, () => ({ lvRating: r.rating }))}
                              className="accent-brand-500"
                            />
                          </td>
                          <td className="px-2 py-1 font-medium text-slate-700">{r.rating}</td>
                          <td className="px-2 py-1 text-right tabular-nums">{num(r.limitKw, 2)}</td>
                          <td className="px-2 py-1">
                            <input className="input !py-1" aria-label={`${r.rating} TNB meter`} value={names.meter ?? ''} onChange={(e) => setName('meter', e.target.value)} />
                          </td>
                          <td className="px-2 py-1">
                            <input className="input !py-1" aria-label={`${r.rating} MSB name`} value={names.msb ?? ''} onChange={(e) => setName('msb', e.target.value)} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {lv && (
                <p
                  className={`flex items-start gap-2 rounded-lg p-3 text-sm ${lv.over ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}
                  role="status"
                >
                  {lv.over ? <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
                  {lv.over
                    ? `The designed system (${num(p.systemKw, 2)} kWp) is above the ${num(lv.limitKw, 2)} kW limit for ${lv.rating}. Reduce the design or plan a meter / CT upgrade.`
                    : `The designed system (${num(p.systemKw, 2)} kWp) is within the ${num(lv.limitKw, 2)} kW limit for ${lv.rating}.`}
                </p>
              )}
            </div>
          )}

          {sec.remarks && (
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="sv-remarks">
                  Remarks and sketch notes
                </label>
                <textarea
                  id="sv-remarks"
                  className="input min-h-[7rem] leading-relaxed"
                  value={p.siteVisit?.remarks ?? ''}
                  onChange={(e) => update(p, () => ({ remarks: e.target.value }))}
                />
              </div>
            </div>
          )}

          {sec.photos && (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Photos</p>
              {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {sec.photos.map((ph) => (
                  <PhotoSlot key={ph.key} projectId={p.id} slot={ph.key} label={ph.label} url={urls[ph.key]} />
                ))}
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
