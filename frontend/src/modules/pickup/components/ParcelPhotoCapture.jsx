import React, { useRef, useState } from "react";
import { Camera, ImagePlus, RotateCcw, Trash2, X } from "lucide-react";

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_IMAGES = 4;

/**
 * Mandatory parcel photos: separate Camera vs Gallery pickers.
 * Supports 1–4 images with preview / remove / retake / replace + upload progress.
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
}) => {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const replaceCameraRef = useRef(null);
  const replaceGalleryRef = useRef(null);
  const [replaceIndex, setReplaceIndex] = useState(null);
  const [replaceMode, setReplaceMode] = useState("camera");

  const remaining = Math.max(0, MAX_IMAGES - images.length);
  const canAdd = !disabled && remaining > 0 && !uploading;

  const filterFiles = (fileList) => {
    const files = Array.from(fileList || []);
    return files.filter((f) => ACCEPTED.includes(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name));
  };

  const handleAdd = (fileList, limit, source) => {
    const valid = filterFiles(fileList).slice(0, limit);
    if (!valid.length) return;
    onAddFiles?.(valid, source);
  };

  const openReplace = (index, mode) => {
    setReplaceIndex(index);
    setReplaceMode(mode);
    setTimeout(() => {
      if (mode === "camera") replaceCameraRef.current?.click();
      else replaceGalleryRef.current?.click();
    }, 0);
  };

  return (
    <div className={`space-y-3 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {label} <span className="text-rose-500">*</span>
        </p>
        <p className="text-[10px] font-bold text-slate-400">
          {images.length}/{MAX_IMAGES}
        </p>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:grid-cols-4">
          {images.map((img, index) => (
            <div
              key={`${img.url}-${index}`}
              className="relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
            >
              <img src={img.url} alt={`Parcel ${index + 1}`} className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-gradient-to-t from-black/75 to-transparent p-2">
                {img.source === "camera" && (
                  <button
                    type="button"
                    onClick={() => openReplace(index, "camera")}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/95 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-900"
                  >
                    <RotateCcw size={10} /> Retake
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openReplace(index, "gallery")}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/95 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-900"
                >
                  <ImagePlus size={10} /> Replace
                </button>
                <button
                  type="button"
                  onClick={() => onRemove?.(index)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500 text-white"
                  aria-label="Remove"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {canAdd && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-slate-600 active:scale-[0.99]"
          >
            <Camera size={22} />
            <span className="text-[10px] font-black uppercase tracking-widest">Camera</span>
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-slate-600 active:scale-[0.99]"
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
        <div className="space-y-1">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${Math.max(8, uploadProgress)}%` }}
            />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Uploading… {uploadProgress}%
          </p>
        </div>
      )}

      {!images.length && !disabled && (
        <p className="text-[10px] font-semibold text-amber-700">
          Upload at least 1 image (jpg, png, webp) to continue
        </p>
      )}

      {/* Camera: single capture */}
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
      {/* Gallery: multi select */}
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
export { MAX_IMAGES, ACCEPTED };
