import type { SiteVisit } from './lib/siteVisit';
import type { TnbBill } from './lib/tnbBill';

export type ProjectStatus = 'Lead' | 'Designing' | 'Proposal Sent' | 'Won' | 'Installed';

export const STATUSES: ProjectStatus[] = ['Lead', 'Designing', 'Proposal Sent', 'Won', 'Installed'];

/** [lat, lng] */
export type LatLng = [number, number];

/** One roof face: its outline and which way / how steeply it slopes. */
export interface RoofFace {
  roof: LatLng[];
  /** degrees from horizontal */
  tilt: number;
  /** degrees, 0 = north, 90 = east, 180 = south, 270 = west */
  azimuth: number;
}

/**
 * The first roof face is stored in `roof` / `tilt` / `azimuth` (as before multi-roof designs);
 * further faces go in `extraRoofs`. Use `roofFaces()` / `facesPatch()` in lib/solar.ts.
 */
export interface DesignSettings {
  roof: LatLng[];
  /** roof faces after the first */
  extraRoofs?: RoofFace[];
  panelWattage: number;
  /** short side, metres */
  panelWidth: number;
  /** long side, metres */
  panelHeight: number;
  orientation: 'portrait' | 'landscape';
  /** degrees from horizontal (roof pitch) */
  tilt: number;
  /** degrees, 0 = north, 90 = east, 180 = south, 270 = west */
  azimuth: number;
  /** keep-out distance from roof edge, metres */
  setback: number;
  /** gap between panels, metres */
  gap: number;
  /** optional cap on panel count; 0 = no cap */
  maxPanels: number;
}

export interface PvWattsResult {
  annual: number;
  monthly: number[];
  fetchedAt: string;
}

export interface EnergySettings {
  peakSunHours: number;
  /** average rate, currency per kWh: used for the flat tariff, and as a fallback with no usage */
  tariff: number;
  /**
   * How bills are worked out: a TNB tariff from 1 July 2025 (Domestic, or Non-Domestic Low /
   * Medium / High Voltage; General or ToU), or one flat rate. Left out: TNB Domestic, or the
   * matching Non-Domestic tariff for a shop or factory bill.
   */
  tariffModel?: 'tnb' | 'tnb-tou' | 'lv' | 'lv-tou' | 'mv' | 'mv-tou' | 'hv' | 'hv-tou' | 'flat';
  /** ToU tariffs: share of use in the peak period, % */
  touPeakPct?: number;
  /** Medium / High Voltage: maximum demand, kW (else from the scanned bill) */
  maxDemandKw?: number;
  /** currency per watt (installed) */
  pricePerWatt: number;
  /** degradation in the first year, % (older projects don't have it: see normalizeProject) */
  firstYearDegradation?: number;
  /** degradation per year from the second year on, % */
  degradation: number;
  /** annual tariff escalation, % */
  escalation: number;
  usePvWatts: boolean;
  pvwatts: PvWattsResult | null;
}

export interface Project {
  id: string;
  customerName: string;
  email: string;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
  monthlyBill: number;
  status: ProjectStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
  design: DesignSettings;
  energy: EnergySettings;
  /** cached results so lists/dashboards don't need to recompute geometry */
  panelCount: number;
  systemKw: number;
  /** system size brought in from another tool (e.g. OpenSolar); used until a roof is drawn */
  importedKw?: number;
  /** average monthly use, kWh, when known from a scanned bill (otherwise estimated as monthlyBill ÷ tariff) */
  monthlyKwh?: number;
  /** the scanned TNB bill this project was created from */
  bill?: ProjectBill;
  proposalSentAt: string | null;
  quote?: ProjectQuote;
  /** Settings.salespeople id: who prepared the proposal */
  salespersonId?: string;
  /** cost build-up behind the quotation (Costing tab) */
  costing?: ProjectCosting;
  /** payments to make and money in/out for this job (Cashflow tab) */
  cashflow?: ProjectCashflow;
  /** preliminary site visit checklist answers (Design tab → Site visit; photos stay on the device) */
  siteVisit?: SiteVisit;
}

export interface ProjectBill extends TnbBill {
  scannedAt: string;
  /** share of yearly use the system is sized to cover, % */
  targetOffsetPct: number;
}

export interface ProjectBill extends TnbBill {
  scannedAt: string;
  /** share of yearly use the system is sized to cover, % */
  targetOffsetPct: number;
}

