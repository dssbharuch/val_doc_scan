import seedVocabulary from '../data/seedVocabulary.json' with { type: 'json' };
import { getVoiceCatalogue } from './voiceCatalogueAdapter.ts';
import { applyProductAliases } from './productAliases.ts';
import type { ParsedAttributes, SeedVocabularyItem } from '../types/product.ts';

// Numbers dictionary in Gujarati, Hindi, and English
export const NUMBERS_DICT: Record<string, string> = {
  'solah': '16',
  'sola': '16',
  'સોળ': '16',
  'सोलह': '16',
  'सोळह': '16',
  'sixteen': '16',
  'bees': '20',
  'vis': '20',
  'વીસ': '20',
  'બીસ': '20',
  'बीस': '20',
  'twenty': '20',
  'das': '10',
  'દસ': '10',
  'दस': '10',
  'ten': '10',
  'pachis': '25',
  'પચ્ચીસ': '25',
  'पच्चीस': '25',
  'twenty five': '25',
  'battis': '32',
  'બત્રીસ': '32',
  'बत्तीस': '32',
  'thirty two': '32',
  'એક': '1',
  'ek': '1',
  'one': '1',
  'વન': '1',
  'एक': '1',
  'બે': '2',
  'do': '2',
  'two': '2',
  'ટુ': '2',
  'દો': '2',
  'दो': '2',
  'ત્રણ': '3',
  'teen': '3',
  'three': '3',
  'ચાર': '4',
  'char': '4',
  'four': '4',
  'chaar': '4',
  'છ': '6',
  'six': '6',
  'આઠ': '8',
  'eight': '8',
};

// Gujarati/Hindi vocabulary phrases to English canonical terms
export const PHRASE_TRANSLATIONS: Record<string, string> = {
  'દસ એમ્પ': '10 amp',
  'દસ એમ્પિયર': '10 amp',
  'दस एम्पियर': '10 amp',
  'સોળ એમ્પ': '16 amp',
  'સોળ એમ્પિયર': '16 amp',
  'सोलह एम्पियर': '16 amp',
  'વીસ એમ્પ': '20 amp',
  'વીસ એમ્પિયર': '20 amp',
  'बीस एम्पियर': '20 amp',
  'પચ્ચીસ એમ્પ': '25 amp',
  'બત્રીસ એમ્પ': '32 amp',
  'એક મોડ્યુલ': '1m',
  'વન મોડ્યુલ': '1m',
  'एक मॉड्यूल': '1m',
  'બે મોડ્યુલ': '2m',
  'ટુ મોડ્યુલ': '2m',
  'દો મોડ્યુલ': '2m',
  'दो मॉड्यूल': '2m',
  'એમ્પિયર': 'amp',
  'એમ્પ': 'amp',
  'एम्पियर': 'amp',
  'મોડ્યુલ': 'module',
  'मॉड्यूल': 'module',
  'વ્હાઇટ': 'white',
  'સફેદ': 'white',
  'सफेद': 'white',
  'ક્રોમ': 'chrome',
  'ઇન્ડિકેટર': 'indicator',
  'ઇન્ડિકેટર વગર': 'without indicator',
  'ઇન્ડિકેટર સાથે': 'with indicator',
  'બે વે': 'two way',
  'ટુ વે': 'two way',
  'વન વે': 'one way',
  'ડુબે': 'two way',
  'દુબે': 'two way',
  'દુબે સ્વિચ': 'two way switch',
};

// Clean code helper: remove spaces, hyphens, and underscores, uppercase
export function cleanCode(s?: string | null): string {
  return String(s || '')
    .toUpperCase()
    .replace(/[\s\-_]/g, '');
}

// Convert Gujarati and Devanagari digits to ASCII digits
export function convertVernacularDigits(s: string): string {
  const gujarati = ['૦', '૧', '૨', '૩', '૪', '૫', '૬', '૭', '૮', '૯'];
  const devanagari = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  let res = s;
  for (let i = 0; i <= 9; i++) {
    res = res.replaceAll(gujarati[i], String(i));
    res = res.replaceAll(devanagari[i], String(i));
  }
  return res;
}

