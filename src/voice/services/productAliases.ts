/**
 * Speech aliases for product attributes. Keep this list product-agnostic:
 * aliases normalize language; only the loaded catalogue can supply products.
 */
export const PRODUCT_ATTRIBUTE_ALIASES: ReadonlyArray<{ canonical: string; aliases: string[] }> = [
  { canonical: '1M', aliases: ['one m', 'one module', 'single module', 'single m', 'એક મોડ્યુલ', 'એક મૉડ્યુલ', 'एक मॉड्यूल', 'एक मॉड्युल'] },
  { canonical: '2M', aliases: ['two m', 'two module', 'double module', 'double m', 'બે મોડ્યુલ', 'બે મૉડ્યુલ', 'दो मॉड्यूल', 'दो मॉड्युल'] },
  { canonical: 'AMPERE', aliases: ['amp', 'amps', 'ampere', 'amperes', 'એમ્પ', 'એમ્પિયર', 'એમ્પીયર', 'एम्प', 'एम्पियर'] },
  { canonical: 'ONE WAY', aliases: ['one way', '1 way', 'વન વે', 'એક વે', 'એક તરફ', 'वन वे'] },
  { canonical: 'TWO WAY', aliases: ['two way', '2 way', 'ટુ વે', 'બે વે', 'બે તરફ', 'दू वे', 'टू वे'] },
  { canonical: 'WHITE', aliases: ['white', 'વ્હાઇટ', 'સફેદ', 'सफेद'] },
  { canonical: 'CHROME', aliases: ['chrome', 'ક્રોમ', 'क्रोम'] },
  { canonical: 'WITH INDICATOR', aliases: ['indicator', 'with indicator', 'ઇન્ડિકેટર', 'ઇન્ડિકેટર સાથે', 'इंडिकेटर'] },
  { canonical: 'WITHOUT INDICATOR', aliases: ['without indicator', 'ઇન્ડિકેટર વગર', 'ઇન્ડિકેટર વિના', 'बिना इंडिकेटर'] },
  { canonical: 'BELL PUSH', aliases: ['bell push', 'bellpush', 'bel push', 'belpur', 'bellpur', 'belp us', 'બેલ પુશ', 'बेल पुश'] },
];

/** Apply aliases in one pass so a short alias cannot rewrite part of a longer one. */
export function applyProductAliases(input: string): string {
  const entries = PRODUCT_ATTRIBUTE_ALIASES.flatMap(({ canonical, aliases }) =>
    aliases.map((alias) => ({ alias, canonical }))
  ).sort((a, b) => b.alias.length - a.alias.length);
  const canonicalByAlias = new Map(entries.map(({ alias, canonical }) => [alias.toLowerCase(), canonical]));
  const alternatives = entries.map(({ alias }) =>
    alias.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  );
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}])(${alternatives.join('|')})(?=[^\\p{L}\\p{N}]|$)`,
    'giu'
  );
  return String(input || '').replace(pattern, (_match, prefix: string, aliasMatch: string) =>
    `${prefix}${canonicalByAlias.get(aliasMatch.toLowerCase()) || aliasMatch}`
  );
}
