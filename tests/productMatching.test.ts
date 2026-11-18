/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ONE RETAIL AI — Stage 2: Product Matching & Search Engine Tests
 * Comprehensive test suite verifying all 16 required search criteria
 * against the actual 531-record canonical FOUR-X catalogue.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  searchProducts,
  findProductByCode,
  findExactProduct,
  getProductMatchDetails,
  normalizeSearchText,
  getProductById,
  getProductBySku,
  getProductsByBaseCode,
  getSearchIndexStats,
} from '../src/services/productMatchingService.ts';

import {
  getFourxCatalogue,
  getFourxProductCount,
} from '../src/services/productMasterService.ts';

describe('ONE RETAIL AI — Product Matching & Search Engine (Stage 2)', () => {
  // Test 1: Exact SKU lookup
  test('1. Exact SKU lookup returns exact product with score 100', () => {
    const results = searchProducts('FX1101WH');
    assert.ok(results.length > 0, 'Must return results for FX1101WH');
    assert.strictEqual(results[0].product.sku, 'FX1101WH');
    assert.strictEqual(results[0].score, 100);
    assert.strictEqual(results[0].matchType, 'EXACT_SKU');
    assert.strictEqual(results[0].confidence, 'VERY_HIGH');
    assert.strictEqual(
      results[0].product.description,
      'GRACE 10 AMP ONE WAY SWITCH 1M (WH)'
    );

    // Direct helper check
    const direct = getProductBySku('FX1101WH');
    assert.ok(direct, 'Direct getProductBySku must return product');
    assert.strictEqual(direct?.sku, 'FX1101WH');
  });

  // Test 2: Exact product code / base code lookup
  test('2. Exact product code / base code lookup returns all variants', () => {
    const baseCode = 'FX1101';
    const variants = getProductsByBaseCode(baseCode);
    assert.strictEqual(
      variants.length,
      2,
      'Base code FX1101 has 2 variants (WH and WHCR)'
    );
    const skus = variants.map((v) => v.sku);
    assert.ok(skus.includes('FX1101WH'));
    assert.ok(skus.includes('FX1101WHCR'));

    const searchResults = searchProducts('FX1101');
    assert.ok(searchResults.length >= 2, 'Search must return variants for base code');
    assert.strictEqual(searchResults[0].matchType, 'EXACT_BASE_CODE');
    assert.strictEqual(searchResults[0].confidence, 'VERY_HIGH');
    assert.ok(searchResults[0].score >= 96);
  });

  // Test 3: Exact description lookup
  test('3. Exact description lookup matches full description', () => {
    const desc = 'GRACE 10 AMP ONE WAY SWITCH 1M (WH)';
    const results = searchProducts(desc);
    assert.ok(results.length > 0, 'Must match exact description');
    assert.strictEqual(results[0].product.description, desc);
    assert.strictEqual(results[0].matchType, 'EXACT_DESCRIPTION');
    assert.strictEqual(results[0].score, 95);
    assert.strictEqual(results[0].confidence, 'VERY_HIGH');

    // findExactProduct helper
    const exact = findExactProduct(desc);
    assert.ok(exact, 'findExactProduct must return matching product');
    assert.strictEqual(exact?.description, desc);
  });

  // Test 4: Case-insensitive search
  test('4. Case-insensitive search behaves identically', () => {
    const lowerResults = searchProducts('fx1101wh');
    const upperResults = searchProducts('FX1101WH');
    const mixedResults = searchProducts('Fx1101Wh');

    assert.strictEqual(lowerResults[0].product.sku, 'FX1101WH');
    assert.strictEqual(upperResults[0].product.sku, 'FX1101WH');
    assert.strictEqual(mixedResults[0].product.sku, 'FX1101WH');
    assert.strictEqual(lowerResults[0].score, 100);
    assert.strictEqual(mixedResults[0].score, 100);
  });

  // Test 5: Different word order
  test('5. Different word order produces high-confidence matches', () => {
    const queryA = '10 amp white grace switch 1m';
    const queryB = 'white grace 1m switch 10 amp';

    const resultsA = searchProducts(queryA);
    const resultsB = searchProducts(queryB);

    assert.ok(resultsA.length > 0, 'Query A must return results');
    assert.ok(resultsB.length > 0, 'Query B must return results');
    assert.strictEqual(resultsA[0].product.sku, 'FX1101WH');
    assert.strictEqual(resultsB[0].product.sku, 'FX1101WH');
    assert.strictEqual(resultsA[0].matchType, 'TOKEN_ALL');
    assert.strictEqual(resultsB[0].matchType, 'TOKEN_ALL');
    assert.strictEqual(resultsA[0].confidence, 'HIGH');
    assert.strictEqual(resultsB[0].confidence, 'HIGH');
  });

  // Test 6: Partial word search
  test('6. Partial word search successfully retrieves matches', () => {
    const results = searchProducts('regulat');
    assert.ok(results.length > 0, 'Must match regulators for partial word "regulat"');
    const hasRegulator = results.some((r) =>
      r.product.description.toUpperCase().includes('REGULATOR') ||
      r.product.product_group?.toUpperCase().includes('REGULATOR')
    );
    assert.ok(hasRegulator, 'Results must include regulator products');
  });

  // Test 7: Minor spelling mistakes (Fuzzy matching)
  test('7. Minor spelling mistakes match expected products', () => {
    // "glamm" instead of "glam"
    const results = searchProducts('glamm 32 amp');
    assert.ok(results.length > 0, 'Typo query "glamm 32 amp" must return results');
    assert.strictEqual(results[0].product.sku, 'FX2520WH');
    assert.ok(
      results[0].product.description.includes('GLAM'),
      'Must match GLAM product'
    );
    assert.ok(results[0].score >= 60, 'Fuzzy match score must be >= 60');

    // "swithc" instead of "switch"
    const switchResults = searchProducts('grace swithc');
    assert.ok(switchResults.length > 0, 'Typo query "grace swithc" must return results');
    assert.ok(
      switchResults[0].product.description.includes('SWITCH') ||
      switchResults[0].product.product_group === 'SWITCH'
    );
  });

  // Test 8: OCR-style code input with surrounding text
  test('8. OCR-style code input extracts SKU code from surrounding noise', () => {
    const ocrSample = 'ITEM PACKAGING OCR: FX-1101-WH (WHITE) BATCH#8892';
    const results = searchProducts(ocrSample);
    assert.ok(results.length > 0, 'OCR text must yield matches');
    assert.strictEqual(results[0].product.sku, 'FX1101WH');
    assert.strictEqual(results[0].matchType, 'OCR_EMBEDDED_SKU');
    assert.strictEqual(results[0].confidence, 'VERY_HIGH');
    assert.strictEqual(results[0].score, 98);
  });

  // Test 9: Multiple matching variants (Base code S30111)
  test('9. Multiple matching variants returned without merging', () => {
    const results = searchProducts('S30111');
    assert.strictEqual(results.length, 3, 'S30111 has exactly 3 variants');

    const variantNames = results.map((r) => r.product.variant);
    assert.ok(variantNames.includes('PURE WHITE'));
    assert.ok(variantNames.includes('CHROME'));
    assert.ok(variantNames.includes('MAPPLE WOOD'));

    // Verify all SKUs are distinct
    const skus = new Set(results.map((r) => r.product.sku));
    assert.strictEqual(skus.size, 3, 'All 3 variants must retain distinct SKUs');
  });

  // Test 10: Ambiguous results
  test('10. Ambiguous query returns multiple scored candidates without auto-selection', () => {
    const results = searchProducts('10 amp switch');
    assert.ok(results.length > 5, 'Generic query must return multiple candidates');
    // Ensure results are not collapsed to 1 and each has authentic description
    results.forEach((r) => {
      assert.ok(r.product.sku, 'Candidate must have SKU');
      assert.ok(r.product.description, 'Candidate must have original description');
    });
  });

  // Test 11: Empty search input
  test('11. Empty search input returns empty array', () => {
    assert.deepStrictEqual(searchProducts(''), []);
    assert.deepStrictEqual(searchProducts('   '), []);
    assert.deepStrictEqual(searchProducts(null as unknown as string), []);
    assert.deepStrictEqual(searchProducts(undefined as unknown as string), []);
  });

  // Test 12: No-result query
  test('12. No-result query returns empty array under default threshold', () => {
    const results = searchProducts('XYZNONEXISTENTCODE999888777');
    assert.strictEqual(results.length, 0);

    const details = getProductMatchDetails('XYZNONEXISTENTCODE999888777');
    assert.strictEqual(details, undefined);
  });

  // Test 13: Search result ranking
  test('13. Search result ranking: Exact SKU > Exact Base Code > Token All > Fuzzy', () => {
    const skuHit = searchProducts('FX1101WH')[0];
    const baseHit = searchProducts('FX1101')[0];
    const tokenHit = searchProducts('grace 10 amp switch')[0];
    const fuzzyHit = searchProducts('glamm 32 amp')[0];

    assert.ok(skuHit.score >= baseHit.score, 'Exact SKU score >= Base code score');
    assert.ok(baseHit.score >= tokenHit.score, 'Base code score >= Token score');
    assert.ok(tokenHit.score >= fuzzyHit.score, 'Token score >= Fuzzy score');
  });

  // Test 14: Original catalogue description preservation
  test('14. Original catalogue description is preserved exactly as stored', () => {
    const product = findProductByCode('FX1101WH');
    assert.ok(product, 'Product must be found');
    assert.strictEqual(
      product?.description,
      'GRACE 10 AMP ONE WAY SWITCH 1M (WH)',
      'Description must be preserved exactly with uppercase and parentheses'
    );

    const plate = findProductByCode('S918109F');
    assert.ok(plate, 'Plate must be found');
    assert.strictEqual(
      plate?.description,
      '18M',
      'Plate description must be preserved exactly as stored'
    );
  });

  // Test 15: No mutation of original catalogue records
  test('15. No mutation of original catalogue records during search execution', () => {
    const catalogueBefore = getFourxCatalogue();
    const originalRecord = catalogueBefore[0];

    // Run multiple varied searches
    searchProducts('FX1101WH');
    searchProducts('glamm 32 amp');
    searchProducts('10 amp white switch');
    searchProducts('OCR TEST STRING 12345');

    const catalogueAfter = getFourxCatalogue();
    assert.strictEqual(catalogueBefore.length, 531);
    assert.strictEqual(catalogueAfter.length, 531);

    // Verify first record properties unchanged
    assert.strictEqual(catalogueAfter[0].sku, originalRecord.sku);
    assert.strictEqual(catalogueAfter[0].description, originalRecord.description);
    assert.strictEqual(catalogueAfter[0].package_qty, originalRecord.package_qty);
    assert.ok(Object.isFrozen(catalogueAfter[0]), 'Records remain strictly frozen');
  });

  // Test 16: Search index covers all 531 records
  test('16. Search index covers all 531 records', () => {
    const stats = getSearchIndexStats();
    assert.strictEqual(
      stats.totalIndexed,
      531,
      `Expected 531 indexed records, got ${stats.totalIndexed}`
    );
    assert.strictEqual(
      stats.uniqueSkus,
      531,
      `Expected 531 unique indexed SKUs, got ${stats.uniqueSkus}`
    );
    assert.strictEqual(
      stats.uniqueBaseCodes,
      244,
      `Expected 244 unique base codes, got ${stats.uniqueBaseCodes}`
    );
  });
});
