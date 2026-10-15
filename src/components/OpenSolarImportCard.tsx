import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileUp, Loader2, Trash2, Upload } from 'lucide-react';
import { STATUSES } from '../types';
import { importProjects, removeProjectsWithPrefix, useProjects, useSettings } from '../lib/store';
import { defaultDesign, defaultEnergy } from '../lib/defaults';
import { OPENSOLAR_ID_PREFIX, importOpenSolarCsv, type OpenSolarImport } from '../lib/openSolarImport';
import { date, num } from '../lib/format';

/**
 * Settings card: import an OpenSolar "Export projects" CSV.
 * Everything happens in this browser; the file is never uploaded.
 */
export default function OpenSolarImportCard() {
  const settings = useSettings();
  const projects = useProjects();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<(OpenSolarImport & { fileName: string }) | null>(null);
  const [removeDemo, setRemoveDemo] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const imported = projects.filter((p) => p.id.startsWith(OPENSOLAR_ID_PREFIX)).length;
  const hasDemo = projects.some((p) => p.id.startsWith('demo-'));

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setError('');
    setDone('');
    setPreview(null);
    if (!file) return;
    setBusy(true);
    try {
      const result = importOpenSolarCsv(await file.text(), settings, { design: defaultDesign, energy: defaultEnergy });
      if (!result.projects.length) throw new Error('No projects found in this file.');
      setPreview({ ...result, fileName: file.name });
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };

  const runImport = () => {
    if (!preview) return;
    setError('');
    try {
      const { added, updated } = importProjects(preview.projects, { removeDemo });
      setDone(
        `Imported ${num(preview.projects.length)} projects (${num(added)} new${updated ? `, ${num(updated)} updated` : ''}).`,
      );
      setPreview(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const undo = () => {
    if (!confirm(`Remove all ${num(imported)} projects imported from OpenSolar from this browser?`)) return;
    const n = removeProjectsWithPrefix(OPENSOLAR_ID_PREFIX);
    setDone(`Removed ${num(n)} imported projects.`);
  };

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-semibold text-slate-900">Import from OpenSolar</h2>
      <p className="mb-4 text-sm text-slate-500">
        In OpenSolar, export your projects as CSV, then choose the file here. It's read in this browser only and is never
        uploaded. Importing the same file again updates those projects instead of duplicating them.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          Choose CSV file
        </button>
        {imported > 0 && (
          <>
            <Link to="/projects?source=opensolar" className="btn-ghost">
              View {num(imported)} imported projects
            </Link>
            <button type="button" className="btn-ghost text-red-600 hover:bg-red-50" onClick={undo}>
              <Trash2 className="h-4 w-4" /> Remove imported
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {done && (
        <p className="mt-3 text-sm text-emerald-700" role="status">
          {done}
        </p>
      )}

      {preview && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-900">{preview.fileName}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-slate-500">Projects</dt>
              <dd className="font-semibold tabular-nums">{num(preview.projects.length)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Total size</dt>
              <dd className="font-semibold tabular-nums">{num(preview.totalKw, 0)} kWp</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">With map location</dt>
              <dd className="font-semibold tabular-nums">{num(preview.withLocation)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Created</dt>
              <dd className="font-semibold tabular-nums">
                {date(preview.firstCreated)} – {date(preview.lastCreated)}
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <span key={s} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">
                {s}: <span className="font-medium tabular-nums">{num(preview.byStatus[s])}</span>
              </span>
            ))}
          </div>
          {preview.skipped > 0 && <p className="mt-2 text-xs text-slate-500">{preview.skipped} rows skipped (no project id).</p>}
          {hasDemo && (
            <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={removeDemo} onChange={(e) => setRemoveDemo(e.target.checked)} />
              Remove the 5 demo projects
            </label>
          )}
          <div className="mt-4 flex gap-2">
            <button type="button" className="btn-primary" onClick={runImport}>
              <Upload className="h-4 w-4" /> Import {num(preview.projects.length)} projects
            </button>
            <button type="button" className="btn-secondary" onClick={() => setPreview(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
