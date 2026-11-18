import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findFourXMatches } from '../src/scanner/utils/fourxLookup.js';
import type { FourxProductRecord } from '../src/services/productMasterService';

const catalogue = JSON.parse(readFileSync(new URL('../src/data/fourx.json', import.meta.url), 'utf8')) as FourxProductRecord[];

test('OCR scanner uses the canonical 531-record FOUR-X catalogue', () => {
  assert.equal(catalogue.length, 531);
});

test('OCR scanner resolves FX code variants from canonical catalogue', () => {
  const result = findFourXMatches('Item label: FX-1101-WH', catalogue);
  assert.deepEqual(result.codes, ['1101']);
  assert.ok(result.matches.some((product) => product.sku === 'FX1101WH'));
  assert.ok(result.matches.every((product) => catalogue.includes(product)));
});

test('OCR scanner does not invent products for unknown codes', () => {
  const result = findFourXMatches('FX-999999', catalogue);
  assert.deepEqual(result.codes, ['999999']);
  assert.equal(result.matches.length, 0);
});
