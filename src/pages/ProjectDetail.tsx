import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { STATUSES, type ProjectStatus } from '../types';
import { deleteProject, updateProject, useProject } from '../lib/store';
import { kw } from '../lib/format';
import { Empty } from '../components/ui';
import InfoTab from './project/InfoTab';
import DesignTab from './project/DesignTab';
import EnergyTab from './project/EnergyTab';
import ProposalTab from './project/ProposalTab';

const TABS = [
  { key: 'info', label: 'Info' },
  { key: 'design', label: 'Design' },
  { key: 'energy', label: 'Energy' },
  { key: 'proposal', label: 'Proposal' },
] as const;

export default function ProjectDetail() {
  const { id, tab = 'info' } = useParams();
  const project = useProject(id);
  const navigate = useNavigate();

  if (!project) {
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

  const remove = () => {
    if (confirm(`Delete the project for ${project.customerName}? This cannot be undone.`)) {
      deleteProject(project.id);
      navigate('/projects');
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <Link to="/projects" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Projects
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{project.customerName}</h1>
          <p className="mt-1 truncate text-sm text-slate-500">
            {project.address}
            {project.systemKw > 0 && <> · <span className="font-medium text-slate-700">{kw(project.systemKw)}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input w-auto"
            value={project.status}
            onChange={(e) => updateProject(project.id, { status: e.target.value as ProjectStatus })}
            aria-label="Status"
          >
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button className="btn-danger !px-2.5" onClick={remove} title="Delete project" aria-label="Delete project">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <nav className="mb-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200">
        {TABS.map((t) => (
          <NavLink
            key={t.key}
            to={`/projects/${project.id}/${t.key}`}
            className={() =>
              `-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                tab === t.key ? 'border-brand-500 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      {tab === 'info' && <InfoTab project={project} />}
      {tab === 'design' && <DesignTab project={project} />}
      {tab === 'energy' && <EnergyTab project={project} />}
      {tab === 'proposal' && <ProposalTab project={project} />}
    </div>
  );
}
