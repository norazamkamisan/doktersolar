import type { DesignSettings, EnergySettings, Project, Settings } from '../types';
import { layoutPanels, systemKw } from './solar';

export const DEFAULT_SETTINGS: Settings = {
  companyName: 'DokterSolar',
  companyEmail: 'hello@doktersolar.example',
  companyPhone: '+60 3-0000 0000',
  logo: null,
  defaultPanelWattage: 450,
  pricePerWatt: 3.2,
  tariff: 0.45,
  currency: 'MYR',
  peakSunHours: 4.2,
  userName: 'Solar Designer',
};

export function defaultDesign(s: Settings): DesignSettings {
  return {
    roof: [],
    panelWattage: s.defaultPanelWattage,
    panelWidth: 1.134,
    panelHeight: 1.762,
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
    degradation: 0.5,
    escalation: 2,
    usePvWatts: false,
    pvwatts: null,
  };
}

/** Recompute cached panel count & size from the design geometry. */
export function withComputed(p: Project): Project {
  const { panels } = layoutPanels(p.design);
  return { ...p, panelCount: panels.length, systemKw: systemKw(panels.length, p.design.panelWattage) };
}
