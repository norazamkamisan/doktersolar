import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, X } from 'lucide-react';
import { createProject, useSettings } from '../lib/store';
import { geocode } from '../lib/api';
import { NAME_HIDDEN, type BillCategory, type TnbBill } from '../lib/tnbBill';
import { DEFAULT_TARGET_OFFSET, analyseBill, billProjectFields } from '../lib/billAnalysis';
import { BillDetails, BillSizing, BillWarnings, ScanBillButton } from './BillScan';

export default function NewProjectModal({ onClose }: { onClose: () => void }) {
  const settings = useSettings();
  const navigate = useNavigate();
  const [form, setForm] = useState({ customerName: '', email: '', phone: '', address: '', monthlyBill: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [bill, setBill] = useState<TnbBill | null>(null);
  const [category, setCategory] = useState<BillCategory>('residential');
  const [offset, setOffset] = useState(100);

  const analysis = useMemo(
    () =>
      bill
        ? analyseBill({ ...bill, category }, { peakSunHours: settings.peakSunHours, panelWattage: settings.defaultPanelWattage, targetOffsetPct: offset })
        : null,
    [bill, category, offset, settings.peakSunHours, settings.defaultPanelWattage],
  );

  const onScanned = (b: TnbBill) => {
    setBill(b);
    setCategory(b.category);
    setOffset(DEFAULT_TARGET_OFFSET[b.category]);
    setError('');
    const avg = analyseBill(b, { peakSunHours: settings.peakSunHours, panelWattage: settings.defaultPanelWattage }).averageBillRm;
    setForm((f) => ({
      ...f,
      customerName: b.customerName || f.customerName,
      address: b.premiseAddress || b.postalAddress || f.address,
      monthlyBill: String(Math.round(avg ?? b.currentCharge ?? 0) || f.monthlyBill),
    }));
  };

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
      // bills mask the house number as "XX", which only confuses the map search
      loc = await geocode(form.address.replace(/^s*X+s*,s*/i, ''), 6000);
    } catch {
      /* geocoding is best-effort: the project is still saved, and can be located on the map later */
    }
    const fromBill = bill && analysis ? billProjectFields({ ...bill, category }, analysis) : null;
    const p = createProject({
      ...fromBill,
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
    navigate(`/projects/${p.id}/${fromBill ? 'proposal' : 'design'}`);
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
        className={`flex max-h-[92dvh] w-full ${bill ? 'max-w-2xl' : 'max-w-lg'} flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl`}
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
        <div className="mb-5">
          {bill ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>
                  TNB bill read{bill.accountNo ? <> for account <strong>{bill.accountNo}</strong></> : null}. Check the details below.
                </span>
              </span>
              <ScanBillButton onScanned={onScanned} variant="button" label="Scan another" />
            </div>
          ) : (
            <ScanBillButton onScanned={onScanned} />
          )}
        </div>
        {bill && <div className="mb-4"><BillWarnings warnings={bill.warnings.filter((w) => w !== NAME_HIDDEN || !form.customerName.trim())} /></div>}
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
        {bill && analysis && (
          <div className="mt-6 space-y-4 border-t border-slate-100 pt-5">
            <h3 className="font-semibold text-slate-900">Recommended system</h3>
            <BillSizing
              analysis={analysis}
              category={category}
              onCategory={(c) => {
                setCategory(c);
                setOffset(DEFAULT_TARGET_OFFSET[c]);
              }}
              onOffset={setOffset}
              panelWattage={settings.defaultPanelWattage}
              idPrefix="np"
            />
            <details className="rounded-xl border border-slate-200 p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">All details read from the bill</summary>
              <div className="mt-3">
                <BillDetails bill={{ ...bill, category }} />
              </div>
            </details>
          </div>
        )}
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
              {busy ? 'Saving…' : bill ? 'Create project & proposal' : 'Create project'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
