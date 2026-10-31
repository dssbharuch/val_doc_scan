import { useCallback, useEffect, useRef, useState } from "react";
import Tesseract from "tesseract.js";

const LANGUAGE_OPTIONS = [
  { value: "eng", label: "ENG" },
  { value: "guj", label: "GUJ" },
  { value: "eng+guj", label: "BOTH" }
];

export default function GalleryScanner({ imageUrl, onFinish, onClose, initialLines = [] }) {
  const imageRef = useRef(null);

  const workerRef = useRef(null);
  const scanBandRef = useRef(null);
  const loopTimerRef = useRef(null);
  const scanLockRef = useRef(false);
  const previousFrameRef = useRef(null);
  const stableSinceRef = useRef(0);
  const waitForMovementRef = useRef(false);
  const widthDragRef = useRef(null);
  const manualButtonDragRef = useRef(null);
  const manualButtonLongPressRef = useRef(false);
  const manualButtonMovedRef = useRef(false);
  const manualButtonTimerRef = useRef(null);

  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  const [ocrMode, setOcrMode] = useState("eng");

  const [workerReady, setWorkerReady] = useState(false);
  const [candidate, setCandidate] = useState("");
  const [lines, setLines] = useState(Array.isArray(initialLines) ? initialLines : []);
  const [widthPct, setWidthPct] = useState(90);
  const [manualButtonPosition, setManualButtonPosition] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("documentScanner.manualScanButtonPosition") || "null");
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        return { x: Math.max(8, Math.min(92, saved.x)), y: Math.max(14, Math.min(84, saved.y)) };
      }
    } catch {
      // Use the default position if saved data is unavailable.
    }
    return { x: 50, y: 38 };
  });
  const manualButtonPositionRef = useRef(manualButtonPosition);

  // The parent owns the selected photo URL. Do not revoke it during
  // React StrictMode effect cleanup: the image may still be loading.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);

  useEffect(() => {
    setReady(false);
    setError("");
    setPan({ x: 0, y: 0 });
    panRef.current = { x: 0, y: 0 };
    setZoom(1);
    zoomRef.current = 1;
  }, [imageUrl]);

  function updateTransform(nextZoom, nextPan) {
    const z = Math.max(1, Math.min(8, nextZoom));
    zoomRef.current = z;
    panRef.current = nextPan;
    setZoom(z);
    setPan(nextPan);
  }
  function pointerDown(event) {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];
    gestureRef.current = points.length >= 2
      ? { kind: "pinch", distance: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y), zoom: zoomRef.current, pan: { ...panRef.current }, center: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 } }
      : { kind: "pan", x: event.clientX, y: event.clientY, pan: { ...panRef.current } };
  }
  function pointerMove(event) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];
    const g = gestureRef.current;
    if (!g) return;
    if (points.length >= 2 && g.kind === "pinch") {
      const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
      const center = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      updateTransform(g.zoom * (distance / Math.max(1, g.distance)), { x: g.pan.x + center.x - g.center.x, y: g.pan.y + center.y - g.center.y });
    } else if (points.length === 1 && g.kind === "pan") {
      updateTransform(zoomRef.current, { x: g.pan.x + event.clientX - g.x, y: g.pan.y + event.clientY - g.y });
    }
  }
  function pointerUp(event) {
    pointersRef.current.delete(event.pointerId);
    const point = [...pointersRef.current.values()][0];
    gestureRef.current = point ? { kind: "pan", x: point.x, y: point.y, pan: { ...panRef.current } } : null;
  }
  function wheelZoom(event) {
    event.preventDefault();
    updateTransform(zoomRef.current * (event.deltaY < 0 ? 1.12 : 1 / 1.12), panRef.current);
  }

  useEffect(() => {
    let active = true;
    let createdWorker;

    async function loadWorker() {
      try {
        setWorkerReady(false);
        if (workerRef.current) {
          await workerRef.current.terminate().catch(() => {});
          workerRef.current = null;
        }

        createdWorker = await Tesseract.createWorker(ocrMode, 1, {
          logger: () => {},
          errorHandler: (err) => console.error("Tesseract worker:", err)
        });

        await createdWorker.setParameters({
          tessedit_pageseg_mode: "7",
          preserve_interword_spaces: "1",
          user_defined_dpi: "300"
        });

        if (!active) {
          await createdWorker.terminate().catch(() => {});
          return;
        }

        workerRef.current = createdWorker;
        setWorkerReady(true);
      } catch (err) {
        if (active) setError(`OCR engine could not start: ${err?.message || "Unknown error"}`);
      }
    }

    loadWorker();
    return () => {
      active = false;
      if (createdWorker) createdWorker.terminate().catch(() => {});
      if (workerRef.current === createdWorker) workerRef.current = null;
      setWorkerReady(false);
    };
  }, [ocrMode]);

  const makeLineCanvas = useCallback(() => {
    const photo = imageRef.current;
    const band = scanBandRef.current;
    if (!photo || !band || !photo.naturalWidth || !photo.naturalHeight) return null;

    const videoRect = photo.getBoundingClientRect();
    const bandRect = band.getBoundingClientRect();
    const sourceWidth = photo.naturalWidth;
    const sourceHeight = photo.naturalHeight;

    // Match object-fit: cover to crop exactly the visible scan strip.
    const scale = Math.max(videoRect.width / sourceWidth, videoRect.height / sourceHeight);
    const renderedWidth = sourceWidth * scale;
    const renderedHeight = sourceHeight * scale;
    const offsetX = (renderedWidth - videoRect.width) / 2;
    const offsetY = (renderedHeight - videoRect.height) / 2;

    let sx = (bandRect.left - videoRect.left + offsetX) / scale;
    let sy = (bandRect.top - videoRect.top + offsetY) / scale;
    let sw = bandRect.width / scale;
    let sh = bandRect.height / scale;

    sx = Math.max(0, Math.min(sourceWidth - 2, sx));
    sy = Math.max(0, Math.min(sourceHeight - 2, sy));
    sw = Math.max(2, Math.min(sourceWidth - sx, sw));
    sh = Math.max(2, Math.min(sourceHeight - sy, sh));

    const canvas = document.createElement("canvas");
    // Upscale only the selected text strip for OCR.
    canvas.width = Math.max(2, Math.round(sw * 2.2));
    canvas.height = Math.max(2, Math.round(sh * 2.2));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.filter = "grayscale(1) contrast(1.22) brightness(1.04)";
    context.drawImage(photo, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    context.filter = "none";
    return canvas;
  }, []);

  const playBeep = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const audio = new AudioContextClass();
      if (audio.state === "suspended") audio.resume().catch(() => {});
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.frequency.value = 880;
      oscillator.type = "sine";
      gain.gain.setValueAtTime(0.0001, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, audio.currentTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.13);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.14);
      oscillator.onended = () => audio.close().catch(() => {});
    } catch {
      // Sound is a convenience only; scanning still works if audio is blocked.
    }
  }, []);

  const scanLine = useCallback(async () => {
    if (scanLockRef.current || candidate || !ready || !workerReady || !workerRef.current) return;
    scanLockRef.current = true;
    try {
      const canvas = makeLineCanvas();
      if (!canvas) return;
      const result = await workerRef.current.recognize(canvas);
      const text = String(result?.data?.text || "")
        .replace(/[\r\n]+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
      const useful = text.replace(/[^A-Za-z0-9\u0A80-\u0AFF]/g, "").length >= 2;

      if (useful) {
        setCandidate(text);
        playBeep();
      } else {
        // Retry after a short pause if the camera still sees the same line.
        stableSinceRef.current = Date.now() - 250;
      }
    } catch (err) {
      console.warn("Line OCR attempt failed:", err);
    } finally {
      scanLockRef.current = false;
    }
  }, [candidate, ready, workerReady, makeLineCanvas, playBeep]);

  // Gallery scanning is manual only: no camera frame loop or automatic OCR.

  function rejectLine() {
    setCandidate("");
    waitForMovementRef.current = false;
    stableSinceRef.current = 0;
    previousFrameRef.current = null;
  }

  function acceptLine() {
    const clean = candidate.trim();
    if (!clean) return;
    setLines((previous) => [...previous, clean]);
    setCandidate("");
    // After accepting, user may move the photo to the next line.
    waitForMovementRef.current = true;
    stableSinceRef.current = 0;
  }

  function startWidthResize(event, side) {
    event.preventDefault();
    event.stopPropagation();
    widthDragRef.current = {
      side,
      startX: event.clientX,
      startWidth: widthPct
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveWidthResize(event) {
    if (!widthDragRef.current) return;
    const drag = widthDragRef.current;
    const deltaPct = ((event.clientX - drag.startX) / window.innerWidth) * 100;
    const next = drag.side === "right"
      ? drag.startWidth + deltaPct * 2
      : drag.startWidth - deltaPct * 2;
    setWidthPct(Math.max(55, Math.min(99, next)));
  }

  function stopWidthResize() {
    widthDragRef.current = null;
  }

  function startManualButtonPress(event) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    manualButtonLongPressRef.current = false;
    manualButtonMovedRef.current = false;
    manualButtonDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPosition: { ...manualButtonPosition }
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    manualButtonTimerRef.current = window.setTimeout(() => {
      manualButtonLongPressRef.current = true;
    }, 380);
  }

  function moveManualButton(event) {
    const drag = manualButtonDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!manualButtonLongPressRef.current) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 5) manualButtonMovedRef.current = true;
    if (!manualButtonMovedRef.current) return;

    const x = Math.max(8, Math.min(92, (event.clientX / window.innerWidth) * 100));
    const y = Math.max(14, Math.min(84, (event.clientY / window.innerHeight) * 100));
    const nextPosition = { x, y };
    manualButtonPositionRef.current = nextPosition;
    setManualButtonPosition(nextPosition);
  }

  function endManualButtonPress(event) {
    const drag = manualButtonDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (manualButtonTimerRef.current) window.clearTimeout(manualButtonTimerRef.current);
    manualButtonTimerRef.current = null;

    if (manualButtonMovedRef.current) {
      try {
        localStorage.setItem("documentScanner.manualScanButtonPosition", JSON.stringify(manualButtonPositionRef.current));
      } catch {
        // The button remains movable for this session if storage is unavailable.
      }
    } else {
      scanLine();
    }

    manualButtonDragRef.current = null;
    manualButtonLongPressRef.current = false;
    manualButtonMovedRef.current = false;
  }

  useEffect(() => () => {
    if (manualButtonTimerRef.current) window.clearTimeout(manualButtonTimerRef.current);
  }, []);

  function cycleLanguage() {
    const index = LANGUAGE_OPTIONS.findIndex((option) => option.value === ocrMode);
    const next = LANGUAGE_OPTIONS[(index + 1) % LANGUAGE_OPTIONS.length];
    setOcrMode(next.value);
    setCandidate("");
    waitForMovementRef.current = false;
    stableSinceRef.current = 0;
    previousFrameRef.current = null;
  }

  function finish() {
    if (!lines.length) {
      setError("Please accept at least one OCR line before Finish.");
      return;
    }
    onFinish?.(lines);
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white">
      <div className="relative h-full w-full overflow-hidden">
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Selected photo for line scanning"
          draggable={false}
          onLoad={() => setReady(true)}
          onError={() => setError("Selected photo could not be loaded.")}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onWheel={wheelZoom}
          className="absolute inset-0 h-full w-full object-cover select-none"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, touchAction: "none", transformOrigin: "center center" }}
        />

        {/* Full preview remains clear. The frame is a fixed-height strip. */}
        <div
          className="absolute left-1/2 top-[13%] h-[76px] -translate-x-1/2 rounded-lg border-2 border-white/95"
          style={{ width: `${widthPct}%` }}
        >
          <div
            ref={scanBandRef}
            className="absolute inset-x-1 top-1/2 h-[46px] -translate-y-1/2"
          >
            <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-cyan-300 shadow-[0_0_8px_2px_rgba(34,211,238,0.9)]" />
          </div>

          <div
            role="slider"
            aria-label="Resize scan frame from left"
            aria-valuenow={Math.round(widthPct)}
            onPointerDown={(event) => startWidthResize(event, "left")}
            onPointerMove={moveWidthResize}
            onPointerUp={stopWidthResize}
            onPointerCancel={stopWidthResize}
            className="absolute -left-3 top-1/2 z-20 h-12 w-6 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-blue-400 bg-white/90 touch-none"
          />
          <div
            role="slider"
            aria-label="Resize scan frame from right"
            aria-valuenow={Math.round(widthPct)}
            onPointerDown={(event) => startWidthResize(event, "right")}
            onPointerMove={moveWidthResize}
            onPointerUp={stopWidthResize}
            onPointerCancel={stopWidthResize}
            className="absolute -right-3 top-1/2 z-20 h-12 w-6 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-blue-400 bg-white/90 touch-none"
          />
        </div>

        {/* Keep the small controls together at the very top, away from the scan frame. */}
        <header className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between gap-2 p-3 pt-[max(12px,env(safe-area-inset-top))]">
          <button onClick={onClose} className="rounded-full bg-black/70 px-3.5 py-2.5 text-sm font-semibold">✕</button>
          <div className="rounded-full bg-black/65 px-3 py-2 text-xs">Gallery Scan · {lines.length}</div>
          <div className="flex items-center gap-1.5">
            <button onClick={cycleLanguage} className="rounded-lg bg-black/70 px-2.5 py-2 text-xs font-bold">
              {LANGUAGE_OPTIONS.find((option) => option.value === ocrMode)?.label || "ENG"}
            </button>
            <button onClick={() => updateTransform(1, { x: 0, y: 0 })} className="rounded-full bg-black/65 px-3 py-2 text-sm" title="Reset photo zoom and position">Reset</button>
          </div>
        </header>

        {error && (
          <div className="absolute left-3 right-3 top-16 z-30 rounded-xl bg-red-600/95 p-3 text-sm">
            {error}
            <button className="ml-3 underline" onClick={() => setError("")}>×</button>
          </div>
        )}

        {/* Show the result panel only after OCR detects text; never show an empty grey box. */}
        {candidate && (
          <div className="absolute left-[4%] right-[4%] top-[41%] z-20 mx-auto max-h-[160px] overflow-hidden rounded-xl bg-white/95 p-2.5 text-slate-900 shadow-lg">
            <textarea
              value={candidate}
              onChange={(event) => setCandidate(event.target.value)}
              rows={2}
              autoFocus
              className="max-h-[90px] min-h-[52px] w-full resize-y rounded-lg border border-slate-300 bg-white p-2 text-base outline-none focus:border-blue-500"
            />
            <div className="mt-1.5 flex justify-end gap-2">
              <button onClick={rejectLine} className="rounded-lg bg-red-100 px-4 py-1.5 text-sm font-bold text-red-700">✕</button>
              <button onClick={acceptLine} disabled={!candidate.trim()} className="rounded-lg bg-emerald-600 px-5 py-1.5 text-sm font-bold text-white disabled:opacity-40">✓</button>
            </div>
          </div>
        )}

        {/* Manual scan button: long-press and drag to reposition; position is remembered. */}
        <button
          type="button"
          disabled={!ready || !workerReady || Boolean(candidate) || scanLockRef.current}
          onPointerDown={startManualButtonPress}
          onPointerMove={moveManualButton}
          onPointerUp={endManualButtonPress}
          onPointerCancel={endManualButtonPress}
          onContextMenu={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              scanLine();
            }
          }}
          style={{ left: `${manualButtonPosition.x}%`, top: `${manualButtonPosition.y}%`, touchAction: "none" }}
          className="absolute z-20 flex h-[68px] w-[64px] -translate-x-1/2 -translate-y-1/2 select-none items-center justify-center rounded-sm bg-black/60 shadow-lg disabled:opacity-40"
          title="Tap to scan. Long-press and drag to move; position is saved."
          aria-label="Manual scan. Tap to scan, long press to move."
        >
          <span className="pointer-events-none flex h-[50px] w-[50px] items-center justify-center rounded-full border border-white bg-white text-2xl font-bold text-slate-900">⌖</span>
        </button>

        {/* Bottom controls: Auto toggle left, Finish right. */}
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 to-transparent p-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-16">
          <div className="absolute bottom-[max(20px,env(safe-area-inset-bottom))] left-4 rounded-full bg-black/70 px-3 py-3 text-xs font-bold">MANUAL ONLY · {Math.round(zoom * 100)}%</div>
          <button
            onClick={finish}
            disabled={!lines.length}
            className="absolute bottom-[max(20px,env(safe-area-inset-bottom))] right-4 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold shadow-lg disabled:opacity-40"
          >
            Finish ({lines.length})
          </button>
        </div>
      </div>
    </div>
  );
}
