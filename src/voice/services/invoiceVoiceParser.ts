import type { ProductRecord } from '../types/product.ts';
import type { ParsedVoiceCommand } from '../types/invoice.ts';
import { cleanCode, convertVernacularDigits, norm, NUMBERS_DICT } from './pronunciationService.ts';
import { normalizeMerchantSpeech } from './speechNormalizer.ts';
import { getSwitchDefaults } from './productFamilyDefaults.ts';
import { deduplicateProductsBySku, productDisplayText } from './uniqueProductResolver.ts';

// Extended number words for voice quantity & serial selection in Gujarati, Hindi, and English
const INVOICE_NUMBERS_MAP: Record<string, number> = {
  // 1-20
  'ek': 1, 'એક': 1, 'एक': 1, 'one': 1, 'વન': 1, 'pehlo': 1, 'pehla': 1, 'pahla': 1, 'first': 1, 'પહેલો': 1, 'પહેલું': 1, 'पहला': 1,
  'be': 2, 'બે': 2, 'do': 2, 'દો': 2, 'दो': 2, 'two': 2, 'ટુ': 2, 'bijoo': 2, 'bijo': 2, 'dusra': 2, 'doosra': 2, 'second': 2, 'બીજો': 2, 'બીજું': 2, 'दूसरा': 2,
  'tran': 3, 'ત્રણ': 3, 'teen': 3, 'तीन': 3, 'three': 3, 'trijo': 3, 'teesra': 3, 'tisra': 3, 'third': 3, 'ત્રીજો': 3, 'तीसरा': 3,
  'char': 4, 'chaar': 4, 'ચાર': 4, 'चार': 4, 'four': 4, 'chotho': 4, 'chautha': 4, 'fourth': 4,
  'panch': 5, 'paanch': 5, 'પાંચ': 5, 'पांच': 5, 'पाँच': 5, 'five': 5, 'panchmo': 5, 'panchva': 5, 'fifth': 5,
  'chha': 6, 'chhe': 6, 'છ': 6, 'छह': 6, 'छे': 6, 'six': 6,
  'saat': 7, 'sat': 7, 'સાત': 7, 'सात': 7, 'seven': 7,
  'aath': 8, 'ath': 8, 'આઠ': 8, 'आठ': 8, 'eight': 8,
  'nau': 9, 'nav': 9, 'નવ': 9, 'नौ': 9, 'nine': 9,
  'das': 10, 'દસ': 10, 'दस': 10, 'ten': 10,
  'agyar': 11, 'giyarah': 11, 'gyarah': 11, 'અગિયાર': 11, 'ग्यारह': 11, 'eleven': 11,
  'bar': 12, 'baar': 12, 'barah': 12, 'બાર': 12, 'बारह': 12, 'twelve': 12,
  'pandar': 15, 'pandrah': 15, 'પંદર': 15, 'पंद्रह': 15, 'fifteen': 15,
  'sol': 16, 'solah': 16, 'sola': 16, 'સોળ': 16, 'सोलह': 16, 'sixteen': 16,
  'vis': 20, 'vees': 20, 'bees': 20, 'વીસ': 20, 'બીસ': 20, 'बीस': 20, 'twenty': 20,
  'pachis': 25, 'pachhis': 25, 'પચ્ચીસ': 25, 'पच्चीस': 25,
  'tris': 30, 'tees': 30, 'ત્રીસ': 30, 'तीस': 30, 'thirty': 30,
  'battis': 32, 'બત્રીસ': 32, 'बत्तीस': 32,
  'chalis': 40, 'ચાલીસ': 40, 'चालीस': 40, 'forty': 40,
  'pachas': 50, 'પચાસ': 50, 'पचास': 50, 'fifty': 50,
  'sau': 100, 'so': 100, 'સો': 100, 'सौ': 100, 'hundred': 100,
};

function lookupSpokenNumber(token: string): number | null {
  const cleaned = norm(token).trim();
  if (INVOICE_NUMBERS_MAP[cleaned] !== undefined) return INVOICE_NUMBERS_MAP[cleaned];
  if (NUMBERS_DICT[cleaned] !== undefined) return parseInt(NUMBERS_DICT[cleaned], 10);
  const rawLower = token.toLowerCase().trim();
  if (INVOICE_NUMBERS_MAP[rawLower] !== undefined) return INVOICE_NUMBERS_MAP[rawLower];
  if (NUMBERS_DICT[rawLower] !== undefined) return parseInt(NUMBERS_DICT[rawLower], 10);
  return null;
}

