import { useEffect, useMemo, useState } from "react";
import GuidedCamera from "./GuidedCamera";
import ScanEditor from "./ScanEditor";
import { clearAllBatches } from "../storage/db";
import { FIELD_LABELS } from "./fieldDefinitions";

function makePage(capture, pageNumber) {
  return {
    id: crypto.randomUUID(),
    pageNumber,
    imageUrl: capture.imageUrl,
    processedImageUrl: null,
    ocrText: "",
    editedText: "",
    photoDeleted: false,
    scanMode: capture.scanMode || "rectangle",
    keyValues: {}
  };
}

function ExportDataModal({ data, pages, onClose }) {
  const rows = Object.entries(data || {});

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-3 sm:items-center"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Export Data
            </h2>

            <p className="text-xs text-slate-500">
              Key-wise data collected from {pages} scanned page
              {pages === 1 ? "" : "s"}.
            </p>
          </div>

          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-slate-100 text-lg text-slate-600"
          >
            ×
          </button>
        </div>

        {rows.length ? (
          <div className="max-h-[65vh] space-y-2 overflow-y-auto">
            {rows.map(([key, value]) => (
              <div
                key={key}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="text-xs font-semibold text-blue-700">
                  {FIELD_LABELS[key] || key}
                </div>

                <div className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                  {value}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-5 text-sm text-slate-500">
            No keyed data available yet. Scan a page and assign keys to OCR
            lines.
          </div>
        )}

        <div className="mt-4 rounded-xl bg-blue-50 p-3 text-xs text-blue-800">
          AppScript export will be connected later. For now this popup is the
          review/export staging screen.
        </div>
      </div>
    </div>
  );
}

export default function ScannerFlow() {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(null);
  const [savedPages, setSavedPages] = useState([]);
  const [showExport, setShowExport] = useState(false);

  // Keys already selected in this scanning session
  const [usedKeys, setUsedKeys] = useState([]);

  function openCamera() {
    setCameraOpen(true);
  }

  function handleCapture(capture) {
    setCameraOpen(false);

    const page = makePage(
      capture,
      savedPages.length + 1
    );

    setCurrentPage(page);
  }

  function handlePageDone(page) {
    const pageKeyValues = page.keyValues || {};

    setSavedPages((pages) => {
      const next = [...pages, page];

      const batchKeyValues = next.reduce(
        (acc, item) => ({
          ...acc,
          ...(item.keyValues || {})
        }),
        {}
      );

      localStorage.setItem(
        "documentScanner.approvedPages",
        JSON.stringify(
          next.map(
            ({
              imageUrl,
              processedImageUrl,
              ...approved
            }) => approved
          )
        )
      );

      localStorage.setItem(
        "documentScanner.keyValues",
        JSON.stringify(batchKeyValues)
      );

      return next;
    });

    // Add newly selected keys to global used-key list.
    const newlyUsedKeys = Object.keys(pageKeyValues);

    setUsedKeys((previous) => {
      const merged = new Set([
        ...previous,
        ...newlyUsedKeys
      ]);

      const result = Array.from(merged);

      localStorage.setItem(
        "documentScanner.usedKeys",
        JSON.stringify(result)
      );

      return result;
    });

    setCurrentPage(null);
  }

  function handlePageCancel() {
    if (
      currentPage?.imageUrl?.startsWith("blob:")
    ) {
      URL.revokeObjectURL(currentPage.imageUrl);
    }

    setCurrentPage(null);
  }

  function handleRetake() {
    if (
      currentPage?.imageUrl?.startsWith("blob:")
    ) {
      URL.revokeObjectURL(currentPage.imageUrl);
    }

    setCurrentPage(null);
    setCameraOpen(true);
  }

  useEffect(() => {
    const storedPages = localStorage.getItem(
      "documentScanner.approvedPages"
    );

    if (storedPages) {
      try {
        const pages = JSON.parse(storedPages);

        setSavedPages(pages);

        // Recover used keys from already saved pages
        const recoveredKeys = pages.reduce(
          (acc, page) => {
            Object.keys(page.keyValues || {}).forEach(
              (key) => acc.add(key)
            );

            return acc;
          },
          new Set()
        );

        const recoveredArray =
          Array.from(recoveredKeys);

        setUsedKeys(recoveredArray);

        localStorage.setItem(
          "documentScanner.usedKeys",
          JSON.stringify(recoveredArray)
        );
      } catch {
        localStorage.removeItem(
          "documentScanner.approvedPages"
        );
      }
    } else {
      // Try restoring keys separately
      const storedKeys = localStorage.getItem(
        "documentScanner.usedKeys"
      );

      if (storedKeys) {
        try {
          setUsedKeys(JSON.parse(storedKeys));
        } catch {
          localStorage.removeItem(
            "documentScanner.usedKeys"
          );
        }
      }
    }
  }, []);

  const exportData = useMemo(() => {
    const fromPages = savedPages.reduce(
      (acc, item) => ({
        ...acc,
        ...(item.keyValues || {})
      }),
      {}
    );

    if (Object.keys(fromPages).length) {
      return fromPages;
    }

    try {
      return JSON.parse(
        localStorage.getItem(
          "documentScanner.keyValues"
        ) || "{}"
      );
    } catch {
      return {};
    }
  }, [savedPages]);

  async function clearAllData() {
    if (
      !window.confirm(
        "Remove all scanner data from this browser? This cannot be undone."
      )
    ) {
      return;
    }

    try {
      await clearAllBatches();
    } catch (e) {
      console.warn(
        "IndexedDB clear failed",
        e
      );
    }

    try {
      localStorage.clear();
    } catch (e) {
      console.warn(
        "LocalStorage clear failed",
        e
      );
    }

    setSavedPages([]);
    setCurrentPage(null);
    setCameraOpen(false);
    setShowExport(false);
    setUsedKeys([]);
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl bg-white p-5 shadow-sm">

          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Document Scanner
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Capture one page at a time. Approve corrected
                OCR before the temporary photo is removed.
              </p>
            </div>

            <button
              onClick={clearAllData}
              className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600"
            >
              Clear All
            </button>
          </div>

          <button
            onClick={openCamera}
            className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-4 font-semibold text-white"
          >
            📷 Scan New Page
          </button>

          <button
            onClick={() => setShowExport(true)}
            disabled={!savedPages.length}
            className="mt-3 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-700 disabled:opacity-40"
          >
            📤 Export Data
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
                    {page.editedText ||
                      page.ocrText ||
                      "No OCR text"}
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
          usedKeys={usedKeys}
          onDone={handlePageDone}
          onCancel={handlePageCancel}
          onRetake={handleRetake}
        />
      )}

      {showExport && (
        <ExportDataModal
          data={exportData}
          pages={savedPages.length}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}