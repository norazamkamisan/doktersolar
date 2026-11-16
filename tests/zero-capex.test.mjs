import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zeroCapexModel } from '../src/lib/zeroCapex.ts';

const near = (a, b, msg, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${msg ?? ''} expected ${b}, got ${a}`);

// Figures from the "Zero Capex" sheet of PSP Group_Solar_Financial_Model_1484kWp.xlsx
const r = zeroCapexModel({
  systemKwp: 1484.64,
  year1Kwh: 1902046.54,
  peakRate: 0.4452,
  offPeakRate: 0.4043,
  afaRate: 0.0361,
});

test('solar rate is the off-peak charge less 10%', () => {
  near(r.ppaRate, 0.36387, 'PPA', 1e-9);
});

test('year 1 matches the workbook', () => {
  const y = r.years[0];
  near(y.peakKwh, 792519.3916666673, 'peak kWh');
  near(y.peakRm, 64455.602124250065, 'peak RM');
  near(y.offPeakRm, 44858.182607116665, 'off-peak RM');
  near(y.afaRm, 68663.880094000007, 'AFA');
  near(y.kwtbbRm, 1749.0205557018678, 'KWTBB');
  near(y.totalRm, 179726.68538106862, 'total');
});

test('later years degrade, escalate and accumulate as the workbook', () => {
  near(r.years[1].generationKwh, 1894438.35384, 'year 2 kWh');
  near(r.years[1].totalRm, 195227.32076791773, 'year 2 total');
  near(r.years[5].cumulativeRm, 1314844.0971591796, 'year 6 cumulative');
});

test('summary matches the workbook', () => {
  near(r.totalSavingsRm, 6780292.6427886058, '20-year total');
  near(r.averageMonthlyRm, 28251.219344952526, 'average monthly');
  near(r.co2Kg, 1483596.3012, 'CO2');
  near(r.forestM2, 3804093.08, 'forest');
  near(r.oilLitre, 466001.4023, 'oil');
});
