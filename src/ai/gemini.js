import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3.8-flash";

const schema = {
  type: "object",
  properties: {
    fields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          value: { type: "string" },
          original_value: { type: "string" },
          source: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["key", "value", "original_value", "source", "confidence"]
      }
    }
  },
  required: ["fields"]
};

function getApiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY?.trim();
}

const MASTER_FIELDS = `
OWNER & PURCHASER
- owner_name
- purchaser_name
- property_address

LOCATION DETAILS
- plot_survey_no
- door_no
- village
- taluka
- district
- pin_code

BOUNDARIES OF PROPERTY (AS PER MAP)
- boundary_map_east
- boundary_map_west
- boundary_map_north
- boundary_map_south

BOUNDARIES OF PROPERTY (AS PER SITE)
- boundary_site_east
- boundary_site_west
- boundary_site_north
- boundary_site_south

MAP AREA
- map_area_value
- map_area_unit

DOCUMENTS
- document_1, document_2, document_3 ... for each distinct supporting-document line found. Keep the complete document description, number and date together when they occur together.

BUILT-UP AREA FLOOR-WISE
- ground_floor_area
- ground_floor_unit
- first_floor_area
- first_floor_unit
- terrace_floor_area
- terrace_floor_unit
- additional_floor_<floor_name>_area
- additional_floor_<floor_name>_unit
`;

export async function extractDocumentFields(pages) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key is not configured. Create .env.local with VITE_GEMINI_API_KEY=YOUR_KEY and restart the development server.");
  }
  const ai = new GoogleGenAI({ apiKey });
  const combinedText = pages.map((page) =>
    `--- PAGE ${page.pageNumber} ---\n${page.editedText || page.ocrText || ""}`
  ).join("\n\n");

  const prompt = `
You are organizing corrected OCR text for an Indian property valuation report.

Use ONLY the following master fields. Do not invent values. If a field is not supported by the OCR, omit it from the result. Read ALL pages together because one field may be split across pages.

MASTER FIELDS:
${MASTER_FIELDS}

Rules:
1. Map the OCR to the closest master field, not to arbitrary new fields.
2. Preserve legal names, numbers, plot/survey references and document descriptions accurately.
3. If Gujarati is present, translate the value to clear English, but put the original Gujarati text in original_value when available.
4. For boundaries, keep East/West/North/South separate.
5. For As Per Site boundaries, use an actual site value only if the OCR contains one. Do not copy Map values into Site fields unless the OCR explicitly says they are the same.
6. For documents, create one document_N field per distinct document/line found. Keep document number and date in the value when present.
7. For floor-wise area, preserve each floor separately. If another floor exists, create an additional_floor_<floor_name>_area/unit key.
8. Dates must not be guessed or generated.
9. Numbers and units must not be guessed.
10. If the same field appears in several pages, combine the information only when the text clearly refers to the same property/value.
11. source must identify the page number(s) where the value was found, for example "Page 2" or "Pages 2, 5".
12. confidence describes OCR-to-field certainty, not the truth of the document.
13. Return only supported fields.

CORRECTED OCR TEXT:
${combinedText}
`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.1 }
  });

  if (!response.text) throw new Error("AI returned an empty response.");
  const parsed = JSON.parse(response.text);
  return { fields: Array.isArray(parsed.fields) ? parsed.fields : [] };
}

export function hasGeminiKey() {
  return Boolean(getApiKey());
}
