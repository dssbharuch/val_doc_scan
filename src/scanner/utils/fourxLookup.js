/** Match OCR-detected FX numeric codes against the canonical product records passed by ONE RETAIL AI. */
export function findFourXMatches(ocrText, catalogue = []) {
  const text = String(ocrText || '').toUpperCase();
  const codes = [...text.matchAll(/F\s*X\s*[-:#]?\s*(\d{3,8})/g)].map((match) => match[1]);
  const uniqueCodes = [...new Set(codes)];
  if (!uniqueCodes.length) return { codes: [], matches: [] };
  const matches = [];
  for (const numericCode of uniqueCodes) {
    for (const product of catalogue) {
      const baseCode = String(product?.base_code || '').toUpperCase();
      const baseMatch = baseCode.match(/^FX(\d{3,8})/);
      if (baseMatch?.[1] === numericCode) matches.push(product);
    }
  }
  return {
    codes: uniqueCodes,
    matches: [...new Map(matches.map((item) => [item.sku || `${item.base_code}-${item.variant}`, item])).values()]
  };
}
