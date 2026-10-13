import { FormEvent, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FileText, FolderKanban, Home, LayoutGrid, Menu, Plus, Search, Settings, UserPlus, X } from 'lucide-react';
import { BrandLogo } from './Logo';
import NewProjectModal from './NewProjectModal';
import { useSettings } from '../lib/store';
import { initials } from '../lib/format';

const NAV = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/leads', label: 'Leads', icon: UserPlus },
  { to: '/designs', label: 'Designs', icon: LayoutGrid },
  { to: '/proposals', label: 'Proposals', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const [navOpen, setNavOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [q, setQ] = useState('');
  const settings = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => setNavOpen(false), [location.pathname]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/projects?q=${encodeURIComponent(q.trim())}`);
  };

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="mb-4 px-2 pt-1">
        <BrandLogo />
      </div>
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`
          }
        >
          <Icon className="h-[18px] w-[18px]" />
          {label}
        </NavLink>
      ))}
      <div className="mt-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
        Data is stored in this browser. Reset demo data in Settings.
      </div>
    </nav>
  );

  return (
    <div className="flex h-full">
      {/* desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>

      {/* mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setNavOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            <button className="btn-ghost absolute right-2 top-2 !p-2" onClick={() => setNavOpen(false)} aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button className="btn-ghost !p-2 lg:hidden" onClick={() => setNavOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <form onSubmit={onSearch} className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input !bg-slate-50 pl-9"
              placeholder="Search customers, addresses…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </form>
          <div className="ml-auto flex items-center gap-3">
            <button className="btn-primary" onClick={() => setNewOpen(true)} aria-label="New Project" title="New Project">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Project</span>
            </button>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white"
              title={settings.userName}
            >
              {initials(settings.userName) || 'DS'}
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto bg-slate-50/50">
          <Outlet />
        </main>
      </div>

      {newOpen && <NewProjectModal onClose={() => setNewOpen(false)} />}
    </div>
  );
}
