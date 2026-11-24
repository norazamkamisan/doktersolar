/**
 * PSP Group preliminary site visit checklist (from "PSP_Group_Site_Visit_Checklist.html").
 * The items are data, so the editor (Design tab → Site visit) and the printable report share them.
 *
 * Answers live on the project (`Project.siteVisit`) and sync like the rest of the project; photos
 * stay on the device that took them (lib/photoStore.ts), since they are too large for the shared file.
 */

export type Field =
  /** free text */
  | { kind: 'text'; key: string; label: string; placeholder?: string }
  /** tick boxes; `single`: only one may be ticked; `other`: a text box after the options */
  | { kind: 'choice'; key: string; label: string; options: string[]; single?: boolean; other?: string };

export interface ChecklistSection {
  id: string;
  title: string;
  intro?: string;
  fields: Field[];
  /** photo slots shown after the fields */
  photos?: { key: string; label: string }[];
  /** the TNB meter / fuse / CT table (Grid connection only) */
  lvTable?: boolean;
  /** remarks box (last section) */
  remarks?: boolean;
}

const YNA = ['Yes', 'No', 'N/A'];

export const CHECKLIST: ChecklistSection[] = [
  {
    id: 'participants',
    title: '1. Date and Participants',
    fields: [
      { kind: 'text', key: 'site', label: 'Project / site' },
      { kind: 'text', key: 'date', label: 'Site survey date' },
      { kind: 'text', key: 'conductedBy', label: 'Conducted by' },
      { kind: 'text', key: 'clientRep', label: 'Client / site representative' },
    ],
  },
  {
    id: 'grid',
    title: '2. Grid Connection',
    fields: [
      { kind: 'choice', key: 'voltage', label: 'TNB incoming voltage level', options: ['LV 400/230V', 'MV 6.6kV', 'MV 11kV', 'MV 22kV', 'MV 33kV', 'HV 132kV'], single: true },
      { kind: 'choice', key: 'phase', label: 'Phase', options: ['Single', 'Three'], single: true },
      { kind: 'text', key: 'distance', label: 'Distance: TNB pencawang to client main incomer (m)' },
      { kind: 'choice', key: 'multiTenant', label: 'Multi-tenant site', options: ['Yes', 'No'], single: true },
    ],
    lvTable: true,
  },
  {
    id: 'roof',
    title: '3. Roof',
    intro: 'Complete this section for each building or carpark area.',
    fields: [
      { kind: 'text', key: 'building', label: 'Building name and building number / total' },
      { kind: 'text', key: 'pvArea', label: 'PV installation area (length × width, m; area, m²)' },
      { kind: 'text', key: 'roofType', label: 'Existing roof, proposed carpark canopy / BIPV and responsible party' },
      { kind: 'text', key: 'cableRuns', label: 'PV area to inverter (m) / inverter to client MSB (m)' },
      { kind: 'choice', key: 'roofProfile', label: 'Roof profile', options: ['Trapezoidal', 'Clay Tile', 'Asphalt Shingles', 'RC Flat Roof', 'Klip Lok', 'Standing Seam'] },
      { kind: 'text', key: 'ribs', label: 'Flange / top rib opening / rib depth / rib spacing (mm)' },
      { kind: 'text', key: 'purlins', label: 'Purlin-to-purlin spacing (mm) / tilt (°)' },
      { kind: 'choice', key: 'structure', label: 'Building structure type', options: ['Steel', 'Wood', 'Other'], single: true, other: 'Other structure' },
      { kind: 'text', key: 'shading', label: 'Shading obstructions, dimensions (m) and remaining usable area (m²)' },
      {
        kind: 'choice',
        key: 'roofCondition',
        label: 'Roof condition',
        options: ['Skylight', 'Rust', 'PV installation possible', 'PV installation restricted', 'Client will replace roof'],
      },
      { kind: 'choice', key: 'grounding', label: 'Grounding system available', options: ['Yes', 'No'], single: true, other: 'Earthing follow-up' },
      { kind: 'text', key: 'roofAccess', label: 'Roof access / ingress' },
    ],
    photos: [
      { key: 'droneOverall', label: 'Drone overall view: mark PV, inverter and MSB' },
      { key: 'droneTop', label: 'Drone top view' },
      { key: 'front', label: 'Front view' },
      { key: 'rear', label: 'Rear view' },
      { key: 'roofProfileDims', label: 'Roof profile dimensions' },
      { key: 'ribPurlin', label: 'Rib and purlin spacing' },
      { key: 'tilt', label: 'Tilt measurement' },
      { key: 'shadingPhoto', label: 'Shading and obstructions' },
      { key: 'skylights', label: 'Skylights and roof condition' },
      { key: 'groundingPhoto', label: 'Grounding and lightning protection' },
      { key: 'ingress', label: 'Roof ingress' },
    ],
  },
  {
    id: 'electrical',
    title: '4. Electrical',
    fields: [
      { kind: 'text', key: 'htRoom', label: 'HT room / transformer room (where applicable)' },
      { kind: 'text', key: 'msbRoom', label: 'Client MSB room, name and board number / total' },
      { kind: 'text', key: 'substation', label: 'TNB substation name, photo reference and access' },
      { kind: 'text', key: 'clrLand', label: 'Land available for CLR (length × width, m; area, m²)' },
      { kind: 'choice', key: 'sldIncomer', label: 'SLD: substation to client main incomer', options: ['Available', 'Pending', 'N/A'], single: true, other: 'SLD reference' },
      { kind: 'choice', key: 'sldPv', label: 'SLD: client main incomer to PV MSB connection', options: ['Available', 'Pending', 'N/A'], single: true, other: 'PV SLD reference' },
      { kind: 'text', key: 'incomer', label: 'MSB main incomer: CT ratio / MSB rating (A) / power factor' },
      { kind: 'text', key: 'injection', label: 'PV injection point: termination point / main and spare breaker ratings (A)' },
      { kind: 'text', key: 'meterId', label: 'TNB meter ID and meter number / total' },
      { kind: 'text', key: 'invToPvmsb', label: 'Inverter to PVMSB (m)' },
      { kind: 'text', key: 'pvmsbToSare', label: 'PVMSB to SARE meter (m)' },
      { kind: 'text', key: 'sareToMsb', label: 'SARE meter to client MSB (m)' },
      { kind: 'text', key: 'pvmsbToMsb', label: 'PVMSB direct to client MSB (m)' },
      { kind: 'text', key: 'md', label: 'MD from MSB / DPM reading and unit' },
      { kind: 'choice', key: 'pattern', label: 'Plant operating pattern', options: ['24 h / 7 days', '24 h / 5 days', '8 h / 5 days', 'Other'], single: true, other: 'Operating pattern' },
      { kind: 'choice', key: 'operating', label: 'Plant operating normally during visit', options: YNA, single: true },
      { kind: 'text', key: 'capBank', label: 'Capacitor bank: total kVAr / total steps / active steps' },
      { kind: 'choice', key: 'genset', label: 'Existing genset', options: YNA, single: true, other: 'Genset mode' },
      { kind: 'text', key: 'positions', label: 'Inverter / PVMSB / SARE meter positions and DC / AC routes' },
    ],
    photos: [
      { key: 'htPhoto', label: 'HT or transformer room' },
      { key: 'msbPhoto', label: 'Client MSB room and termination point' },
      { key: 'substationPhoto', label: 'TNB substation or CLR area' },
      { key: 'incomerPhoto', label: 'Incomer nameplate and CT ratio' },
      { key: 'injectionPhoto', label: 'PV injection point and breaker' },
      { key: 'meterPhoto', label: 'TNB meter' },
      { key: 'capPhoto', label: 'Capacitor bank and genset' },
      { key: 'routingPhoto', label: 'Equipment locations and cable routing' },
    ],
  },
  {
    id: 'data',
    title: '5. Data System',
    fields: [
      { kind: 'choice', key: 'network', label: 'Existing network / internet / CCTV', options: YNA, single: true },
      { kind: 'choice', key: 'cctv', label: 'CCTV camera locations for PV array and inverters', options: YNA, single: true, other: 'CCTV location' },
    ],
  },
  {
    id: 'hse',
    title: '6. HSE',
    fields: [
      { kind: 'choice', key: 'hseProc', label: 'Client HSE procedures', options: YNA, single: true },
      { kind: 'choice', key: 'access', label: 'Site access procedures', options: YNA, single: true },
      { kind: 'choice', key: 'fireAlarm', label: 'Existing fire alarm coverage for PV panels and PVMSB', options: YNA, single: true },
    ],
  },
  {
    id: 'special',
    title: '7. Special Requirements',
    fields: [
      { kind: 'choice', key: 'lifeline', label: 'Existing safety lifeline', options: YNA, single: true },
      { kind: 'choice', key: 'water', label: 'Existing water source', options: YNA, single: true },
      { kind: 'text', key: 'waterDistance', label: 'Nearest water point to roof (m) for O&M' },
    ],
    photos: [
      { key: 'lifelinePhoto', label: 'Lifeline evidence' },
      { key: 'waterPhoto', label: 'Water source evidence' },
    ],
  },
  {
    id: 'remarks',
    title: '8. Remarks and Sketch',
    fields: [],
    remarks: true,
  },
];

