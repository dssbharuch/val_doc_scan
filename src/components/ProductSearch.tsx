/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ONE RETAIL AI — Reusable Product Search Component
 * Stage 2: Product Matching & Search Engine UI
 * 
 * - Real-time matching against all 531 canonical FOUR-X records.
 * - Displays exact original descriptions, SKUs, and authentic attributes.
 * - Shows transparent match scoring and explanations.
 * - Local-first & offline: zero external API calls.
 */

import React, { useState, useMemo, useTransition } from 'react';
import {
  Search,
  X,
  Sparkles,
  Tag,
  CheckCircle2,
  Package,
  Layers,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import {
  searchProducts,
  getSearchIndexStats,
  type SearchResult,
  type MatchConfidence,
} from '../services/productMatchingService.ts';
import {
  getFourxCategories,
  getFourxProductGroups,
  type FourxProductRecord,
} from '../services/productMasterService.ts';

export interface ProductSearchProps {
  onSelectProduct?: (product: FourxProductRecord) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export const ProductSearch: React.FC<ProductSearchProps> = ({
  onSelectProduct,
  placeholder = 'Search product name, code or description...',
  className = '',
  autoFocus = false,
}) => {
  const [query, setQuery] = useState('');
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [productGroupFilter, setProductGroupFilter] = useState<string>('');
  const [minConfidence, setMinConfidence] = useState<number>(60);
  const [showFilters, setShowFilters] = useState(false);
  const [, startTransition] = useTransition();

  const stats = useMemo(() => getSearchIndexStats(), []);
  const categories = useMemo(() => getFourxCategories(), []);
  const productGroups = useMemo(() => getFourxProductGroups(), []);

  // Compute search results locally and instantaneously
  const results: SearchResult[] = useMemo(() => {
    if (!query.trim()) return [];
    return searchProducts(query, {
      limit: 30,
      minScore: minConfidence,
      categoryFilter: categoryFilter || undefined,
      productGroupFilter: productGroupFilter || undefined,
    });
  }, [query, minConfidence, categoryFilter, productGroupFilter]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    startTransition(() => {
      setQuery(val);
    });
  };

  const handleClear = () => {
    setQuery('');
    setSelectedSku(null);
  };

  const handleSelect = (product: FourxProductRecord) => {
    setSelectedSku(product.sku);
    if (onSelectProduct) {
      onSelectProduct(product);
    }
  };

  const getConfidenceBadge = (confidence: MatchConfidence, score: number) => {
    switch (confidence) {
      case 'VERY_HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            {score}% Exact Match
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            {score}% High Confidence
          </span>
        );
      case 'POSSIBLE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            {score}% Possible Match
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-500/15 text-slate-400 border border-slate-500/30">
            {score}% Match
          </span>
        );
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search Input Bar */}
      <div className="relative">
        <div className="relative flex items-center">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="w-full pl-10 pr-24 py-3 bg-slate-900/90 text-white placeholder-slate-500 text-sm rounded-xl border border-slate-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none"
          />
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1.5">
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Clear search"
                aria-label="Clear search input"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1.5 rounded-lg text-xs font-medium border flex items-center gap-1 transition-colors ${
                showFilters || categoryFilter || productGroupFilter
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800'
              }`}
              title="Filter by category or group"
              aria-label="Toggle search filters"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Index Metadata Bar */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>Offline Search Engine</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>{stats.totalIndexed} catalogue records indexed</span>
          </div>
          {query.trim() && (
            <span className="font-mono text-slate-300">
              {results.length} {results.length === 1 ? 'match' : 'matches'} found
            </span>
          )}
        </div>
      </div>

      {/* Optional Filters Drawer */}
      {showFilters && (
        <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-300">Search Filters</span>
            {(categoryFilter || productGroupFilter || minConfidence !== 60) && (
              <button
                onClick={() => {
                  setCategoryFilter('');
                  setProductGroupFilter('');
                  setMinConfidence(60);
                }}
                className="text-[11px] text-emerald-400 hover:underline"
              >
                Reset filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Product Group</label>
              <select
                value={productGroupFilter}
                onChange={(e) => setProductGroupFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-md p-1.5 focus:border-emerald-500 outline-none"
              >
                <option value="">All Groups ({productGroups.length})</option>
                {productGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-md p-1.5 focus:border-emerald-500 outline-none"
              >
                <option value="">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Min Confidence ({minConfidence}%)
              </label>
              <input
                type="range"
                min="40"
                max="95"
                step="5"
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="w-full accent-emerald-500 mt-1 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Results Container */}
      <div className="space-y-2">
        {/* State A: User typed a query and matches exist */}
        {query.trim() && results.length > 0 && (
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {results.map((res) => {
              const p = res.product;
              const isSelected = selectedSku === p.sku;

              return (
                <div
                  key={p.sku}
                  onClick={() => handleSelect(p)}
                  className={`border rounded-xl p-3.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-950/20 border-emerald-500/50 ring-1 ring-emerald-500/30'
                      : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/80 hover:border-slate-700'
                  }`}
                >
                  {/* Top row: SKU, Confidence Badge, Score */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-emerald-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {p.sku}
                      </span>
                      {p.base_code && p.base_code !== p.sku && (
                        <span className="text-[11px] font-mono text-slate-400">
                          Base: {p.base_code}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        Brand: <span className="text-slate-300 font-medium">{p.brand}</span>
                      </span>
                    </div>
                    <div>{getConfidenceBadge(res.confidence, res.score)}</div>
                  </div>

                  {/* Middle row: Exact Original Description */}
                  <div className="text-sm font-semibold text-white tracking-wide leading-snug">
                    {p.description}
                  </div>

                  {/* Item Name if distinct from description */}
                  {p.item_name && p.item_name !== p.description && (
                    <div className="text-xs text-slate-400 mt-0.5 font-mono">
                      {p.item_name}
                    </div>
                  )}

                  {/* Attributes chips: Only authentic, non-empty fields */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2 flex-wrap text-xs text-slate-400">
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.variant && (
                        <span className="inline-flex items-center gap-1 bg-slate-800/60 px-2 py-0.5 rounded text-[11px] text-slate-300">
                          <Tag className="w-3 h-3 text-slate-400" />
                          Variant: <strong className="text-white font-medium">{p.variant}</strong>
                        </span>
                      )}
                      {p.product_group && (
                        <span className="inline-flex items-center gap-1 bg-slate-800/60 px-2 py-0.5 rounded text-[11px] text-slate-300">
                          <Layers className="w-3 h-3 text-slate-400" />
                          Group: {p.product_group}
                        </span>
                      )}
                      {p.series && (
                        <span className="inline-flex items-center gap-1 bg-slate-800/60 px-2 py-0.5 rounded text-[11px] text-slate-300">
                          Series: {p.series}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 bg-slate-800/60 px-2 py-0.5 rounded text-[11px] text-slate-300">
                        <Package className="w-3 h-3 text-slate-400" />
                        Pack: {p.package_qty} / Outer: {p.outer_qty}
                      </span>
                    </div>

                    {/* Transparent Match Explanation */}
                    <div className="text-[11px] text-slate-400 italic flex items-center gap-1 ml-auto">
                      <Info className="w-3 h-3 text-slate-500 shrink-0" />
                      <span>{res.explanation}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* State B: User typed a query and NO matches found */}
        {query.trim() && results.length === 0 && (
          <div className="border border-slate-800 bg-slate-900/30 rounded-xl p-6 text-center space-y-2">
            <div className="w-9 h-9 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto">
              <Search className="w-4 h-4" />
            </div>
            <p className="text-sm font-medium text-slate-300">
              No matching product found in the current catalogue.
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try searching by product code (e.g. <span className="font-mono text-slate-400">FX1101</span>), SKU (e.g. <span className="font-mono text-slate-400">FX1101WH</span>), or keywords like "10 amp switch" or "18M frame".
            </p>
          </div>
        )}

        {/* State C: Search input is empty (Idle prompt) */}
        {!query.trim() && (
          <div className="border border-dashed border-slate-800 rounded-xl p-5 text-center text-slate-500 text-xs">
            <span>Enter a product code, SKU, or keywords to query the 531-item canonical catalogue.</span>
          </div>
        )}
      </div>
    </div>
  );
};
