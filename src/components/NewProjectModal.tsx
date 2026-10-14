import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { createProject, useSettings } from '../lib/store';
import { geocode } from '../lib/api';

export default function NewProjectModal({ onClose }: { onClose: () => void }) {
  const settings = useSettings();
  const navigate = useNavigate();
  const [form, setForm] = useState({ customerName: '', email: '', phone: '', address: '', monthlyBill: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    setNotice('');
    if (!form.customerName.trim() || !form.address.trim()) {
      setError('Customer name and address are required.');
      return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('That email address looks incomplete. Fix it or leave it empty.');
      return;
    }
    setBusy(true);
    setNotice('Finding the address on the map…');
    let loc: { lat: number; lng: number } | null = null;
    try {
      loc = await geocode(form.address, 6000);
    } catch {
      /* geocoding is best-effort: the project is still saved, and can be located on the map later */
    }
    const p = createProject({
      customerName: form.customerName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      monthlyBill: Number(form.monthlyBill) || 0,
      lat: loc?.lat ?? null,
      lng: loc?.lng ?? null,
    });
    setBusy(false);
    onClose();
    navigate(`/projects/${p.id}/design`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      onClick={() => !busy && onClose()}
    >
      {/* Scrollable on small screens (and with the keyboard open); the buttons stay pinned at the bottom. */}
      <form
        onSubmit={submit}
        noValidate
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        aria-labelledby="new-project-title"
      >
        <div className="overflow-y-auto p-6 pb-4">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 id="new-project-title" className="text-lg font-semibold text-slate-900">
              New project
            </h2>
            <p className="text-sm text-slate-500">We'll locate the address on the satellite map.</p>
          </div>
          <button type="button" className="btn-ghost !p-2" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="np-name">Customer name *</label>
            <input id="np-name" className="input" value={form.customerName} onChange={set('customerName')} autoComplete="name" autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="np-email">Email</label>
            <input id="np-email" className="input" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set('email')} />
          </div>
          <div>
            <label className="label" htmlFor="np-phone">Phone</label>
            <input id="np-phone" className="input" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="np-address">Address *</label>
            <input
              id="np-address"
              className="input"
              value={form.address}
              onChange={set('address')}
              placeholder="Street, city, postcode"
              autoComplete="street-address"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="np-bill">
              Average monthly electricity bill ({settings.currency})
            </label>
            <input
              id="np-bill"
              className="input"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={form.monthlyBill}
              onChange={set('monthlyBill')}
            />
          </div>
        </div>
        </div>
        <div className="border-t border-slate-100 bg-white px-6 py-4">
          {error && (
            <p className="mb-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {busy && notice && (
            <p className="mb-3 text-sm text-slate-500" aria-live="polite">
              {notice}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? 'Saving…' : 'Create project'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
