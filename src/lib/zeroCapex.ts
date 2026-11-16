/**
 * Zero Capex (solar PPA) financial model for Commercial & Industrial customers, following the
 * "Zero Capex" sheet of the PSP Group Solar Financial Model workbook:
 *
 * - generation falls 0.4% a year (compounded) from the year 1 figure;
 * - 5/12 of the solar output lands in the TNB peak period, the rest off-peak;
 * - the customer pays a fixed solar (PPA) rate for the solar used: the TNB off-peak energy charge
 *   less 10%, never escalated;
 * - the energy-charge saving each year is kWh × (TNB rate, rising 2% a year − solar rate), for peak
 *   and off-peak; the AFA saving is all solar kWh × AFA (not escalated); KWTBB is 1.6% of the
 *   energy-charge saving;
 * - the investor pays for the system and its O&M, so there is no payback period.
 *
 * Self-contained (no imports) so the tests can load it directly with Node.
 */

export const ZERO_CAPEX = {
  /** bills from this much a month (RM) get the Zero Capex proposal, for C&I customers */
  minMonthlyBill: 10000,
  years: 20,
  /** per year, compounded, from year 2 */
  degradation: 0.004,
  /** share of solar output in the TNB peak period */
  peakShare: 5 / 12,
  /** TNB tariff increase per year */
  escalation: 0.02,
  /** KWTBB (Renewable Energy Fund), share of the energy-charge saving */
  kwtbb: 0.016,
  /** solar rate = TNB off-peak energy charge less this share */
  ppaDiscount: 0.1,
  /** generation the investor guarantees, share of the expected */
  guarantee: 0.85,
  /** environment, per kWh of solar */
  co2Kg: 0.78,
  forestM2: 2,
  oilLitre: 0.245,
};

export interface ZeroCapexInputs {
  systemKwp: number;
  /** year 1 solar generation, kWh */
  year1Kwh: number;
  /** TNB energy charge, RM/kWh (the same figure twice for a non-ToU tariff) */
  peakRate: number;
  offPeakRate: number;
  /** RM/kWh */
  afaRate: number;
  /** override the solar (PPA) rate, RM/kWh; default off-peak less 10% */
  ppaRate?: number;
}

export interface ZeroCapexYear {
  year: number;
  generationKwh: number;
  peakKwh: number;
  peakRm: number;
  offPeakKwh: number;
  offPeakRm: number;
  afaRm: number;
  kwtbbRm: number;
  totalRm: number;
  cumulativeRm: number;
}

export interface ZeroCapexResult {
  inputs: ZeroCapexInputs;
  ppaRate: number;
  years: ZeroCapexYear[];
  year1SavingsRm: number;
  /** year 1 saving ÷ 12 */
  year1MonthlyRm: number;
  totalSavingsRm: number;
  /** total ÷ (years × 12), as the workbook's "Average Monthly Solar Savings" */
  averageMonthlyRm: number;
  totalKwh: number;
  /** year 1 */
  co2Kg: number;
  forestM2: number;
  oilLitre: number;
}

export function zeroCapexModel(inputs: ZeroCapexInputs, c: typeof ZERO_CAPEX = ZERO_CAPEX): ZeroCapexResult {
  const ppaRate = inputs.ppaRate ?? inputs.offPeakRate * (1 - c.ppaDiscount);
  const years: ZeroCapexYear[] = [];
  let cumulative = 0;
  let totalKwh = 0;
  for (let year = 1; year <= c.years; year++) {
    const generationKwh = inputs.year1Kwh * (1 - c.degradation) ** (year - 1);
    const rise = (1 + c.escalation) ** (year - 1);
    const peakKwh = generationKwh * c.peakShare;
    const offPeakKwh = generationKwh - peakKwh;
    const peakRm = peakKwh * (inputs.peakRate * rise - ppaRate);
    const offPeakRm = offPeakKwh * (inputs.offPeakRate * rise - ppaRate);
    const afaRm = generationKwh * inputs.afaRate;
    const kwtbbRm = (peakRm + offPeakRm) * c.kwtbb;
    const totalRm = peakRm + offPeakRm + afaRm + kwtbbRm;
    cumulative += totalRm;
    totalKwh += generationKwh;
    years.push({ year, generationKwh, peakKwh, peakRm, offPeakKwh, offPeakRm, afaRm, kwtbbRm, totalRm, cumulativeRm: cumulative });
  }
  const y1 = years[0];
  return {
    inputs,
    ppaRate,
    years,
    year1SavingsRm: y1?.totalRm ?? 0,
    year1MonthlyRm: (y1?.totalRm ?? 0) / 12,
    totalSavingsRm: cumulative,
    averageMonthlyRm: cumulative / (c.years * 12),
    totalKwh,
    co2Kg: inputs.year1Kwh * c.co2Kg,
    forestM2: inputs.year1Kwh * c.forestM2,
    oilLitre: inputs.year1Kwh * c.oilLitre,
  };
}