// Normalize string: lowercase, remove diacritics, trim spaces
export function norm(s: string): string {
  const withAsciiDigits = convertVernacularDigits(String(s || ''));
  return withAsciiDigits
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0900-\u097f\u0a80-\u0aff]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Normalize spoken phrases by replacing numbers, modules, and phonetic units
export function normalizeSpoken(s: string): string {
  let raw = applyProductAliases(convertVernacularDigits(String(s || '')));

  // Normalize speech recognition variations of product code prefixes before tokenizing
  raw = raw.replace(/(^|\s)(eff\s*x|f\s*x|f\.x\.|ef\s*x|એફ\s*એક્સ|એફએક્સ|एफ\s*एक्स|एफएक्स)\s*[-]?\s*(\d+)/gi, '$1FX$3');
  raw = raw.replace(/(^|\s)(fx)\s*[-_]?\s*(\d+)/gi, '$1FX$3');
  raw = raw.replace(/(^|\s)(s)\s*[-_]?\s*(\d{4,6})/gi, '$1S$3');
  raw = raw.replace(/(^|\s)(v)\s*[-_]?\s*(\d{4,6})/gi, '$1V$3');

  let x = ' ' + norm(raw) + ' ';

  // Replace numbers
  for (const [k, v] of Object.entries(NUMBERS_DICT)) {
    x = x.replaceAll(' ' + norm(k) + ' ', ' ' + v + ' ');
  }

  // Handle explicit 'A' suffix after rating numbers (e.g. 10a, 16a, 20a, 25a, 32a, 6a)
  x = x.replace(/\b(6|10|16|20|25|32)\s*a\b/gi, '$1 amp');

  // Long-form module synonyms (including ASR-friendly forms).
  x = x.replace(/\b(single|one)\s+module\b/g, '1m');
  x = x.replace(/\b(double|two)\s+module\b/g, '2m');

  // Replace module words
  x = x.replace(/\b(one|two|three|four|six|eight|twelve|sixteen|eighteen)\s+module\b/g, (_, n) => {
    const map: Record<string, string> = {
      one: '1', two: '2', three: '3', four: '4', six: '6', eight: '8', twelve: '12', sixteen: '16', eighteen: '18',
    };
    return (map[n] || n) + 'm';
  });

  x = x.replace(/\b(1|2|3|4|6|8|12|16|18)\s+module\b/g, '$1m');
  x = x.replace(/\b(ampere|amperes|amps|amp|એમ્પિયર|એમ્પ|एम्पियर)\b/g, 'amp');
  x = x.replace(/\bmodule\b/g, 'm');
  x = x.replace(/\b(single|one)\s+m\b/g, '1m');
  x = x.replace(/\b(double|two)\s+m\b/g, '2m');
  x = x.replace(/\b(dube|દુબે|ડુબે|tu\s*ve|too\s*way)\b/gi, 'two way');
  x = x.replace(/\b(one\s*ve)\b/gi, 'one way');
  x = x.replace(/\b(grac|grase)\b/gi, 'grace');

  // Preserve unified code patterns (e.g. "fx 1102" or "fx-1102" -> "fx1102")
  x = x.replace(/\b(fx)\s+(\d{4})\b/gi, '$1$2');
  x = x.replace(/\b(s)\s+(\d{4,6})\b/gi, '$1$2');
  x = x.replace(/\b(v)\s+(\d{4,6})\b/gi, '$1$2');

  x = x.replace(/\s+/g, ' ').trim();
  return x;
}

// Convert Gujarati/Hindi aliases & seed vocabulary to English search tokens
export function toEnglishSearchWords(raw: string): string {
  let s = normalizeSpoken(raw);

  // Match seed vocabulary aliases first
  const seeds: SeedVocabularyItem[] = seedVocabulary;
  for (const item of seeds) {
    for (const alias of item.aliases || []) {
      const a = norm(alias);
      if (a && s === a) return item.canonical;
      if (a && s.includes(a)) {
        s = s.replaceAll(a, norm(item.canonical));
      }
    }
  }

  // Replace spoken phrases in descending order of length
  const phraseEntries = Object.entries(PHRASE_TRANSLATIONS).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [k, v] of phraseEntries) {
    s = s.replaceAll(norm(k), norm(v));
  }

  // Replace speech-recognition mistakes
  s = s.replace(/\bdube\b/gi, 'two way');
  s = s.replace(/\btu\s*ve\b/gi, 'two way');
  s = s.replace(/\btoo\s*way\b/gi, 'two way');
  s = s.replace(/\bone\s*ve\b/gi, 'one way');
  s = s.replace(/\bgrac\b/gi, 'grace');
  s = s.replace(/\bgrase\b/gi, 'grace');
  s = s.replace(/\bglid\b/gi, 'glide');
  s = s.replace(/\bchrom\b/gi, 'chrome');

  s = normalizeSpoken(s);

  // Convert bare rating numbers into AMP ratings in product context (e.g. "GRACE 20" -> "GRACE 20 AMP")
  // Only when not part of a product code like FX1102, S30111, and not followed by 'm', 'module', or 'way'
  s = s.replace(/\b(6|10|16|20|25|32)\b(?!\s*amp|\s*m\b|\s*way\b)/gi, '$1 amp');

  return s.toUpperCase().trim();
}