export interface Settings {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  logo: string | null;
  defaultPanelWattage: number;
  /** default panel size for new projects, metres */
  defaultPanelWidth: number;
  defaultPanelLength: number;
  /** default degradation for new projects, % (first year, then per year) */
  firstYearDegradation: number;
  degradation: number;
  /** shown on proposals */
  panelWarrantyYears: number;
  performanceWarrantyYears: number;
  /** inverter brand, e.g. "Solis / Sungrow or equivalent" */
  inverter: string;
  inverterWarrantyYears: number;
  pricePerWatt: number;
  tariff: number;
  currency: string;
  peakSunHours: number;
  /** the salesperson preparing proposals ("Prepared by") */
  userName: string;
  userPhone: string;
  userEmail: string;
  /** company address, one line per line */
  companyAddress: string;
  companyWebsite: string;
  /** proposal cover photo (data URL), or null for the built-in banner */
  coverImage: string | null;
  /** cover letter text below "Dear …," */
  coverLetter: string;
  /** "About us" page; empty = no page */
  aboutUs: string;
  panelBrand: string;
  panelModel: string;
  /** deposit payable on acceptance, % of the price */
  depositPct: number;
  /** small print under the quotation */
  quoteNote: string;
  /** "Payment details" under the quote acceptance */
  paymentDetails: string;
  /** terms & conditions page; placeholders {customer} {address} {price} {deposit} {depositPct}. Empty = no page */
  terms: string;
  caseStudies: CaseStudy[];
  /** sales team: chosen per project as "Prepared by" (else the userName / userPhone / userEmail above) */
  salespeople: Salesperson[];
  /** fixed monthly charge on the electricity bill with the flat tariff (stays after solar) */
  fixedCharge: number;
  /** TNB Automatic Fuel Adjustment, sen/kWh: changes monthly */
  afaSen: number;
  /** supplier price list for costing (the admin edits it; everyone reads it) */
  priceList: PriceItem[];
  /** costing defaults for new cost build-ups, % */
  sstPct: number;
  markupPct: number;
  contingencyPct: number;
  /** dropdown lists */
  costCategories: string[];
  costUnits: string[];
  cashCategories: string[];
  payMethods: string[];
}

export interface Salesperson {
  id: string;
  name: string;
  phone: string;
  email: string;
}

export interface CaseStudy {
  title: string;
  text: string;
  /** data URL, optional */
  image: string | null;
}

/** Per-project quotation details (all optional; defaults are worked out from the design and settings). */
export interface ProjectQuote {
  inverterModel?: string;
  /** total inverter rating, kW */
  inverterKw?: number;
  inverterQty?: number;
  /** total system price; default kWp × price per watt */
  systemPrice?: number;
  /** rebate or discount taken off the total */
  discount?: number;
}

/* ------------------------------------------------------------------ */
/* Costing & cashflow                                                  */
/* ------------------------------------------------------------------ */

export interface CostItem {
  id: string;
  description: string;
  category: string;
  unit: string;
  qty: number;
  /** cost per unit */
  rate: number;
  /** markup on this item, %; left out = the costing default */
  markupPct?: number;
  remarks: string;
}

export interface CostScenario {
  name: string;
  markupPct: number;
}

export interface ProjectCosting {
  items: CostItem[];
  markupPct: number;
  /** of total direct cost, % */
  contingencyPct: number;
  /** SST on the selling price, % */
  sstPct: number;
  /**
   * 'proposal': the final quotation is the proposal price (Total System Price less any discount),
   * SST included, and one markup is worked out for every item. 'markup': built up from item markups.
   */
  priceFrom: 'proposal' | 'markup';
  scenarios: CostScenario[];
  /** the margin this job should make, %; not set = the 15% rule */
  targetMarginPct?: number;
}

export const PAY_STATUSES = ['Not Paid', 'Partial', 'Paid', 'Overdue', 'Hold', 'Cancelled'] as const;
export type PayStatus = (typeof PAY_STATUSES)[number];
export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** A payment we have to make (supplier, subcon, crew). */
export interface PaymentRow {
  id: string;
  /** yyyy-mm-dd, or '' when not known */
  due: string;
  payee: string;
  category: string;
  description: string;
  ref: string;
  amount: number;
  status: PayStatus;
  paid: number;
  priority: Priority;
  remarks: string;
}

/** Money from the customer: a claim, milestone or VO. */
export interface CashInRow {
  id: string;
  /** received or expected, yyyy-mm-dd or '' */
  date: string;
  ref: string;
  received: number;
  outstanding: number;
  status: PayStatus;
  remarks: string;
}

/** Money paid out, or due to be paid out. Only Paid rows count as cash out. */
export interface CashOutRow {
  id: string;
  /** paid or due, yyyy-mm-dd or '' */
  date: string;
  payee: string;
  category: string;
  description: string;
  amount: number;
  /** missing on rows saved before statuses existed: see cashOutStatus() */
  status?: PayStatus;
  method: string;
  remarks: string;
}

export interface ProjectCashflow {
  payments: PaymentRow[];
  cashIn: CashInRow[];
  cashOut: CashOutRow[];
}

export interface PriceItem {
  id: string;
  category: string;
  item: string;
  uom: string;
  /** cost per unit; null = waiting for a supplier quote (RFQ) */
  price: number | null;
  supplier: string;
  note: string;
  /** yyyy-mm-dd the price was last set */
  updated: string;
}
