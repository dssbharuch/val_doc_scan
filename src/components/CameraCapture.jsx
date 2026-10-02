import { useEffect, useRef, useState } from "react";

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
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
      } catch (err) {
        console.error(err);
        setError(
          "Camera could not be opened. Please allow camera permission and use HTTPS or localhost."
        );
      }
    }

    startCamera();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const imageUrl = URL.createObjectURL(blob);
        onCapture({
          id: crypto.randomUUID(),
          blob,
          imageUrl,
          createdAt: new Date().toISOString()
        });
      },
      "image/jpeg",
      0.92
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-4 text-white">
        <h2 className="text-lg font-semibold">Camera</h2>
        <button
          onClick={onClose}
          className="rounded-full bg-white/15 px-4 py-2 text-sm"
        >
          Close
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {error ? (
          <div className="mx-6 rounded-2xl bg-white p-5 text-center text-slate-700">
            {error}
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-contain"
          />
        )}
      </div>

      <div className="flex justify-center p-7">
        <button
          onClick={capturePhoto}
          disabled={!!error}
          aria-label="Capture photo"
          className="h-20 w-20 rounded-full border-8 border-white bg-white/20 shadow-lg active:scale-95 disabled:opacity-40"
        >
          <span className="block h-full w-full rounded-full bg-white" />
        </button>
      </div>
    </div>
  );
}