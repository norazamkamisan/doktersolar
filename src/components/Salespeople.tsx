import { Plus, Trash2 } from 'lucide-react';
import type { Salesperson, Settings } from '../types';
import { newId, updateSettings } from '../lib/store';

const LAST_KEY = 'doktersolar.lastSalesperson';

/** The salesperson last picked on this device, to preselect for the next new project. */
export function lastSalespersonId(s: Pick<Settings, 'salespeople'>): string {
  try {
    const id = localStorage.getItem(LAST_KEY) ?? '';
    return (s.salespeople ?? []).some((p) => p.id === id) ? id : '';
  } catch {
    return '';
  }
}

export function rememberSalesperson(id: string) {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* not important */
  }
}

/** Dropdown to pick who prepares a project's proposal. Hidden when there is no sales team yet. */
export function SalespersonSelect({
  settings: s,
  value,
  onChange,
  id = 'salesperson',
}: {
  settings: Pick<Settings, 'salespeople' | 'userName'>;
  value: string | undefined;
  onChange: (id: string) => void;
  id?: string;
}) {
  const team = s.salespeople ?? [];
  if (!team.length) return null;
  return (
    <div>
      <label className="label" htmlFor={id}>
        Salesperson
      </label>
      <select id={id} className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">{s.userName ? `${s.userName} (default)` : '— Not set —'}</option>
        {team.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name || 'Unnamed'}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Settings → Sales team: names, phones and emails shown as "Prepared by" on proposals. */
export default function SalesTeamSettings({ s }: { s: Settings }) {
  const team = s.salespeople ?? [];
  const set = (i: number, patch: Partial<Salesperson>) => updateSettings({ salespeople: team.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-medium text-slate-900">Sales team</h3>
          <p className="text-sm text-slate-500">Pick one for each project; their name, phone and email go on that proposal.</p>
        </div>
        <button
          type="button"
          className="btn-secondary shrink-0"
          onClick={() => updateSettings({ salespeople: [...team, { id: newId(), name: '', phone: '', email: '' }] })}
        >
          <Plus className="h-4 w-4" /> Add salesperson
        </button>
      </div>
      {team.map((p, i) => (
        <div key={p.id} className="grid items-end gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <div>
            <label className="label" htmlFor={`sp-name-${p.id}`}>
              Name
            </label>
            <input id={`sp-name-${p.id}`} className="input" value={p.name} onChange={(e) => set(i, { name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor={`sp-phone-${p.id}`}>
              Phone
            </label>
            <input id={`sp-phone-${p.id}`} className="input" type="tel" value={p.phone} onChange={(e) => set(i, { phone: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor={`sp-email-${p.id}`}>
              Email
            </label>
            <input id={`sp-email-${p.id}`} className="input" type="email" value={p.email} onChange={(e) => set(i, { email: e.target.value })} />
          </div>
          <button
            type="button"
            className="btn-ghost justify-self-start text-red-600 sm:justify-self-auto"
            aria-label={`Remove ${p.name || 'salesperson'}`}
            onClick={() => {
              if (confirm(`Remove ${p.name || 'this salesperson'}? Their projects will show the default "Prepared by" instead.`)) {
                updateSettings({ salespeople: team.filter((_, j) => j !== i) });
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
