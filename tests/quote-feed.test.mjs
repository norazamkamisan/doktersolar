import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFeed, totalPrice, FEED_FORMAT } from '../server/quote-feed.mjs';

const settings = { companyName: 'PSP', currency: 'MYR', depositPct: 20, panelBrand: 'Trina Solar', panelModel: 'TSM-620', inverter: 'Solis', salespeople: [{ id: 's1', name: 'Shalia' }], priceList: [{ id: 'p1', item: 'Rail' }] };
const base = { energy: { pricePerWatt: 2.29 }, design: { panelWattage: 615 }, panelCount: 20 };
const data = {
  settings,
  projects: [
    { ...base, id: 'a', customerName: 'Datin Hamidah', status: 'Won', systemKw: 12.3, salespersonId: 's1', updatedAt: '2026-11-02', costing: { items: [] } },
    { ...base, id: 'b', customerName: 'Lead only', status: 'Lead', systemKw: 5, updatedAt: '2026-11-03' },
    { ...base, id: 'c', customerName: 'Quoted', status: 'Proposal Sent', systemKw: 10, quote: { systemPrice: 30000, discount: 1000 }, updatedAt: '2026-11-01' },
  ],
};

test('price: quoted price wins, else kWp × price per watt', () => {
  assert.equal(totalPrice(data.projects[2]), 30000);
  assert.equal(Math.round(totalPrice(data.projects[0])), 28167);
});

test('default feed: proposal-stage projects only, with net price and costing', () => {
  const f = buildFeed(data, { now: 'x' });
  assert.equal(f.format, FEED_FORMAT);
  assert.deepEqual(f.projects.map((p) => p.id), ['a', 'c']);
  const c = f.projects.find((p) => p.id === 'c');
  assert.equal(c.netPrice, 29000);
  const a = f.projects.find((p) => p.id === 'a');
  assert.equal(a.totalSystemPrice, 28167);
  assert.equal(a.salesperson, 'Shalia');
  assert.match(a.system, /20 x Trina Solar 615W panels \(TSM-620\)/);
  assert.deepEqual(a.costing, { items: [] });
  assert.equal(f.priceList.length, 1);
});

test('status=all and id filters', () => {
  assert.equal(buildFeed(data, { statuses: 'all' }).projects.length, 3);
  assert.deepEqual(buildFeed(data, { ids: ['b'] }).projects.map((p) => p.id), ['b']);
});
