export const PREVIEW_DRAWER_WIDTH = 120;
export const PREVIEW_THUMB_SIZE = 88;
export const PREVIEW_THUMB_GAP = 8;

export function defaultSheets(pageCount) {
  const count = Math.max(0, Number(pageCount) || 0);
  return Array.from({ length: count }, (_, index) => ({
    key: String(index + 1),
    kind: "pdf",
    pdfPage: index + 1,
  }));
}

export function coerceSheets(sheets, pageCount) {
  if (!Array.isArray(sheets) || !sheets.length) {
    return defaultSheets(pageCount);
  }
  const next = [];
  const seen = new Set();
  for (const sheet of sheets) {
    if (!sheet || typeof sheet !== "object" || !sheet.key || seen.has(sheet.key)) {
      continue;
    }
    if (sheet.kind === "outline") {
      seen.add(sheet.key);
      next.push({ key: String(sheet.key), kind: "outline" });
      continue;
    }
    const pdfPage = Number(sheet.pdfPage || sheet.key);
    if (pdfPage >= 1 && pdfPage <= pageCount) {
      seen.add(sheet.key);
      next.push({ key: String(sheet.key), kind: "pdf", pdfPage });
    }
  }
  if (!next.some((sheet) => sheet.kind === "pdf")) {
    return defaultSheets(pageCount);
  }
  for (let index = 1; index <= pageCount; index += 1) {
    if (!next.some((sheet) => sheet.kind === "pdf" && sheet.pdfPage === index)) {
      next.push({ key: String(index), kind: "pdf", pdfPage: index });
    }
  }
  return next;
}

export function insertOutlineSheet(sheets, afterIndex, id) {
  const next = (sheets || []).slice();
  const index = Math.max(-1, Math.min(next.length - 1, Number(afterIndex)));
  next.splice(index + 1, 0, { key: `ol-${id}`, kind: "outline" });
  return next;
}

export function toggleBookmark(bookmarks, key) {
  const list = Array.isArray(bookmarks) ? bookmarks.map(String) : [];
  const id = String(key);
  if (list.includes(id)) {
    return list.filter((item) => item !== id);
  }
  return list.concat(id);
}

export function filterSheets(sheets, bookmarks, filter) {
  const list = sheets || [];
  if (filter === "bookmarks") {
    const marks = new Set((bookmarks || []).map(String));
    return list.filter((sheet) => marks.has(sheet.key));
  }
  if (filter === "outlines") {
    return list.filter((sheet) => sheet.kind === "outline");
  }
  return list;
}

export function sheetIndexByKey(sheets, key) {
  return (sheets || []).findIndex((sheet) => sheet.key === String(key));
}
