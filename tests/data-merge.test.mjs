import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORMAT, applyChanges, emptyData, parseData } from '../server/data-merge.mjs';

const p = (id, updatedAt, extra = {}) => ({ id, updatedAt, ...extra });
const NOW = '2026-11-15T10:00:00.000Z';

test('empty or unrelated file text is empty data', () => {
  assert.deepEqual(parseData(''), emptyData());
  assert.deepEqual(parseData('{}'), emptyData());
  assert.throws(() => parseData('not json'), /not valid JSON/);
});

test('adds new projects and keeps the newer copy', () => {
  let data = applyChanges(emptyData(), { upsert: [p('a', '2026-01-01', { v: 1 }), p('b', '2026-01-01')] }, NOW);
  data = applyChanges(data, { upsert: [p('a', '2026-02-01', { v: 2 })] }, NOW);
  data = applyChanges(data, { upsert: [p('a', '2025-12-01', { v: 0 })] }, NOW); // stale device
  assert.equal(data.projects.length, 2);
  assert.equal(data.projects.find((x) => x.id === 'a').v, 2);
  assert.equal(data.format, FORMAT);
  assert.equal(data.savedAt, NOW);
});

test('deleted projects stay deleted unless edited after the deletion', () => {
  let data = applyChanges(emptyData(), { upsert: [p('a', '2026-01-01')] }, NOW);
  data = applyChanges(data, { remove: ['a'] }, '2026-03-01T00:00:00.000Z');
  assert.equal(data.projects.length, 0);
  data = applyChanges(data, { upsert: [p('a', '2026-02-01')] }, NOW); // older copy from an offline device
  assert.equal(data.projects.length, 0);
  data = applyChanges(data, { upsert: [p('a', '2026-04-01')] }, NOW); // edited after the deletion
  assert.equal(data.projects.length, 1);
  assert.equal(data.deleted.a, undefined);
});

test('settings are replaced only when sent', () => {
  let data = applyChanges(emptyData(), { settings: { companyName: 'A' } }, NOW);
  data = applyChanges(data, { upsert: [p('x', '2026-01-01')] }, NOW);
  assert.deepEqual(data.settings, { companyName: 'A' });
});

test('round-trips through the file text', () => {
  const data = applyChanges(emptyData(), { upsert: [p('a', '2026-01-01')], remove: ['z'] }, NOW);
  assert.deepEqual(parseData(JSON.stringify(data)), data);
});
