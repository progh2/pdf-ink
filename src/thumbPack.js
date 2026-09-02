/**
 * 썸네일 묶음 (#153). Off by default. When a document turns it on, the thumbs
 * it already drew travel beside it, so a slow machine opening the file for the
 * first time does not have to render hundreds of pages.
 */

export const THUMB_PACK_SUFFIX = ".thumbs";
export const THUMB_PACK_VERSION = 1;
/** Above this we do not upload: a pack should help, not become the problem. */
export const THUMB_PACK_MAX_BYTES = 12 * 1024 * 1024;
/** Re-upload once this much of the document no longer matches the pack. */
export const THUMB_PACK_STALE_RATIO = 0.1;

export function thumbPackPath(pdfPath) {
  return `${String(pdfPath || "")}${THUMB_PACK_SUFFIX}`;
}

export function buildThumbPack(entries, savedAt = Date.now()) {
  return {
    version: THUMB_PACK_VERSION,
    app: "pdf-ink",
    savedAt: Math.round(Number(savedAt) || Date.now()),
    thumbs: entries || {},
  };
}

export function parseThumbPack(text) {
  try {
    const data = JSON.parse(text);
    if (!data || data.app !== "pdf-ink" || !data.thumbs || typeof data.thumbs !== "object") {
      return null;
    }
    return { savedAt: Math.round(Number(data.savedAt) || 0), thumbs: data.thumbs };
  } catch {
    return null;
  }
}

export function packTooBig(text, limit = THUMB_PACK_MAX_BYTES) {
  return (typeof text === "string" ? text.length : 0) > limit;
}

/**
 * How much of what this document needs is missing from the pack. Rotating one
 * page out of four hundred must not trigger a fresh upload.
 */
export function staleRatio(packKeys, wantedKeys) {
  const wanted = [...new Set(wantedKeys || [])];
  if (!wanted.length) {
    return 0;
  }
  const have = new Set(packKeys || []);
  const missing = wanted.filter((key) => !have.has(key)).length;
  return missing / wanted.length;
}

export function shouldUploadPack({ hasPack, ratio, ready }, threshold = THUMB_PACK_STALE_RATIO) {
  if (!ready) {
    return false;
  }
  if (!hasPack) {
    return true;
  }
  return ratio >= threshold;
}

/** Worth downloading only when this machine is missing a real share of them. */
export function shouldDownloadPack(missingRatio, threshold = THUMB_PACK_STALE_RATIO) {
  return missingRatio > threshold;
}
