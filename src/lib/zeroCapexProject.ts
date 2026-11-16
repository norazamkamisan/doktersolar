import type { Project } from '../types';
import { currentAfaSen, energyFor, isTouModel, nonDomesticTariffFor, outputFactor, tariffModelOf, type TariffModel } from './solar';
import { TNB_2025, TNB_TARIFF_NAME, type TnbTariffId } from './tnbTariff';
import { ZERO_CAPEX, zeroCapexModel, type ZeroCapexResult } from './zeroCapex';

/**
 * A scanned Commercial or Industrial TNB bill of RM10,000 or more a month gets the Zero Capex
 * proposal; every other project gets the standard (cash purchase) proposal.
 */
export function isZeroCapexProject(p: Pick<Project, 'bill' | 'monthlyBill'>): boolean {
  return !!p.bill && p.bill.category !== 'residential' && p.monthlyBill >= ZERO_CAPEX.minMonthlyBill;
}

/** The Non-Domestic tariff for the model: the chosen one, else the one the bill points to. */
function nonDomesticModel(p: Project): Exclude<TariffModel, 'flat' | 'tnb' | 'tnb-tou'> {
  const m = tariffModelOf(p);
  if (m !== 'flat' && m !== 'tnb' && m !== 'tnb-tou') return m;
  const fromBill = p.bill ? nonDomesticTariffFor(p.bill) : 'lv';
  return fromBill as Exclude<TariffModel, 'flat' | 'tnb' | 'tnb-tou'>;
}

export interface ZeroCapexProject {
  model: ZeroCapexResult;
  tariffId: TnbTariffId;
  tariffName: string;
  tou: boolean;
  panelCount: number;
  /** m², panels only */
  panelAreaM2: number;
}

export function zeroCapexFor(p: Project): ZeroCapexProject {
  const m = nonDomesticModel(p);
  const tou = isTouModel(m);
  const level = m.replace('-tou', '') as 'lv' | 'mv' | 'hv';
  const t = TNB_2025[level];
  const peakSen = tou ? t.touPeak : t.energy;
  const offPeakSen = tou ? t.touOffPeak : t.energy;
  const energy = energyFor(p);
  const panelCount = p.panelCount || (p.design.panelWattage > 0 ? Math.round((p.systemKw * 1000) / p.design.panelWattage) : 0);
  return {
    model: zeroCapexModel({
      systemKwp: p.systemKw,
      year1Kwh: energy.annualKwh * outputFactor(p.energy, 1),
      peakRate: peakSen / 100,
      offPeakRate: offPeakSen / 100,
      afaRate: currentAfaSen() / 100,
    }),
    tariffId: m as TnbTariffId,
    tariffName: TNB_TARIFF_NAME[m as TnbTariffId],
    tou,
    panelCount,
    panelAreaM2: panelCount * p.design.panelWidth * p.design.panelHeight,
  };
}

/** "Plaza Azalea, Seksyen 14, 40000 Shah Alam, Selangor" → "Shah Alam, Selangor" */
export function townAndState(address: string): string {
  const parts = address
    .split(/,|\n/)
    .map((s) => s.replace(/\b\d{5}\b/g, '').trim())
    .filter(Boolean);
  return parts.slice(-2).join(', ');
}
