import { useEffect, useRef, useState } from "react";
import Tesseract from "tesseract.js";

/**
 * Live line scanner:
 * - camera preview remains fully visible (no blur/dimming outside the frame)
 * - the scan frame and horizontal scan band stay fixed on screen
 * - OCR is run only on the narrow band crossing the camera preview
 * - a detected line pauses for Reject / Accept; accepting resumes scanning
 */
export default function GuidedCamera({ onFinish, onClose, initialLines = [] }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const workerRef = useRef(null);
  const frameRef = useRef(null);
  const scanBandRef = useRef(null);
  const loopTimerRef = useRef(null);
  const scanningLockRef = useRef(false);

  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [facingMode, setFacingMode] = useState("environment");
  const [ocrMode, setOcrMode] = useState("eng");
  const [workerReady, setWorkerReady] = useState(false);
  const [workerStatus, setWorkerStatus] = useState("Loading OCR engine...");
  const [scanning, setScanning] = useState(true);
  const [candidate, setCandidate] = useState("");
  const [lines, setLines] = useState(Array.isArray(initialLines) ? initialLines : []);
  const [widthPct, setWidthPct] = useState(90);
  const [heightPct, setHeightPct] = useState(42);
  const [lastStatus, setLastStatus] = useState("Align the first text line with the fixed scan line.");

  // Keep the camera open until this screen is closed or Finish is pressed.
  useEffect(() => {
    let active = true;

    async function openCamera() {
      try {
        setError("");
        setReady(false);
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera is not supported in this browser.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          if (active) setReady(true);
        }
      } catch (err) {
        if (active) setError(err?.message || "Camera could not be opened.");
      }
    }

    openCamera();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [facingMode]);

  // Load one OCR worker and reuse it for every scan line.
  useEffect(() => {
    let active = true;
    let createdWorker;

    async function loadWorker() {
      try {
        setWorkerReady(false);
        setWorkerStatus("Loading OCR engine...");
        if (workerRef.current) {
          await workerRef.current.terminate().catch(() => {});
          workerRef.current = null;
        }

        createdWorker = await Tesseract.createWorker(ocrMode, 1, {
          logger: (message) => {
            if (active && message?.status) setWorkerStatus(message.status);
          },
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
        setWorkerStatus("OCR ready");
      } catch (err) {
        if (active) {
          setError(`OCR engine could not start: ${err?.message || "Unknown error"}`);
          setWorkerStatus("OCR unavailable");
        }
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

  function makeLineCanvas() {
    const video = videoRef.current;
    const band = scanBandRef.current;
    if (!video || !band || !video.videoWidth || !video.videoHeight) return null;

    const videoRect = video.getBoundingClientRect();
    const bandRect = band.getBoundingClientRect();
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;

    // Match CSS object-fit: cover so the OCR crop corresponds to the visible scan band.
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
    // Upscale the narrow strip for more reliable small-text recognition.
    canvas.width = Math.max(2, Math.round(sw * 2.5));
    canvas.height = Math.max(2, Math.round(sh * 2.5));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.filter = "grayscale(1) contrast(1.25) brightness(1.04)";
    context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    context.filter = "none";
    return canvas;
  }

  // Auto-scan while there is no pending line for the user to approve.
  useEffect(() => {
    if (!ready || !workerReady || !scanning || candidate) return undefined;
    let active = true;

    const scanOnce = async () => {
      if (!active || scanningLockRef.current) return;
      scanningLockRef.current = true;
      try {
        const canvas = makeLineCanvas();
        const worker = workerRef.current;
        if (canvas && worker) {
          const result = await worker.recognize(canvas);
          const text = String(result?.data?.text || "")
            .replace(/[\r\n]+/g, " ")
            .replace(/\s{2,}/g, " ")
            .trim();

          // Ignore empty/noise-only detections; wait for the next pass.
          const useful = text.replace(/[^A-Za-z0-9\u0A80-\u0AFF]/g, "").length >= 2;
          if (useful && active) {
            setCandidate(text);
            setScanning(false);
            setLastStatus("Text detected. Correct it if needed, then Accept or Reject.");
          }
        }
      } catch (err) {
        console.warn("Line OCR attempt failed:", err);
      } finally {
        scanningLockRef.current = false;
        if (active && scanning) {
          loopTimerRef.current = window.setTimeout(scanOnce, 650);
        }
      }
    };

    loopTimerRef.current = window.setTimeout(scanOnce, 250);
    return () => {
      active = false;
      if (loopTimerRef.current) window.clearTimeout(loopTimerRef.current);
    };
    // `candidate` intentionally pauses this effect as soon as one line is found.
  }, [ready, workerReady, scanning, candidate, ocrMode]);

  function rejectLine() {
    setCandidate("");
    setScanning(true);
    setLastStatus("Line rejected. Keep the next text line aligned with the scan line.");
  }

  function acceptLine() {
    const clean = candidate.trim();
    if (!clean) return;
    setLines((previous) => [...previous, clean]);
    setCandidate("");
    setScanning(true);
    setLastStatus("Line accepted. Move the document to the next line.");
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
        <video
          ref={videoRef}
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* No blur or dim overlay: the complete camera preview stays clear. */}
        <div
          ref={frameRef}
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
          style={{ width: `${widthPct}%`, height: `${heightPct}%` }}
        >
          <div
            ref={scanBandRef}
            className="absolute left-1 right-1 top-1/2 h-12 -translate-y-1/2"
          >
            <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 bg-cyan-300 shadow-[0_0_8px_2px_rgba(34,211,238,0.9)]" />
          </div>
          <div className="absolute -left-1 -top-1 h-7 w-7 rounded-tl-xl border-l-4 border-t-4 border-blue-400" />
          <div className="absolute -right-1 -top-1 h-7 w-7 rounded-tr-xl border-r-4 border-t-4 border-blue-400" />
          <div className="absolute -bottom-1 -left-1 h-7 w-7 rounded-bl-xl border-b-4 border-l-4 border-blue-400" />
          <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-br-xl border-b-4 border-r-4 border-blue-400" />
        </div>

        <header className="absolute left-0 right-0 top-0 flex items-center justify-between gap-2 p-3">
          <button onClick={onClose} className="rounded-full bg-black/65 px-4 py-2 text-sm">Close</button>
          <div className="rounded-full bg-black/65 px-3 py-2 text-xs">Live Line OCR</div>
          <button
            onClick={() => setFacingMode((value) => value === "environment" ? "user" : "environment")}
            className="rounded-full bg-black/65 px-3 py-2 text-sm"
            title="Switch camera"
          >
            ↔ Camera
          </button>
        </header>

        {error && (
          <div className="absolute left-3 right-3 top-16 z-20 rounded-xl bg-red-600/95 p-3 text-sm">
            {error}
            <button className="ml-3 underline" onClick={() => setError("")}>Dismiss</button>
          </div>
        )}

        <div className="absolute left-1/2 top-[14%] z-10 w-[92%] max-w-md -translate-x-1/2 rounded-xl bg-black/65 p-3 text-xs backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span>Frame width</span>
            <span>{widthPct}%</span>
          </div>
          <input className="w-full" type="range" min="65" max="98" value={widthPct} onChange={(event) => setWidthPct(Number(event.target.value))} />
          <div className="mb-2 mt-2 flex items-center justify-between gap-2">
            <span>Frame height</span>
            <span>{heightPct}%</span>
          </div>
          <input className="w-full" type="range" min="24" max="65" value={heightPct} onChange={(event) => setHeightPct(Number(event.target.value))} />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span>OCR language</span>
            <select
              value={ocrMode}
              onChange={(event) => {
                setOcrMode(event.target.value);
                setScanning(false);
                setLastStatus("Changing OCR language...");
              }}
              className="rounded-md bg-white px-2 py-1 text-slate-900"
            >
              <option value="eng">English</option>
              <option value="guj">Gujarati</option>
              <option value="eng+guj">English + Gujarati</option>
            </select>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-3 pt-16">
          <div className="mx-auto mb-2 max-w-xl rounded-xl bg-black/65 p-3 text-center text-xs">
            <div className="font-semibold">{workerReady ? "OCR ready" : workerStatus}</div>
            <div className="mt-1 text-white/75">Accepted lines: {lines.length} · {lastStatus}</div>
          </div>

          {candidate ? (
            <div className="mx-auto mb-3 max-w-xl rounded-2xl bg-white p-3 text-slate-900 shadow-xl">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">DETECTED LINE · REVIEW</span>
                <span className="text-xs text-blue-700">Edit if required</span>
              </div>
              <textarea
                value={candidate}
                onChange={(event) => setCandidate(event.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-300 p-2 text-base outline-none focus:border-blue-500"
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button onClick={rejectLine} className="rounded-xl bg-red-100 px-3 py-3 font-semibold text-red-700">✕ Reject / Rescan</button>
                <button onClick={acceptLine} disabled={!candidate.trim()} className="rounded-xl bg-emerald-600 px-3 py-3 font-semibold text-white disabled:opacity-40">✓ Accept Line</button>
              </div>
            </div>
          ) : (
            <div className="mx-auto mb-3 max-w-xl rounded-xl bg-black/65 p-3 text-center text-sm">
              {ready ? (workerReady ? "Place one document line across the horizontal scan line." : "Preparing OCR...") : "Starting camera..."}
            </div>
          )}

          <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
            <button
              onClick={() => setScanning((value) => !value)}
              disabled={!ready || !workerReady || Boolean(candidate)}
              className="rounded-xl bg-white/15 px-4 py-3 text-sm font-semibold disabled:opacity-40"
            >
              {scanning ? "Ⅱ Pause" : "▶ Resume"}
            </button>
            <button
              onClick={finish}
              disabled={!lines.length}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold disabled:opacity-40"
            >
              Finish ({lines.length}) ✓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
