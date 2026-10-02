import { useState } from "react";
import { extractDocumentFields, hasGeminiKey } from "../ai/gemini";

export default function AIFieldsEditor({ batch, onSave, onClose }) {
  const [fields, setFields] = useState(batch.finalData?.fields || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasAnalyzed, setHasAnalyzed] = useState(
    (batch.finalData?.fields || []).length > 0
  );

  function updateField(index, property, value) {
    setFields((current) =>
      current.map((field, i) =>
        i === index ? { ...field, [property]: value } : field
      )
    );
  }

  function addField() {
    setFields((current) => [
      ...current,
      {
        key: "New Field",
        value: "",
        original_value: "",
        confidence: "high"
      }
    ]);
  }

  function deleteField(index) {
    setFields((current) => current.filter((_, i) => i !== index));
  }

  async function analyze() {
    setError("");

    if (!hasGeminiKey()) {
      setError(
        "Gemini API key is not configured. Add VITE_GEMINI_API_KEY to .env.local and restart the development server."
      );
      return;
    }

    if (!batch.pages.length) {
      setError("There are no pages to analyze.");
      return;
    }

    const hasText = batch.pages.some(
      (page) => (page.editedText || page.ocrText || "").trim()
    );

    if (!hasText) {
      setError("No OCR text is available yet.");
      return;
    }

    try {
      setLoading(true);
      const result = await extractDocumentFields(batch.pages);
      setFields(result.fields);
      setHasAnalyzed(true);
    } catch (err) {
      console.error(err);
      setError(err.message || "AI analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  function save() {
    onSave({
      ...batch,
      finalData: {
        fields
      },
      status: "completed",
      updatedAt: new Date().toISOString()
    });
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950">
      <div className="mx-auto min-h-screen max-w-3xl bg-slate-100">
        <header className="sticky top-0 z-20 flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
          <div>
            <div className="text-xs text-slate-300">Step 4</div>
            <h2 className="font-semibold">AI Document Data</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-white/10 px-3 py-2 text-sm"
          >
            Close
          </button>
        </header>

        <div className="p-4">
          {!hasAnalyzed && (
            <section className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">
                Create Keys & Values
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                AI will read the corrected OCR text from all pages together.
                Gujarati values can be translated to English. Missing
                information will not be invented.
              </p>

              <button
                onClick={analyze}
                disabled={loading}
                className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
              >
                {loading ? "✨ Analyzing..." : "✨ Analyze with Gemini AI"}
              </button>
            </section>
          )}

          {hasAnalyzed && (
            <>
              <section className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Extracted Fields
                    </h3>
                    <p className="text-xs text-slate-500">
                      Both keys and values are editable.
                    </p>
                  </div>

                  <button
                    onClick={analyze}
                    disabled={loading}
                    className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50"
                  >
                    {loading ? "Analyzing..." : "Run AI Again"}
                  </button>
                </div>

                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div
                      key={`${index}-${field.key}`}
                      className="rounded-xl border border-slate-200 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">
                          Field {index + 1} · {field.confidence || "unknown"}
                        </span>
                        <button
                          onClick={() => deleteField(index)}
                          className="text-xs text-red-600"
                        >
                          Delete
                        </button>
                      </div>

                      <label className="text-xs text-slate-500">Key</label>
                      <input
                        value={field.key}
                        onChange={(e) =>
                          updateField(index, "key", e.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-blue-500"
                      />

                      <label className="mt-3 block text-xs text-slate-500">
                        Value
                      </label>
                      <textarea
                        value={field.value}
                        onChange={(e) =>
                          updateField(index, "value", e.target.value)
                        }
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      />

                      {field.original_value &&
                        field.original_value !== field.value && (
                          <div className="mt-2 rounded-lg bg-slate-50 p-2">
                            <div className="text-[11px] text-slate-400">
                              Original OCR value
                            </div>
                            <div className="mt-1 whitespace-pre-wrap text-xs text-slate-600">
                              {field.original_value}
                            </div>
                          </div>
                        )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={addField}
                  className="mt-4 w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"
                >
                  + Add Field
                </button>

                <button
                  onClick={save}
                  className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white"
                >
                  ✓ Save Final Data
                </button>
              </section>
            </>
          )}

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700">
              {error}
            </div>
          )}

          <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            This personal version sends only the corrected OCR text to Gemini
            when you press Analyze. The scanned images remain in your local
            IndexedDB storage.
          </div>
        </div>
      </div>
    </div>
  );
}