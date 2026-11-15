import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eeiRateSen, tnbDomesticBill, tnbKwhForBill } from '../src/lib/tnbTariff.ts';

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005, `${msg ?? ''} expected ${b}, got ${a}`);
const AFA = 3.6;

test('300 kWh: low energy rate, retail and AFA waived, efficiency incentive', () => {
  const b = tnbDomesticBill(300, { afaSen: AFA });
  near(b.energy, 81.09); // 300 × 27.03 sen
  near(b.capacity, 13.65); // 300 × 4.55 sen
  near(b.network, 38.55); // 300 × 12.85 sen
  assert.equal(b.retail, 0);
  assert.equal(b.afa, 0);
  near(b.eei, -67.5); // 300 × −22.5 sen
  near(b.total, 65.79);
});

test('1,000 kWh: retail charge and AFA apply, smallest incentive', () => {
  const b = tnbDomesticBill(1000, { afaSen: AFA });
  near(b.energy, 270.3);
  assert.equal(b.retail, 10);
  near(b.afa, 36);
  near(b.eei, -5);
  near(b.total, 485.3);
});

test('2,000 kWh: the higher energy rate applies to every kWh, no incentive', () => {
  const b = tnbDomesticBill(2000, { afaSen: AFA });
  near(b.energy, 740.6); // 2000 × 37.03 sen
  assert.equal(b.eei, 0);
  near(b.total, 740.6 + 91 + 257 + 10 + 72);
});

test('waivers stop above 800 kWh', () => {
  assert.equal(tnbDomesticBill(800, { afaSen: AFA }).retail, 0);
  assert.equal(tnbDomesticBill(800, { afaSen: AFA }).afa, 0);
  assert.equal(tnbDomesticBill(801, { afaSen: AFA }).retail, 10);
  near(tnbDomesticBill(801, { afaSen: AFA }).afa, 28.836);
});

test('incentive bands', () => {
  assert.equal(eeiRateSen(200), -25);
  assert.equal(eeiRateSen(201), -24.5);
  assert.equal(eeiRateSen(1000), -0.5);
  assert.equal(eeiRateSen(1001), 0);
  assert.equal(eeiRateSen(0), 0);
});

test('Domestic ToU blends peak and off-peak rates', () => {
  const b = tnbDomesticBill(1000, { afaSen: AFA, touPeakPct: 50 });
  near(b.energy, 264.75); // (28.52 + 24.43) / 2 × 1000 sen
});

test('no use, no bill', () => {
  assert.equal(tnbDomesticBill(0, { afaSen: AFA }).total, 0);
});

test('works back from a bill to kWh', () => {
  assert.ok(Math.abs(tnbKwhForBill(485.3, { afaSen: AFA }) - 1000) <= 1);
  assert.ok(Math.abs(tnbKwhForBill(65.79, { afaSen: AFA }) - 300) <= 1);
  assert.equal(tnbKwhForBill(0, { afaSen: AFA }), 0);
});
