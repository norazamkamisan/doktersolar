import { useEffect, useState } from 'react';

/**
 * Compact inputs for editable tables. Number cells keep what is typed ("1.", "") while
 * editing and report a number (or null when empty).
 */

const CELL = 'input !py-1.5 !px-2 text-sm';

export function NumCell({
  value,
  onChange,
  placeholder,
  disabled,
  label,
  className = '',
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    if ((text === '' ? null : Number(text)) !== (value ?? null)) setText(value == null ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      className={`${CELL} min-w-[84px] text-right tabular-nums ${className}`}
      type="number"
      inputMode="decimal"
      step="any"
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value === '' ? null : Number(e.target.value));
      }}
    />
  );
}

export function TextCell({
  value,
  onChange,
  label,
  list,
  className = '',
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  list?: string;
  className?: string;
  placeholder?: string;
}) {
  return (
    <input
      className={`${CELL} min-w-[110px] ${className}`}
      value={value}
      list={list}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function DateCell({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return <input className={`${CELL} min-w-[140px]`} type="date" value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} />;
}

export function SelectCell({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  label: string;
}) {
  const opts = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select className={`${CELL} min-w-[110px] !pr-7`} value={value} aria-label={label} onChange={(e) => onChange(e.target.value)}>
      {opts.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}

/** A delete button that needs a second click within 3 s. */
export function DeleteCell({ onDelete, label }: { onDelete: () => void; label: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={`rounded-md px-2 py-1 text-xs font-medium transition ${armed ? 'bg-rose-600 text-white' : 'text-slate-400 hover:bg-rose-50 hover:text-rose-600'}`}
      aria-label={label}
      onClick={() => (armed ? onDelete() : setArmed(true))}
    >
      {armed ? 'Delete?' : '✕'}
    </button>
  );
}

/** Coloured KPI tile for the costing and cashflow dashboards. */
export function KpiTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: 'blue' | 'violet' | 'green' | 'orange' | 'red' | 'teal' | 'amber' }) {
  const bg = {
    blue: 'from-blue-600 to-blue-700',
    violet: 'from-violet-600 to-violet-700',
    green: 'from-emerald-600 to-emerald-700',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-rose-600 to-rose-700',
    teal: 'from-teal-600 to-teal-700',
    amber: 'from-amber-500 to-amber-600',
  }[tone];
  return (
    <div className={`min-w-0 rounded-xl bg-gradient-to-br ${bg} p-4 text-white shadow-sm`}>
      <p className="text-xs font-medium uppercase tracking-wide text-white/85">{label}</p>
      <p className="mt-1 break-words text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-white/85">{sub}</p>}
    </div>
  );
}
