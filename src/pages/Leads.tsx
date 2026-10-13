import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, PenLine, Phone, Plus } from 'lucide-react';
import { useProjects, useSettings } from '../lib/store';
import { money, relative } from '../lib/format';
import { Empty, PageHeader } from '../components/ui';
import NewProjectModal from '../components/NewProjectModal';

export default function Leads() {
  const projects = useProjects();
  const { currency } = useSettings();
  const [newOpen, setNewOpen] = useState(false);
  const leads = useMemo(() => projects.filter((p) => p.status === 'Lead').sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [projects]);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <PageHeader
        title="Leads"
        subtitle="New enquiries that haven't been designed yet."
        actions={
          <button className="btn-primary" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> Add lead
          </button>
        }
      />
      {leads.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {leads.map((p) => (
            <div key={p.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/projects/${p.id}`} className="font-semibold text-slate-900 hover:text-brand-600">
                  {p.customerName}
                </Link>
                <span className="text-xs text-slate-400">{relative(p.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">{p.address}</p>
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                {p.email && (
                  <a href={`mailto:${p.email}`} className="flex items-center gap-2 hover:text-brand-600">
                    <Mail className="h-4 w-4 text-slate-400" /> {p.email}
                  </a>
                )}
                {p.phone && (
                  <a href={`tel:${p.phone}`} className="flex items-center gap-2 hover:text-brand-600">
                    <Phone className="h-4 w-4 text-slate-400" /> {p.phone}
                  </a>
                )}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-sm text-slate-500">
                  Bill <span className="font-medium text-slate-800">{money(p.monthlyBill, currency)}</span>/mo
                </span>
                <Link to={`/projects/${p.id}/design`} className="btn-primary !py-1.5">
                  <PenLine className="h-4 w-4" /> Start design
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty title="No open leads">New projects start here as leads.</Empty>
      )}
      {newOpen && <NewProjectModal onClose={() => setNewOpen(false)} />}
    </div>
  );
}