// Extract attributes from phrase
export function parseAttrs(s: string): ParsedAttributes {
  const x = normalizeSpoken(s).toUpperCase();
  const a: ParsedAttributes = {};

  // Brand / Family
  const seeds: SeedVocabularyItem[] = seedVocabulary;
  for (const item of seeds) {
    if (new RegExp(`\\b${norm(item.canonical)}\\b`, 'i').test(x)) {
      a.brand = item.canonical;
      break;
    }
  }

  // Module (1M, 2M, etc.)
  const m = x.match(/\b(1|2|3|4|6|8|12|16|18)\s*M\b/);
  if (m) a.module = m[1] + 'M';

  // Ampere
  // 1. Explicit AMP pattern (e.g. 20 AMP, 16 AMP, 10 AMP)
  const am = x.match(/\b(6|10|16|20|25|32)\s*AMP\b/);
  if (am) {
    a.amp = am[1];
  } else {
    // 2. Standalone rating number not followed by M or WAY
    const bareNum = x.match(/\b(6|10|16|20|25|32)\b(?!\s*M\b|\s*WAY\b)/);
    if (bareNum) {
      a.amp = bareNum[1];
    }
  }

  // Collect any unresolved numbers that aren't module, amp, or switch way
  const allNumbers = x.match(/\b\d+\b/g) || [];
  const unresolved: string[] = [];
  const moduleNum = a.module ? a.module.replace('M', '') : '';
  const ampNum = a.amp || '';
  const isSwitchWayNumber = (n: string) =>
    (n === '1' || n === '2') && /\b(ONE|TWO|1|2)\s*WAY\b/.test(x);

  for (const n of allNumbers) {
    if (n === moduleNum || n === ampNum || isSwitchWayNumber(n)) continue;
    unresolved.push(n);
  }
  if (unresolved.length > 0) {
    a.unresolvedNumbers = unresolved;
  }

  // Product Code pattern (e.g. FX1102, S30111, V5001)
  const codeMatch = x.match(/\b(FX\d+|S\d{4,6}|V\d{4,6})\b/i);
  if (codeMatch) {
    a.code = codeMatch[1].toUpperCase();
  }

  // Variant & Colour Code
  if (/\b(CHROME|ક્રોમ|क्रोम)\b/i.test(x)) {
    a.variant = 'CHROME';
    a.colourCode = 'CR';
  } else if (/\b(PURE WHITE|PW)\b/i.test(x)) {
    a.variant = 'PURE WHITE';
    a.colourCode = 'PW';
  } else if (/\b(MAPPLE WOOD|WOOD|MW|WD)\b/i.test(x)) {
    a.variant = 'MAPPLE WOOD';
    a.colourCode = 'MW';
  } else if (/\b(WARM WHITE|WW)\b/i.test(x)) {
    a.variant = 'WARM WHITE';
    a.colourCode = 'WW';
  } else if (/\b(BLUE|બ્લુ|BL)\b/i.test(x)) {
    a.variant = 'BLUE';
    a.colourCode = 'BL';
  } else if (/\b(RED|લાલ)\b/i.test(x)) {
    a.variant = 'RED';
    a.colourCode = 'RED';
  } else if (/\b(WHITE|વ્હાઇટ|સફેદ|WH)\b/i.test(x)) {
    a.variant = 'WHITE';
    a.colourCode = 'WH';
  }

  // Switch Type
  if (/\b(TWO WAY|2 WAY|ટુ વે|દુબે|ડુબે|DUBE)\b/i.test(x)) a.switchType = 'TWO WAY';
  else if (/\b(ONE WAY|1 WAY|વન વે)\b/i.test(x)) a.switchType = 'ONE WAY';

  // Indicator
  if (/\b(WITH INDICATOR|INDICATOR|ઇન્ડિકેટર)\b/i.test(x) && !/\b(WITHOUT|વગર|સાથે નહિ)\b/i.test(x)) {
    a.indicator = true;
  } else if (/\b(WITHOUT INDICATOR|NORMAL|સાદો)\b/i.test(x)) {
    a.indicator = false;
  }

  // Product Type
  if (/\b(CALL BELL|કોલ બેલ)\b/i.test(x)) a.productType = 'CALL BELL';
  else if (/\b(BELL PUSH|બેલ પુશ)\b/i.test(x)) a.productType = 'BELL PUSH';
  else if (/\b(SOCKET|સોકેટ)\b/i.test(x)) a.productType = 'SOCKET';
  else if (/\b(DIMMER|REGULATOR|રેગ્યુલેટર)\b/i.test(x)) a.productType = 'DIMMER';
  else if (/\b(MCB|એમસીબી)\b/i.test(x)) a.productType = 'MCB';
  else if (/\bSWITCH\b/i.test(x) || a.switchType) a.productType = 'SWITCH';

  return a;
}

