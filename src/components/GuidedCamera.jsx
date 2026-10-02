import { useEffect, useRef, useState } from "react";

export default function GuidedCamera({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [facingMode, setFacingMode] = useState("environment");
  const [guideScale, setGuideScale] = useState(1);

  useEffect(() => {
    let active = true;

    async function start() {
      try {
        setError("");
        setReady(false);

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera is not supported by this browser.");
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
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
      } catch (err) {
        console.error(err);
        setError(
          err?.message ||
            "Camera permission was denied or the camera could not be opened."
        );
      }
    }

    start();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode]);

  function switchCamera() {
    setFacingMode((value) => (value === "environment" ? "user" : "environment"));
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !ready) return;

    const videoWidth = Number(video.videoWidth);
    const videoHeight = Number(video.videoHeight);

    if (!Number.isFinite(videoWidth) || !Number.isFinite(videoHeight) || videoWidth < 2 || videoHeight < 2) {
      setError("Camera image is not ready yet. Please wait a moment and try again.");
      return;
    }

    // Portrait-friendly guide: central 82% width, 76% height.
    // The UI frame and this crop use the same percentages.
    const cropW = Math.max(1, Math.round(videoWidth * 0.82));
    const cropH = Math.max(1, Math.round(videoHeight * 0.76));
    const sx = Math.round((videoWidth - cropW) / 2);
    const sy = Math.round((videoHeight - cropH) / 2);

    const canvas = document.createElement("canvas");
    canvas.width = cropW;
    canvas.height = cropH;

    if (!Number.isInteger(canvas.width) || !Number.isInteger(canvas.height) || canvas.width < 1 || canvas.height < 1) {
      setError("Could not create the captured image. Please try again.");
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Canvas is not supported by this browser.");
      return;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(
      video,
      sx,
      sy,
      cropW,
      cropH,
      0,
      0,
      cropW,
      cropH
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const url = URL.createObjectURL(blob);

        onCapture({
          imageUrl: url,
          width: cropW,
          height: cropH,
          source: "guided-camera"
        });
      },
      "image/jpeg",
      0.94
    );
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

        {/* Dark mask around the capture area */}
        <div className="pointer-events-none absolute inset-0 bg-black/45">
          <div className="absolute left-1/2 top-1/2 h-[76%] w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>

        {/* Document guide */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[76%] w-[82%] -translate-x-1/2 -translate-y-1/2">
          <div className="absolute inset-0 rounded-xl border-2 border-white/90" />
          <div className="absolute -left-0.5 -top-0.5 h-10 w-10 rounded-tl-xl border-l-4 border-t-4 border-blue-400" />
          <div className="absolute -right-0.5 -top-0.5 h-10 w-10 rounded-tr-xl border-r-4 border-t-4 border-blue-400" />
          <div className="absolute -bottom-0.5 -left-0.5 h-10 w-10 rounded-bl-xl border-b-4 border-l-4 border-blue-400" />
          <div className="absolute -bottom-0.5 -right-0.5 h-10 w-10 rounded-br-xl border-b-4 border-r-4 border-blue-400" />

          <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs">
            Keep document inside frame
          </div>
        </div>

        <header className="absolute left-0 right-0 top-0 flex items-center justify-between p-4">
          <button
            onClick={onClose}
            className="rounded-full bg-black/50 px-4 py-2 text-sm"
          >
            Close
          </button>

          <div className="rounded-full bg-black/50 px-3 py-2 text-xs">
            Document Scan
          </div>

          <button
            onClick={switchCamera}
            className="rounded-full bg-black/50 px-4 py-2 text-sm"
          >
            ↔ Camera
          </button>
        </header>

        {error && (
          <div className="absolute left-4 right-4 top-20 rounded-xl bg-red-600/90 p-4 text-sm">
            {error}
          </div>
        )}

        <div className="absolute bottom-28 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-3 py-2 text-xs backdrop-blur">
          <span>Scan area</span>
          <input
            aria-label="Scan area size"
            type="range"
            min="0.75"
            max="1.8"
            step="0.05"
            value={guideScale}
            onChange={(e) => setGuideScale(Number(e.target.value))}
            className="ml-2 w-28 align-middle"
          />
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-24">
          <div className="mb-4 text-center text-xs text-slate-200">
            Place the document inside the frame. The area outside the frame
            will not be saved.
          </div>

          <div className="flex items-center justify-center">
            <button
              disabled={!ready}
              onClick={capture}
              className="h-20 w-20 rounded-full border-4 border-white bg-white/20 shadow-xl disabled:opacity-40"
              aria-label="Capture document"
            >
              <span className="mx-auto block h-14 w-14 rounded-full bg-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}