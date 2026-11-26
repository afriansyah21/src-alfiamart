import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSummaryCache,
  getSummaryCacheTtl,
  SUMMARY_TTL_MS,
} from '../src/services/summaryCache.js';

test('TTL kemarin maksimal satu jam', () => {
  assert.equal(getSummaryCacheTtl('kemarin'), 60 * 60 * 1000);
  assert.equal(SUMMARY_TTL_MS.kemarin, 3600000);
});

test('TTL hari_ini sekitar sepuluh menit', () => {
  assert.equal(getSummaryCacheTtl('hari_ini'), 10 * 60 * 1000);
});

test('cache valid dibaca dan expired dibuang', () => {
  let now = 1000;
  const cache = createSummaryCache({ now: () => now });
  const data = { facts: { revenue: 1000 } };

  assert.equal(cache.set('sales', 'kemarin', data), true);
  assert.equal(cache.get('sales', 'kemarin'), data);

  now += 3600000;
  assert.equal(cache.get('sales', 'kemarin'), null);
});

test('periode lain tidak dicache pada implementasi awal', () => {
  const cache = createSummaryCache();
  assert.equal(cache.set('sales', '7_hari_terakhir', { facts: {} }), false);
  assert.equal(cache.get('sales', '7_hari_terakhir'), null);
});
