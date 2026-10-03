export default function BatchGallery({
  pages,
  onDelete,
  onAdd,
  onEdit,
  onMove,
  onFinish
}) {
  if (!pages.length) return null;

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-800">Current Batch</h2>
          <p className="text-xs text-slate-500">
            {pages.length} page{pages.length === 1 ? "" : "s"} · local
          </p>
        </div>

        <button
          onClick={onAdd}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          + Add Page
        </button>
      </div>

      <div className="space-y-3">
        {pages.map((page, index) => (
          <div
            key={page.id}
            className="flex gap-3 rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
          >
            <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
              OCR
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-800">
                  Page {index + 1}
                </div>

                <button
                  onClick={() => onDelete(page.id)}
                  className="rounded-lg px-2 py-1 text-sm text-red-600"
                >
                  Delete
                </button>
              </div>

              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-slate-500">
                {page.editedText || page.ocrText || "No OCR text"}
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => onMove(page.id, -1)}
                  disabled={index === 0}
                  className="rounded-lg bg-slate-100 px-2 py-1.5 text-xs disabled:opacity-30"
                >
                  ↑
                </button>

                <button
                  onClick={() => onMove(page.id, 1)}
                  disabled={index === pages.length - 1}
                  className="rounded-lg bg-slate-100 px-2 py-1.5 text-xs disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onFinish}
        className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white"
      >
        Finish Batch ({pages.length} pages)
      </button>
    </section>
  );
}