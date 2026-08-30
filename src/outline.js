/** PDF table-of-contents outline. Not GoodNotes blank outline pages (leaf.kind === "outline"). */

export const PREVIEW_TABS = ["pages", "toc"];
export const PREVIEW_TAB_LABELS = {
  pages: "페이지",
  toc: "개요",
};

export function outlineTitleForPage(page) {
  const n = Math.max(1, Math.round(Number(page) || 1));
  return `페이지 ${n}`;
}

let outlineSeq = 0;

export function makeOutlineEntry(page, extras = {}) {
  const dest = Math.max(1, Math.round(Number(page) || 1));
  outlineSeq += 1;
  const key = String(extras.id || `t:${Date.now().toString(36)}-${outlineSeq}`);
  return {
    id: key.startsWith("t:") ? key : `t:${key}`,
    title: extras.title ? String(extras.title) : outlineTitleForPage(dest),
    page: dest,
  };
}

export function normalizeOutline(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }
  const out = [];
  const seen = new Set();
  for (const raw of entries) {
    if (!raw || typeof raw !== "object") {
      continue;
    }
    const page = Math.max(1, Math.round(Number(raw.page) || 0));
    if (!page) {
      continue;
    }
    const entry = makeOutlineEntry(page, raw);
    if (seen.has(entry.id)) {
      continue;
    }
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

export function addOutlineEntry(entries, page) {
  return [...normalizeOutline(entries), makeOutlineEntry(page)];
}

export function renameOutlineEntry(entries, id, title) {
  const nextTitle = String(title ?? "").trim();
  return normalizeOutline(entries).map((entry) => {
    if (entry.id !== id) {
      return entry;
    }
    return {
      ...entry,
      title: nextTitle || outlineTitleForPage(entry.page),
    };
  });
}

export function deleteOutlineEntry(entries, id) {
  return normalizeOutline(entries).filter((entry) => entry.id !== id);
}

export function outlineDestPage(entry) {
  return Math.max(1, Math.round(Number(entry?.page) || 1));
}
