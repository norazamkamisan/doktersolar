import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { STATUSES, type Project, type ProjectStatus } from '../types';
import { updateProject } from '../lib/store';
import { kw } from '../lib/format';
import { STATUS_DOT } from './ui';

/** Kanban-style pipeline. Drag cards between columns (desktop) or use the arrow to advance. */
const MAX_CARDS = 6;

export default function Pipeline({ projects }: { projects: Project[] }) {
  const [over, setOver] = useState<ProjectStatus | null>(null);

  const move = (id: string, status: ProjectStatus) => updateProject(id, { status });

  return (
    <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
      {STATUSES.map((status, idx) => {
        const all = projects.filter((p) => p.status === status);
        // Big pipelines (e.g. after an OpenSolar import): show the most recent few, link to the rest.
        const items = [...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, MAX_CARDS);
        const next = STATUSES[idx + 1];
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(status);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain');
              if (id) move(id, status);
              setOver(null);
            }}
            className={`flex w-64 shrink-0 snap-start flex-col rounded-xl border p-3 transition md:w-auto md:min-w-0 md:flex-1 ${
              over === status ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
              <h3 className="text-sm font-semibold text-slate-700">{status}</h3>
              <span className="ml-auto rounded-full bg-white px-2 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                {all.length.toLocaleString()}
              </span>
            </div>
            <div className="flex min-h-[64px] flex-col gap-2">
              {items.map((p) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id)}
                  className="group cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/projects/${p.id}`} className="text-sm font-medium text-slate-900 hover:text-brand-600">
                      {p.customerName}
                    </Link>
                    {next && (
                      <button
                        className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title={`Move to ${next}`}
                        aria-label={`Move ${p.customerName} to ${next}`}
                        onClick={() => move(p.id, next)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{p.address}</p>
                  {p.systemKw > 0 && <p className="mt-1.5 text-xs font-medium text-slate-600 tabular-nums">{kw(p.systemKw)}</p>}
                </div>
              ))}
              {all.length > items.length && (
                <Link
                  to={`/projects?status=${encodeURIComponent(status)}`}
                  className="rounded-lg px-3 py-2 text-center text-xs font-medium text-brand-700 hover:bg-white"
                >
                  + {(all.length - items.length).toLocaleString()} more
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
