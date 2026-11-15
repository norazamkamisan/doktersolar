import type { DesignSettings, EnergySettings, Project, Settings } from '../types';
import { hasRoof, layoutPanels, systemKw } from './solar';

export const DEFAULT_SETTINGS: Settings = {
  companyName: 'DokterSolar',
  companyEmail: 'hello@doktersolar.example',
  companyPhone: '+60 3-0000 0000',
  logo: null,
  defaultPanelWattage: 450,
  defaultPanelWidth: 1.134,
  defaultPanelLength: 2.384,
  firstYearDegradation: 1,
  degradation: 0.42,
  panelWarrantyYears: 12,
  performanceWarrantyYears: 25,
  inverter: 'Solis / Sungrow or equivalent',
  inverterWarrantyYears: 10,
  pricePerWatt: 3.2,
  tariff: 0.45,
  currency: 'MYR',
  peakSunHours: 4.2,
  userName: 'Solar Designer',
  userPhone: '',
  userEmail: '',
  companyAddress: '',
  companyWebsite: '',
  coverImage: null,
  coverLetter: 'Thank you for the opportunity to present your Solar Energy System Proposal.',
  aboutUs: '',
  panelBrand: '',
  panelModel: '',
  depositPct: 20,
  quoteNote: 'Price excludes the smart meter from your electricity retailer; if you want us to install it, it will be an additional cost.',
  paymentDetails: 'Contact your sales representative regarding payment.',
  terms: [
    'Subject Matter:',
    'This contract concerns the sale and purchase of a rooftop solar PV system ("the System") for {customer} at {address}.',
    '',
    'Purchase Price:',
    'The total purchase price for the System is {price}. A deposit of {deposit} ({depositPct}%) is payable on signing; the balance is payable on completion of installation and commissioning.',
    '',
    'Delivery and Installation:',
    'Installation starts after the necessary permits and approvals are obtained.',
    '',
    'Warranties:',
    'Equipment warranties are as stated by each manufacturer, shown in this proposal.',
  ].join('\n'),
  caseStudies: [],
  fixedCharge: 10,
  afaSen: 3.6,
};

export function defaultDesign(s: Settings): DesignSettings {
  return {
    roof: [],
    panelWattage: s.defaultPanelWattage,
    panelWidth: s.defaultPanelWidth,
    panelHeight: s.defaultPanelLength,
    orientation: 'portrait',
    tilt: 20,
    azimuth: 180,
    setback: 0.4,
    gap: 0.02,
    maxPanels: 0,
  };
}

export function defaultEnergy(s: Settings): EnergySettings {
  return {
    peakSunHours: s.peakSunHours,
    tariff: s.tariff,
    pricePerWatt: s.pricePerWatt,
    firstYearDegradation: s.firstYearDegradation,
    degradation: s.degradation,
    escalation: 2,
    usePvWatts: false,
    pvwatts: null,
  };
}

/**
 * Bring projects saved before these settings existed up to date (applied whenever projects are
 * loaded, so it needs no data migration):
 * - the old 0.5%/yr default degradation becomes 1% in the first year, then 0.42%/yr;
 * - the old 1.134 × 1.762 m default panel becomes 1.134 × 2.384 m where no roof is drawn yet
 *   (drawn layouts keep their panel size so their panel count doesn't change by itself).
 */
export function normalizeProject(p: Project): Project {
  let { energy, design } = p;
  if (energy.firstYearDegradation == null) {
    const old = energy.degradation === 0.5;
    energy = { ...energy, firstYearDegradation: old ? 1 : energy.degradation, degradation: old ? 0.42 : energy.degradation };
  }
  if (!hasRoof(design) && design.panelWidth === 1.134 && design.panelHeight === 1.762) {
    design = { ...design, panelHeight: 2.384 };
  }
  return energy === p.energy && design === p.design ? p : { ...p, energy, design };
}

/** Recompute cached panel count & size from the design geometry. */
export function withComputed(p: Project): Project {
  // Imported projects keep their original size until a roof is drawn.
  if (!hasRoof(p.design) && p.importedKw && p.importedKw > 0) {
    return { ...p, systemKw: p.importedKw, panelCount: Math.round((p.importedKw * 1000) / p.design.panelWattage) };
  }
  const { panels } = layoutPanels(p.design);
  return { ...p, panelCount: panels.length, systemKw: systemKw(panels.length, p.design.panelWattage) };
}
