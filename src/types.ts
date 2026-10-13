export type ProjectStatus = 'Lead' | 'Designing' | 'Proposal Sent' | 'Won' | 'Installed';

export const STATUSES: ProjectStatus[] = ['Lead', 'Designing', 'Proposal Sent', 'Won', 'Installed'];

/** [lat, lng] */
export type LatLng = [number, number];

export interface DesignSettings {
  roof: LatLng[];
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
  /** currency per kWh */
  tariff: number;
  /** currency per watt (installed) */
  pricePerWatt: number;
  /** annual degradation, % */
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
  proposalSentAt: string | null;
}

export interface Settings {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  logo: string | null;
  defaultPanelWattage: number;
  pricePerWatt: number;
  tariff: number;
  currency: string;
  peakSunHours: number;
  userName: string;
}
