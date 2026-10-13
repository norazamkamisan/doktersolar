import { useRef } from 'react';
import { ImagePlus, RotateCcw, Trash2 } from 'lucide-react';
import { resetDemoData, updateSettings, useSettings } from '../lib/store';
import { CURRENCIES } from '../lib/format';
import { Field, NumberField, PageHeader } from '../components/ui';
import { BrandLogo } from '../components/Logo';

/** Read an image file, downscale it to fit 400×160 and return a base64 data URL. */
function fileToLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const src = reader.result as string;
      if (file.type === 'image/svg+xml') return resolve(src);
      const img = new Image();
      img.onerror = () => reject(new Error('Not a valid image'));
      img.onload = () => {
        const scale = Math.min(1, 400 / img.width, 160 / img.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export default function SettingsPage() {
  const s = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return alert('Please choose an image under 2 MB.');
    try {
      updateSettings({ logo: await fileToLogo(file) });
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <PageHeader title="Settings" subtitle="Changes save automatically to this browser." />

      <div className="space-y-6">
        <section className="card p-5 sm:p-6">
          <h2 className="font-semibold text-slate-900">Company</h2>
          <p className="mb-5 text-sm text-slate-500">Shown on proposals.</p>
          <div className="mb-5 flex flex-wrap items-center gap-4">
            <div className="flex h-20 min-w-[180px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4">
              <BrandLogo size="lg" />
            </div>
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onLogo} />
              <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="h-4 w-4" /> Upload logo
              </button>
              {s.logo && (
                <button className="btn-ghost" onClick={() => updateSettings({ logo: null })}>
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name" value={s.companyName} onChange={(e) => updateSettings({ companyName: e.target.value })} />
            <Field label="Your name" value={s.userName} onChange={(e) => updateSettings({ userName: e.target.value })} />
            <Field label="Company email" type="email" value={s.companyEmail} onChange={(e) => updateSettings({ companyEmail: e.target.value })} />
            <Field label="Company phone" value={s.companyPhone} onChange={(e) => updateSettings({ companyPhone: e.target.value })} />
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="font-semibold text-slate-900">Defaults for new projects</h2>
          <p className="mb-5 text-sm text-slate-500">Existing projects keep their own values (edit them in each project's Design / Energy tab).</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Currency</label>
              <select className="input" value={s.currency} onChange={(e) => updateSettings({ currency: e.target.value })}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.label}
                  </option>
                ))}
              </select>
            </div>
            <NumberField label="Default panel wattage" suffix="W" value={s.defaultPanelWattage} min={50} onChange={(v) => updateSettings({ defaultPanelWattage: v })} />
            <NumberField label="Price per watt (installed)" suffix={`${s.currency}/W`} value={s.pricePerWatt} min={0} step={0.05} onChange={(v) => updateSettings({ pricePerWatt: v })} />
            <NumberField label="Electricity tariff" suffix={`${s.currency}/kWh`} value={s.tariff} min={0} step={0.01} onChange={(v) => updateSettings({ tariff: v })} />
            <NumberField label="Peak sun hours" suffix="h/day" value={s.peakSunHours} min={0} step={0.1} onChange={(v) => updateSettings({ peakSunHours: v })} />
          </div>
        </section>

        <section className="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div>
            <h2 className="font-semibold text-slate-900">Demo data</h2>
            <p className="text-sm text-slate-500">Restore the 5 sample projects and default settings. Your changes will be lost.</p>
          </div>
          <button
            className="btn-danger"
            onClick={() => confirm('Reset all projects and settings to the demo data?') && resetDemoData()}
          >
            <RotateCcw className="h-4 w-4" /> Reset demo data
          </button>
        </section>
      </div>
    </div>
  );
}
