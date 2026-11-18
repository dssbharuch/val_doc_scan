import { convertVernacularDigits, cleanCode } from './pronunciationService.ts';
import { applyProductAliases } from './productAliases.ts';

export interface NormalizedSpeechResult {
  rawTranscript: string;
  normalizedTranscript: string;
  detectedLanguage: 'gujarati' | 'hindi' | 'english' | 'mixed';
  confidence: number;
}

// 1. Comprehensive Gujarati, Hindi, and English number word mapping
export const NUMBER_WORDS_MAP: Record<string, string> = {
  // 1-10
  'ek': '1', 'એક': '1', 'एक': '1', 'one': '1', 'વન': '1',
  'be': '2', 'બે': '2', 'do': '2', 'દો': '2', 'दो': '2', 'two': '2', 'ટુ': '2',
  'tran': '3', 'ત્રણ': '3', 'teen': '3', 'तीन': '3', 'three': '3', 'થ્રી': '3',
  'char': '4', 'chaar': '4', 'ચાર': '4', 'चार': '4', 'four': '4', 'ફોર': '4',
  'panch': '5', 'paanch': '5', 'પાંચ': '5', 'पांच': '5', 'पाँच': '5', 'five': '5', 'ફાઇવ': '5',
  'chha': '6', 'chhe': '6', 'છ': '6', 'છઠ': '6', 'छह': '6', 'छे': '6', 'six': '6', 'સિક્સ': '6',
  'saat': '7', 'sat': '7', 'સાત': '7', 'सात': '7', 'seven': '7', 'સેવન': '7',
  'aath': '8', 'ath': '8', 'આઠ': '8', 'आठ': '8', 'eight': '8', 'એઇટ': '8',
  'nau': '9', 'nav': '9', 'નવ': '9', 'नौ': '9', 'nine': '9', 'નાઇન': '9',
  'das': '10', 'દસ': '10', 'दस': '10', 'ten': '10', 'ટેન': '10',

  // 11-20
  'agyar': '11', 'giyarah': '11', 'gyarah': '11', 'અગિયાર': '11', 'ग्यारह': '11', 'eleven': '11',
  'bar': '12', 'baar': '12', 'barah': '12', 'બાર': '12', 'बारह': '12', 'twelve': '12',
  'ter': '13', 'terah': '13', 'તેર': '13', 'तेरह': '13', 'thirteen': '13',
  'chaud': '14', 'chaudah': '14', 'ચૌદ': '14', 'चौदह': '14', 'fourteen': '14',
  'pandar': '15', 'pandrah': '15', 'પંદર': '15', 'पंद्रह': '15', 'fifteen': '15',
  'sol': '16', 'solah': '16', 'sola': '16', 'સોળ': '16', 'सोलह': '16', 'sixteen': '16',
  'sattar': '17', 'satrah': '17', 'સત્તર': '17', 'सत्रह': '17', 'seventeen': '17',
  'adhar': '18', 'atharah': '18', 'અઢાર': '18', 'अठारह': '18', 'eighteen': '18',
  'ognis': '19', 'unnis': '19', 'ઓગણીસ': '19', 'उन्नीस': '19', 'nineteen': '19',
  'vis': '20', 'vees': '20', 'bees': '20', 'વીસ': '20', 'બીસ': '20', 'बीस': '20', 'twenty': '20',

  // 21-100
  'ekvis': '21', 'ikkis': '21', 'એકવીસ': '21', 'इक्कीस': '21',
  'bavis': '22', 'baais': '22', 'બાવીસ': '22', 'बाईस': '22',
  'tevis': '23', 'teis': '23', 'તેવીસ': '23', 'तेईस': '23',
  'chovis': '24', 'chaubis': '24', 'ચોવીસ': '24', 'चौबीस': '24',
  'pachis': '25', 'pachees': '25', 'પચ્ચીસ': '25', 'પચીસ': '25', 'पच्चीस': '25', 'पचीस': '25',
  'chhavis': '26', 'chhattis': '26', 'છવીસ': '26', 'छब्बीस': '26',
  'sattavis': '27', 'sattais': '27', 'સત્તાવીસ': '27', 'सत्ताईस': '27',
  'atthavis': '28', 'atthais': '28', 'અઠ્ઠાવીસ': '28', 'अट्ठाईस': '28',
  'ognogntris': '29', 'unattis': '29', 'ઓગણત્રીસ': '29', 'उनतीस': '29',
  'tris': '30', 'tees': '30', 'ત્રીસ': '30', 'तीस': '30', 'thirty': '30',
  'battis': '32', 'બત્રીસ': '32', 'बत्तीस': '32',
  'chalis': '40', 'ચાલીસ': '40', 'चालीस': '40', 'forty': '40',
  'pachas': '50', 'પચાસ': '50', 'पचास': '50', 'fifty': '50',
  'so': '100', 'sau': '100', 'સો': '100', 'सौ': '100', 'hundred': '100',
};

