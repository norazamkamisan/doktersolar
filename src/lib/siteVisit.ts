/**
 * PSP Group site visit checklists: the preliminary checklist for commercial / industrial sites
 * (from "PSP_Group_Site_Visit_Checklist.html") and the residential one for landed homes.
 * The items are data, so the editor (Design tab → Site visit) and the printable report share them.
 *
 * Answers live on the project (`Project.siteVisit`) and sync like the rest of the project; photos
 * are kept on the device and uploaded to the owner's Google Drive when connected (lib/photoStore.ts).
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
 * PSP Group residential solar site visit checklist (from
 * "PSP_Group_Residential_Solar_Site_Visit_Checklist.html"), for landed homes. Keys start with "r"
 * so they never mix with the commercial / industrial checklist's answers.
 */
export const RESIDENTIAL_CHECKLIST: ChecklistSection[] = [
  {
    id: 'rCustomer',
    title: '1. Customer and Property',
    intro: 'For landed homes. Tick the applicable options, complete the measurements and add photos.',
    fields: [
      { kind: 'text', key: 'rContact', label: 'Customer / contact number' },
      { kind: 'text', key: 'rAddress', label: 'Site address / postcode' },
      { kind: 'text', key: 'rVisit', label: 'Visit date / surveyor' },
      { kind: 'choice', key: 'rPropertyType', label: 'Property type', options: ['Terrace', 'Semi-D', 'Detached', 'Townhouse', 'Other'], single: true, other: 'Property type details' },
      { kind: 'choice', key: 'rStoreys', label: 'Storeys', options: ['1', '2', '3 or more'], single: true },
      { kind: 'choice', key: 'rAccess', label: 'Ownership / access permission', options: ['Owner present', 'Occupier present', 'Permission pending'] },
      { kind: 'choice', key: 'rObjective', label: 'Installation objective', options: ['Reduce bill', 'Battery backup', 'EV charging', 'Other'], other: 'Installation objective details' },
    ],
  },
  {
    id: 'rSupply',
    title: '2. TNB Supply and Household Usage',
    fields: [
      { kind: 'choice', key: 'rBillEvidence', label: 'TNB bill evidence', options: ['Latest bill received', 'Usage history received', 'Pending'] },
      { kind: 'text', key: 'rAccount', label: 'Account / meter number' },
      { kind: 'choice', key: 'rPhase', label: 'Supply phase', options: ['Single-phase', 'Three-phase', 'To confirm'], single: true },
      { kind: 'text', key: 'rMeterDb', label: 'Meter and main DB location' },
      { kind: 'text', key: 'rMainSwitch', label: 'Main switch rating (A) / spare DB ways' },
      { kind: 'text', key: 'rUsage', label: 'Electricity usage (kWh/month) / bill (RM/month)' },
      { kind: 'choice', key: 'rOccupancy', label: 'Daytime occupancy', options: ['Usually occupied', 'Usually vacant', 'Varies'], single: true },
      { kind: 'choice', key: 'rLoads', label: 'Major loads', options: ['Air-conditioning', 'Water heater', 'EV charger', 'Pump', 'Other'], other: 'Major loads details' },
      { kind: 'text', key: 'rPlanned', label: 'Planned additions / battery backup loads' },
      { kind: 'choice', key: 'rElecFollowUp', label: 'Electrical follow-up', options: ['DB review', 'Earthing review', 'Meter location review', 'None identified'] },
    ],
  },
  {
    id: 'rRoof',
    title: '3. Roof and Shading',
    fields: [
      { kind: 'choice', key: 'rCovering', label: 'Roof covering', options: ['Concrete tile', 'Clay tile', 'Metal deck', 'RC flat roof', 'Other'], other: 'Roof covering details' },
      {
        kind: 'choice',
        key: 'rCondition',
        label: 'Roof condition observed',
        options: ['Acceptable visually', 'Cracked tiles', 'Rust', 'Leak signs', 'Obstructed view', 'Review needed'],
      },
      { kind: 'text', key: 'rRoofAge', label: 'Roof age / renovation plans' },
      { kind: 'choice', key: 'rStructure', label: 'Roof structure observed', options: ['Timber', 'Steel', 'RC', 'Unconfirmed'], single: true },
      { kind: 'text', key: 'rPlaneA', label: 'Roof plane A (orientation, length × width, pitch)' },
      { kind: 'text', key: 'rPlaneB', label: 'Roof plane B (orientation, length × width, pitch)' },
      { kind: 'text', key: 'rPlanesOther', label: 'Other roof planes / estimated usable area (m²)' },
      { kind: 'choice', key: 'rShading', label: 'Shading', options: ['Adjacent house', 'Trees', 'Tank', 'Parapet', 'Antenna', 'None observed'] },
      { kind: 'text', key: 'rShadingWhen', label: 'Shading location / observation time' },
      {
        kind: 'choice',
        key: 'rRoofAccess',
        label: 'Roof access and site constraints',
        options: ['Ladder access', 'Scaffold access to assess', 'Restricted access', 'Other'],
        other: 'Roof access details',
      },
    ],
  },
  {
    id: 'rEquipment',
    title: '4. Equipment, Cable Route and Access',
    fields: [
      { kind: 'choice', key: 'rInverterAt', label: 'Proposed inverter location', options: ['Garage', 'Utility area', 'External wall', 'Other'], single: true, other: 'Inverter location details' },
      { kind: 'choice', key: 'rInverterNotes', label: 'Inverter location notes', options: ['Sheltered', 'Ventilation to review', 'Clearance to review', 'Owner approval pending'] },
      { kind: 'choice', key: 'rBattery', label: 'Battery requirement', options: ['Requested', 'Future provision', 'Not requested'], single: true },
      { kind: 'text', key: 'rBatteryAt', label: 'Proposed battery location / constraints' },
      { kind: 'text', key: 'rPvRoute', label: 'PV to inverter route / estimated length (m)' },
      { kind: 'text', key: 'rDbRoute', label: 'Inverter to main DB route / estimated length (m)' },
      { kind: 'choice', key: 'rConcealment', label: 'Cable concealment / wall penetrations', options: ['Concealed requested', 'Surface conduit accepted', 'Route approval pending'] },
      { kind: 'choice', key: 'rConnectivity', label: 'Monitoring connectivity', options: ['Wi-Fi available', 'Mobile signal available', 'To confirm'] },
      {
        kind: 'choice',
        key: 'rInstallAccess',
        label: 'Installation access',
        options: ['Equipment staging available', 'Parking restricted', 'Shared access', 'Pet or occupant arrangements needed'],
      },
      { kind: 'choice', key: 'rWater', label: 'Water access for future cleaning', options: ['Available', 'Unavailable', 'To confirm'], single: true },
    ],
  },
  {
    id: 'rPhotos',
    title: '5. Photo Evidence',
    fields: [],
    photos: [
      { key: 'rFrontage', label: 'House frontage and access' },
      { key: 'rRoofOverview', label: 'Roof overview and roof planes' },
      { key: 'rRoofCovering', label: 'Roof covering and any damage' },
      { key: 'rShadingPhoto', label: 'Shading obstruction' },
      { key: 'rMeter', label: 'TNB meter and nameplate' },
      { key: 'rMainDb', label: 'Main DB and main switch' },
      { key: 'rInverterPhoto', label: 'Proposed inverter or battery location' },
      { key: 'rCableRoute', label: 'Proposed cable route or annotated sketch' },
    ],
  },
  {
    id: 'rOutcome',
    title: '6. Survey Outcome and Follow-up',
    fields: [
      { kind: 'choice', key: 'rOutcome', label: 'Survey outcome', options: ['Ready for design review', 'More information required', 'Revisit required'], single: true },
      { kind: 'text', key: 'rSize', label: 'Indicative PV size (kWp) / battery size (kWh), if discussed' },
      { kind: 'text', key: 'rNextStep', label: 'Customer preferences / agreed next step' },
      { kind: 'text', key: 'rAction', label: 'Outstanding action / owner / due date' },
      { kind: 'text', key: 'rSurveyor', label: 'Surveyor name / date' },
      { kind: 'text', key: 'rReviewed', label: 'Reviewed by / date' },
    ],
    remarks: true,
  },
];

