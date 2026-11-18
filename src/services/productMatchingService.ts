/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ONE RETAIL AI — Product Matching & Search Engine
 * Stage 2: Local-first, deterministic, offline product matching service.
 * 
 * Operates purely on the canonical FOUR-X catalogue (src/data/fourx.json).
 * Does not require external network requests, Gemini API calls, or database servers.
 * Preserves canonical records in their exact raw state without mutation.
 */

import {
  getFourxCatalogue,
  type FourxProductRecord,
} from './productMasterService.ts';

/**
 * Match confidence classification.
 * - VERY_HIGH: 95-100 (Exact SKU, OCR embedded code, exact base code, or exact full description)
 * - HIGH:      80-94  (All search tokens matched across product attributes)
 * - POSSIBLE:  60-79  (Majority of tokens matched or partial token match)
 * - LOW:       < 60   (Weak match, filtered out by default unless minScore is set lower)
 */
export type MatchConfidence = 'VERY_HIGH' | 'HIGH' | 'POSSIBLE' | 'LOW';

/**
 * Matching tier / rule that produced the match.
 */
export type MatchType =
  | 'EXACT_SKU'
  | 'OCR_EMBEDDED_SKU'
  | 'EXACT_BASE_CODE'
  | 'EXACT_DESCRIPTION'
  | 'TOKEN_ALL'
  | 'TOKEN_PARTIAL'
  | 'FUZZY';

/**
 * Search options configuring result limits and thresholds.
 */
export interface SearchOptions {
  limit?: number;
  minScore?: number;
  includeAllVariants?: boolean;
  categoryFilter?: string;
  productGroupFilter?: string;
}

/**
 * Detailed search result for a matched product.
 */
export interface SearchResult {
  product: FourxProductRecord;
  score: number;
  confidence: MatchConfidence;
  matchType: MatchType;
  matchedFields: string[];
  explanation: string;
}

/**
 * Internal index structure holding pre-computed token sets and normalized text.
 * The original FourxProductRecord remains immutable and untouched.
 */
interface IndexedProduct {
  original: FourxProductRecord;
  rawSku: string;
  cleanSku: string;
  rawBaseCode: string;
  cleanBaseCode: string;
  normalizedDesc: string;
  normalizedItemName: string;
  variant: string;
  category: string;
  productGroup: string;
  series?: string;
  tokenSet: Set<string>;
  tokenList: string[];
  searchableText: string;
}

// -----------------------------------------------------------------------------
// Normalization & Helper Utilities
// -----------------------------------------------------------------------------

/**
 * Converts search text into a clean, normalized string:
 * 1. Lowercase.
 * 2. Unnecessary punctuation converted to spaces.
 * 3. Multiple spaces collapsed.
 * 4. Leading/trailing whitespace trimmed.
 * Does not alter the original catalogue data.
 */
