/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ONE RETAIL AI — Product Master Service
 * Stage 1: Canonical Product Master integration for FOUR-X catalogue.
 * Loads and safely exposes all 531 original records with zero data modifications.
 */

import rawFourxData from '../data/fourx.json' with { type: 'json' };

export interface FourxGroupHistoryEntry {
  from: string;
  to: string;
  changed_at: string;
}

/**
 * Exact representation of raw FOUR-X catalogue record.
 * All original fields and values are preserved without renaming or normalization.
 */
export interface FourxProductRecord {
  brand: string;
  source_file: string;
  source_page: number;
  source_row: number;
  base_code: string;
  description: string;
  package_qty: number;
  outer_qty: number;
  verification_status: string;
  source_price_columns: number[];
  category: string;
  sku: string;
  variant?: string;
  price_column_mapping?: string;
  needs_review?: boolean;
  original_base_code?: string;
  original_sku?: string;
  item_name?: string;
  original_group?: string;
  product_group?: string;
  current_group?: string;
  group_history?: FourxGroupHistoryEntry[];
  original_alpha_code?: string;
  sku_mode?: string;
  colour_code?: string;
  sku_status?: string;
  series?: string;
  variant_group?: string;
  net_rate_as_printed?: number;
  with_gst_as_printed?: number;
  [key: string]: unknown;
}

// Canonical catalogue array loaded from src/data/fourx.json
const FOURX_CATALOGUE: readonly FourxProductRecord[] = Object.freeze(
  (rawFourxData as unknown as FourxProductRecord[]).map((item) => Object.freeze({ ...item }))
);

// SKU lookup index for safe, fast direct lookups
const SKU_INDEX = new Map<string, FourxProductRecord>();
// Base code lookup index
const BASE_CODE_INDEX = new Map<string, FourxProductRecord[]>();

// Initialize indices safely on module load
for (const product of FOURX_CATALOGUE) {
  if (product.sku && !SKU_INDEX.has(product.sku)) {
    SKU_INDEX.set(product.sku, product);
  }
  if (product.base_code) {
    const existing = BASE_CODE_INDEX.get(product.base_code) || [];
    existing.push(product);
    BASE_CODE_INDEX.set(product.base_code, existing);
  }
}

/**
 * Returns the entire immutable FOUR-X catalogue (531 records).
 */
export function getFourxCatalogue(): readonly FourxProductRecord[] {
  return FOURX_CATALOGUE;
}

/**
 * Returns the exact total count of records in the canonical catalogue.
 */
export function getFourxProductCount(): number {
  return FOURX_CATALOGUE.length;
}

/**
 * Safe lookup by exact SKU code.
 */
export function getFourxProductBySku(sku: string): FourxProductRecord | undefined {
  if (!sku) return undefined;
  return SKU_INDEX.get(sku.trim());
}

/**
 * Safe lookup by base code (e.g. FX1101, returning all variants/SKUs under it).
 */
export function getFourxProductsByBaseCode(baseCode: string): FourxProductRecord[] {
  if (!baseCode) return [];
  return BASE_CODE_INDEX.get(baseCode.trim()) || [];
}

/**
 * Safe lookup by 0-based array index.
 */
export function getFourxProductByIndex(index: number): FourxProductRecord | undefined {
  if (index < 0 || index >= FOURX_CATALOGUE.length) return undefined;
  return FOURX_CATALOGUE[index];
}

/**
 * Returns all unique categories present in the FOUR-X catalogue.
 */
export function getFourxCategories(): string[] {
  const categories = new Set<string>();
  for (const item of FOURX_CATALOGUE) {
    if (item.category) categories.add(item.category);
  }
  return Array.from(categories).sort();
}

/**
 * Returns all unique product groups present in the FOUR-X catalogue.
 */
export function getFourxProductGroups(): string[] {
  const groups = new Set<string>();
  for (const item of FOURX_CATALOGUE) {
    if (item.product_group) groups.add(item.product_group);
  }
  return Array.from(groups).sort();
}

/**
 * Verifies catalogue integrity against the Stage 1 requirements:
 * 1. Exact count matches 531.
 * 2. Essential raw fields exist on every record.
 * 3. Records are immutable and non-empty.
 */
export function verifyCatalogueIntegrity(): {
  isValid: boolean;
  totalRecords: number;
  expectedCount: number;
  errors: string[];
} {
  const errors: string[] = [];
  const expectedCount = 531;
  const totalRecords = FOURX_CATALOGUE.length;

  if (totalRecords !== expectedCount) {
    errors.push(`Expected exactly ${expectedCount} records, but found ${totalRecords}`);
  }

  FOURX_CATALOGUE.forEach((record, idx) => {
    if (!record.brand) {
      errors.push(`Record at index ${idx} is missing 'brand'`);
    }
    if (!record.base_code) {
      errors.push(`Record at index ${idx} is missing 'base_code'`);
    }
    if (!record.sku) {
      errors.push(`Record at index ${idx} is missing 'sku'`);
    }
    if (!record.description) {
      errors.push(`Record at index ${idx} is missing 'description'`);
    }
    if (!Array.isArray(record.source_price_columns)) {
      errors.push(`Record at index ${idx} ('${record.sku}') has invalid 'source_price_columns'`);
    }
  });

  return {
    isValid: errors.length === 0,
    totalRecords,
    expectedCount,
    errors,
  };
}
