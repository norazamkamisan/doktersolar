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

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.customerName.trim() || !form.address.trim()) {
      setError('Customer name and address are required.');
      return;
    }
    setBusy(true);
    let loc: { lat: number; lng: number } | null = null;
    try {
      loc = await geocode(form.address);
    } catch {
      /* geocoding is best-effort; user can locate on the map later */
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">New project</h2>
            <p className="text-sm text-slate-500">We'll locate the address on the satellite map.</p>
          </div>
          <button type="button" className="btn-ghost !p-2" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Customer name *</label>
            <input className="input" value={form.customerName} onChange={set('customerName')} autoFocus />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" type="tel" value={form.phone} onChange={set('phone')} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address *</label>
            <input className="input" value={form.address} onChange={set('address')} placeholder="Street, city, postcode" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Average monthly electricity bill ({settings.currency})</label>
            <input className="input" type="number" min="0" step="any" value={form.monthlyBill} onChange={set('monthlyBill')} />
          </div>
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Create project
          </button>
        </div>
      </form>
    </div>
  );
}
