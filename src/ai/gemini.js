import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-2.5-flash";

const schema = {
  type: "object",
  properties: {
    fields: {
      type: "array",
      description: "Document fields found in the supplied OCR text.",
      items: {
        type: "object",
        properties: {
          key: {
            type: "string",
            description: "Short English field name suitable for a database key."
          },
          value: {
            type: "string",
            description: "Value translated to English when the source is Gujarati."
          },
          original_value: {
            type: "string",
            description: "Original value as found in the OCR text, when available."
          },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"]
          }
        },
        required: ["key", "value", "original_value", "confidence"]
      }
    }
  },
  required: ["fields"]
};

function getApiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY?.trim();
}

export async function extractDocumentFields(pages) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error(
      "Gemini API key is not configured. Create a .env.local file with VITE_GEMINI_API_KEY=YOUR_KEY."
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  const combinedText = pages
    .map(
      (page) =>
        `--- PAGE ${page.pageNumber} ---\n${page.editedText || page.ocrText || ""}`
    )
    .join("\n\n");

  const prompt = `
You are extracting structured information from a scanned Indian property/legal document.

The OCR may contain Gujarati, English, or both.

Tasks:
1. Read ALL pages together.
2. Identify useful facts actually present in the text.
3. Create concise English field keys.
4. If a value is Gujarati, translate that value into clear English.
5. Preserve the original Gujarati/English value in original_value when useful.
6. Do NOT invent or guess missing information.
7. If a fact is uncertain, still include it only when the text provides evidence and mark confidence low.
8. Important examples of fields: Document Number, Date, Document Type, Registration Number, First Party, Second Party, Seller, Buyer, Survey Number, Block Number, Village, Taluka, District, Area, Consideration Amount, Stamp Duty, Registration Office, North, South, East, West, Witnesses.
9. "Chaturdisha" / property boundaries should become separate fields such as North, South, East, West.
10. Keep dates and numbers as written unless a clear standard English representation is useful.
11. Return only fields supported by the supplied OCR.

OCR TEXT:
${combinedText}
`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.1
    }
  });

  if (!response.text) {
    throw new Error("AI returned an empty response.");
  }

  const parsed = JSON.parse(response.text);

  return {
    fields: Array.isArray(parsed.fields) ? parsed.fields : []
  };
}

export function hasGeminiKey() {
  return Boolean(getApiKey());
}