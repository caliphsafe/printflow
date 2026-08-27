/*
  LONGEVITY ADMIN IMAGE OPTIMIZER
  Shared by the existing single-product uploader and bulk uploader.

  Shopify's current MediaImage limit is 20 MB / 20 MP / 4472px max dimension.
  We deliberately normalize new product images to <= 3000px on the longest
  side and aim below 18 MB to leave upload headroom.
*/
(() => {
  const MAX_DIMENSION = 3000;
  const TARGET_BYTES = 18 * 1024 * 1024;
  const JPEG_QUALITY = 0.92;
  const WEBP_QUALITY = 0.92;

  function formatBytes(bytes = 0) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function loadBitmap(file) {
    if ("createImageBitmap" in window) return createImageBitmap(file);

    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Could not read ${file.name}`));
      };
      image.src = url;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error("Image conversion failed.")),
        type,
        quality
      );
    });
  }

  function outputType(file) {
    const type = String(file.type || "").toLowerCase();
    if (type === "image/png") return "image/png"; // transparency-safe
    if (type === "image/webp") return "image/webp";
    return "image/jpeg";
  }

  function outputName(file, type) {
    const base = file.name.replace(/\.[^.]+$/, "");
    if (type === "image/png") return `${base}.png`;
    if (type === "image/webp") return `${base}.webp`;
    return `${base}.jpg`;
  }

  async function optimizeImageFile(file) {
    if (!file?.type?.startsWith("image/")) return file;

    const bitmap = await loadBitmap(file);
    const originalWidth = bitmap.width || bitmap.naturalWidth;
    const originalHeight = bitmap.height || bitmap.naturalHeight;

    if (!originalWidth || !originalHeight) return file;

    const longest = Math.max(originalWidth, originalHeight);
    const scale = Math.min(1, MAX_DIMENSION / longest);
    const width = Math.max(1, Math.round(originalWidth * scale));
    const height = Math.max(1, Math.round(originalHeight * scale));

    // Leave already-safe images untouched so we never recompress needlessly.
    if (scale === 1 && file.size <= TARGET_BYTES) {
      try { bitmap.close?.(); } catch {}
      file.__longevityOptimization = {
        optimized: false,
        originalWidth,
        originalHeight,
        width: originalWidth,
        height: originalHeight,
        originalBytes: file.size,
        bytes: file.size,
      };
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { alpha: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    try { bitmap.close?.(); } catch {}

    const type = outputType(file);
    let quality = type === "image/png" ? undefined : (type === "image/webp" ? WEBP_QUALITY : JPEG_QUALITY);
    let blob = await canvasToBlob(canvas, type, quality);

    // JPEG/WebP can be progressively compressed if an unusually detailed
    // image is still too large. PNG stays PNG to preserve transparency.
    if (type !== "image/png") {
      while (blob.size > TARGET_BYTES && quality > 0.68) {
        quality -= 0.06;
        blob = await canvasToBlob(canvas, type, quality);
      }
    }

    // A giant transparent PNG can still be unusually large. 3000x3000 is
    // already safely below Shopify's pixel/dimension limits; warn only if its
    // encoded file remains above our conservative target.
    const optimized = new File([blob], outputName(file, type), {
      type,
      lastModified: Date.now(),
    });

    optimized.__longevityOptimization = {
      optimized: true,
      originalName: file.name,
      originalWidth,
      originalHeight,
      width,
      height,
      originalBytes: file.size,
      bytes: optimized.size,
      warning: optimized.size > TARGET_BYTES
        ? "Image dimensions are safe, but this PNG is still large."
        : "",
    };

    return optimized;
  }

  async function optimizeImageFiles(files = []) {
    const results = [];
    for (const file of files) {
      try {
        results.push(await optimizeImageFile(file));
      } catch (error) {
        console.warn("Image optimization skipped:", file?.name, error);
        results.push(file);
      }
    }
    return results;
  }

  function showOptimizationNotice(files) {
    const changed = files.filter(file => file.__longevityOptimization?.optimized);
    if (!changed.length) return;

    let notice = document.getElementById("admin-image-optimization-notice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "admin-image-optimization-notice";
      notice.className = "admin-image-optimization-notice";
      document.body.appendChild(notice);
    }

    const before = changed.reduce((sum, f) => sum + (f.__longevityOptimization.originalBytes || 0), 0);
    const after = changed.reduce((sum, f) => sum + (f.size || 0), 0);

    notice.textContent = `IMAGES OPTIMIZED · ${changed.length} FILE${changed.length === 1 ? "" : "S"} · ${formatBytes(before)} → ${formatBytes(after)}`;
    notice.classList.add("is-visible");
    clearTimeout(notice.__hideTimer);
    notice.__hideTimer = setTimeout(() => notice.classList.remove("is-visible"), 4500);
  }

  window.LongevityImageOptimizer = {
    optimizeImageFile,
    optimizeImageFiles,
    formatBytes,
    MAX_DIMENSION,
    TARGET_BYTES,
  };

  // Enhance existing single-product uploader without replacing admin.js.
  if (typeof window.addPendingFiles === "function") {
    const originalAddPendingFiles = window.addPendingFiles;
    window.addPendingFiles = async function(files = []) {
      const optimized = await optimizeImageFiles(files);
      showOptimizationNotice(optimized);
      return originalAddPendingFiles(optimized);
    };
  }

  // Enhance the existing bulk intake before filename grouping occurs.
  if (typeof window.ingestBulkFiles === "function") {
    const originalIngestBulkFiles = window.ingestBulkFiles;
    window.ingestBulkFiles = async function(files = []) {
      const optimized = await optimizeImageFiles(files);
      showOptimizationNotice(optimized);
      return originalIngestBulkFiles(optimized);
    };
  }
})();