// Helper to extract numeric quantity from spoken command
// Supports: "10 nang", "10 pcs", "10 nos", "10 pieces", "દસ નંગ", "૧૦ નંગ", "दस नग", "qty 10", "quantity 5"
export function extractQuantity(raw: string): number | null {
  const s = convertVernacularDigits(raw);

  // Pattern: <number> nang/nag/pcs/nos/pieces/નંગ/નગ/नग/units/items
  const m1 = s.match(/(\d+)\s*(?:nang|nangs|nag|pcs|pc|nos|pieces|piece|નંગ|નગ|नग|नंग|units|items)\b/i);
  if (m1) {
    return parseInt(m1[1], 10);
  }

  // Pattern: qty/quantity/નંગ/नग <number>
  const m2 = s.match(/(?:quantity|qty|નંગ|નગ|नग|नंग|piece|pcs|nos)\s*[:=]?\s*(\d+)/i);
  if (m2) {
    return parseInt(m2[1], 10);
  }

  // Check spoken words for numbers before "nang/nag/pcs" e.g. "panch nang", "bees nag", "vis nang", "das nang"
  const nangMatch = s.match(/([^\s\d]+)\s*(?:nang|nangs|nag|pcs|pc|nos|pieces|piece|નંગ|નગ|नग|नंग|units|items)\b/i);
  if (nangMatch) {
    const val = lookupSpokenNumber(nangMatch[1]);
    if (val !== null) {
      return val;
    }
  }

  return null;
}

