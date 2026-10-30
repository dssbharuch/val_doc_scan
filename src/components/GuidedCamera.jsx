import { useCallback, useEffect, useRef, useState } from "react";
import Tesseract from "tesseract.js";

const LANGUAGE_OPTIONS = [
  { value: "eng", label: "ENG" },
  { value: "guj", label: "GUJ" },
  { value: "eng+guj", label: "BOTH" }
];

export default function GuidedCamera({ onFinish, onClose, initialLines = [] }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const workerRef = useRef(null);
  const scanBandRef = useRef(null);
  const loopTimerRef = useRef(null);
  const scanLockRef = useRef(false);
  const previousFrameRef = useRef(null);
  const stableSinceRef = useRef(0);
  const waitForMovementRef = useRef(false);
  const widthDragRef = useRef(null);

  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [facingMode, setFacingMode] = useState("environment");
  const [ocrMode, setOcrMode] = useState("eng");
  const [autoScan, setAutoScan] = useState(true);
  const [workerReady, setWorkerReady] = useState(false);
  const [candidate, setCandidate] = useState("");
  const [lines, setLines] = useState(Array.isArray(initialLines) ? initialLines : []);
  const [widthPct, setWidthPct] = useState(90);

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
    const video = videoRef.current;
    const band = scanBandRef.current;
    if (!video || !band || !video.videoWidth || !video.videoHeight) return null;

    const videoRect = video.getBoundingClientRect();
    const bandRect = band.getBoundingClientRect();
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;

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
    context.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
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

  // Detect a steady camera/document image before running OCR.
  // This avoids repeatedly running Tesseract while the user is moving the page.
  useEffect(() => {
    if (!ready || !workerReady || !autoScan || candidate) return undefined;
    let active = true;

    const checkFrame = () => {
      if (!active || candidate) return;
      if (scanLockRef.current) {
        loopTimerRef.current = window.setTimeout(checkFrame, 140);
        return;
      }
      const canvas = makeLineCanvas();
      const context = canvas?.getContext("2d", { willReadFrequently: true });
      if (!canvas || !context) {
        loopTimerRef.current = window.setTimeout(checkFrame, 120);
        return;
      }

      const sample = document.createElement("canvas");
      sample.width = 24;
      sample.height = 6;
      const sampleContext = sample.getContext("2d", { willReadFrequently: true });
      if (!sampleContext) return;
      sampleContext.drawImage(canvas, 0, 0, sample.width, sample.height);
      const pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
      let signature = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        signature += pixels[i] * 1 + pixels[i + 1] * 2 + pixels[i + 2] * 3;
      }

      const now = Date.now();
      const previous = previousFrameRef.current;
      const changed = previous !== null && Math.abs(signature - previous) > 1700;
      previousFrameRef.current = signature;

      if (waitForMovementRef.current) {
        if (changed) {
          waitForMovementRef.current = false;
          stableSinceRef.current = now;
        }
      } else if (previous === null || changed) {
        stableSinceRef.current = now;
      } else if (!stableSinceRef.current) {
        stableSinceRef.current = now;
      }

      if (!waitForMovementRef.current && stableSinceRef.current && now - stableSinceRef.current >= 520) {
        stableSinceRef.current = now;
        scanLine();
      }

      loopTimerRef.current = window.setTimeout(checkFrame, 140);
    };

    loopTimerRef.current = window.setTimeout(checkFrame, 250);
    return () => {
      active = false;
      if (loopTimerRef.current) window.clearTimeout(loopTimerRef.current);
    };
  }, [ready, workerReady, autoScan, candidate, makeLineCanvas, scanLine]);

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
    // After accepting, wait until the document moves to the next row and settles.
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
        <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-cover" />

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
          <div className="rounded-full bg-black/65 px-3 py-2 text-xs">Live Scan · {lines.length}</div>
          <div className="flex items-center gap-1.5">
            <button onClick={cycleLanguage} className="rounded-lg bg-black/70 px-2.5 py-2 text-xs font-bold">
              {LANGUAGE_OPTIONS.find((option) => option.value === ocrMode)?.label || "ENG"}
            </button>
            <button
              onClick={() => setFacingMode((value) => value === "environment" ? "user" : "environment")}
              className="rounded-full bg-black/65 px-3 py-2 text-sm"
              title="Switch camera"
            >
              ↔
            </button>
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

        {/* Centered manual scan button, directly positioned against the full camera view. */}
        <button
          onClick={scanLine}
          disabled={!ready || !workerReady || Boolean(candidate) || scanLockRef.current}
          className="absolute left-1/2 top-[33%] z-20 flex h-[68px] w-[64px] -translate-x-1/2 items-center justify-center rounded-sm bg-black/60 shadow-lg disabled:opacity-40"
          title="Scan this line now"
          aria-label="Manual scan"
        >
          <span className="flex h-[50px] w-[50px] items-center justify-center rounded-full border border-white bg-white text-2xl font-bold text-slate-900">⌖</span>
        </button>

        {/* Bottom controls: Auto toggle left, Finish right. */}
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 to-transparent p-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-16">
          <button
            onClick={() => setAutoScan((value) => !value)}
            className={`absolute bottom-[max(20px,env(safe-area-inset-bottom))] left-4 rounded-full px-4 py-3 text-xs font-bold shadow-lg ${autoScan ? "bg-emerald-600 text-white" : "bg-white/20 text-white"}`}
            title="Toggle automatic scanning"
          >
            {autoScan ? "AUTO ON" : "AUTO OFF"}
          </button>
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