/**
 * TNB meter protection on LV sites and the largest solar system it allows:
 * fuse rating / CT ratio × 60% (from the original survey form).
 */
export const LV_LIMITS: { rating: string; limitKw: number }[] = [
  { rating: 'Fuse 32A', limitKw: 11.31 },
  { rating: 'Fuse 63A', limitKw: 22.26 },
  { rating: 'CT 150/5', limitKw: 53.0 },
  { rating: 'CT 200/5', limitKw: 70.67 },
  { rating: 'CT 300/5', limitKw: 106.0 },
  { rating: 'CT 400/5', limitKw: 141.34 },
  { rating: 'CT 500/5', limitKw: 176.67 },
  { rating: 'CT 600/5', limitKw: 212.0 },
  { rating: 'CT 800/5', limitKw: 282.67 },
  { rating: 'CT 1000/5', limitKw: 353.34 },
  { rating: 'CT 1200/5', limitKw: 424.01 },
  { rating: 'CT 1600/5', limitKw: 565.34 },
];

/** A text answer, or the ticked options of a choice. */
export type SiteVisitValue = string | string[];

export interface SiteVisit {
  values: Record<string, SiteVisitValue>;
  /** the site's TNB meter protection, a LV_LIMITS rating */
  lvRating?: string;
  /** TNB meter and MSB names per LV_LIMITS row */
  lvNames?: Record<string, { meter?: string; msb?: string }>;
  remarks?: string;
  updatedAt?: string;
}

export const allFields = () => CHECKLIST.flatMap((s) => s.fields);
export const allPhotoSlots = () => CHECKLIST.flatMap((s) => s.photos ?? []);

const answered = (v: SiteVisitValue | undefined) => (Array.isArray(v) ? v.length > 0 : !!v && String(v).trim() !== '');

/** How many checklist items have an answer. */
export function progress(sv: SiteVisit | undefined): { done: number; total: number } {
  const fields = allFields();
  const done = fields.filter((f) => answered(sv?.values[f.key])).length + (sv?.lvRating ? 1 : 0);
  return { done, total: fields.length + 1 };
}
