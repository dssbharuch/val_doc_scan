import test from 'node:test';
import assert from 'node:assert/strict';
import { getFourxCatalogue, getFourxProductCount } from '../src/services/productMasterService.ts';
import { searchProducts as searchCanonical } from '../src/services/productMatchingService.ts';
import { getVoiceCatalogue } from '../src/voice/services/voiceCatalogueAdapter.ts';
import { normalizeMerchantSpeech } from '../src/voice/services/speechNormalizer.ts';
import { parseInvoiceVoiceCommand } from '../src/voice/services/invoiceVoiceParser.ts';

test('Stage 3A voice adapter uses the canonical 531-record catalogue', () => {
  assert.equal(getFourxProductCount(), 531);
  assert.equal(getVoiceCatalogue().length, 531);
  assert.equal(new Set(getVoiceCatalogue().map((p) => p.sku)).size, 531);
});

test('Stage 3A voice catalogue adapter preserves canonical SKU and description values', () => {
  const canonical = getFourxCatalogue();
  const voice = getVoiceCatalogue();
  for (const sku of ['FX1101WH', 'FX2520WH', 'V5001AP', 'S918109F']) {
    const source = canonical.find((p) => p.sku === sku);
    const adapted = voice.find((p) => p.sku === sku);
    assert.ok(source, `canonical SKU ${sku} exists`);
    assert.ok(adapted, `voice adapter SKU ${sku} exists`);
    assert.equal(adapted.description, source.description);
    assert.equal(adapted.base_code, source.base_code);
  }
});

test('Stage 3A Gujarati/Hindi quantity normalization retains product attributes', () => {
  const gujarati = normalizeMerchantSpeech('Grace દસ એમ્પિયર બે વે ૫ નંગ');
  assert.match(gujarati.normalizedTranscript, /10 AMPERE/);
  assert.match(gujarati.normalizedTranscript, /TWO WAY/);
  assert.match(gujarati.normalizedTranscript, /5 PIECES/);

  const hindi = normalizeMerchantSpeech('दस एम्पियर टू वे ५ नग');
  assert.match(hindi.normalizedTranscript, /10 AMPERE/);
  assert.match(hindi.normalizedTranscript, /TWO WAY/);
  assert.match(hindi.normalizedTranscript, /5 PIECES/);
});

test('Stage 3A voice parser resolves exact SKU using the canonical voice adapter', () => {
  const catalogue = getVoiceCatalogue();
  const known = catalogue.find((p) => p.sku === 'FX1101WH');
  assert.ok(known);
  const parsed = parseInvoiceVoiceCommand('FX1101WH', catalogue, 'SWITCH');
  assert.equal(parsed.exactMatch?.sku, known.sku);
  assert.equal(parsed.confidence, 1);
});

test('Stage 3A training/search adapter reuses Stage 2 local matching', () => {
  const results = searchCanonical('FX1101WH', { limit: 5 });
  assert.equal(results[0]?.product.sku, 'FX1101WH');
  assert.equal(results[0]?.matchType, 'EXACT_SKU');
});

test('Stage 3A voice operations do not mutate the canonical catalogue', () => {
  const before = JSON.stringify(getFourxCatalogue());
  normalizeMerchantSpeech('Grace દસ એમ્પિયર ટુ વે પાંચ નંગ');
  parseInvoiceVoiceCommand('FX1101WH', getVoiceCatalogue(), 'SWITCH');
  searchCanonical('grace 10 amp switch white');
  assert.equal(JSON.stringify(getFourxCatalogue()), before);
});