// Replace word with Unicode boundaries (boundary-safe for Gujarati / Hindi scripts)
function replaceWord(text: string, patternStr: string, replacement: string): string {
  const regex = new RegExp(`(^|[^\\p{L}\\p{N}])(?:${patternStr})(?=[^\\p{L}\\p{N}]|$)`, 'gui');
  return text.replace(regex, `$1${replacement}`);
}

// Detect language from character sets
export function detectLanguage(text: string): 'gujarati' | 'hindi' | 'english' | 'mixed' {
  const hasGujarati = /[\u0a80-\u0aff]/.test(text);
  const hasHindi = /[\u0900-\u097f]/.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);

  if (hasGujarati && !hasHindi && !hasLatin) return 'gujarati';
  if (hasHindi && !hasGujarati && !hasLatin) return 'hindi';
  if (hasLatin && !hasGujarati && !hasHindi) return 'english';
  return 'mixed';
}

/**
 * Universal Speech Normalizer
 * Converts spoken Gujarati, Hindi, or English merchant speech into standardized English text.
 * - Converts number words (દસ, બીસ, પાંચ) to digits (10, 20, 5)
 * - Converts vernacular digits (૦-૯, ०-९) to ASCII (0-9)
 * - Normalizes quantity units (નંગ, નગ, नग, nang, nag) to PIECES
 * - Normalizes series, colours, ampere, modules, and switch attributes into canonical English
 */
