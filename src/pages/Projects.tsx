import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { STATUSES, type ProjectStatus } from '../types';
import { useProjects } from '../lib/store';
import { Empty, PageHeader } from '../components/ui';
import ProjectTable from '../components/ProjectTable';
import NewProjectModal from '../components/NewProjectModal';

export default function Projects() {
  const projects = useProjects();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [status, setStatus] = useState<ProjectStatus | 'All'>('All');
  const [newOpen, setNewOpen] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return projects
      .filter((p) => status === 'All' || p.status === status)
      .filter((p) => !needle || [p.customerName, p.address, p.email, p.phone].some((f) => f.toLowerCase().includes(needle)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [projects, q, status]);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} projects`}
        actions={
          <button className="btn-primary" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> New Project
          </button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="Filter…"
          value={q}
          onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
        />
        <div className="flex flex-wrap gap-1">
          {(['All', ...STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                status === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      {filtered.length ? (
        <div className="card overflow-hidden">
          <ProjectTable projects={filtered} />
        </div>
      ) : (
        <Empty title="No projects match">Try a different search or status filter.</Empty>
      )}
      {newOpen && <NewProjectModal onClose={() => setNewOpen(false)} />}
    </div>
  );
}
