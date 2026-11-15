import type { Project, Settings } from '../types';
import { money, num } from './format';
import { netSystemPrice, totalSystemPrice } from './solar';

/** "Mohamad Faiz Bin Ibrahim" → "Mohamad Faiz" (drops bin/binti/a/l/a/p and what follows). */
export function shortName(full: string): string {
  const name = full.trim().replace(/\s+/g, ' ');
  const cut = name.search(/\s(bin|binti|bt|b\.|a\/l|a\/p|s\/o|d\/o)(\s|$)/i);
  return (cut > 0 ? name.slice(0, cut) : name) || 'Customer';
}

/** Who prepared the proposal: the project's salesperson, else the name, phone and email in Settings. */
export function preparedBy(p: Pick<Project, 'salespersonId'>, s: Pick<Settings, 'salespeople' | 'userName' | 'userPhone' | 'userEmail'>) {
  const sp = p.salespersonId ? (s.salespeople ?? []).find((x) => x.id === p.salespersonId) : undefined;
  return sp ?? { id: '', name: s.userName, phone: s.userPhone, email: s.userEmail };
}

/** Quote number: the OpenSolar project number for imported projects, else the project id. */
export function quoteNumber(p: Project): string {
  return p.id.replace(/^os-/, '').toUpperCase();
}

export const VALID_DAYS = 30;

export function issuedAt(p: Project): string {
  return p.proposalSentAt ?? p.updatedAt;
}

export function validUntil(p: Project): string {
  return new Date(new Date(issuedAt(p)).getTime() + VALID_DAYS * 86400000).toISOString();
}

/** "13th December 2026" */
export function longDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  return `${day}${suffix} ${d.toLocaleDateString('en-GB', { month: 'long' })} ${d.getFullYear()}`;
}

const INVERTER_SIZES = [3, 3.6, 4, 5, 6, 8, 10, 12, 15, 17, 20, 25, 30, 36, 40, 50, 60, 75, 100, 110, 125];

/** Smallest common inverter rating for a panel array (panels may exceed the inverter by up to 40%). */
export function suggestInverterKw(kwp: number): number {
  if (kwp <= 0) return 0;
  const need = kwp / 1.4;
  return INVERTER_SIZES.find((k) => k >= need) ?? Math.ceil(need);
}

export interface QuoteInfo {
  panelBrand: string;
  panelModel: string;
  inverterBrand: string;
  inverterModel: string;
  inverterKw: number;
  inverterQty: number;
  totalPrice: number;
  discount: number;
  netPrice: number;
  depositPct: number;
  deposit: number;
  balance: number;
}

export function quoteFor(p: Project, s: Settings): QuoteInfo {
  const q = p.quote ?? {};
  const totalPrice = totalSystemPrice(p);
  const netPrice = netSystemPrice(p);
  const depositPct = s.depositPct ?? 0;
  const deposit = Math.round(netPrice * depositPct) / 100;
  return {
    panelBrand: s.panelBrand,
    panelModel: s.panelModel,
    inverterBrand: s.inverter,
    inverterModel: q.inverterModel ?? '',
    inverterKw: q.inverterKw ?? suggestInverterKw(p.systemKw),
    inverterQty: q.inverterQty ?? 1,
    totalPrice,
    discount: totalPrice - netPrice,
    netPrice,
    depositPct,
    deposit,
    balance: netPrice - deposit,
  };
}

/** "11 x Trina Solar 620 Watt Panels (TSM-620NE19R)" */
export function panelLine(p: Project, qi: QuoteInfo): string {
  return [`${p.panelCount} x`, qi.panelBrand, `${num(p.design.panelWattage)} Watt Panels`, qi.panelModel && `(${qi.panelModel})`].filter(Boolean).join(' ');
}

/** "1 x S5-GR3P5K (SOLIS)" or "1 x 5 kW inverter (Solis / Sungrow or equivalent)" */
export function inverterLine(qi: QuoteInfo): string {
  const what = qi.inverterModel || `${num(qi.inverterKw / qi.inverterQty, 1)} kW inverter`;
  return `${qi.inverterQty} x ${what}${qi.inverterBrand ? ` (${qi.inverterBrand})` : ''}`;
}

/** Fill the placeholders in the terms text. */
export function fillTerms(text: string, p: Project, s: Settings, qi: QuoteInfo): string {
  const values: Record<string, string> = {
    customer: p.customerName,
    address: p.address,
    price: money(qi.netPrice, s.currency, 2),
    deposit: money(qi.deposit, s.currency, 2),
    depositPct: String(qi.depositPct),
    company: s.companyName,
  };
  return text.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
}

/** Split text into paragraphs (blank lines), keeping single line breaks inside them. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean);
}