export function normalizeSearchText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/['"`,/\\()[\]{}:;*#+=_~|]/g, ' ')
    .replace(/[-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes product codes/SKUs for comparison:
 * Strips whitespace, hyphens, and underscores for direct alphanumeric checks.
 */
export function normalizeCode(code: string): string {
  if (!code) return '';
  return code.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Domain-aware electrical token normalizer.
 * Handles common electrical terminology synonyms safely without altering original data:
 * - 10a / 10amp -> 10 amp
 * - 16a / 16amp -> 16 amp
 * - 20a / 20amp -> 20 amp
 * - 25a / 25amp -> 25 amp
 * - 32a / 32amp -> 32 amp
 * - 1way / 1 way / one way
 * - 2way / 2 way / two way
 * - dp / double pole
 */
function expandElectricalSynonyms(tokens: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    // Normalize amp shorthands (e.g. 10a -> 10, amp)
    const ampMatch = t.match(/^(\d+)(a|amp|amps)$/);
    if (ampMatch) {
      result.push(ampMatch[1]);
      result.push('amp');
      continue;
    }

    // Normalize module shorthands (e.g. 1m -> 1m, module)
    const modMatch = t.match(/^(\d+)(m)$/);
    if (modMatch) {
      result.push(t);
      result.push('module');
      continue;
    }

    // Normalize one-way / two-way
    if (t === '1way') {
      result.push('one');
      result.push('way');
      continue;
    }
    if (t === '2way') {
      result.push('two');
      result.push('way');
      continue;
    }

    result.push(t);
  }
  return result;
}

/**
 * Tokenizes text into unique search terms, expanding electrical synonyms.
 */
function tokenizeText(text: string): string[] {
  const normalized = normalizeSearchText(text);
  if (!normalized) return [];
  const rawTokens = normalized.split(/\s+/).filter(Boolean);
  return expandElectricalSynonyms(rawTokens);
}

/**
 * Lightweight, deterministic Levenshtein distance for fuzzy matching typos.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 3) return 999;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/**
 * Calculates similarity between two single tokens (0.0 to 1.0).
 */
function tokenSimilarity(tokA: string, tokB: string): number {
  if (tokA === tokB) return 1.0;
  if (tokA.length <= 2 || tokB.length <= 2) return 0;
  const dist = levenshteinDistance(tokA, tokB);
  if (dist === 1 && Math.max(tokA.length, tokB.length) >= 4) return 0.85;
  if (dist === 2 && Math.max(tokA.length, tokB.length) >= 6) return 0.70;
  return 0;
}

/**
 * Extracts candidate code tokens from OCR or noisy text (e.g. "ITEM: FX-1101-WH BATCH: 2026").
 */
function extractCandidateCodes(text: string): string[] {
  if (!text) return [];
  const rawMatches = text.match(/[A-Za-z0-9\-_]{3,18}/g) || [];
  const cleanList = rawMatches.map(normalizeCode).filter((c) => c.length >= 3);
  return Array.from(new Set(cleanList));
}

// -----------------------------------------------------------------------------
// In-Memory Search Index
// -----------------------------------------------------------------------------

interface SearchIndex {
  allIndexed: IndexedProduct[];
  skuExactMap: Map<string, IndexedProduct>;
  cleanSkuMap: Map<string, IndexedProduct>;
  baseCodeMap: Map<string, IndexedProduct[]>;
  cleanBaseCodeMap: Map<string, IndexedProduct[]>;
  normalizedDescMap: Map<string, IndexedProduct>;
  normalizedItemNameMap: Map<string, IndexedProduct>;
}

let searchIndex: SearchIndex | null = null;

/**
 * Initializes or returns the pre-computed in-memory search index.
 * Indexing covers all 531 records from the canonical catalogue.
 */
function getSearchIndex(): SearchIndex {
  if (searchIndex) return searchIndex;

  const rawCatalogue = getFourxCatalogue();
  const allIndexed: IndexedProduct[] = [];
  const skuExactMap = new Map<string, IndexedProduct>();
  const cleanSkuMap = new Map<string, IndexedProduct>();
  const baseCodeMap = new Map<string, IndexedProduct[]>();
  const cleanBaseCodeMap = new Map<string, IndexedProduct[]>();
  const normalizedDescMap = new Map<string, IndexedProduct>();
  const normalizedItemNameMap = new Map<string, IndexedProduct>();

  for (const item of rawCatalogue) {
    const rawSku = (item.sku || '').trim();
    const cleanSku = normalizeCode(rawSku);
    const rawBase = (item.base_code || '').trim();
    const cleanBase = normalizeCode(rawBase);
    const normalizedDesc = normalizeSearchText(item.description || '');
    const normalizedItemName = normalizeSearchText(item.item_name || '');
    const variant = normalizeSearchText(item.variant || '');
    const category = normalizeSearchText(item.category || '');
    const productGroup = normalizeSearchText(item.product_group || '');
    const series = item.series ? `series ${item.series}` : '';

    const textToTokenize = [
      rawSku,
      rawBase,
      normalizedDesc,
      normalizedItemName,
      variant,
      category,
      productGroup,
      series,
      item.colour_code || '',
      item.brand || '',
    ].join(' ');

    const tokenList = tokenizeText(textToTokenize);
    const tokenSet = new Set<string>(tokenList);

    const indexed: IndexedProduct = {
      original: item,
      rawSku,
      cleanSku,
      rawBaseCode: rawBase,
      cleanBaseCode: cleanBase,
      normalizedDesc,
      normalizedItemName,
      variant: item.variant || '',
      category: item.category || '',
      productGroup: item.product_group || '',
      series: item.series ? String(item.series) : undefined,
      tokenSet,
      tokenList,
      searchableText: textToTokenize.toLowerCase(),
    };

    allIndexed.push(indexed);

    // Exact SKU maps
    if (rawSku && !skuExactMap.has(rawSku.toUpperCase())) {
      skuExactMap.set(rawSku.toUpperCase(), indexed);
    }
    if (cleanSku && !cleanSkuMap.has(cleanSku)) {
      cleanSkuMap.set(cleanSku, indexed);
    }

    // Base code maps (one base code can have multiple SKUs / variants)
    if (rawBase) {
      const baseKey = rawBase.toUpperCase();
      const list = baseCodeMap.get(baseKey) || [];
      list.push(indexed);
      baseCodeMap.set(baseKey, list);
    }
    if (cleanBase) {
      const list = cleanBaseCodeMap.get(cleanBase) || [];
      list.push(indexed);
      cleanBaseCodeMap.set(cleanBase, list);
    }

    // Exact description maps
    if (normalizedDesc && !normalizedDescMap.has(normalizedDesc)) {
      normalizedDescMap.set(normalizedDesc, indexed);
    }
    if (normalizedItemName && !normalizedItemNameMap.has(normalizedItemName)) {
      normalizedItemNameMap.set(normalizedItemName, indexed);
    }
  }

  searchIndex = {
    allIndexed,
    skuExactMap,
    cleanSkuMap,
    baseCodeMap,
    cleanBaseCodeMap,
    normalizedDescMap,
    normalizedItemNameMap,
  };

  return searchIndex;
}

/**
 * Returns statistics about the search index for diagnostic / testing verification.
 */
export function getSearchIndexStats(): {
  totalIndexed: number;
  uniqueSkus: number;
  uniqueBaseCodes: number;
} {
  const idx = getSearchIndex();
  return {
    totalIndexed: idx.allIndexed.length,
    uniqueSkus: idx.cleanSkuMap.size,
    uniqueBaseCodes: idx.cleanBaseCodeMap.size,
  };
}

// -----------------------------------------------------------------------------
// Core Public Search & Matching Functions
// -----------------------------------------------------------------------------

/**
 * Searches the canonical catalogue using the 5-level tiered matching algorithm.
 * Deterministic, offline, and preserves raw catalogue records.
 */
export function searchProducts(
  query: string,
  options?: SearchOptions
): SearchResult[] {
  const trimmed = (query || '').trim();
  if (!trimmed) {
    return [];
  }

  const {
    limit = 20,
    minScore = 60,
    categoryFilter,
    productGroupFilter,
  } = options || {};

  const index = getSearchIndex();
  const normalizedQuery = normalizeSearchText(trimmed);
  const cleanQueryCode = normalizeCode(trimmed);
  const queryTokens = tokenizeText(trimmed);

  const resultMap = new Map<string, SearchResult>();

  // Helper to add or keep the highest score for a product
  const recordResult = (
    indexed: IndexedProduct,
    score: number,
    confidence: MatchConfidence,
    matchType: MatchType,
    matchedFields: string[],
    explanation: string
  ) => {
    // Apply filters if specified
    if (categoryFilter && indexed.original.category !== categoryFilter) {
      return;
    }
    if (productGroupFilter && indexed.original.product_group !== productGroupFilter) {
      return;
    }

    const skuKey = indexed.original.sku;
    const existing = resultMap.get(skuKey);
    if (!existing || score > existing.score) {
      resultMap.set(skuKey, {
        product: indexed.original,
        score,
        confidence,
        matchType,
        matchedFields,
        explanation,
      });
    }
  };

  // ---------------------------------------------------------------------------
  // LEVEL 1: Exact SKU / Product Code Matching (Highest Priority)
  // ---------------------------------------------------------------------------

  // 1A. Exact SKU match (e.g. "FX1101WH", "fx-1101-wh")
  const exactSkuHit =
    index.skuExactMap.get(trimmed.toUpperCase()) ||
    index.cleanSkuMap.get(cleanQueryCode);

  if (exactSkuHit) {
    recordResult(
      exactSkuHit,
      100,
      'VERY_HIGH',
      'EXACT_SKU',
      ['sku'],
      `Exact SKU match: '${exactSkuHit.original.sku}'`
    );
  }

  // 1B. OCR-embedded SKU Extraction
  // When the query contains surrounding text (e.g. "ITEM: FX1101WH BATCH#99")
  if (!exactSkuHit && trimmed.length > 5) {
    const candidateCodes = extractCandidateCodes(trimmed);
    for (const cand of candidateCodes) {
      const hit = index.cleanSkuMap.get(cand);
      if (hit) {
        recordResult(
          hit,
          98,
          'VERY_HIGH',
          'OCR_EMBEDDED_SKU',
          ['sku'],
          `Detected SKU '${hit.original.sku}' within input text`
        );
      }
    }
  }

  // 1C. Exact Base Code Match (e.g. "FX1101" -> matches all variants under FX1101)
  const baseHits =
    index.baseCodeMap.get(trimmed.toUpperCase()) ||
    index.cleanBaseCodeMap.get(cleanQueryCode);

  if (baseHits && baseHits.length > 0) {
    for (const item of baseHits) {
      // Check if query also specified a variant (e.g. "FX1101 Chrome")
      let variantBonus = 0;
      let matchedVariant = false;
      if (item.variant && normalizedQuery.includes(item.variant.toLowerCase())) {
        variantBonus = 2; // boosts to 98
        matchedVariant = true;
      }
      const score = Math.min(98, 96 + variantBonus);
      recordResult(
        item,
        score,
        'VERY_HIGH',
        'EXACT_BASE_CODE',
        matchedVariant ? ['base_code', 'variant'] : ['base_code'],
        `Exact base code match for '${item.original.base_code}'${
          item.original.variant ? ` (Variant: ${item.original.variant})` : ''
        }`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // LEVEL 2: Exact Description or Item Name Match
  // ---------------------------------------------------------------------------

  const exactDescHit = index.normalizedDescMap.get(normalizedQuery);
  if (exactDescHit) {
    recordResult(
      exactDescHit,
      95,
      'VERY_HIGH',
      'EXACT_DESCRIPTION',
      ['description'],
      `Exact description match: '${exactDescHit.original.description}'`
    );
  }

  const exactItemNameHit = index.normalizedItemNameMap.get(normalizedQuery);
  if (exactItemNameHit) {
    recordResult(
      exactItemNameHit,
      95,
      'VERY_HIGH',
      'EXACT_DESCRIPTION',
      ['item_name'],
      `Exact item name match: '${exactItemNameHit.original.item_name}'`
    );
  }

  // ---------------------------------------------------------------------------
  // LEVEL 3, 4, 5: Token-Based, Partial & Fuzzy Matching Across All Records
  // ---------------------------------------------------------------------------

  // If the query is a single code token that already produced an exact SKU or exact base code match,
  // we do not pollute the result set with weak fuzzy mutations of other product codes.
  const isPureExactCodeQuery =
    queryTokens.length <= 1 && (exactSkuHit !== undefined || (baseHits && baseHits.length > 0));

  if (queryTokens.length > 0 && !isPureExactCodeQuery) {
    for (const item of index.allIndexed) {
      let matchedTokensCount = 0;
      let partialTokensCount = 0;
      let fuzzyTokensCount = 0;
      const matchedFieldNames = new Set<string>();

      for (const qToken of queryTokens) {
        if (item.tokenSet.has(qToken)) {
          matchedTokensCount++;
          // Identify matched field
          if (item.rawSku.toLowerCase().includes(qToken)) matchedFieldNames.add('sku');
          if (item.rawBaseCode.toLowerCase().includes(qToken)) matchedFieldNames.add('base_code');
          if (item.normalizedDesc.includes(qToken)) matchedFieldNames.add('description');
          if (item.variant && item.variant.toLowerCase().includes(qToken)) matchedFieldNames.add('variant');
          if (item.productGroup && item.productGroup.toLowerCase().includes(qToken)) matchedFieldNames.add('product_group');
          continue;
        }

        // Check partial prefix/substring match in token list
        const partialHit = item.tokenList.some(
          (t) => (t.startsWith(qToken) && qToken.length >= 3) || (qToken.startsWith(t) && t.length >= 3)
        );
        if (partialHit) {
          partialTokensCount++;
          matchedFieldNames.add('partial_term');
          continue;
        }

        // Check fuzzy match
        const fuzzyHit = item.tokenList.some((t) => tokenSimilarity(qToken, t) >= 0.7);
        if (fuzzyHit) {
          fuzzyTokensCount++;
          matchedFieldNames.add('fuzzy_term');
          continue;
        }
      }

      const totalMatched = matchedTokensCount + partialTokensCount * 0.75 + fuzzyTokensCount * 0.5;
      const matchRatio = totalMatched / queryTokens.length;

      // Level 3: Token-All Match (All query tokens satisfied)
      if (matchedTokensCount === queryTokens.length && queryTokens.length >= 1) {
        // Base score: 85 to 94 depending on query length and token richness
        const lengthFactor = Math.min(6, queryTokens.length);
        const score = 85 + lengthFactor + (item.rawSku.toLowerCase().includes(normalizedQuery) ? 3 : 0);
        recordResult(
          item,
          Math.min(94, score),
          'HIGH',
          'TOKEN_ALL',
          Array.from(matchedFieldNames),
          `All ${queryTokens.length} search terms matched product attributes`
        );
      }
      // Level 4: Partial Token Match (High ratio of query tokens matched)
      else if (matchRatio >= 0.60 && queryTokens.length >= 2) {
        const score = Math.round(62 + matchRatio * 17); // 62 - 79
        const confidence: MatchConfidence = score >= 80 ? 'HIGH' : 'POSSIBLE';
        recordResult(
          item,
          score,
          confidence,
          'TOKEN_PARTIAL',
          Array.from(matchedFieldNames),
          `Partial token match (${matchedTokensCount} exact, ${partialTokensCount} partial of ${queryTokens.length} terms)`
        );
      }
      // Single token partial match for queries with length >= 4 (e.g. "regulat" for "regulator")
      else if (queryTokens.length === 1 && (partialTokensCount === 1 || matchedTokensCount === 1)) {
        const score = matchedTokensCount === 1 ? 82 : 68;
        const confidence: MatchConfidence = score >= 80 ? 'HIGH' : 'POSSIBLE';
        recordResult(
          item,
          score,
          confidence,
          matchedTokensCount === 1 ? 'TOKEN_ALL' : 'TOKEN_PARTIAL',
          Array.from(matchedFieldNames),
          `Term '${queryTokens[0]}' matched product catalogue`
        );
      }
      // Level 5: Fuzzy Match (e.g. minor typo "glamm" -> "glam")
      else if (fuzzyTokensCount >= 1 && (fuzzyTokensCount + matchedTokensCount) / queryTokens.length >= 0.6) {
        const score = Math.min(74, Math.round(60 + matchRatio * 14));
        recordResult(
          item,
          score,
          'POSSIBLE',
          'FUZZY',
          Array.from(matchedFieldNames),
          `Fuzzy spelling match for query terms`
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Sorting, Threshold Filtering & Result Limiting
  // ---------------------------------------------------------------------------

  const filtered = Array.from(resultMap.values())
    .filter((res) => res.score >= minScore)
    .sort((a, b) => {
      // Primary: Score descending
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // Secondary: Prioritize exact SKU/code over fuzzy
      if (a.matchType === 'EXACT_SKU' && b.matchType !== 'EXACT_SKU') return -1;
      if (b.matchType === 'EXACT_SKU' && a.matchType !== 'EXACT_SKU') return 1;
      // Tertiary: Deterministic alphabetical sort by SKU
      return a.product.sku.localeCompare(b.product.sku);
    });

  return filtered.slice(0, limit);
}

/**
 * Fast direct lookup by product code or SKU.
 * Checks exact SKU first, then clean SKU, then base code.
 * If code is a base code with multiple variants, returns the first primary variant.
 */
export function findProductByCode(code: string): FourxProductRecord | undefined {
  if (!code) return undefined;
  const index = getSearchIndex();
  const trimmed = code.trim();
  const clean = normalizeCode(trimmed);

  // Exact SKU lookup
  const skuHit = index.skuExactMap.get(trimmed.toUpperCase()) || index.cleanSkuMap.get(clean);
  if (skuHit) return skuHit.original;

  // Base code lookup
  const baseHits = index.baseCodeMap.get(trimmed.toUpperCase()) || index.cleanBaseCodeMap.get(clean);
  if (baseHits && baseHits.length > 0) {
    return baseHits[0].original;
  }

  return undefined;
}

/**
 * Returns all variants sharing a given base code.
 */
export function getProductsByBaseCode(baseCode: string): FourxProductRecord[] {
  if (!baseCode) return [];
  const index = getSearchIndex();
  const clean = normalizeCode(baseCode);
  const hits = index.baseCodeMap.get(baseCode.trim().toUpperCase()) || index.cleanBaseCodeMap.get(clean);
  if (!hits) return [];
  return hits.map((h) => h.original);
}

/**
 * Finds an exact product matching either SKU, base code, or exact full description.
 */
export function findExactProduct(query: string): FourxProductRecord | undefined {
  if (!query) return undefined;
  const index = getSearchIndex();
  const trimmed = query.trim();
  const clean = normalizeCode(trimmed);
  const normalizedDesc = normalizeSearchText(trimmed);

  // Exact SKU
  const skuHit = index.skuExactMap.get(trimmed.toUpperCase()) || index.cleanSkuMap.get(clean);
  if (skuHit) return skuHit.original;

  // Exact description
  const descHit = index.normalizedDescMap.get(normalizedDesc) || index.normalizedItemNameMap.get(normalizedDesc);
  if (descHit) return descHit.original;

  // Exact base code (if uniquely identifies one product)
  const baseHits = index.baseCodeMap.get(trimmed.toUpperCase()) || index.cleanBaseCodeMap.get(clean);
  if (baseHits && baseHits.length === 1) {
    return baseHits[0].original;
  }

  return undefined;
}

/**
 * Returns the highest-scoring search match with full scoring details and explanation.
 */
export function getProductMatchDetails(query: string): SearchResult | undefined {
  const results = searchProducts(query, { limit: 1, minScore: 50 });
  return results[0];
}

/**
 * Safe, read-only lookup by SKU (the canonical unique identifier in FOUR-X catalogue).
 */
export function getProductById(id: string): FourxProductRecord | undefined {
  return findProductByCode(id);
}

/**
 * Safe, read-only lookup by SKU.
 */
export function getProductBySku(sku: string): FourxProductRecord | undefined {
  if (!sku) return undefined;
  const index = getSearchIndex();
  const hit = index.skuExactMap.get(sku.trim().toUpperCase()) || index.cleanSkuMap.get(normalizeCode(sku));
  return hit ? hit.original : undefined;
}
