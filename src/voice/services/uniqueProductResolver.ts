import type { ProductRecord, SearchResult } from '../types/product.ts';

/** Keep the first original catalogue record for each exact sellable SKU. */
export function deduplicateProductsBySku(products: ProductRecord[]): ProductRecord[] {
  const seen = new Set<string>();
  return products.filter((product) => {
    const sku = String(product.sku || '').trim().toUpperCase();
    const key = sku || `${product.base_code || ''}|${product.item_name || product.description || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Search/list intent must not trigger single-item defaults. */
export function isProductFamilyListRequest(transcript: string): boolean {
  const text = String(transcript || '').toLowerCase();
  return /\b(show|list|display|all)\b/i.test(text) || ['બધા', 'બધી', 'બતાવો', 'યાદી', 'सभी', 'सूची'].some((term) => text.includes(term));
}

/** Compare explicit/defaulted constraints against the display text from a real record. */
export function productDisplayText(product: ProductRecord): string {
  return `${product.item_name || ''} ${product.description || ''} ${product.variant || ''} ${product.sku || ''}`.toUpperCase();
}

export function uniqueSearchResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter(({ product }) => {
    const sku = String(product.sku || '').trim().toUpperCase();
    const key = sku || `${product.base_code || ''}|${product.item_name || product.description || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
