import React, { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, RotateCcw, Trash2, AlertCircle, RefreshCw, X } from "lucide-react";
import { cn } from "../utils/cn";
import { PickupSkeleton } from "./ui";

export const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
export const MAX_IMAGES = 4;

function cameraErrorMessage(err) {
  const name = err?.name || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera permission denied or blocked. Enable camera for this site in browser settings, then try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera found on this device.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Camera is in use by another app. Close it and try again.";
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return "Camera constraints not supported. Try again or use Gallery.";
  }
  if (name === "SecurityError") {
    return "Camera blocked by browser security. Use HTTPS or localhost.";
  }
  if (name === "TypeError") {
    return "Camera is unavailable in this browser.";
  }
  return err?.message || "Could not open camera. Check permissions or use Gallery.";
}

/**
 * Parcel photo capture with separated camera (getUserMedia) and gallery picker.
 */
const ParcelPhotoCapture = ({
  images = [],
  uploading = false,
  uploadProgress = 0,
  disabled = false,
  onAddFiles,
  onRemove,
  onReplace,
  label = "Parcel photos",
  uploadError = null,
  onRetryUpload,
}) => {
  const galleryRef = useRef(null);
  const replaceGalleryRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [replaceIndex, setReplaceIndex] = useState(null);
  const [loadedImages, setLoadedImages] = useState({});
  const [captureError, setCaptureError] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraMode, setCameraMode] = useState("add"); // add | replace

  const remaining = Math.max(0, MAX_IMAGES - images.length);
  const canAdd = !disabled && remaining > 0 && !uploading;

  const stopCamera = () => {
    streamRef.current?.getTracks?.().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
    setCameraBusy(false);
  };

  useEffect(() => () => stopCamera(), []);

  useEffect(() => {
    if (!cameraOpen || !streamRef.current || !videoRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play?.().catch(() => {});
  }, [cameraOpen]);

  const filterFiles = (fileList) => {
    const files = Array.from(fileList || []);
    return files.filter(
      (f) => ACCEPTED.includes(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name),
    );
  };

  const handleAdd = (fileList, limit, source) => {
    const valid = filterFiles(fileList).slice(0, limit);
    if (!valid.length) {
      setCaptureError(
        source === "camera"
          ? "Camera capture failed. Try again or use Gallery."
          : "No valid images selected. Use JPG, PNG, or WebP.",
      );
      return;
    }
    setCaptureError(null);
    onAddFiles?.(valid, source);
  };

  const openGallery = () => {
    setCaptureError(null);
    galleryRef.current?.click();
  };

  const openReplaceGallery = (index) => {
    setReplaceIndex(index);
    setTimeout(() => replaceGalleryRef.current?.click(), 0);
  };

  const openCamera = async (mode = "add", index = null) => {
    setCaptureError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCaptureError("Camera is unavailable in this browser. Use Gallery instead.");
      return;
    }

    // Permissions API when available (Chrome/Edge); Safari may not support camera query.
    try {
      if (navigator.permissions?.query) {
        const status = await navigator.permissions.query({ name: "camera" });
        if (status.state === "denied") {
          setCaptureError(
            "Camera permission is blocked. Enable camera for this site in browser settings.",
          );
          return;
        }
      }
    } catch {
      /* ignore — proceed to getUserMedia which prompts */
    }

    setCameraBusy(true);
    setCameraMode(mode);
    if (mode === "replace") setReplaceIndex(index);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (err) {
      stopCamera();
      setCaptureError(cameraErrorMessage(err));
    } finally {
      setCameraBusy(false);
    }
  };

  const snapPhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setCaptureError("Camera not ready yet. Wait a moment and try again.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCaptureError("Could not capture frame from camera.");
      return;
    }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCaptureError("Failed to create photo from camera.");
          return;
        }
        const file = new File([blob], `pickup-camera-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        if (cameraMode === "replace" && replaceIndex != null) {
          onReplace?.(replaceIndex, file, "camera");
          setReplaceIndex(null);
        } else {
          handleAdd([file], 1, "camera");
        }
        stopCamera();
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div
      className={cn(
        "min-w-0 space-y-3",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
          {label} <span className="text-rose-500">*</span>
        </p>
        <p className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-500">
          {images.length}/{MAX_IMAGES}
        </p>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-4">
          {images.map((img, index) => (
            <div
              key={`${img.url}-${index}`}
              className="relative aspect-square min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-[var(--pickup-shadow-xs)] ring-1 ring-black/5"
            >
              {!loadedImages[index] && (
                <PickupSkeleton className="absolute inset-0 rounded-2xl" />
              )}
              <img
                src={img.url}
                alt={`Parcel ${index + 1}`}
                className={cn(
                  "h-full w-full object-cover transition-opacity",
                  loadedImages[index] ? "opacity-100" : "opacity-0",
                )}
                onLoad={() => setLoadedImages((p) => ({ ...p, [index]: true }))}
              />
              <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2">
                {img.source === "camera" && (
                  <button
                    type="button"
                    onClick={() => openCamera("replace", index)}
                    className="flex min-h-[32px] flex-1 items-center justify-center gap-1 rounded-lg bg-white/95 px-1 py-1.5 text-[9px] font-black uppercase tracking-wide text-slate-900"
                  >
                    <RotateCcw size={10} /> Retake
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openReplaceGallery(index)}
                  className="flex min-h-[32px] flex-1 items-center justify-center gap-1 rounded-lg bg-white/95 px-1 py-1.5 text-[9px] font-black uppercase tracking-wide text-slate-900"
                >
                  <ImagePlus size={10} /> Replace
                </button>
                <button
                  type="button"
                  onClick={() => onRemove?.(index)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500 text-white"
                  aria-label={`Remove photo ${index + 1}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {canAdd && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => openCamera("add")}
            disabled={cameraBusy}
            aria-label="Take photo with camera"
            className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-teal-200/90 bg-gradient-to-b from-teal-50/80 to-white px-3 py-4 text-teal-700 shadow-[var(--pickup-shadow-xs)] transition-all active:scale-[0.98] hover:border-teal-300 hover:shadow-md disabled:opacity-60"
          >
            <Camera size={22} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              {cameraBusy ? "Opening…" : "Camera"}
            </span>
          </button>
          <button
            type="button"
            onClick={openGallery}
            aria-label="Choose photos from gallery"
            className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200/90 bg-gradient-to-b from-slate-50 to-white px-3 py-4 text-slate-600 shadow-[var(--pickup-shadow-xs)] transition-all active:scale-[0.98] hover:border-slate-300 hover:shadow-md"
          >
            <ImagePlus size={22} />
            <span className="text-[10px] font-black uppercase tracking-widest">Gallery</span>
            <span className="text-[9px] font-semibold text-slate-400">
              Up to {remaining} more
            </span>
          </button>
        </div>
      )}

      {uploading && (
        <div className="space-y-1.5" role="status" aria-live="polite">
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-500 to-teal-600 transition-all duration-300 shadow-sm"
              style={{ width: `${Math.max(8, uploadProgress)}%` }}
            />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Uploading… {uploadProgress}%
          </p>
        </div>
      )}

      {(captureError || uploadError) && (
        <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-rose-500" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-rose-800">
              {uploadError || captureError}
            </p>
            {uploadError && onRetryUpload && (
              <button
                type="button"
                onClick={onRetryUpload}
                className="mt-1.5 flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-rose-600"
              >
                <RefreshCw size={10} /> Retry upload
              </button>
            )}
          </div>
        </div>
      )}

      {!images.length && !disabled && (
        <p className="text-[10px] font-semibold text-amber-700">
          Upload at least 1 image (jpg, png, webp) to continue
        </p>
      )}

      {/* Gallery only — no capture attribute (must not open camera) */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          handleAdd(e.target.files, remaining, "gallery");
          e.target.value = "";
        }}
      />
      <input
        ref={replaceGalleryRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = filterFiles(e.target.files)[0];
          if (file != null && replaceIndex != null) {
            onReplace?.(replaceIndex, file, "gallery");
          }
          setReplaceIndex(null);
          e.target.value = "";
        }}
      />

      {cameraOpen && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-black/90 p-3 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-black uppercase tracking-widest text-white/90">
              Camera capture
            </p>
            <button
              type="button"
              onClick={stopCamera}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white"
              aria-label="Close camera"
            >
              <X size={18} />
            </button>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
          </div>
          <div className="mt-4 flex items-center justify-center gap-4 pb-[env(safe-area-inset-bottom)]">
            <button
              type="button"
              onClick={stopCamera}
              className="rounded-xl bg-white/15 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={snapPhoto}
              className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-teal-500 shadow-lg"
              aria-label="Capture photo"
            >
              <Camera size={22} className="text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParcelPhotoCapture;
