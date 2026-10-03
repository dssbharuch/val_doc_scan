import { useEffect, useState } from "react";
import GuidedCamera from "./GuidedCamera";
import ScanEditor from "./ScanEditor";
import { clearAllBatches } from "../storage/db";

function makePage(capture, pageNumber) {
  return {
    id: crypto.randomUUID(),
    pageNumber,
    imageUrl: capture.imageUrl,
    processedImageUrl: null,
    ocrText: "",
    editedText: "",
    photoDeleted: false,
    scanMode: capture.scanMode || "rectangle"
  };
}

export default function ScannerFlow() {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(null);
  const [savedPages, setSavedPages] = useState([]);

  function openCamera() {
    setCameraOpen(true);
  }

  function handleCapture(capture) {
    setCameraOpen(false);
    const page = makePage(capture, savedPages.length + 1);
    setCurrentPage(page);
  }

  function handlePageDone(page) {
    setSavedPages((pages) => {
      const next = [...pages, page];

      // Persist only approved data; temporary photo fields are null.
      localStorage.setItem(
        "documentScanner.approvedPages",
        JSON.stringify(
          next.map(({ imageUrl, processedImageUrl, ...approved }) => approved)
        )
      );

      return next;
    });

    setCurrentPage(null);
  }

  function handlePageCancel() {
    if (currentPage?.imageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(currentPage.imageUrl);
    }
    setCurrentPage(null);
  }

  useEffect(() => {
    const stored = localStorage.getItem("documentScanner.approvedPages");
    if (!stored) return;

    try {
      setSavedPages(JSON.parse(stored));
    } catch {
      localStorage.removeItem("documentScanner.approvedPages");
    }
  }, []);

  async function clearAllData() {
    if (!window.confirm("Remove all scanner data from this browser? This cannot be undone.")) return;
    try { await clearAllBatches(); } catch (e) { console.warn("IndexedDB clear failed", e); }
    try { localStorage.clear(); } catch (e) { console.warn("LocalStorage clear failed", e); }
    setSavedPages([]);
    setCurrentPage(null);
    setCameraOpen(false);
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">
            Document Scanner
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Capture one page at a time. Approve corrected OCR before the
            temporary photo is removed.
          </p></div><button onClick={clearAllData} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">Clear All</button></div>

          <button
            onClick={openCamera}
            className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-4 font-semibold text-white"
          >
            📷 Scan New Page
          </button>

          <div className="mt-5">
            <div className="mb-2 font-semibold text-slate-900">
              Approved pages: {savedPages.length}
            </div>

            <div className="space-y-2">
              {savedPages.map((page) => (
                <div
                  key={page.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      Page {page.pageNumber}
                    </span>
                    <span className="text-xs text-emerald-700">
                      ✓ Photo deleted
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-slate-600">
                    {page.editedText || page.ocrText || "No OCR text"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {cameraOpen && (
        <GuidedCamera
          onCapture={handleCapture}
          onClose={() => setCameraOpen(false)}
        />
      )}

      {currentPage && (
        <ScanEditor
          page={currentPage}
          onDone={handlePageDone}
          onCancel={handlePageCancel}
        />
      )}
    </div>
  );
}