/** Which checklist a project uses: the residential one for homes, the preliminary one for C&I. */
export type ChecklistKind = 'residential' | 'ci';

export const CHECKLIST_TITLE: Record<ChecklistKind, string> = {
  residential: 'Residential Solar Site Visit Checklist',
  ci: 'Preliminary Site Visit Checklist (commercial / industrial)',
};

export const checklistFor = (kind: ChecklistKind): ChecklistSection[] => (kind === 'residential' ? RESIDENTIAL_CHECKLIST : CHECKLIST);

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
  /** which checklist to use, when changed by hand (else worked out from the project) */
  kind?: ChecklistKind;
  /** the site's TNB meter protection, a LV_LIMITS rating */
  lvRating?: string;
  /** TNB meter and MSB names per LV_LIMITS row */
  lvNames?: Record<string, { meter?: string; msb?: string }>;
  remarks?: string;
  updatedAt?: string;
}

export const allFields = (kind: ChecklistKind = 'ci') => checklistFor(kind).flatMap((s) => s.fields);
export const allPhotoSlots = (kind: ChecklistKind = 'ci') => checklistFor(kind).flatMap((s) => s.photos ?? []);

const answered = (v: SiteVisitValue | undefined) => (Array.isArray(v) ? v.length > 0 : !!v && String(v).trim() !== '');

/** How many checklist items have an answer. */
export function progress(sv: SiteVisit | undefined, kind: ChecklistKind = 'ci'): { done: number; total: number } {
  const fields = allFields(kind);
  const done = fields.filter((f) => answered(sv?.values[f.key])).length;
  // the C&I checklist also has the TNB meter protection table
  return kind === 'ci' ? { done: done + (sv?.lvRating ? 1 : 0), total: fields.length + 1 } : { done, total: fields.length };
}
