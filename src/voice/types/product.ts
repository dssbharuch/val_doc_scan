export interface ProductRecord {
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
  group_history?: Array<{ from: string; to: string; changed_at: string }>;
  original_alpha_code?: string;
  sku_mode?: string;
  colour_code?: string;
  sku_status?: string;
  series?: string;
  variant_group?: string;
  net_rate_as_printed?: number;
  with_gst_as_printed?: number;
}

export interface VoiceTrainingRecord {
  id: string;
  heard: string;
  corrected: string;
  manual?: string;
  sku?: string;
  productDescription?: string;
  updatedAt: string;
  count: number;
  category?: 'phrase' | 'pronunciation' | 'attribute' | 'word';
  scope?: 'common';
  confirmed?: boolean;
  source?: string;
}

export interface InterpretationResult {
  originalTranscript: string;
  correctedPhrase: string;
  detectedLanguage?: string;
  brandOrFamily?: string;
  productType?: string;
  switchType?: string;
  ampere?: string;
  module?: string;
  variant?: string;
  indicator?: boolean | null;
  reasoning?: string;
  confidence?: number;
  unresolvedTokens?: string[];
  appliedDefaults?: string[];
  rejectedAttributes?: string[];
  source?: 'gemini' | 'gemini_text' | 'gemini_audio_fallback' | 'local_first' | 'local_only' | 'local_fallback' | 'local_training' | 'rule_engine';
  quantity?: number;
  quantityUnit?: string;
  fallbackReason?: string;
  model?: string;
  geminiAttempted?: boolean;
  geminiStatus?: string;
}

export interface ParsedAttributes {
  brand?: string;
  module?: string;
  amp?: string;
  variant?: string;
  switchType?: 'ONE WAY' | 'TWO WAY';
  indicator?: boolean;
  productType?: 'SWITCH' | 'SOCKET' | 'DIMMER' | 'CALL BELL' | 'BELL PUSH' | 'MCB';
  unresolvedNumbers?: string[];
  code?: string;
  colourCode?: string;
  alphaCode?: string;
}

export interface SearchResult {
  product: ProductRecord;
  score: number;
  matchedAttributes: string[];
  defaultsApplied: boolean;
  note?: string;
  isAlternative?: boolean;
  alternativeLabel?: string;
}

export interface SeedVocabularyItem {
  canonical: string;
  aliases: string[];
}
