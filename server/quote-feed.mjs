// The slim project list the claude.ai "Quotation, Margin & Cashflow" app syncs from
// (pure function, tested in tests/quote-feed.test.mjs). Served by api/quote-feed.js.
//
// Only what a quotation needs: customer, address, size, system, the proposal price (Total System
// Price, less any discount), and the project's costing and cashflow. Same visibility as the app:
// salespeople only get their own projects.

export const FEED_FORMAT = 'doktersolar.quote-feed.v1';
export const DEFAULT_STATUSES = ['Proposal Sent', 'Won', 'Installed'];

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

/** Same rule as totalSystemPrice() in src/lib/solar.ts: the quoted price, else kWp × price per watt. */
export function totalPrice(p) {
  const q = num(p?.quote?.systemPrice);
  return q > 0 ? q : num(p?.systemKw) * 1000 * num(p?.energy?.pricePerWatt);
}

function systemText(p, s) {
  const panels = [
    p.panelCount ? `${p.panelCount} x` : '',
    s?.panelBrand || '',
    p.design?.panelWattage ? `${p.design.panelWattage}W panels` : 'panels',
    s?.panelModel ? `(${s.panelModel})` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const qty = num(p.quote?.inverterQty) || 1;
  const inv = p.quote?.inverterModel || s?.inverter || '';
  const kw = num(p.quote?.inverterKw);
  const inverter = inv || kw ? `${qty} x ${kw ? `${kw} kW ` : ''}inverter${inv ? ` (${inv})` : ''}` : '';
  return [panels, inverter].filter(Boolean).join(' + ');
}

/**
 * @param data   the visible data (visibleData(...) in server/access.mjs)
 * @param opts   { statuses?: string[] | 'all', ids?: string[], now?: string }
 */
export function buildFeed(data, opts = {}) {
  const s = data.settings ?? {};
  const salespeople = new Map((s.salespeople ?? []).map((x) => [x.id, x.name]));
  const ids = opts.ids?.length ? new Set(opts.ids) : null;
  const statuses = opts.statuses === 'all' ? null : new Set(opts.statuses?.length ? opts.statuses : DEFAULT_STATUSES);
  const projects = (data.projects ?? [])
    .filter((p) => p && (ids ? ids.has(p.id) : !statuses || statuses.has(p.status)))
    .map((p) => {
      const total = totalPrice(p);
      const discount = num(p.quote?.discount);
      return {
        id: p.id,
        customerName: p.customerName ?? '',
        email: p.email ?? '',
        phone: p.phone ?? '',
        address: p.address ?? '',
        status: p.status,
        systemKw: num(p.systemKw),
        panelCount: num(p.panelCount),
        system: systemText(p, s),
        totalSystemPrice: Math.round(total * 100) / 100,
        discount,
        netPrice: Math.round(Math.max(0, total - discount) * 100) / 100,
        proposalSentAt: p.proposalSentAt ?? null,
        salesperson: salespeople.get(p.salespersonId) ?? '',
        updatedAt: p.updatedAt ?? null,
        costing: p.costing ?? null,
        cashflow: p.cashflow ?? null,
      };
    })
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  return {
    format: FEED_FORMAT,
    generatedAt: opts.now ?? new Date().toISOString(),
    company: s.companyName ?? '',
    currency: s.currency ?? 'MYR',
    depositPct: num(s.depositPct),
    priceList: Array.isArray(s.priceList) ? s.priceList : [],
    projects,
  };
}
