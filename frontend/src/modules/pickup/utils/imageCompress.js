const MAX_DIM = 1600;
const JPEG_QUALITY = 0.82;

/**
 * Compress image file client-side before upload.
 */
export async function compressImageFile(file, { maxDim = MAX_DIM, quality = JPEG_QUALITY } = {}) {
  if (!file?.type?.startsWith("image/")) return file;
  if (file.size < 200_000) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Compression failed"))),
        "image/jpeg",
        quality,
      );
    });

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

export async function compressImageFiles(files) {
  const list = Array.from(files || []);
  return Promise.all(list.map((f) => compressImageFile(f)));
}
