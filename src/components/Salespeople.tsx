import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Salesperson, Settings } from '../types';
import { newId, updateSettings, useSettings } from '../lib/store';
import { useMe, useSyncStatus } from '../lib/sync';

const LAST_KEY = 'doktersolar.lastSalesperson';

/** The signed-in person's name: the salesperson's, or the default name in Settings for the admin. */
export function useCurrentName(): string {
  const me = useMe();
  const s = useSettings();
  if (me.role === 'sales') return (s.salespeople ?? []).find((p) => p.id === me.salespersonId)?.name || 'Salesperson';
  return s.userName;
}

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

interface LoginInfo {
  id: string;
  loginId: string;
  hasPassword: boolean;
}

/** Salesperson logins from /api/users (admin only; needs Google Drive storage). */
function useLogins(enabled: boolean) {
  const [logins, setLogins] = useState<LoginInfo[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetch('/api/users', { cache: 'no-store' })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!alive) return;
        if (r.ok) setLogins(body.users ?? []);
        else setError(body.error || `Couldn't load logins (${r.status}).`);
      })
      .catch(() => alive && setError("Couldn't load logins."));
    return () => {
      alive = false;
    };
  }, [enabled]);

  const call = async (init: RequestInit, query = '') => {
    const r = await fetch(`/api/users${query}`, { ...init, headers: { 'Content-Type': 'application/json' } });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error || `Request failed (${r.status}).`);
    setLogins(body.users ?? []);
  };
  return {
    logins,
    error,
    save: (id: string, loginId: string, password?: string) => call({ method: 'POST', body: JSON.stringify({ id, loginId, password: password || undefined }) }),
    remove: (id: string) => call({ method: 'DELETE' }, `?id=${encodeURIComponent(id)}`),
  };
}

/** Login ID + password for one salesperson. */
function LoginEditor({ person, login, onSave, onRemove }: { person: Salesperson; login?: LoginInfo; onSave: (loginId: string, password?: string) => Promise<void>; onRemove: () => Promise<void> }) {
  const [loginId, setLoginId] = useState(login?.loginId ?? '');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setLoginId(login?.loginId ?? ''), [login?.loginId]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await onSave(loginId.trim(), password);
      setPassword('');
      setMsg({ ok: true, text: password ? 'Saved. They sign in with the new password (other devices are signed out).' : 'Login ID saved.' });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
    setBusy(false);
  };

  return (
    <div className="sm:col-span-4 border-t border-slate-100 pt-3">
      <p className="mb-2 text-xs font-medium text-slate-500">
        {login ? (
          <>
            Signs in as <strong className="text-slate-700">{login.loginId}</strong> and sees only their own projects.
          </>
        ) : (
          'No login yet. Give them a login ID and password to let them sign in.'
        )}
      </p>
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
        <div>
          <label className="label" htmlFor={`sp-login-${person.id}`}>
            Login ID
          </label>
          <input
            id={`sp-login-${person.id}`}
            className="input"
            value={loginId}
            autoCapitalize="none"
            spellCheck={false}
            placeholder="e.g. ija"
            onChange={(e) => setLoginId(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor={`sp-pass-${person.id}`}>
            {login ? 'New password (optional)' : 'Password'}
          </label>
          <input
            id={`sp-pass-${person.id}`}
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            placeholder="at least 6 characters"
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="button" className="btn-primary" onClick={save} disabled={busy || !loginId.trim() || (!login && password.length < 6)}>
          {login ? 'Save login' : 'Create login'}
        </button>
        {login && (
          <button
            type="button"
            className="btn-ghost text-red-600"
            disabled={busy}
            onClick={async () => {
              if (!confirm(`Remove ${person.name || 'this salesperson'}'s login? They will be signed out and can't sign in until you create a new one.`)) return;
              setBusy(true);
              try {
                await onRemove();
                setMsg({ ok: true, text: 'Login removed.' });
              } catch (err) {
                setMsg({ ok: false, text: (err as Error).message });
              }
              setBusy(false);
            }}
          >
            Remove login
          </button>
        )}
      </div>
      {msg && <p className={`mt-1.5 text-xs ${msg.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}
    </div>
  );
}

/** Settings → Sales team: names, phones and emails shown as "Prepared by" on proposals, and each person's login. */
export default function SalesTeamSettings({ s }: { s: Settings }) {
  const team = s.salespeople ?? [];
  const sync = useSyncStatus();
  const online = sync.state !== 'local' && sync.state !== 'connecting';
  const { logins, error, save, remove } = useLogins(sync.state !== 'local');
  const set = (i: number, patch: Partial<Salesperson>) => updateSettings({ salespeople: team.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-medium text-slate-900">Sales team</h3>
          <p className="text-sm text-slate-500">
            Pick one for each project; their name, phone and email go on that proposal. With a login, a salesperson signs in with their own ID
            and password and sees only their own projects.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary shrink-0"
          onClick={() => updateSettings({ salespeople: [...team, { id: newId(), name: '', phone: '', email: '' }] })}
        >
          <Plus className="h-4 w-4" /> Add salesperson
        </button>
      </div>
      {sync.state === 'local' && team.length > 0 && (
        <p className="text-xs text-amber-700">Logins need Google Drive storage, which isn't set up here.</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {team.map((p, i) => {
        const login = logins?.find((l) => l.id === p.id);
        return (
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
              onClick={async () => {
                if (!confirm(`Remove ${p.name || 'this salesperson'}? Their login is removed too, and their projects go back to the default "Prepared by" (only you will see them).`)) return;
                if (login) {
                  try {
                    await remove(p.id);
                  } catch (err) {
                    return alert((err as Error).message);
                  }
                }
                updateSettings({ salespeople: team.filter((_, j) => j !== i) });
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
            {online && logins && <LoginEditor person={p} login={login} onSave={(id, pw) => save(p.id, id, pw)} onRemove={() => remove(p.id)} />}
          </div>
        );
      })}
    </div>
  );
}
