import type { ReactNode } from 'react';
import type { ProjectStatus } from '../types';

const STATUS_STYLE: Record<ProjectStatus, string> = {
  Lead: 'bg-slate-100 text-slate-700 ring-slate-200',
  Designing: 'bg-sky-50 text-sky-700 ring-sky-200',
  'Proposal Sent': 'bg-amber-50 text-amber-800 ring-amber-200',
  Won: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Installed: 'bg-brand-50 text-brand-700 ring-brand-200',
};

export const STATUS_DOT: Record<ProjectStatus, string> = {
  Lead: 'bg-slate-400',
  Designing: 'bg-sky-500',
  'Proposal Sent': 'bg-amber-500',
  Won: 'bg-emerald-500',
  Installed: 'bg-brand-500',
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {status}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon && <div className="rounded-lg bg-brand-50 p-2 text-brand-600">{icon}</div>}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Field({
  label,
  suffix,
  ...props
}: { label: string; suffix?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input className={`input ${suffix ? 'pr-12' : ''}`} {...props} />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}

/** Numeric input that commits on change; blank → 0. */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  step = 'any',
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  step?: number | 'any';
  min?: number;
  max?: number;
}) {
  return (
    <Field
      label={label}
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      max={max}
      suffix={suffix}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
    />
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  );
}
