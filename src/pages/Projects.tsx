import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { STATUSES, type ProjectStatus } from '../types';
import { useProjects } from '../lib/store';
import { OPENSOLAR_ID_PREFIX } from '../lib/openSolarImport';
import { num } from '../lib/format';
import { Empty, PageHeader } from '../components/ui';
import ProjectTable from '../components/ProjectTable';
import NewProjectModal from '../components/NewProjectModal';

const PAGE_SIZE = 50;
type Source = 'all' | 'opensolar' | 'app';

export default function Projects() {
  const projects = useProjects();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = (STATUSES as string[]).includes(params.get('status') ?? '') ? (params.get('status') as ProjectStatus) : 'All';
  const source: Source = (['opensolar', 'app'] as const).find((s) => s === params.get('source')) ?? 'all';
  const [shown, setShown] = useState(PAGE_SIZE);
  const [newOpen, setNewOpen] = useState(false);

  // Filters live in the URL so links (e.g. from the pipeline) can open a filtered list.
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  useEffect(() => setShown(PAGE_SIZE), [q, status, source]);

  const inSource = useMemo(
    () =>
      projects.filter((p) =>
        source === 'all' ? true : source === 'opensolar' ? p.id.startsWith(OPENSOLAR_ID_PREFIX) : !p.id.startsWith(OPENSOLAR_ID_PREFIX),
      ),
    [projects, source],
  );

  const matching = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inSource
      .filter((p) => !needle || [p.customerName, p.address, p.email, p.phone, p.notes].some((f) => f.toLowerCase().includes(needle)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [inSource, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: matching.length };
    for (const s of STATUSES) c[s] = 0;
    for (const p of matching) c[p.status]++;
    return c;
  }, [matching]);

  const filtered = useMemo(() => matching.filter((p) => status === 'All' || p.status === status), [matching, status]);
  const hasImported = projects.some((p) => p.id.startsWith(OPENSOLAR_ID_PREFIX));

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <PageHeader
        title="Projects"
        subtitle={`${num(projects.length)} projects`}
        actions={
          <button className="btn-primary" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> New Project
          </button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search name, address, notes…"
          aria-label="Search projects"
          value={q}
          onChange={(e) => setParam('q', e.target.value || null)}
        />
        {hasImported && (
          <select
            className="input w-auto"
            aria-label="Source"
            value={source}
            onChange={(e) => setParam('source', e.target.value === 'all' ? null : e.target.value)}
          >
            <option value="all">All sources</option>
            <option value="opensolar">Imported from OpenSolar</option>
            <option value="app">Created in DokterSolar</option>
          </select>
        )}
        <div className="flex flex-wrap gap-1">
          {(['All', ...STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setParam('status', s === 'All' ? null : s)}
              aria-pressed={status === s}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                status === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {s} <span className="tabular-nums opacity-70">{num(counts[s] ?? 0)}</span>
            </button>
          ))}
        </div>
      </div>
      {filtered.length ? (
        <>
          <div className="card overflow-hidden">
            <ProjectTable projects={filtered.slice(0, shown)} />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
            <span>
              Showing {num(Math.min(shown, filtered.length))} of {num(filtered.length)}
            </span>
            {shown < filtered.length && (
              <button className="btn-secondary" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                Show {num(Math.min(PAGE_SIZE, filtered.length - shown))} more
              </button>
            )}
          </div>
        </>
      ) : (
        <Empty title="No projects match">Try a different search, source or status filter.</Empty>
      )}
      {newOpen && <NewProjectModal onClose={() => setNewOpen(false)} />}
    </div>
  );
}
