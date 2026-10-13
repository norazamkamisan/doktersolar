import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, FolderKanban, Send, Zap } from 'lucide-react';
import { useProjects, useSettings } from '../lib/store';
import { num } from '../lib/format';
import { PageHeader, StatCard } from '../components/ui';
import { CountBarChart } from '../components/Charts';
import ProjectTable from '../components/ProjectTable';
import Pipeline from '../components/Pipeline';

export default function Home() {
  const projects = useProjects();
  const settings = useSettings();

  const stats = useMemo(() => {
    const active = projects.filter((p) => p.status !== 'Installed').length;
    const totalKw = projects.reduce((s, p) => s + p.systemKw, 0);
    const sent = projects.filter((p) => p.proposalSentAt || ['Proposal Sent', 'Won', 'Installed'].includes(p.status)).length;
    const accepted = projects.filter((p) => p.status === 'Won' || p.status === 'Installed').length;
    return { active, totalKw, sent, accepted };
  }, [projects]);

  const perMonth = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const value = projects.filter((p) => {
        const c = new Date(p.createdAt);
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
      }).length;
      return { label: d.toLocaleDateString(undefined, { month: 'short' }), value };
    });
  }, [projects]);

  const recent = useMemo(() => [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6), [projects]);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <PageHeader title="Dashboard" subtitle={`Hi ${settings.userName || 'there'} — here's how your solar pipeline is looking.`} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Active projects" value={stats.active} hint={`${projects.length} total`} icon={<FolderKanban className="h-4 w-4" />} />
        <StatCard label="Total designed" value={`${num(stats.totalKw, 1)} kWp`} hint="Across all projects" icon={<Zap className="h-4 w-4" />} />
        <StatCard label="Proposals sent" value={stats.sent} icon={<Send className="h-4 w-4" />} />
        <StatCard
          label="Proposals accepted"
          value={stats.accepted}
          hint={stats.sent ? `${Math.round((stats.accepted / stats.sent) * 100)}% win rate` : undefined}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Recent projects</h2>
            <Link to="/projects" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              View all
            </Link>
          </div>
          <ProjectTable projects={recent} />
        </section>
        <section className="card p-5">
          <h2 className="font-semibold text-slate-900">Projects per month</h2>
          <p className="mb-4 text-xs text-slate-500">New projects created, last 6 months</p>
          <CountBarChart data={perMonth} unit="projects" />
        </section>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold text-slate-900">Pipeline</h2>
          <p className="hidden text-xs text-slate-500 sm:block">Drag cards between stages, or use › to advance.</p>
        </div>
        <Pipeline projects={projects} />
      </section>
    </div>
  );
}
