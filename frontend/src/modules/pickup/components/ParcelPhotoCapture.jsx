import React, { useRef, useState } from "react";
import { Camera, ImagePlus, RotateCcw, Trash2, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "../utils/cn";
import { PickupSkeleton } from "./ui";

export const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
export const MAX_IMAGES = 4;

/**
 * Parcel photo capture with camera/gallery, preview, replace, and upload progress.
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
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const replaceCameraRef = useRef(null);
  const replaceGalleryRef = useRef(null);
  const [replaceIndex, setReplaceIndex] = useState(null);
  const [loadedImages, setLoadedImages] = useState({});
  const [captureError, setCaptureError] = useState(null);

  const remaining = Math.max(0, MAX_IMAGES - images.length);
  const canAdd = !disabled && remaining > 0 && !uploading;

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
          ? "Camera capture failed or permission denied. Try gallery or check browser settings."
          : "No valid images selected. Use JPG, PNG, or WebP.",
      );
      return;
    }
    setCaptureError(null);
    onAddFiles?.(valid, source);
  };

  const openReplace = (index, mode) => {
    setReplaceIndex(index);
    setTimeout(() => {
      if (mode === "camera") replaceCameraRef.current?.click();
      else replaceGalleryRef.current?.click();
    }, 0);
  };

  return (
    <div
      className={cn(
        "min-w-0 space-y-3",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {label} <span className="text-rose-500">*</span>
        </p>
        <p className="shrink-0 text-[10px] font-bold text-slate-400">
          {images.length}/{MAX_IMAGES}
        </p>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-4">
          {images.map((img, index) => (
            <div
              key={`${img.url}-${index}`}
              className="relative aspect-square min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
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
                    onClick={() => openReplace(index, "camera")}
                    className="flex min-h-[32px] flex-1 items-center justify-center gap-1 rounded-lg bg-white/95 px-1 py-1.5 text-[9px] font-black uppercase tracking-wide text-slate-900"
                  >
                    <RotateCcw size={10} /> Retake
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openReplace(index, "gallery")}
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
        <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            aria-label="Take photo with camera"
            className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/50 px-3 py-4 text-teal-700 transition-colors active:scale-[0.99] hover:border-teal-300"
          >
            <Camera size={22} />
            <span className="text-[10px] font-black uppercase tracking-widest">Camera</span>
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            aria-label="Choose photos from gallery"
            className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-slate-600 transition-colors active:scale-[0.99] hover:border-slate-300"
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
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-teal-600 transition-all duration-300"
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

      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleAdd(e.target.files, 1, "camera");
          e.target.value = "";
        }}
      />
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
        ref={replaceCameraRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = filterFiles(e.target.files)[0];
          if (file != null && replaceIndex != null) {
            onReplace?.(replaceIndex, file, "camera");
          }
          setReplaceIndex(null);
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
    </div>
  );
};

export default ParcelPhotoCapture;
