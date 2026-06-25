// Downscale + re-encode a captured image in the browser BEFORE upload, so the
// request body is always small (~<1MB) and a normalized JPEG. This keeps OCR
// fast/cheap and makes the body-size 502 (oversized photo → connection reset)
// impossible on every proxy. Falls back to the original file if the browser
// can't decode it (e.g. an exotic format) — the server still validates.

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

async function decode(file: File): Promise<Decoded> {
  // Fast path: createImageBitmap (handles JPEG/PNG/WebP in modern browsers).
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, cleanup: () => bmp.close() };
    } catch {
      /* fall through to <img> */
    }
  }
  // Fallback: decode via an <img> element + object URL.
  return await new Promise<Decoded>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () =>
      resolve({
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        cleanup: () => URL.revokeObjectURL(url),
      });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

export async function downscaleImage(
  file: File,
  maxEdge = 1600,
  quality = 0.8,
): Promise<File> {
  if (typeof window === "undefined" || typeof document === "undefined") return file;
  // Already a small JPEG? Leave it alone.
  if (file.type === "image/jpeg" && file.size < 900_000) return file;

  try {
    const { source, width, height, cleanup } = await decode(file);
    if (!width || !height) {
      cleanup();
      return file;
    }
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      cleanup();
      return file;
    }
    ctx.drawImage(source, 0, 0, w, h);
    cleanup();

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", quality),
    );
    if (!blob || blob.size === 0) return file;
    // If re-encoding somehow produced something bigger, keep the smaller one.
    if (blob.size >= file.size && file.type === "image/jpeg") return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "upload";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
