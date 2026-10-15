/**
 * Convert an OpenSolar "Export projects" CSV into DokterSolar projects.
 *
 * Pure function (type-only imports) so it can be tested directly with Node.
 * Runs entirely in the browser: the file is never uploaded anywhere.
 */
import type { DesignSettings, EnergySettings, Project, ProjectStatus, Settings } from '../types';
import { parseCsv } from './csv.ts';

export const OPENSOLAR_ID_PREFIX = 'os-';

const REQUIRED_COLUMNS = ['id', 'title', 'stage_name', 'created_date'];

export interface OpenSolarImport {
  projects: Project[];
  /** rows that could not be used (e.g. no id) */
  skipped: number;
  byStatus: Record<ProjectStatus, number>;
  firstCreated: string | null;
  lastCreated: string | null;
  totalKw: number;
  withLocation: number;
}

export interface ImportDefaults {
  design: (s: Settings) => DesignSettings;
  energy: (s: Settings) => EnergySettings;
}

/** OpenSolar stage (+ sold date) → DokterSolar pipeline status. */
export function mapStage(stage: string, hasSize: boolean, sold: boolean): ProjectStatus {
  switch (stage.trim().toLowerCase()) {
    case 'maintaining':
      return 'Installed';
    case 'installing':
    case 'procurement':
      return 'Won';
    case 'selling':
      return sold ? 'Won' : 'Proposal Sent';
    default:
      // "Designing", "Lead" and anything unknown
      return hasSize ? 'Designing' : 'Lead';
  }
}

const num = (v: string | undefined) => {
  const n = Number(v);
  return v !== undefined && v.trim() !== '' && Number.isFinite(n) ? n : null;
};
const iso = (v: string | undefined) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const clean = (v: string | undefined) => (v ?? '').replace(/\s+/g, ' ').trim();

export function importOpenSolarCsv(text: string, settings: Settings, defaults: ImportDefaults): OpenSolarImport {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('This file has no projects in it.');
  const header = rows[0].map((h) => h.trim());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) {
    throw new Error(`This doesn't look like an OpenSolar project export (missing columns: ${missing.join(', ')}).`);
  }
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  const get = (r: string[], name: string) => (col[name] === undefined ? '' : r[col[name]] ?? '');

  const byStatus: Record<ProjectStatus, number> = { Lead: 0, Designing: 0, 'Proposal Sent': 0, Won: 0, Installed: 0 };
  const projects: Project[] = [];
  let skipped = 0;
  let totalKw = 0;
  let withLocation = 0;

  for (const r of rows.slice(1)) {
    const osId = clean(get(r, 'id'));
    if (!osId) {
      skipped++;
      continue;
    }

    const title = clean(get(r, 'title'));
    const person = [clean(get(r, 'contact_first_name')), clean(get(r, 'contact_family_name'))].filter(Boolean).join(' ');
    const business = clean(get(r, 'business_name'));
    const customerName = person || business || title || `OpenSolar project ${osId}`;

    const street = clean(get(r, 'address')) || title;
    const cityLine = [clean(get(r, 'zip')), clean(get(r, 'locality'))].filter(Boolean).join(' ');
    const address = [street, cityLine, clean(get(r, 'state'))].filter(Boolean).join(', ');

    const lat = num(get(r, 'lat'));
    const lng = num(get(r, 'lon'));
    const located = lat !== null && lng !== null && !(lat === 0 && lng === 0);
    if (located) withLocation++;

    const kw = Math.round(Math.max(0, num(get(r, 'system_solar_size_kw')) ?? 0) * 1000) / 1000;
    const sold = !!clean(get(r, 'sold_date'));
    const status = mapStage(get(r, 'stage_name'), kw > 0, sold);
    byStatus[status]++;
    totalKw += kw;

    const design = defaults.design(settings);
    const energy = defaults.energy(settings);
    const ppw = num(get(r, 'system_price_per_watt')); // OpenSolar exports this per kW
    if (ppw && ppw > 0) energy.pricePerWatt = Math.round((ppw / 1000) * 100) / 100;

    const created = iso(get(r, 'created_date')) ?? new Date().toISOString();
    const modified = iso(get(r, 'modified_date')) ?? created;
    const sentAt =
      status === 'Proposal Sent' || status === 'Won' || status === 'Installed'
        ? iso(get(r, 'sold_date')) ?? iso(get(r, 'contract_date')) ?? modified
        : null;

    const price = num(get(r, 'system_price_including_tax'));
    const battery = num(get(r, 'system_battery_size_kwh'));
    const details: [string, string | null][] = [
      ['OpenSolar stage', clean(get(r, 'stage_name')) || null],
      ['Title in OpenSolar', title && title !== street ? title : null],
      ['Business', business && business !== customerName ? business : null],
      ['Price incl. tax', price ? `${settings.currency} ${price.toLocaleString('en-MY', { maximumFractionDigits: 0 })}` : null],
      ['Battery', battery ? `${battery} kWh` : null],
      ['Roof type', clean(get(r, 'roof_type_name')) || null],
      ['Storeys', clean(get(r, 'number_of_storeys')) || null],
      ['Phases', clean(get(r, 'number_of_phases')) || null],
      ['Tariff', clean(get(r, 'utility_tariff_current_code')) || null],
      ['Contract date', iso(get(r, 'contract_date'))?.slice(0, 10) ?? null],
      ['Sold date', iso(get(r, 'sold_date'))?.slice(0, 10) ?? null],
      ['Salesperson', clean(get(r, 'assigned_salesperson_role_name')) || null],
      ['Designer', clean(get(r, 'assigned_designer_role_name')) || null],
    ];
    const extraNotes = [clean(get(r, 'site_notes')), clean(get(r, 'notes'))].filter(Boolean);
    const notes = [
      `Imported from OpenSolar (project #${osId}).`,
      ...details.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
      ...extraNotes,
    ].join('\n');

    projects.push({
      id: `${OPENSOLAR_ID_PREFIX}${osId}`,
      customerName,
      email: clean(get(r, 'contact_email')),
      phone: clean(get(r, 'contact_phone')),
      address,
      lat: located ? lat : null,
      lng: located ? lng : null,
      monthlyBill: 0,
      status,
      notes,
      createdAt: created,
      updatedAt: modified,
      design,
      energy,
      // No roof drawing comes with the export: keep OpenSolar's system size until a roof is drawn.
      panelCount: kw > 0 ? Math.round((kw * 1000) / design.panelWattage) : 0,
      systemKw: kw,
      importedKw: kw > 0 ? kw : undefined,
      proposalSentAt: sentAt,
    });
  }

  const created = projects.map((p) => p.createdAt).sort();
  return {
    projects,
    skipped,
    byStatus,
    firstCreated: created[0] ?? null,
    lastCreated: created[created.length - 1] ?? null,
    totalKw,
    withLocation,
  };
}