// Extract serial number selection: e.g. "number 1", "#1", "1", "pehlo number", "ek number", "be number", "do number", "first one", "option 2"
export function extractSerialNumber(raw: string): number | null {
  const s = convertVernacularDigits(raw).trim();

  // "#1", "No 1", "Number 1", "Item 1", "Option 1"
  const m1 = s.match(/(?:#|no\.?|number|item|option|નંબર|નં\.?|नंबर)\s*(\d+)/i);
  if (m1) return parseInt(m1[1], 10);

  // "1 number", "2 number", "1 option"
  const m2 = s.match(/(\d+)\s*(?:number|no|option|item|નંબર|नंबर)/i);
  if (m2) return parseInt(m2[1], 10);

  // Phrase selection: "first one", "second one", "first option", "second option", "pehlo option", "bijo option"
  const phraseMatch = s.match(/\b(first|second|third|fourth|fifth|pehlo|pehla|pahla|bijo|bijoo|dusra|doosra|trijo|teesra)\s*(?:one|option|item|number|valo|valu)?\b/i);
  if (phraseMatch) {
    const val = lookupSpokenNumber(phraseMatch[1]);
    if (val !== null) return val;
  }

  // "<spoken-word> number" e.g. "pehlo number", "ek number", "be number", "do number", "પહેલો નંબર"
  const m3 = s.match(/([^\s\d]+)\s*(?:number|no\.?|item|option|નંબર|नंबर)/i);
  if (m3) {
    const val = lookupSpokenNumber(m3[1]);
    if (val !== null) return val;
  }

  // "number <spoken-word>" e.g. "number ek", "નંબર બે"
  const m4 = s.match(/(?:number|no\.?|item|option|નંબર|नंबर)\s+([^\s\d]+)/i);
  if (m4) {
    const val = lookupSpokenNumber(m4[1]);
    if (val !== null) return val;
  }

  // Standalone single/double digit e.g. "1", "2", "3"
  if (/^\d{1,2}$/.test(s)) {
    return parseInt(s, 10);
  }

  // Standalone vernacular word: "pehlo", "bijoo", "trijo", "first", "second", "ek", "be", "do"
  const w = norm(s);
  const directWord = lookupSpokenNumber(w);
  if (directWord !== null && ['first', 'pehlo', 'pehla', 'pahla', 'ek', 'second', 'bijoo', 'bijo', 'be', 'do', 'dusra', 'doosra', 'third', 'trijo', 'teen', 'tran', 'teesra', 'fourth', 'chotho', 'fifth', 'panchmo'].includes(w)) {
    return directWord;
  }

  return null;
}

// Detect category switch intent
export function detectCategoryIntent(raw: string): 'SWITCH' | 'PLATES' | 'OTHER' | null {
  const s = norm(raw);
  if (/\b(switch|switches|સ્વિચ|સ્વીચ|स्विच)\b/i.test(s)) return 'SWITCH';
  if (/\b(plate|plates|frame|frames|પ્લેટ|પ્લેટ્સ|પ્લેટો|પ્લેટોસ|प्लेट|प्लेट्स)\b/i.test(s)) return 'PLATES';
  if (/\b(other|others|બીજું|બીજા|अन्य|accessories|accessory|socket|mcb)\b/i.test(s)) return 'OTHER';
  return null;
}

// Extract Plate Attributes from voice or text
export function extractPlateAttributes(raw: string): {
  colour?: string;
  module?: string;
  series?: string;
} {
  const s = convertVernacularDigits(raw).toUpperCase();
  const res: { colour?: string; module?: string; series?: string } = {};

  // Colour / Variant in plates
  if (s.includes('PURE WHITE') || s.includes('ROSEGOLD WHITE') || s.includes('PW')) {
    res.colour = 'PURE WHITE';
  } else if (s.includes('SNOW WHITE') || s.includes('LUNAR WHITE') || s.includes('SHIMMER WHITE') || s.includes('DOVE WHITE')) {
    res.colour = 'WHITE';
  } else if (s.includes('MAPPLE WOOD') || s.includes('MAPLE WOOD') || s.includes('CAFÉ PIINE')) {
    res.colour = 'MAPPLE WOOD';
  } else if (s.includes('AMERICAN WALNUT')) {
    res.colour = 'AMERICAN WALNUT';
  } else if (s.includes('TEAK WOOD') || s.includes('SHADYY WOOD') || s.includes('ESPRESSO WOOD') || s.includes('WOOD')) {
    res.colour = 'WOOD';
  } else if (s.includes('EMERAL CHROME') || s.includes('GRAPHITE CHROME') || s.includes('METALIK CHROME') || s.includes('ALLOY CHROME') || s.includes('LAVA CHROME') || s.includes('CHROME')) {
    res.colour = 'CHROME';
  } else if (s.includes('WHITE') || s.includes('SAFED') || s.includes('સફેદ') || s.includes('વ્હાઇટ')) {
    // Check if user specifically said pure white vs general white
    res.colour = s.includes('PURE') ? 'PURE WHITE' : 'WHITE';
  } else if (s.includes('FRAME')) {
    res.colour = 'FRAME';
  } else if (s.includes('ALL COLOUR') || s.includes('ALL COLOURS')) {
    res.colour = 'ALL COLOURS';
  }

  // Module extraction
  // Handles: "6 MODULE", "6M", "6 M", "CHHA MODULE", "12M (H&V)", etc.
  const modMatch = s.match(/\b(1|2|3|4|6|8|10|12|16|18|20|24)\s*(?:M|MODULE|MOD|મોડ્યુલ|मॉड्यूल)\b/i);
  if (modMatch) {
    const num = modMatch[1];
    if (s.includes('(H&V)') || s.includes('H AND V')) {
      res.module = `${num}M (H&V)`;
    } else if (s.includes('(V)') || s.includes('VERTICAL')) {
      res.module = `${num}M (V)`;
    } else if (s.includes('(H)') || s.includes('HORIZONTAL')) {
      res.module = `${num}M (H)`;
    } else {
      res.module = `${num}M`;
    }
  }

  // Series check: "SERIES 3", "SERIES 5", "SERIES 7", "SERIES 9", "SERIES 11", "SERIES 15"
  const seriesMatch = s.match(/\b(?:SERIES|SERIS)\s*(\d+)\b/i);
  if (seriesMatch) {
    res.series = seriesMatch[1];
  }

  return res;
}

// Extract Switch Attributes from voice or text
export function extractSwitchAttributes(raw: string, activeSeries: string | null): {
  series?: string;
  ampere?: string;
  switchType?: string;
  variant?: string;
  module?: string;
  indicator?: boolean;
  productType?: string;
} {
  const s = convertVernacularDigits(raw).toUpperCase();
  const res: {
    series?: string;
    ampere?: string;
    switchType?: string;
    variant?: string;
    module?: string;
    indicator?: boolean;
    productType?: string;
  } = {};

  // Series detection
  if (s.includes('GRACE') || s.includes('GRASE') || s.includes('GRAC') || s.includes('ગ્રેસ')) {
    res.series = 'GRACE';
  } else if (s.includes('GLIDE') || s.includes('GLID') || s.includes('ગ્લાઇડ')) {
    res.series = 'GLIDE';
  } else if (s.includes('GLAM') || s.includes('ગ્લેમ')) {
    res.series = 'GLAM';
  } else if (s.includes('TESLA') || s.includes('ટેસ્લા')) {
    res.series = 'TESLA';
  } else if (s.includes('ORO') || s.includes('ઓરો')) {
    res.series = 'ORO';
  } else if (s.includes('ORION') || s.includes('ઓરિયન')) {
    res.series = 'ORION';
  } else if (s.includes('OVIUS') || s.includes('ઓવિયસ')) {
    res.series = 'OVIUS';
  } else if (s.includes('F TOUCH') || s.includes('F-TOUCH') || s.includes('એફ ટચ')) {
    res.series = 'F TOUCH';
  } else if (activeSeries) {
    // Inherit active switch series from session memory
    res.series = activeSeries;
  }

  // Ampere rating: 10 AMP, 20 AMP, 25 AMP, 32 AMP, 6 AMP
  const ampMatch = s.match(/\b(6|10|16|20|25|32)\s*(?:AMP|AMPERE|A|એમ્પ|एम्प)\b/i);
  if (ampMatch) {
    res.ampere = `${ampMatch[1]} AMP`;
  } else {
    // Check bare rating numbers not followed by M/way
    const bareAmp = s.match(/\b(6|10|16|20|25|32)\b(?!\s*M|\s*MODULE|\s*WAY|\s*NANG|\s*PCS|\s*NOS)/i);
    if (bareAmp) {
      res.ampere = `${bareAmp[1]} AMP`;
    }
  }

  // Switch Type
  if (s.includes('TWO WAY') || s.includes('2 WAY') || s.includes('DUBE') || s.includes('દુબે') || s.includes('ડુબે') || s.includes('ટુ વે')) {
    res.switchType = 'TWO WAY';
  } else if (s.includes('ONE WAY') || s.includes('1 WAY') || s.includes('વન વે')) {
    res.switchType = 'ONE WAY';
  }

  // Product type discrimination. Special products never inherit ordinary switch defaults.
  if (s.includes('BELL PUSH') || s.includes('બેલ પુશ')) {
    res.productType = 'BELL PUSH';
  } else if (s.includes('CALL BELL') || s.includes('કોલ બેલ')) {
    res.productType = 'CALL BELL';
  } else if (/\bDP(?:\s+MAIN)?\s+SWITCH\b/i.test(s)) {
    res.productType = 'DP SWITCH';
  } else if (/\bMOTOR\s+STARTER\b/i.test(s)) {
    res.productType = 'MOTOR STARTER';
  } else if (/\bMOTION\s+SENSOR\b/i.test(s)) {
    res.productType = 'MOTION SENSOR';
  } else if (/\bWAVE\s+SWITCH\b/i.test(s)) {
    res.productType = 'WAVE SWITCH';
  } else if (/\bF\s*[- ]?TOUCH\b/i.test(s)) {
    res.productType = 'F TOUCH';
  } else if (/\bELECTRONIC\s+BUZZER\b/i.test(s)) {
    res.productType = 'ELECTRONIC BUZZER';
  }

  // Indicator
  if (s.includes('WITH INDICATOR') || s.includes('INDICATOR') || s.includes('ઇન્ડિકેટર')) {
    if (!s.includes('WITHOUT') && !s.includes('વગર')) {
      res.indicator = true;
    } else {
      res.indicator = false;
    }
  } else if (s.includes('WITHOUT INDICATOR') || s.includes('PLAIN') || s.includes('NORMAL') || s.includes('સાદો')) {
    res.indicator = false;
  }

  // Module (1M, 2M)
  const modMatch = s.match(/\b(1|2)\s*(?:M|MODULE|મોડ્યુલ|मॉड्यूल)\b/i);
  if (modMatch) {
    res.module = `${modMatch[1]}M`;
  }

  // Variant
  if (s.includes('CHROME') || s.includes('CHROM') || s.includes('ક્રોમ') || s.includes('CR')) {
    res.variant = 'CHROME';
  } else if (s.includes('WHITE') || s.includes('SAFED') || s.includes('વ્હાઇટ') || s.includes('સફેદ') || s.includes('WH')) {
    res.variant = 'WHITE';
  }

  return res;
}

// Master Voice & Text Command Parser for Make Invoice
export function parseInvoiceVoiceCommand(
  rawTranscript: string,
  arg2: ProductRecord[] | string | null | undefined,
  arg3?: ProductRecord[] | 'SWITCH' | 'PLATES' | 'OTHER',
  arg4?: string | 'SWITCH' | 'PLATES' | 'OTHER' | null
): ParsedVoiceCommand {
  let catalogue: ProductRecord[];
  let activeCategory: 'SWITCH' | 'PLATES' | 'OTHER' = 'SWITCH';
  let activeSwitchSeries: string | null = null;

  if (Array.isArray(arg2)) {
    catalogue = arg2;
    activeCategory = (arg3 as 'SWITCH' | 'PLATES' | 'OTHER') || 'SWITCH';
    activeSwitchSeries = (arg4 as string) || null;
  } else {
    activeSwitchSeries = (arg2 as string) || null;
    catalogue = (arg3 as ProductRecord[]) || [];
    activeCategory = (arg4 as 'SWITCH' | 'PLATES' | 'OTHER') || 'SWITCH';
  }

  const trimmed = rawTranscript.trim();
  if (!trimmed) {
    return {
      rawTranscript: '',
      normalizedTranscript: '',
      confidence: 0,
      feedbackMessage: 'Empty speech input',
    };
  }

  // 0. Stage 1: Universal Speech Normalization (Gujarati / Hindi / English -> Standardized English)
  const normResult = normalizeMerchantSpeech(trimmed);
  const normalized = normResult.normalizedTranscript;
  const searchInput = `${normalized} ${trimmed}`;

  // 1. Direct SKU or Base Code search (Priority 1)
  const codeClean = cleanCode(trimmed);
  if (codeClean.length >= 4) {
    const directSkuMatch = catalogue.find(
      (p) => cleanCode(p.sku) === codeClean || cleanCode(p.original_sku) === codeClean
    );
    if (directSkuMatch) {
      const qty = extractQuantity(searchInput) || 1;
      return {
        rawTranscript: trimmed,
        normalizedTranscript: normalized,
        detectedLanguage: normResult.detectedLanguage,
        intent: 'add_product',
        exactMatch: directSkuMatch,
        quantity: qty,
        confidence: 1.0,
        feedbackMessage: `Exact SKU match found: ${directSkuMatch.sku} (${directSkuMatch.description})`,
      };
    }
  }

  // 2. Check for Serial Number Selection (e.g. "Number 1", "#2", "3", "First one")
  const selectedNum = extractSerialNumber(searchInput) ?? extractSerialNumber(trimmed);
  if (selectedNum !== null) {
    return {
      rawTranscript: trimmed,
      normalizedTranscript: normalized,
      detectedLanguage: normResult.detectedLanguage,
      intent: 'select_number',
      selectedNumber: selectedNum,
      confidence: 0.95,
      feedbackMessage: `Selected option #${selectedNum}`,
    };
  }

  // 3. Category Switch Intent
  let catIntent = detectCategoryIntent(searchInput) ?? detectCategoryIntent(trimmed);
  if (catIntent) {
    // Check if the command was solely to switch category (e.g. "Plates" or "Go to Switches")
    const words = trimmed.split(/\s+/);
    if (words.length <= 3 && !extractQuantity(searchInput)) {
      return {
        rawTranscript: trimmed,
        normalizedTranscript: normalized,
        detectedLanguage: normResult.detectedLanguage,
        intent: 'category_switch',
        targetCategory: catIntent,
        confidence: 0.98,
        feedbackMessage: `Switched category to ${catIntent}`,
      };
    }
  }

  // Auto-detect category from product-specific terms if not explicitly named
  if (!catIntent) {
    if (
      /\b(MODULE|MOD|MODS|PURE WHITE|EMERAL|EMERALD|MAPPLE|WALNUT|TEAK|WOOD)\b/i.test(searchInput) ||
      /\b(S\d{4,5}[A-Z]{2,4})\b/i.test(trimmed)
    ) {
      catIntent = 'PLATES';
    } else if (
      /\b(MCB|SOCKET|REGULATOR|DIMMER|RJ\s*45|BLANK\s*PLATE|GANG\s*BOX|METAL\s*BOX)\b/i.test(searchInput)
    ) {
      catIntent = 'OTHER';
    }
  }

  const effectiveCategory = catIntent || activeCategory;
  const quantity = extractQuantity(searchInput) ?? extractQuantity(trimmed);

  // 4. PLATES Flow Processing
  if (effectiveCategory === 'PLATES') {
    const plateAttrs = extractPlateAttributes(searchInput);
    const plates = catalogue.filter((p) => (p.current_group || p.product_group) === 'PLATES');

    // Filter matching plate records
    let matches = plates;
    if (plateAttrs.series) {
      matches = matches.filter((p) => p.series === plateAttrs.series);
    }
    if (plateAttrs.colour) {
      const cUpper = plateAttrs.colour.toUpperCase();
      matches = matches.filter(
        (p) =>
          (p.variant && p.variant.toUpperCase() === cUpper) ||
          (p.variant_group && p.variant_group.toUpperCase().includes(cUpper)) ||
          (p.colour_code && p.colour_code.toUpperCase() === cUpper)
      );
    }
    if (plateAttrs.module) {
      const mUpper = plateAttrs.module.toUpperCase();
      matches = matches.filter((p) => {
        const d = (p.description || '').toUpperCase();
        return d === mUpper || d.startsWith(mUpper);
      });
    }

    // Check missing attributes
    const missing: string[] = [];
    if (!plateAttrs.colour && !plateAttrs.series && !plateAttrs.module) {
      missing.push('series', 'colour', 'module');
    } else {
      if (!plateAttrs.colour) missing.push('colour');
      if (!plateAttrs.module) missing.push('module');
    }
    if (!quantity) missing.push('quantity');

    if (matches.length === 1 && quantity) {
      return {
        rawTranscript: trimmed,
        normalizedTranscript: normalized,
        detectedLanguage: normResult.detectedLanguage,
        intent: 'add_product',
        targetCategory: 'PLATES',
        colour: plateAttrs.colour,
        module: plateAttrs.module,
        quantity: quantity ?? undefined,
        exactMatch: matches[0],
        confidence: 0.95,
        feedbackMessage: `Found unique plate: ${matches[0].item_name || matches[0].description} (Qty: ${quantity})`,
      };
    }

    if (matches.length > 1) {
      // If exact module matches S30616PW (6M) vs S30617PW (6M H&V) and user said exact "6M", check for exact equality
      if (plateAttrs.module) {
        const exactModuleOnly = matches.filter(
          (p) => (p.description || '').toUpperCase() === plateAttrs.module!.toUpperCase()
        );
        if (exactModuleOnly.length === 1 && quantity) {
          return {
            rawTranscript: trimmed,
            normalizedTranscript: normalized,
            detectedLanguage: normResult.detectedLanguage,
            intent: 'add_product',
            targetCategory: 'PLATES',
            colour: plateAttrs.colour,
            module: plateAttrs.module,
            quantity,
            exactMatch: exactModuleOnly[0],
            confidence: 0.94,
            feedbackMessage: `Found unique plate: ${exactModuleOnly[0].item_name || exactModuleOnly[0].description} (Qty: ${quantity})`,
          };
        }
      }

      return {
        rawTranscript: trimmed,
        normalizedTranscript: normalized,
        detectedLanguage: normResult.detectedLanguage,
        intent: 'add_product',
        targetCategory: 'PLATES',
        colour: plateAttrs.colour,
        module: plateAttrs.module,
        quantity: quantity || undefined,
        multipleMatches: matches,
        missingAttributes: missing.length > 0 ? missing : undefined,
        confidence: 0.85,
        feedbackMessage: `${matches.length} plate options match. Please choose an option or specify module/colour.`,
      };
    }

    if (matches.length === 0) {
      return {
        rawTranscript: trimmed,
        normalizedTranscript: normalized,
        detectedLanguage: normResult.detectedLanguage,
        intent: 'unknown',
        targetCategory: 'PLATES',
        confidence: 0.2,
        feedbackMessage: 'Product not found in Product Master for the requested plate combination.',
      };
    }
  }

  // 5. SWITCHES Flow Processing
  if (effectiveCategory === 'SWITCH') {
    const switchAttrs = extractSwitchAttributes(searchInput, activeSwitchSeries);
    const switches = deduplicateProductsBySku(catalogue.filter((p) => (p.current_group || p.product_group) === 'SWITCH'));

    // Keep an explicit series-navigation command, but a family name alone is now
    // resolved as a product request using the approved defaults (then quantity is asked).
    if (switchAttrs.series && /\b(series|family)\b/i.test(searchInput)) {
      return {
        rawTranscript: trimmed,
        normalizedTranscript: normalized,
        detectedLanguage: normResult.detectedLanguage,
        intent: 'select_series',
        targetCategory: 'SWITCH',
        series: switchAttrs.series,
        confidence: 0.98,
        feedbackMessage: `Active series set to ${switchAttrs.series}.`,
      };
    }

    const isBellPushRequest = switchAttrs.productType === 'BELL PUSH';
    const isSpecialSwitchRequest = /\b(DP|MOTOR\s+STARTER|MOTION\s+SENSOR|WAVE\s+SWITCH|F\s*[- ]?TOUCH|ELECTRONIC\s+BUZZER|CALL\s+BELL|BLANK\s+PLATE)\b/i.test(searchInput);
    const switchDefaults = isSpecialSwitchRequest || !switchAttrs.series
      ? null
      : (isBellPushRequest ? getSwitchDefaults('BELL PUSH SWITCH') : getSwitchDefaults('MODULAR SWITCH'));

    // Apply only missing attributes. Bell Push intentionally has no ONE WAY default.
    if (switchDefaults) {
      if (!switchAttrs.ampere) switchAttrs.ampere = `${switchDefaults.amp} AMP`;
      if (!switchAttrs.variant) switchAttrs.variant = switchDefaults.colour;
      if (!switchAttrs.module) switchAttrs.module = switchDefaults.module;
      if (switchAttrs.indicator === undefined) switchAttrs.indicator = switchDefaults.indicator;
      if (!switchAttrs.switchType && switchDefaults.switchType) switchAttrs.switchType = switchDefaults.switchType;
    }

    // Filter only original catalogue records. For an ordinary family request,
    // retain only products eligible for the configured defaults; this prevents
    // DP/Motor/Sensor/Wave/F TOUCH products from leaking into a generic result.
    let matches = switches;
    if (switchAttrs.series) {
      matches = matches.filter((p) => {
        const d = `${p.item_name || ''} ${p.description || ''}`.toUpperCase();
        return d.includes(switchAttrs.series!.toUpperCase());
      });
    }

    if (switchDefaults && switchAttrs.series) {
      matches = matches.filter((p) => {
        const text = productDisplayText(p);
        const profile = getSwitchDefaults(text);
        if (!profile) return false;
        const bellPush = /\bBELL\s+PUSH\b/i.test(text);
        if (bellPush !== isBellPushRequest) return false;
        return true;
      });
    }

    const searchable = (p: ProductRecord) => `${p.item_name || ''} ${p.description || ''}`.toUpperCase();
    if (switchAttrs.ampere) {
      const ampNumber = switchAttrs.ampere.match(/\d+/)?.[0] || '';
      matches = matches.filter((p) => new RegExp(`(^|\\D)${ampNumber}\\s*AMP(\\D|$)`, 'i').test(searchable(p)));
    }

    if (switchAttrs.switchType) {
      const st = switchAttrs.switchType.toUpperCase();
      matches = matches.filter((p) => searchable(p).includes(st));
    }

    if (switchAttrs.productType === 'BELL PUSH') {
      matches = matches.filter((p) => searchable(p).includes('BELL PUSH'));
    } else if (switchAttrs.productType === 'CALL BELL') {
      matches = matches.filter((p) => searchable(p).includes('CALL BELL') && !searchable(p).includes('BELL PUSH'));
    } else if (switchAttrs.productType) {
      const typePatterns: Record<string, RegExp> = {
        'DP SWITCH': /\bDP(?:\s+MAIN)?\s+SWITCH\b/i,
        'MOTOR STARTER': /MOTOR\s+STARTER/i,
        'MOTION SENSOR': /MOTION\s+SENSOR/i,
        'WAVE SWITCH': /WAVE\s+SWITCH/i,
        'F TOUCH': /F\s*[- ]?TOUCH/i,
        'ELECTRONIC BUZZER': /ELECTRONIC\s+BUZZER/i,
      };
      const pattern = typePatterns[switchAttrs.productType];
      if (pattern) matches = matches.filter((p) => pattern.test(searchable(p)));
    }

    if (switchAttrs.indicator !== undefined) {
      if (switchAttrs.indicator) {
        matches = matches.filter((p) => searchable(p).includes('WITH INDICATOR'));
      } else {
        matches = matches.filter((p) => !searchable(p).includes('WITH INDICATOR'));
      }
    }

    if (switchAttrs.module) {
      matches = matches.filter((p) => searchable(p).includes(switchAttrs.module!.toUpperCase()));
    }

    if (switchAttrs.variant) {
      const v = switchAttrs.variant.toUpperCase();
      matches = matches.filter((p) => (p.variant || '').toUpperCase() === v || searchable(p).includes(v));
    }

    // Identify missing required attributes (Strict Policy: ASK)
    const missing: string[] = [];
    if (!switchAttrs.series) missing.push('series');
    if (!switchAttrs.ampere) missing.push('ampere');
    if (!switchAttrs.switchType && !isBellPushRequest && !switchDefaults && !switchAttrs.productType) missing.push('switchType');
    if (!switchAttrs.variant) missing.push('variant');
    if (!switchAttrs.module) missing.push('module');
    if (!quantity) missing.push('quantity');

    const missingNonQuantity = missing.filter((attribute) => attribute !== 'quantity');
    if (matches.length === 1 && missingNonQuantity.length === 0) {
      return {
        rawTranscript: trimmed,
        normalizedTranscript: normalized,
        detectedLanguage: normResult.detectedLanguage,
        intent: 'add_product',
        targetCategory: 'SWITCH',
        series: switchAttrs.series,
        ampere: switchAttrs.ampere,
        switchType: switchAttrs.switchType,
        quantity: quantity ?? undefined,
        exactMatch: matches[0],
        confidence: 0.95,
        feedbackMessage: quantity ? `Found unique switch: ${matches[0].item_name || matches[0].description} (Qty: ${quantity})` : `Found unique switch: ${matches[0].item_name || matches[0].description}. Quantity required.`,
      };
    }

    if (matches.length > 0) {
      return {
        rawTranscript: trimmed,
        normalizedTranscript: normalized,
        detectedLanguage: normResult.detectedLanguage,
        intent: 'add_product',
        targetCategory: 'SWITCH',
        series: switchAttrs.series,
        ampere: switchAttrs.ampere,
        switchType: switchAttrs.switchType,
        variant: switchAttrs.variant,
        module: switchAttrs.module,
        quantity: quantity || undefined,
        multipleMatches: matches,
        missingAttributes: missing,
        confidence: 0.85,
        feedbackMessage: `${matches.length} switches match. Please select an option or specify missing attributes (${missing.join(', ')}).`,
      };
    }

    if (matches.length === 0) {
      return {
        rawTranscript: trimmed,
        normalizedTranscript: normalized,
        detectedLanguage: normResult.detectedLanguage,
        intent: 'unknown',
        targetCategory: 'SWITCH',
        confidence: 0.2,
        feedbackMessage: 'Product not found in Product Master for the requested switch attributes.',
      };
    }
  }

  // 6. OTHER Products Processing
  if (effectiveCategory === 'OTHER') {
    const otherProducts = catalogue.filter(
      (p) => (p.current_group || p.product_group) !== 'SWITCH' && (p.current_group || p.product_group) !== 'PLATES'
    );

    const normForSearch = norm(normalized.replace(/\bAMPERE\b/g, 'AMP'));
    const words = normForSearch
      .split(' ')
      .filter(
        (w) =>
          w &&
          !['nang', 'pcs', 'nos', 'pieces', 'piece', 'other', 'item', 'unit', 'units'].includes(w) &&
          !(quantity && w === String(quantity))
      );

    const matches = otherProducts.filter((p) => {
      const desc = norm(`${p.description || ''} ${p.item_name || ''} ${p.base_code || ''} ${p.sku || ''}`);
      return words.every((w) => desc.includes(w) || cleanCode(desc).includes(cleanCode(w)));
    });

    if (matches.length === 1 && quantity) {
      return {
        rawTranscript: trimmed,
        normalizedTranscript: normalized,
        detectedLanguage: normResult.detectedLanguage,
        intent: 'add_product',
        targetCategory: 'OTHER',
        quantity: quantity ?? undefined,
        exactMatch: matches[0],
        confidence: 0.95,
        feedbackMessage: `Found unique product: ${matches[0].item_name || matches[0].description} (Qty: ${quantity})`,
      };
    }

    if (matches.length > 1) {
      return {
        rawTranscript: trimmed,
        normalizedTranscript: normalized,
        detectedLanguage: normResult.detectedLanguage,
        intent: 'add_product',
        targetCategory: 'OTHER',
        quantity: quantity || undefined,
        multipleMatches: matches,
        missingAttributes: !quantity ? ['quantity'] : undefined,
        confidence: 0.85,
        feedbackMessage: `${matches.length} products match. Please choose an option.`,
      };
    }

    return {
      rawTranscript: trimmed,
      normalizedTranscript: normalized,
      detectedLanguage: normResult.detectedLanguage,
      intent: 'unknown',
      targetCategory: 'OTHER',
      confidence: 0.2,
      feedbackMessage: 'Product not found in Product Master.',
    };
  }

  return {
    rawTranscript: trimmed,
    normalizedTranscript: normalized,
    detectedLanguage: normResult.detectedLanguage,
    confidence: 0.1,
    feedbackMessage: 'Could not understand command. Please try speaking product name and quantity.',
  };
}
