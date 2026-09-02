/**
 * 사이드카 (#147). The ink travels beside the PDF as a small JSON file, so it
 * stays editable, saves in kilobytes, and follows the document to another
 * machine. The PDF itself is left alone until someone asks to bake it in (#54).
 */

export const INK_FILE_VERSION = 1;
export const INK_FILE_SUFFIX = ".ink";

export function sidecarPath(pdfPath) {
  return `${String(pdfPath || "")}${INK_FILE_SUFFIX}`;
}

export function sidecarName(pdfName) {
  return `${String(pdfName || "문서.pdf")}${INK_FILE_SUFFIX}`;
}

/** Everything this browser knows that the PDF itself does not carry. */
export function buildInkFile({
  pages,
  leaves,
  outline,
  savedAt = Date.now(),
  name = "",
  shareThumbs = false,
} = {}) {
  return {
    version: INK_FILE_VERSION,
    app: "pdf-ink",
    name: String(name || ""),
    savedAt: Math.round(Number(savedAt) || Date.now()),
    // #153: per document, so a heavy textbook can share thumbs and a scratch
    // file does not.
    shareThumbs: Boolean(shareThumbs),
    pages: pages || {},
    leaves: Array.isArray(leaves) ? leaves : [],
    outline: Array.isArray(outline) ? outline : [],
  };
}

export function serializeInkFile(data) {
  return JSON.stringify(buildInkFile(data));
}

export function parseInkFile(text) {
  try {
    const data = JSON.parse(text);
    if (!data || data.app !== "pdf-ink" || !data.pages || typeof data.pages !== "object") {
      return null;
    }
    return {
      version: Number(data.version) || 1,
      savedAt: Math.round(Number(data.savedAt) || 0),
      shareThumbs: Boolean(data.shareThumbs),
      pages: data.pages,
      leaves: Array.isArray(data.leaves) ? data.leaves : [],
      outline: Array.isArray(data.outline) ? data.outline : [],
    };
  } catch {
    return null;
  }
}

export function inkFileIsEmpty(data) {
  const pages = data?.pages || {};
  return !Object.values(pages).some((items) => (items || []).length);
}

/**
 * Whichever side was saved later wins, and a tie keeps what is already here.
 * Never silently drops ink that the other side does not have.
 */
export function pickNewer(local, remote) {
  if (!remote) {
    return "local";
  }
  if (!local || !Number(local.savedAt)) {
    return inkFileIsEmpty(remote) ? "local" : "remote";
  }
  if (inkFileIsEmpty(remote) && !inkFileIsEmpty(local)) {
    return "local";
  }
  return Number(remote.savedAt) > Number(local.savedAt) ? "remote" : "local";
}

/** Rough size guard, so a runaway document does not wedge the upload. */
export function inkFileSize(text) {
  return typeof text === "string" ? text.length : 0;
}
