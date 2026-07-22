import React, { useRef } from "react";
import { Camera, ImagePlus, RotateCcw, X } from "lucide-react";

/**
 * Mandatory parcel photo: camera / gallery + preview / retake / replace.
 */
const ParcelPhotoCapture = ({
  imageUrl,
  uploading = false,
  onUpload,
  onClear,
  label = "Parcel photo",
}) => {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    onUpload?.(file);
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {label} <span className="text-rose-500">*</span>
      </p>

      {imageUrl ? (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          <img src={imageUrl} alt="Parcel proof" className="h-44 w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/70 to-transparent p-3">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={uploading}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-white/95 py-2 text-[10px] font-black uppercase tracking-widest text-slate-900"
            >
              <RotateCcw size={12} /> Retake
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              disabled={uploading}
              className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-white/95 py-2 text-[10px] font-black uppercase tracking-widest text-slate-900"
            >
              <ImagePlus size={12} /> Replace
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={uploading}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500 text-white"
              aria-label="Remove photo"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-6 text-slate-600 active:scale-[0.98]"
          >
            <Camera size={22} />
            <span className="text-[10px] font-black uppercase tracking-widest">Camera</span>
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-6 text-slate-600 active:scale-[0.98]"
          >
            <ImagePlus size={22} />
            <span className="text-[10px] font-black uppercase tracking-widest">Gallery</span>
          </button>
        </div>
      )}

      {uploading && (
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Uploading proof...
        </p>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
};

export default ParcelPhotoCapture;
