import { useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import type { Project } from '../../types';
import { updateProject, useSettings } from '../../lib/store';
import { geocode } from '../../lib/api';
import { date, money, num } from '../../lib/format';
import { energyFor, recommendedKw } from '../../lib/solar';
import { Field } from '../../components/ui';

export default function InfoTab({ project: p }: { project: Project }) {
  const settings = useSettings();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const set = (k: 'customerName' | 'email' | 'phone' | 'address' | 'notes') => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    updateProject(p.id, { [k]: e.target.value });

  const relocate = async () => {
    setBusy(true);
    setMsg('');
    try {
      const r = await geocode(p.address);
      if (r) {
        updateProject(p.id, { lat: r.lat, lng: r.lng });
        setMsg(r.approximate ? `Closest match: ${r.label}. Check it on the Design tab.` : `Located: ${r.label}`);
      } else setMsg('Address not found. Try adding the town or postcode, or pan the map in the Design tab.');
    } catch (err) {
      setMsg((err as Error).message);
    }
    setBusy(false);
  };

  const energy = energyFor(p);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="card p-5 lg:col-span-2">
        <h2 className="mb-4 font-semibold text-slate-900">Customer</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer name" value={p.customerName} onChange={set('customerName')} />
          <Field label="Email" type="email" value={p.email} onChange={set('email')} />
          <Field label="Phone" type="tel" value={p.phone} onChange={set('phone')} />
          <Field
            label={`Avg. monthly bill (${settings.currency})`}
            type="number"
            min={0}
            value={p.monthlyBill}
            onChange={(e) => updateProject(p.id, { monthlyBill: Number(e.target.value) || 0 })}
          />
          <div className="sm:col-span-2">
            <label className="label">Address</label>
            <div className="flex gap-2">
              <input className="input" value={p.address} onChange={set('address')} />
              <button className="btn-secondary shrink-0" onClick={relocate} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                Locate
              </button>
            </div>
            {msg && <p className="mt-1.5 text-xs text-slate-500">{msg}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input min-h-[96px]" value={p.notes} onChange={set('notes')} />
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="mb-4 font-semibold text-slate-900">Summary</h2>
        <dl className="space-y-3 text-sm">
          {[
            ['Created', date(p.createdAt)],
            ['Last updated', date(p.updatedAt)],
            ['Coordinates', p.lat != null && p.lng != null ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : 'Not located'],
            ['Est. annual usage', `${num(energy.consumptionKwh)} kWh`],
            ['Annual bill', money(p.monthlyBill * 12, settings.currency)],
            ['Recommended size', `${num(recommendedKw(p.monthlyBill, p.energy), 2)} kWp`],
            ['Designed size', p.systemKw > 0 ? `${num(p.systemKw, 2)} kWp (${p.panelCount} panels)` : '—'],
            ['Bill offset', p.systemKw > 0 ? `${num(energy.offsetPct)}%` : '—'],
            ['Proposal sent', date(p.proposalSentAt)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-slate-500">{k}</dt>
              <dd className="text-right font-medium text-slate-800 tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