// Tokenize phrase for search
export function tokensOf(s: string): string[] {
  const x = normalizeSpoken(s);
  const switchPhrase = /\b(one|1)\s+way\b/i.test(x) || /\b(two|2)\s+way\b/i.test(x);
  return x
    .split(' ')
    .filter((t) => {
      if (!t || ['a', 'an', 'the', 'with', 'without', 'and', 'is', 'switch', 'product', 'please'].includes(t)) {
        return false;
      }
      if (switchPhrase && ['1', '2', 'one', 'two', 'way'].includes(t)) return false;
      return true;
    });
}

// Phonetic key for fuzzy matching
export function phoneticKey(word: string): string {
  let x = norm(word).replace(/[^a-z0-9]/g, '');
  x = x.replace(/tch/g, 'ch').replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/qu/g, 'kw');
  x = x.replace(/igh(t?)/g, 'ide').replace(/ght/g, 't').replace(/wr/g, 'r').replace(/^kn/, 'n');
  x = x.replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/q/g, 'k').replace(/x/g, 'ks');
  x = x.replace(/(.)\1+/g, '$1');
  return x;
}

// Acoustic edit distance
export function editDistance(a: string, b: string): number {
  const prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const ca = a[i - 1];
      const cb = b[j - 1];
      const cost =
        ca === cb
          ? 0
          : /[aeiou]/.test(ca) && /[aeiou]/.test(cb)
          ? 0.45
          : 'dt'.includes(ca) && 'dt'.includes(cb)
          ? 0.25
          : 'kg'.includes(ca) && 'kg'.includes(cb)
          ? 0.3
          : 'bp'.includes(ca) && 'bp'.includes(cb)
          ? 0.3
          : 0.85;
      cur[j] = Math.min(prev[j] + 0.85, cur[j - 1] + 0.85, prev[j - 1] + cost);
    }
    for (let k = 0; k < cur.length; k++) prev[k] = cur[k];
  }
  return prev[b.length];
}

// Pronunciation similarity score (0 to 1)
export function pronunciationScore(a: string, b: string): number {
  const x = phoneticKey(a);
  const y = phoneticKey(b);
  if (!x || !y) return 0;
  const dist = editDistance(x, y);
  return Math.max(0, 1 - dist / Math.max(x.length, y.length, 1));
}

// Build unique list of meaningful catalogue vocabulary words
export function getCatalogueWords(): string[] {
  const set = new Set<string>();
  for (const p of getVoiceCatalogue()) {
    const vocabularyText = [
      p.item_name, p.description, p.variant, p.product_group,
      p.current_group, p.original_group, p.series, p.variant_group,
    ].filter(Boolean).join(' ');
    for (const w of norm(vocabularyText).split(' ')) {
      if (
        w.length >= 3 &&
        !['amp', 'with', 'way', 'one', 'two', 'switch', 'module', 'white', 'chrome', 'indicator', 'each', 'the'].includes(w) &&
        !/^\d+$/.test(w)
      ) {
        set.add(w);
      }
    }
  }
  return Array.from(set);
}

const CATALOGUE_WORDS = getCatalogueWords();

// Find nearest catalogue word
export function nearestCatalogueWord(token: string): { word: string; score: number } | null {
  const normalizedToken = norm(token);
  // Very short tokens are too collision-prone for phonetic correction.
  if (normalizedToken.length < 3) return null;
  const scored = CATALOGUE_WORDS.map((word) => ({
    word,
    score: pronunciationScore(normalizedToken, word),
  })).sort((a, b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1];
  if (!best) return null;
  const minimum = normalizedToken.length <= 4 ? 0.82 : 0.72;
  const requiredMargin = normalizedToken.length <= 4 ? 0.12 : 0.08;
  if (best.score < minimum) return null;
  if (second && best.score - second.score < requiredMargin) return null;
  return best;
}
