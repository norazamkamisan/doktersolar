import { useRef } from 'react';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import type { CaseStudy, Settings } from '../types';
import { updateSettings } from '../lib/store';
import { NumberField } from './ui';

/** Read an image file, downscale it to fit maxW × maxH and return a JPEG data URL (keeps storage small). */
export function fileToImage(file: File, maxW: number, maxH: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Not a valid image'));
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width, maxH / img.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function TextArea({ label, value, onChange, rows = 4, hint }: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea className="input min-h-[2.5rem] leading-relaxed" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function ImagePick({ value, onChange, label, maxW, maxH }: { value: string | null; onChange: (v: string | null) => void; label: string; maxW: number; maxH: number }) {
  const ref = useRef<HTMLInputElement>(null);
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return alert('Please choose an image under 10 MB.');
    try {
      onChange(await fileToImage(file, maxW, maxH));
    } catch (err) {
      alert((err as Error).message);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      {value ? (
        <img src={value} alt="" className="h-20 max-w-[200px] rounded-lg border border-slate-200 object-cover" />
      ) : (
        <div className="flex h-20 w-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">No image</div>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} />
      <button type="button" className="btn-secondary" onClick={() => ref.current?.click()}>
        <ImagePlus className="h-4 w-4" /> {label}
      </button>
      {value && (
        <button type="button" className="btn-ghost" onClick={() => onChange(null)}>
          <Trash2 className="h-4 w-4" /> Remove
        </button>
      )}
    </div>
  );
}

/** Settings → "Proposal" card: the company content that fills the customer proposal pages. */
export default function ProposalSettings({ s }: { s: Settings }) {
  const studies = s.caseStudies ?? [];
  const setStudy = (i: number, patch: Partial<CaseStudy>) => updateSettings({ caseStudies: studies.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  return (
    <section className="card space-y-5 p-5 sm:p-6">
      <div>
        <h2 className="font-semibold text-slate-900">Proposal</h2>
        <p className="text-sm text-slate-500">The pages of every customer proposal. Leave a box empty to leave that page out.</p>
      </div>

      <div>
        <label className="label">Cover photo</label>
        <ImagePick label="Upload cover photo" value={s.coverImage} onChange={(v) => updateSettings({ coverImage: v })} maxW={1400} maxH={700} />
      </div>
      <TextArea label="Cover letter" rows={3} value={s.coverLetter} onChange={(v) => updateSettings({ coverLetter: v })} hint='Shown under "Dear <customer>,".' />
      <TextArea label="About us (page 2)" rows={8} value={s.aboutUs} onChange={(v) => updateSettings({ aboutUs: v })} hint="Leave a blank line between paragraphs." />

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField label="Deposit payable" suffix="%" value={s.depositPct} min={0} step={1} onChange={(v) => updateSettings({ depositPct: Math.min(100, Math.max(0, v)) })} />
        <NumberField label="Fixed charge (flat-rate tariff only)" suffix={`${s.currency}/month`} value={s.fixedCharge} min={0} step={1} onChange={(v) => updateSettings({ fixedCharge: Math.max(0, v) })} />
      </div>
      <TextArea label="Quotation note" rows={2} value={s.quoteNote} onChange={(v) => updateSettings({ quoteNote: v })} />
      <TextArea label="Payment details" rows={3} value={s.paymentDetails} onChange={(v) => updateSettings({ paymentDetails: v })} hint="Shown under the quote acceptance, e.g. bank account details." />
      <TextArea
        label="Terms & conditions (last page)"
        rows={10}
        value={s.terms}
        onChange={(v) => updateSettings({ terms: v })}
        hint="A line ending in “:” followed by text becomes a heading. These are filled in for each customer: {customer} {address} {price} {deposit} {depositPct} {company}."
      />

      <div className="space-y-4 border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-slate-900">Case studies</h3>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => updateSettings({ caseStudies: [...studies, { title: '', text: '', image: null }] })}
            disabled={studies.length >= 3}
            title={studies.length >= 3 ? 'Up to 3 case studies' : undefined}
          >
            <Plus className="h-4 w-4" /> Add case study
          </button>
        </div>
        {!studies.length && <p className="text-sm text-slate-500">None yet. Add one to include a Case Studies page.</p>}
        {studies.map((c, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="label">Title</label>
                <input className="input" value={c.title} onChange={(e) => setStudy(i, { title: e.target.value })} placeholder="e.g. customer name" />
              </div>
              <button
                type="button"
                className="btn-ghost text-red-600"
                aria-label={`Delete case study ${i + 1}`}
                onClick={() => updateSettings({ caseStudies: studies.filter((_, j) => j !== i) })}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <TextArea label="Story" rows={5} value={c.text} onChange={(v) => setStudy(i, { text: v })} />
            <ImagePick label="Add picture" value={c.image} onChange={(v) => setStudy(i, { image: v })} maxW={1000} maxH={800} />
          </div>
        ))}
      </div>
    </section>
  );
}