export function normalizeMerchantSpeech(
  rawTranscript: string,
  _hintLanguage?: string
): NormalizedSpeechResult {
  const raw = String(rawTranscript || '').trim();
  if (!raw) {
    return {
      rawTranscript: '',
      normalizedTranscript: '',
      detectedLanguage: 'english',
      confidence: 1.0,
    };
  }

  const detectedLanguage = detectLanguage(raw);

  // 1. Convert vernacular digits (૦-૯ and ०-९) to ASCII 0-9
  let text = applyProductAliases(convertVernacularDigits(raw));

  // 2. Pre-normalize combined Ampere phrases with Gujarati/Hindi words before word splitting
  text = replaceWord(text, 'દસ\\s*એમ્પીયર|દસ\\s*એમ્પિયર|દસ\\s*એમ્પ|दस\\s*एम्पियर', '10 AMPERE');
  text = replaceWord(text, 'સોળ\\s*એમ્પીયર|સોળ\\s*એમ્પિયર|સોળ\\s*એમ્પ|सोलह\\s*एम्पियर', '16 AMPERE');
  text = replaceWord(text, 'વીસ\\s*એમ્પીયર|વીસ\\s*એમ્પિયર|વીસ\\s*એમ્પ|બીસ\\s*એમ્પીયર|बीस\\s*एम्पियर', '20 AMPERE');
  text = replaceWord(text, 'પચ્ચીસ\\s*એમ્પીયર|પચીસ\\s*એમ્પીયર|પચીસ\\s*એમ્પ|पच्चीस\\s*एम्पियर', '25 AMPERE');
  text = replaceWord(text, 'બત્રીસ\\s*એમ્પીયર|બત્રીસ\\s*એમ્પ|बत्तीस\\s*एम्पियर', '32 AMPERE');
  text = replaceWord(text, 'છ\\s*એમ્પીયર|છ\\s*એમ્પ|छह\\s*एम्पियर', '6 AMPERE');

  // 3. Pre-normalize switch switching attribute phrases (ONE WAY / TWO WAY / BELL PUSH)
  text = replaceWord(text, 'એક\\s*તરફ|વન\\s*વે|એક\\s*વે|one\\s*ve', 'ONE WAY');
  text = replaceWord(text, 'બે\\s*તરફ|દો\\s*તરફ|ટુ\\s*વે|બે\\s*વે|દો\\s*વે|ડુબે|દુબે|dube|tu\\s*ve|too\\s*way', 'TWO WAY');
  text = replaceWord(text, 'બેલ\\s*પુશ|ઘંટડી|बेल\\s*पुश', 'BELL PUSH');
  text = replaceWord(text, 'ઇન્ડિકેટર\\s*સાથે|લાઇટ\\s*સાથે|with\\s*light|with\\s*ind', 'WITH INDICATOR');
  text = replaceWord(text, 'ઇન્ડિકેટર\\s*વગર|લાઇટ\\s*વગર|without\\s*light|without\\s*ind', 'WITHOUT INDICATOR');

  // 4. Pre-normalize Series names
  text = replaceWord(text, 'ગ્રેસ|ग्रेस|grac|grase', 'GRACE');
  text = replaceWord(text, 'ગ્લાયક|ગ્લાઇક|ગ્લાઇડ|ગ્લાઈડ|ग्लाइड|glid|glaik|glyak', 'GLIDE');
  text = replaceWord(text, 'ગ્લેમ|ग्लैम', 'GLAM');
  text = replaceWord(text, 'એફ\\s*ટચ|એફટચ|ફ\\s*ટચ|एफ\\s*टच|f\\s*touch|ftouch', 'F TOUCH');
  text = replaceWord(text, 'ટેસ્લા|टेस्ला', 'TESLA');

  // 5. Pre-normalize Colours
  text = replaceWord(text, 'પ્યોર\\s*વ્હાઇટ|પ્યોર\\s*સફેદ|प्योर\\s*सफेद|pure\\s*white', 'PURE WHITE');
  text = replaceWord(text, 'સફેદ|વ્હાઇટ|सफेद', 'WHITE');
  text = replaceWord(text, 'કાળો|બ્લેક|કાળા|काला|काळा', 'BLACK');
  text = replaceWord(text, 'લાલ|રેડ|लाल', 'RED');
  text = replaceWord(text, 'ક્રોમ|क्रोम', 'CHROME');
  text = replaceWord(text, 'મેપલ\\s*વૂડ|મેપલવૂડ|મેપલ|mapple\\s*wood|maple\\s*wood', 'MAPPLE WOOD');
  text = replaceWord(text, 'વોલનટ|અમેરિકન\\s*વોલનટ|walnut', 'AMERICAN WALNUT');

  // 6. Pre-normalize FX and series code patterns
  text = text.replace(/(?:^|[^\p{L}\p{N}])(?:એફ\s*એક્સ|એફએક્સ|एफ\s*एक्स|एफएक्स|eff\s*x|f\s*x|f\.x\.)\s*[-]?\s*(\d+)/gui, ' FX$1');

  // 7. Replace individual number words (Gujarati / Hindi / English)
  for (const [word, digit] of Object.entries(NUMBER_WORDS_MAP)) {
    text = replaceWord(text, word, digit);
  }

  // 7b. Re-normalize ONE WAY and TWO WAY (prevent 'one'/'two' from splitting into 1 WAY / 2 WAY)
  text = text.replace(/(?:^|[^\p{L}\p{N}])(?:1\s*WAY|ONE\s*WAY)(?=[^\p{L}\p{N}]|$)/gui, ' ONE WAY');
  text = text.replace(/(?:^|[^\p{L}\p{N}])(?:2\s*WAY|TWO\s*WAY)(?=[^\p{L}\p{N}]|$)/gui, ' TWO WAY');

  // 7c. Normalize number selection commands e.g. "NUMBER 1", "NUMBER 2"
  text = text.replace(/(?:^|[^\p{L}\p{N}])(?:નંબર|नंबर|number|no\.?|item|option)\s*[:=]?\s*(\d+)(?=[^\p{L}\p{N}]|$)/gui, ' NUMBER $1');

  // 8. Normalize Ampere suffixes (e.g. "10 ampere", "10a", "20a", "16 a", "10amp", "10 amp") -> "10 AMPERE"
  text = text.replace(/(?:^|[^\p{L}\p{N}])(6|10|16|20|25|32)\s*(?:a|amp|amps|amperes|ampere|એમ્પીયર|એમ્પિયર|એમ્પ|एम्पियर)(?=[^\p{L}\p{N}]|$)/gui, ' $1 AMPERE');
  text = replaceWord(text, 'amp|amps|amperes|એમ્પીયર|એમ્પિયર|એમ્પ|एम्पियर', 'AMPERE');
  // Browser ASR sometimes inserts the filler article in phrases such as "Glide the ampere".
  // Remove only this narrow phrase; an absent ampere value is then resolved by family defaults.
  text = text.replace(/\bTHE\s+AMPERE\b/gi, 'AMPERE');

  // 9. Normalize long-form single/double module expressions before generic module parsing.
  text = replaceWord(text, 'single\\s*module|one\\s*module|એક\\s*મોડ્યુલ|एक\\s*मॉड्यूल', '1 MODULE');
  text = replaceWord(text, 'double\\s*module|two\\s*module|બે\\s*મોડ્યુલ|दो\\s*मॉड्यूल', '2 MODULE');

  // 9b. Normalize modules (e.g. "6 module", "6 મોડ્યુલ", "6 m", "6mod") -> "6M"
  text = text.replace(/(?:^|[^\p{L}\p{N}])(1|2|3|4|6|8|10|12|16|18|20|24)\s*(?:m|module|mod|મોડ્યુલ|मॉड्यूल)(?=[^\p{L}\p{N}]|$)/gui, ' $1M');

  // 10. Normalize quantity units:
  // "5 nang", "10 નંગ", "20 नग", "5 nag", "5 nug" -> "5 PIECES"
  text = text.replace(
    /(?:^|[^\p{L}\p{N}])(\d+)\s*(?:nang|nangs|nag|nags|nug|nugs|naam|nam|નંગ|નગ|नग|नंग|pieces|piece|pcs|pc|nos|units)(?=[^\p{L}\p{N}]|$)/gui,
    ' $1 PIECES'
  );
  text = text.replace(
    /(?:^|[^\p{L}\p{N}])(?:quantity|qty|નંગ|નગ|नग)\s*[:=]?\s*(\d+)(?=[^\p{L}\p{N}]|$)/gui,
    ' $1 PIECES'
  );

  // Standalone "nang", "નંગ", "નગ", "नग"
  text = replaceWord(text, 'nang|nangs|nag|nags|nug|nugs|નંગ|નગ|नग|नंग', 'PIECES');

  // Clean extra spaces & uppercase
  const normalizedTranscript = text.replace(/\s+/g, ' ').trim().toUpperCase();

  return {
    rawTranscript: raw,
    normalizedTranscript,
    detectedLanguage,
    confidence: 0.95,
  };
}
