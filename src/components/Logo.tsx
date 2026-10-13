import { useSettings } from '../lib/store';

/** DokterSolar mark: a sun cresting over a panel row. */
export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#f97316" />
      <circle cx="16" cy="13" r="5" fill="#fff" />
      <g stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <path d="M16 4v2M8 13H6M26 13h-2M9.6 6.6l1.4 1.4M22.4 6.6 21 8" />
      </g>
      <path d="M8 22h16M11 26h10M16 19v9" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Company logo if uploaded, otherwise the DokterSolar mark + name. */
export function BrandLogo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const s = useSettings();
  const h = size === 'lg' ? 'h-12' : 'h-8';
  if (s.logo) return <img src={s.logo} alt={s.companyName} className={`${h} max-w-[180px] object-contain`} />;
  return (
    <div className="flex items-center gap-2">
      <LogoMark className={size === 'lg' ? 'h-11 w-11' : 'h-8 w-8'} />
      <span className={`font-semibold tracking-tight text-slate-900 ${size === 'lg' ? 'text-2xl' : 'text-lg'}`}>
        {s.companyName === 'DokterSolar' ? (
          <>
            Dokter<span className="text-brand-500">Solar</span>
          </>
        ) : (
          s.companyName
        )}
      </span>
    </div>
  );
}
