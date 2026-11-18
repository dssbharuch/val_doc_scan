/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ONE RETAIL AI — Stage 1: Product Master Integrity Test
 * Verifies exact preservation of all 531 records and all original fields from FOUR-X catalogue.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getFourxCatalogue,
  getFourxProductCount,
  getFourxProductBySku,
  getFourxProductsByBaseCode,
  getFourxProductByIndex,
  getFourxCategories,
  getFourxProductGroups,
  verifyCatalogueIntegrity,
  type FourxProductRecord,
} from '../src/services/productMasterService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

describe('FOUR-X Product Master Integrity (Stage 1)', () => {
  const originalAttachmentPath = path.join(
    projectRoot,
    'public',
    'assets',
    'aistudio',
    'catalogue_321d6ce9.json'
  );
  const canonicalPath = path.join(projectRoot, 'src', 'data', 'fourx.json');

  test('Requirement 2: Canonical catalogue file exists at src/data/fourx.json', () => {
    assert.strictEqual(
      fs.existsSync(canonicalPath),
      true,
      'Canonical catalogue file must exist at src/data/fourx.json'
    );
  });

  test('Requirement 3 & 4: Exact file match with original source attachment (no modifications)', () => {
    assert.strictEqual(
      fs.existsSync(originalAttachmentPath),
      true,
      'Original uploaded attachment must exist at public/assets/aistudio/catalogue_321d6ce9.json'
    );

    const originalRaw = fs.readFileSync(originalAttachmentPath, 'utf-8');
    const canonicalRaw = fs.readFileSync(canonicalPath, 'utf-8');

    // Verify exact byte and string equality
    assert.strictEqual(
      canonicalRaw,
      originalRaw,
      'Canonical fourx.json content must match original source attachment exactly with zero mutations'
    );
  });

  test('Requirement 1 & 6: Exact record count is 531', () => {
    const rawData: FourxProductRecord[] = JSON.parse(
      fs.readFileSync(canonicalPath, 'utf-8')
    );
    assert.strictEqual(
      rawData.length,
      531,
      `Raw JSON array length must be exactly 531, got ${rawData.length}`
    );

    const serviceCount = getFourxProductCount();
    assert.strictEqual(
      serviceCount,
      531,
      `Service getFourxProductCount() must return 531, got ${serviceCount}`
    );

    const catalogue = getFourxCatalogue();
    assert.strictEqual(
      catalogue.length,
      531,
      `Service getFourxCatalogue() array length must be 531, got ${catalogue.length}`
    );
  });

  test('Requirement: No duplicate or missing records in the canonical catalogue', () => {
    const catalogue = getFourxCatalogue();

    // 1. Check all 531 SKUs are completely unique (no duplicate SKUs)
    const skuSet = new Set<string>();
    const duplicateSkus: string[] = [];

    // 2. Check full serialized record uniqueness (no duplicate rows)
    const recordSet = new Set<string>();
    const duplicateRecords: number[] = [];

    catalogue.forEach((record, index) => {
      // Check SKU uniqueness
      if (skuSet.has(record.sku)) {
        duplicateSkus.push(`Index ${index}: SKU '${record.sku}'`);
      }
      skuSet.add(record.sku);

      // Check full record uniqueness
      const serialized = JSON.stringify(record);
      if (recordSet.has(serialized)) {
        duplicateRecords.push(index);
      }
      recordSet.add(serialized);

      // Verify no record slot is undefined or missing
      assert.ok(record !== undefined && record !== null, `Record at index ${index} must not be null/undefined`);
      assert.ok(record.sku && record.sku.trim().length > 0, `Record at index ${index} must have non-empty SKU`);
    });

    assert.strictEqual(
      duplicateSkus.length,
      0,
      `Catalogue must have zero duplicate SKUs, found: ${duplicateSkus.join(', ')}`
    );
    assert.strictEqual(
      skuSet.size,
      531,
      `Catalogue must have exactly 531 unique SKUs, got ${skuSet.size}`
    );
    assert.strictEqual(
      duplicateRecords.length,
      0,
      `Catalogue must have zero duplicate records, found duplicates at indices: ${duplicateRecords.join(', ')}`
    );
    assert.strictEqual(
      recordSet.size,
      531,
      `Catalogue must contain 531 unique record objects, got ${recordSet.size}`
    );
  });

  test('Requirement 3: All original fields and data types are preserved across all 531 records', () => {
    const catalogue = getFourxCatalogue();
    const coreFields: (keyof FourxProductRecord)[] = [
      'brand',
      'source_file',
      'source_page',
      'source_row',
      'base_code',
      'description',
      'package_qty',
      'outer_qty',
      'verification_status',
      'source_price_columns',
      'category',
      'sku',
    ];

    catalogue.forEach((record, index) => {
      // Check core fields presence and non-null
      for (const field of coreFields) {
        assert.ok(
          record[field] !== undefined && record[field] !== null,
          `Record at index ${index} (SKU: ${record.sku}) missing or null field: ${String(field)}`
        );
      }

      // Check specific types and valid values
      assert.strictEqual(
        typeof record.brand,
        'string',
        `Record ${index} brand must be string`
      );
      assert.ok(
        ['FOUR-X', 'FYBROS'].includes(record.brand),
        `Record ${index} brand must be 'FOUR-X' or 'FYBROS', got '${record.brand}'`
      );
      assert.strictEqual(
        typeof record.source_page,
        'number',
        `Record ${index} source_page must be number`
      );
      assert.strictEqual(
        typeof record.source_row,
        'number',
        `Record ${index} source_row must be number`
      );
      assert.strictEqual(
        typeof record.base_code,
        'string',
        `Record ${index} base_code must be string`
      );
      assert.strictEqual(
        typeof record.description,
        'string',
        `Record ${index} description must be string`
      );
      assert.strictEqual(
        typeof record.package_qty,
        'number',
        `Record ${index} package_qty must be number`
      );
      assert.strictEqual(
        typeof record.outer_qty,
        'number',
        `Record ${index} outer_qty must be number`
      );
      assert.ok(
        Array.isArray(record.source_price_columns),
        `Record ${index} source_price_columns must be array`
      );
      assert.ok(
        record.source_price_columns.length > 0,
        `Record ${index} source_price_columns must not be empty`
      );
    });
  });

  test('Specific record anchor checks: verify first, middle, and last records', () => {
    // Record 0: FX1101WH
    const first = getFourxProductByIndex(0);
    assert.ok(first, 'Record 0 must exist');
    assert.strictEqual(first?.base_code, 'FX1101');
    assert.strictEqual(first?.sku, 'FX1101WH');
    assert.strictEqual(first?.description, 'GRACE 10 AMP ONE WAY SWITCH 1M (WH)');
    assert.strictEqual(first?.package_qty, 20);
    assert.strictEqual(first?.outer_qty, 1000);
    assert.strictEqual(first?.variant, 'WHITE');
    assert.strictEqual(first?.category, 'switch_accessory');
    assert.strictEqual(first?.product_group, 'SWITCH');

    // Record 250: FX2520WH
    const mid = getFourxProductByIndex(250);
    assert.ok(mid, 'Record 250 must exist');
    assert.strictEqual(mid?.base_code, 'FX2520');
    assert.strictEqual(mid?.sku, 'FX2520WH');
    assert.strictEqual(mid?.description, 'GLAM 32 AMP DP SWITCH WITH INDICATOR 2M (WH)');
    assert.strictEqual(mid?.package_qty, 10);
    assert.strictEqual(mid?.outer_qty, 500);

    // Record 272: FYBROS metal box
    const fybrosRec = getFourxProductByIndex(272);
    assert.ok(fybrosRec, 'Record 272 must exist');
    assert.strictEqual(fybrosRec?.brand, 'FYBROS');
    assert.strictEqual(fybrosRec?.base_code, 'V5001');
    assert.strictEqual(fybrosRec?.sku, 'V5001AP');

    // Record 530: S918109F
    const last = getFourxProductByIndex(530);
    assert.ok(last, 'Record 530 must exist');
    assert.strictEqual(last?.base_code, 'S918109');
    assert.strictEqual(last?.sku, 'S918109F');
    assert.strictEqual(last?.description, '18M');
    assert.strictEqual(last?.package_qty, 5);
    assert.strictEqual(last?.outer_qty, 40);
    assert.strictEqual(last?.variant, 'FRAME');
    assert.strictEqual(last?.series, '9');
    assert.strictEqual(last?.category, 'modular_plate_or_frame');
  });

  test('Requirement 5: productMasterService safe lookups and indexes', () => {
    // SKU lookup
    const foundSku = getFourxProductBySku('FX1101WH');
    assert.ok(foundSku, 'SKU FX1101WH lookup should succeed');
    assert.strictEqual(foundSku?.description, 'GRACE 10 AMP ONE WAY SWITCH 1M (WH)');

    // Non-existent SKU lookup
    assert.strictEqual(
      getFourxProductBySku('NON_EXISTENT_SKU'),
      undefined,
      'Invalid SKU should return undefined safely'
    );

    // Base code lookup
    const baseProducts = getFourxProductsByBaseCode('FX1101');
    assert.ok(
      baseProducts.length >= 1,
      'Base code FX1101 should return at least 1 variant'
    );
    assert.strictEqual(baseProducts[0].base_code, 'FX1101');

    // Non-existent base code
    const emptyBase = getFourxProductsByBaseCode('INVALID_BASE');
    assert.deepStrictEqual(emptyBase, [], 'Invalid base code should return empty array');

    // Categories
    const categories = getFourxCategories();
    assert.ok(categories.length > 0, 'Categories list must be populated');
    assert.ok(categories.includes('switch_accessory'));
    assert.ok(categories.includes('modular_plate_or_frame'));

    // Product groups
    const groups = getFourxProductGroups();
    assert.ok(groups.length > 0, 'Product groups list must be populated');
    assert.ok(groups.includes('SWITCH'));
    assert.ok(groups.includes('PLATES'));

    // verifyCatalogueIntegrity helper
    const integrity = verifyCatalogueIntegrity();
    assert.strictEqual(integrity.isValid, true);
    assert.strictEqual(integrity.totalRecords, 531);
    assert.strictEqual(integrity.expectedCount, 531);
    assert.strictEqual(integrity.errors.length, 0);
  });

  test('Immutability guarantee: catalogue records cannot be mutated in place', () => {
    const catalogue = getFourxCatalogue();
    assert.ok(Object.isFrozen(catalogue), 'Catalogue array must be frozen');
    assert.ok(Object.isFrozen(catalogue[0]), 'Individual catalogue records must be frozen');

    assert.throws(
      () => {
        (catalogue[0] as unknown as Record<string, string>).brand = 'MUTATED';
      },
      /TypeError/,
      'Mutating a frozen catalogue record must throw TypeError'
    );
  });
});
