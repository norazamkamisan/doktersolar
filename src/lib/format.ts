export const CURRENCIES = [
  { code: 'MYR', label: 'Malaysian Ringgit (RM)' },
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'SGD', label: 'Singapore Dollar (S$)' },
  { code: 'IDR', label: 'Indonesian Rupiah (Rp)' },
  { code: 'PHP', label: 'Philippine Peso (₱)' },
  { code: 'THB', label: 'Thai Baht (฿)' },
  { code: 'AUD', label: 'Australian Dollar (A$)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'GBP', label: 'British Pound (£)' },
  { code: 'INR', label: 'Indian Rupee (₹)' },
];

export function money(value: number, currency: string, digits = 0): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol', // RM, $, € instead of MYR, USD, EUR
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(digits)}`;
  }
}

export function num(value: number, digits = 0): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

export function kw(value: number): string {
  return `${num(value, 2)} kWp`;
}

export function date(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86400000;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < day) return `${Math.floor(diff / 3600000)} h ago`;
  if (diff < day * 30) return `${Math.floor(diff / day)} d ago`;
  return date(iso);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}
