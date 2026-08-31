import { normalizeRotation } from "./rotate.js";

export const PREVIEW_FILTERS = ["all", "bookmarks", "outline"];
export const PREVIEW_FILTER_LABELS = {
  all: "전체",
  bookmarks: "책갈피",
  outline: "빈 쪽",
};

export function makePdfLeaf(pdfPage, extras = {}) {
  const leaf = {
    id: extras.id || `p${pdfPage}`,
    kind: "pdf",
    pdfPage,
    bookmark: Boolean(extras.bookmark),
    rotate: normalizeRotation(extras.rotate || 0),
    title: extras.title || "",
  };
  // A duplicated page carries its own ink, so it needs its own key (#55).
  if (extras.inkId) {
    leaf.inkId = String(extras.inkId);
  }
  return leaf;
}

export function makeOutlineLeaf(id, extras = {}) {
  const key = String(id || `o-${Date.now()}`);
  return {
    id: key.startsWith("o:") ? key : `o:${key}`,
    kind: "outline",
    pdfPage: 0,
    bookmark: Boolean(extras.bookmark),
    rotate: normalizeRotation(extras.rotate || 0),
    title: extras.title || "빈 쪽",
  };
}

export function defaultLeaves(pageCount) {
  const n = Math.max(0, Math.round(Number(pageCount) || 0));
  return Array.from({ length: n }, (_, index) => makePdfLeaf(index + 1));
}

/** Ids address ink and rows, so a duplicated page must not reuse one (#55). */
function uniqueId(base, used) {
  if (base && !used.has(base)) {
    used.add(base);
    return base;
  }
  let n = 2;
  while (used.has(`${base}#${n}`)) {
    n += 1;
  }
  const id = `${base}#${n}`;
  used.add(id);
  return id;
}

export function normalizeLeaves(leaves, pageCount) {
  const n = Math.max(0, Math.round(Number(pageCount) || 0));
  if (!Array.isArray(leaves) || !leaves.length) {
    return defaultLeaves(n);
  }
  const out = [];
  const seen = new Set();
  const ids = new Set();
  for (const raw of leaves) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    if (raw.kind === "outline") {
      const leaf = makeOutlineLeaf(raw.id || `o:${out.length + 1}`, raw);
      leaf.id = uniqueId(leaf.id, ids);
      out.push(leaf);
      continue;
    }
    const pdfPage = Number(raw.pdfPage || raw.page);
    // The same source page may appear more than once: that is a duplicate (#55).
    if (pdfPage >= 1 && pdfPage <= n) {
      seen.add(pdfPage);
      const leaf = makePdfLeaf(pdfPage, raw);
      leaf.id = uniqueId(leaf.id, ids);
      out.push(leaf);
    }
  }
  for (let page = 1; page <= n; page += 1) {
    if (seen.has(page)) {
      continue;
    }
    const leaf = makePdfLeaf(page);
    leaf.id = uniqueId(leaf.id, ids);
    const idx = out.findIndex((item) => item.kind === "pdf" && item.pdfPage > page);
    if (idx === -1) {
      out.push(leaf);
    } else {
      out.splice(idx, 0, leaf);
    }
  }
  return out;
}

export function inkKey(leaf) {
  if (!leaf) {
    return "1";
  }
  if (leaf.kind === "outline") {
    return leaf.id;
  }
  return leaf.inkId ? String(leaf.inkId) : String(leaf.pdfPage);
}

export function insertOutlineAfter(leaves, index, id) {
  const next = (leaves || []).slice();
  const at = Math.min(Math.max(0, Number(index) + 1), next.length);
  next.splice(at, 0, makeOutlineLeaf(id));
  return next;
}

export function toggleBookmark(leaves, index) {
  return (leaves || []).map((leaf, i) => (i === index ? { ...leaf, bookmark: !leaf.bookmark } : leaf));
}

export function setLeafRotate(leaves, index, rotate) {
  return (leaves || []).map((leaf, i) => (i === index ? { ...leaf, rotate: normalizeRotation(rotate) } : leaf));
}

export function filterLeaves(leaves, mode) {
  if (mode === "bookmarks") {
    return (leaves || []).filter((leaf) => leaf.bookmark);
  }
  if (mode === "outline") {
    return (leaves || []).filter((leaf) => leaf.kind === "outline");
  }
  return leaves || [];
}

export function leafAt(leaves, page) {
  return (leaves || [])[Math.max(0, Number(page) - 1)] || null;
}

export function pageOfLeaf(leaves, id) {
  const index = (leaves || []).findIndex((leaf) => leaf.id === id);
  return index >= 0 ? index + 1 : 1;
}

export function pageOfInkKey(leaves, key) {
  const index = (leaves || []).findIndex((leaf) => inkKey(leaf) === String(key));
  return index >= 0 ? index + 1 : 1;
}

export function outlineViewport(baseWidth, baseHeight, rotate) {
  if (normalizeRotation(rotate) % 180 === 90) {
    return { width: baseHeight, height: baseWidth };
  }
  return { width: baseWidth, height: baseHeight };
}
