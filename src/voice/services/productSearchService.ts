/**
 * Compatibility adapter for FOUR-X voice training UI.
 * All actual product matching is delegated to the approved Stage 2 engine.
 */
import {
  searchProducts as searchCanonicalProducts,
  type SearchResult as CanonicalSearchResult,
} from '../../services/productMatchingService.ts';
import type { ProductRecord, SearchResult } from '../types/product.ts';

export interface SearchOptions { applyDefaults?: boolean }
export interface SearchOutput {
  results: SearchResult[];
  alternatives: SearchResult[];
  totalMatches: number;
  exactMatchesCount: number;
  defaultsApplied: boolean;
  defaultsUnavailable: boolean;
  fuzzyUsed: boolean;
  fuzzyLabel?: string;
  queryPhrase: string;
  searchSource: 'Input 2' | 'Input 3';
  note?: string;
  unmatchedReason?: string;
  appliedDefaultsList?: string[];
  rejectedAttributesList?: string[];
}

function adaptResult(result: CanonicalSearchResult): SearchResult {
  return {
    product: result.product as unknown as ProductRecord,
    score: result.score,
    matchedAttributes: result.matchedFields,
    defaultsApplied: false,
    note: result.explanation,
    isAlternative: false,
  };
}

export function searchProducts(
  phrase: string,
  source: 'Input 2' | 'Input 3' = 'Input 2',
  _options: SearchOptions = { applyDefaults: true },
): SearchOutput {
  const canonical = searchCanonicalProducts(phrase, { limit: 30, minScore: 60, includeAllVariants: true });
  const results = canonical.map(adaptResult);
  const exactMatchesCount = canonical.filter((r) =>
    r.matchType === 'EXACT_SKU' || r.matchType === 'EXACT_BASE_CODE' || r.matchType === 'EXACT_DESCRIPTION' || r.matchType === 'OCR_EMBEDDED_SKU'
  ).length;
  const fuzzyUsed = canonical.some((r) => r.matchType === 'FUZZY' || r.matchType === 'TOKEN_PARTIAL');
  return {
    results,
    alternatives: results,
    totalMatches: results.length,
    exactMatchesCount,
    defaultsApplied: false,
    defaultsUnavailable: false,
    fuzzyUsed,
    fuzzyLabel: fuzzyUsed ? 'Local Stage 2 fuzzy/partial matching' : undefined,
    queryPhrase: phrase,
    searchSource: source,
    note: results[0]?.note,
    unmatchedReason: results.length ? undefined : 'No reliable match in the canonical 531-record catalogue.',
  };
}
