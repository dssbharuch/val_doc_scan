import { useEffect, useState } from "react";
import GuidedCamera from "./GuidedCamera";
import ScanEditor from "./ScanEditor";
import BatchGallery from "./BatchGallery";
import AIFieldsEditor from "./AIFieldsEditor";
import { clearAllBatches } from "../storage/db";

function makePage(capture, pageNumber) {
  return { id: crypto.randomUUID(), pageNumber, imageUrl: capture.imageUrl, processedImageUrl: null, ocrText: "", editedText: "", photoDeleted: false, scanMode: capture.scanMode || "rectangle" };
}

export default function ScannerFlow() {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(null);
  const [savedPages, setSavedPages] = useState([]);
  const [showAI, setShowAI] = useState(false);
  const [finalData, setFinalData] = useState(null);

  function openCamera() { setCameraOpen(true); }
  function handleCapture(capture) { setCameraOpen(false); setCurrentPage(makePage(capture, savedPages.length + 1)); }

  function persistPages(next) {
    localStorage.setItem("documentScanner.approvedPages", JSON.stringify(next.map(({ imageUrl, processedImageUrl, ...approved }) => approved)));
  }

  function handlePageDone(page) {
    if (page.imageUrl?.startsWith("blob:")) URL.revokeObjectURL(page.imageUrl);
    setSavedPages((pages) => { const next = [...pages, { ...page, imageUrl: null, processedImageUrl: null, photoDeleted: true }]; persistPages(next); return next; });
    setCurrentPage(null);
  }
  function handlePageCancel() { if (currentPage?.imageUrl?.startsWith("blob:")) URL.revokeObjectURL(currentPage.imageUrl); setCurrentPage(null); }
  function deletePage(id) { setSavedPages((pages) => { const next = pages.filter((p) => p.id !== id); persistPages(next); return next; }); }
  function editPage(page) { setCurrentPage({ ...page, imageUrl: page.imageUrl || null }); }
  function movePage(id, direction) { setSavedPages((pages) => { const i = pages.findIndex((p) => p.id === id); const j = i + direction; if (i < 0 || j < 0 || j >= pages.length) return pages; const next = [...pages]; [next[i], next[j]] = [next[j], next[i]]; next.forEach((p, n) => p.pageNumber = n + 1); persistPages(next); return next; }); }
  function saveAI(batch) { localStorage.setItem("documentScanner.finalData", JSON.stringify(batch.finalData || { fields: [] })); setFinalData(batch.finalData || { fields: [] }); setShowAI(false); }

  useEffect(() => {
    try {
      const stored = localStorage.getItem("documentScanner.approvedPages");
      if (stored) setSavedPages(JSON.parse(stored));
      const final = localStorage.getItem("documentScanner.finalData");
      if (final) setFinalData(JSON.parse(final));
    } catch { localStorage.removeItem("documentScanner.approvedPages"); }
  }, []);

  async function clearAllData() {
    if (!window.confirm("Remove all scanner data from this browser? This cannot be undone.")) return;
    try { await clearAllBatches(); } catch (e) { console.warn("IndexedDB clear failed", e); }
    try { localStorage.clear(); } catch (e) { console.warn("LocalStorage clear failed", e); }
    setSavedPages([]); setCurrentPage(null); setCameraOpen(false); setFinalData(null); setShowAI(false);
  }

  const batch = { id: "current-batch", pages: savedPages, finalData };

  return <div className="min-h-screen bg-slate-100 p-4"><div className="mx-auto max-w-3xl"><div className="rounded-2xl bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">Document Scanner</h1><p className="mt-1 text-sm text-slate-500">Scan multiple pages, correct OCR, then organize the complete batch into valuation fields.</p></div><button onClick={clearAllData} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">Clear All</button></div>
    <button onClick={openCamera} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-4 font-semibold text-white">📷 Scan New Page</button>
    <BatchGallery pages={savedPages} onDelete={deletePage} onAdd={openCamera} onEdit={editPage} onMove={movePage} onFinish={() => setShowAI(true)} />
    {finalData?.fields?.length > 0 && <button onClick={() => setShowAI(true)} className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white">✓ Review AI Valuation Data ({finalData.fields.length} fields)</button>}
  </div></div>
  {cameraOpen && <GuidedCamera onCapture={handleCapture} onClose={() => setCameraOpen(false)} />}
  {currentPage && <ScanEditor page={currentPage} onDone={handlePageDone} onCancel={handlePageCancel} />}
  {showAI && <AIFieldsEditor batch={batch} onSave={saveAI} onClose={() => setShowAI(false)} />}
  </div>;
}
