import { useState } from "react";
import { extractDocumentFields, hasGeminiKey } from "../ai/gemini";

export default function AIFieldsEditor({ batch, onSave, onClose }) {
  const [fields, setFields] = useState(batch.finalData?.fields || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasAnalyzed, setHasAnalyzed] = useState(fields.length > 0);

  function updateField(index, property, value) {
    setFields((current) => current.map((field, i) => i === index ? { ...field, [property]: value } : field));
  }
  function addField() {
    setFields((current) => [...current, { key: "new_field", value: "", original_value: "", source: "Manual", confidence: "high" }]);
  }
  function deleteField(index) { setFields((current) => current.filter((_, i) => i !== index)); }

  async function analyze() {
    setError("");
    if (!hasGeminiKey()) {
      setError("Gemini API key is not configured. Add VITE_GEMINI_API_KEY to .env.local and restart the development server.");
      return;
    }
    if (!batch.pages?.length) { setError("There are no pages to analyze."); return; }
    if (!batch.pages.some((p) => (p.editedText || p.ocrText || "").trim())) { setError("No corrected OCR text is available yet."); return; }
    try {
      setLoading(true);
      const result = await extractDocumentFields(batch.pages);
      setFields(result.fields);
      setHasAnalyzed(true);
    } catch (err) {
      console.error(err);
      setError(err.message || "AI analysis failed.");
    } finally { setLoading(false); }
  }

  function save() {
    onSave({ ...batch, finalData: { fields }, status: "completed", updatedAt: new Date().toISOString() });
  }

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950">
    <div className="mx-auto min-h-screen max-w-3xl bg-slate-100">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
        <div><div className="text-xs text-slate-300">Step 4</div><h2 className="font-semibold">AI Valuation Data</h2></div>
        <button onClick={onClose} className="rounded-lg bg-white/10 px-3 py-2 text-sm">Close</button>
      </header>
      <div className="p-4">
        {!hasAnalyzed && <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Organize scanned data</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">AI will read all approved OCR pages together and map them only to the Property Valuation fields. Missing values are left blank; AI will not invent data.</p>
          <div className="mt-3 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-800">Fields covered: Owner, Purchaser, Property Address, Survey/Plot, Door No., Village, Taluka, District, PIN, Map/Site boundaries, Map Area, Documents and floor-wise Built-up Area.</div>
          <button onClick={analyze} disabled={loading} className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{loading ? "✨ Organizing..." : "✨ Organize Data with Gemini AI"}</button>
        </section>}

        {hasAnalyzed && <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold">AI Key / Value Data</h3><p className="text-xs text-slate-500">Both keys and values can be edited before saving.</p></div><button onClick={analyze} disabled={loading} className="rounded-lg bg-slate-100 px-3 py-2 text-xs">{loading ? "Analyzing..." : "Run AI Again"}</button></div>
          <div className="space-y-4">
            {fields.map((field, index) => <div key={`${index}-${field.key}`} className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between"><span className="text-xs font-medium text-slate-500">{index + 1} · {field.confidence || "unknown"}</span><button onClick={() => deleteField(index)} className="text-xs text-red-600">Delete</button></div>
              <label className="text-xs text-slate-500">Key</label>
              <input value={field.key || ""} onChange={(e) => updateField(index, "key", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium outline-none focus:border-blue-500" />
              <label className="mt-3 block text-xs text-slate-500">Value</label>
              <textarea value={field.value || ""} onChange={(e) => updateField(index, "value", e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500"><span>Source: {field.source || "Not specified"}</span>{field.original_value && <span>· Original: {field.original_value}</span>}</div>
            </div>)}
          </div>
          <button onClick={addField} className="mt-4 w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium">+ Add Field</button>
          <button onClick={save} className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white">✓ Save Organized Data</button>
        </section>}
        {error && <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm leading-6 text-red-700">{error}</div>}
      </div>
    </div>
  </div>;
}
