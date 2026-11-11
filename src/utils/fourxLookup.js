import fourXData from "../data/fourx-products.json";

const products = Array.isArray(fourXData?.products) ? fourXData.products : [];

// Search the complete OCR text, not just its first word/character.
// Example: "Item ABC FX1102WH SWITCH" -> numeric code "1102".
export function findFourXMatches(ocrText) {
  const text = String(ocrText || "").toUpperCase();
  const codes = [...text.matchAll(/F\s*X\s*[-:#]?\s*(\d{3,8})/g)]
    .map((match) => match[1]);
  const uniqueCodes = [...new Set(codes)];
  if (!uniqueCodes.length) return { codes: [], matches: [] };

  const matches = [];
  for (const numericCode of uniqueCodes) {
    const found = products.filter((product) => {
      const baseCode = String(product?.base_code || "").toUpperCase();
      const baseMatch = baseCode.match(/^FX(\d{3,8})/);
      return baseMatch?.[1] === numericCode;
    });
    matches.push(...found);
  }

  // Keep different variants, but remove duplicate identical records.
  const uniqueMatches = [...new Map(matches.map((item) => [item.sku || `${item.base_code}-${item.variant}`, item])).values()];
  return { codes: uniqueCodes, matches: uniqueMatches };
}
