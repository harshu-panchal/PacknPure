import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Camera, RotateCcw, Check } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Full-screen live camera capture — bypasses the OS file/gallery picker
 * entirely (unlike <input capture>, which many mobile browsers treat as a
 * hint only and still land on the gallery). Falls back via onError so the
 * caller can drop back to the plain file input when getUserMedia is
 * unavailable/denied.
 */
export default function CameraCapture({ facingMode = "user", label, onCapture, onClose, onError }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [capturedUrl, setCapturedUrl] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const stopStream = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera not supported on this browser");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          onError?.(err?.message || "Could not access camera");
        }
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const handleShoot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (facingMode === "user") {
      // Mirror the front-camera capture so it matches what the rider saw in preview
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapturedUrl(canvas.toDataURL("image/jpeg", 0.92));
  };

  const handleRetake = () => setCapturedUrl(null);

  const handleUsePhoto = () => {
    const canvas = canvasRef.current;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        onCapture(file);
      },
      "image/jpeg",
      0.92,
    );
  };

  const handleClose = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onClose();
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] flex flex-col bg-slate-950 p-4 sm:p-6"
    >
      <div className="flex items-center justify-between px-2 py-3 text-white">
        <p className="text-sm font-black uppercase tracking-widest">{label || "Take Photo"}</p>
        <button
          type="button"
          onClick={handleClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-3xl bg-black border border-white/10 shadow-2xl">
        {capturedUrl ? (
          <img src={capturedUrl} alt="Captured" className="absolute inset-0 h-full w-full object-contain bg-black" />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className={`absolute inset-0 h-full w-full object-cover ${facingMode === "user" ? "-scale-x-100" : ""}`}
          />
        )}
        {!ready && !capturedUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm font-bold">
            Starting camera…
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex items-center justify-center gap-6 px-6 py-6 bg-slate-950 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {capturedUrl ? (
          <>
            <button
              type="button"
              onClick={handleRetake}
              className="flex flex-col items-center gap-1.5 text-white"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                <RotateCcw className="w-6 h-6" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider">Retake</span>
            </button>
            <button
              type="button"
              onClick={handleUsePhoto}
              className="flex flex-col items-center gap-1.5 text-white"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500">
                <Check className="w-7 h-7" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider">Use Photo</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleShoot}
            disabled={!ready}
            className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-teal-500 text-white shadow-[0_0_30px_rgba(20,184,166,0.6)] disabled:opacity-40"
          >
            <Camera className="w-8 h-8 text-white" />
          </button>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}
