/**
 * 목차 (table of contents). Not 빈 쪽 (`leaf.kind === "outline"`), which is a
 * blank inserted page. Both used to be called 개요, which read as one thing (#107).
 */

export const PREVIEW_TABS = ["pages", "toc"];
export const PREVIEW_TAB_LABELS = {
  pages: "페이지",
  toc: "목차",
};

/** Row prefix, `p5.` style (#120). */
export function outlinePageLabel(page) {
  return `p${Math.max(1, Math.round(Number(page) || 1))}.`;
}

export function outlineTitleForPage(page) {
  const n = Math.max(1, Math.round(Number(page) || 1));
  return `페이지 ${n}`;
}

let outlineSeq = 0;

/** An entry points at the leaf, so reordering pages cannot move it (#107). */
export function makeOutlineEntry(page, extras = {}) {
  const dest = Math.max(1, Math.round(Number(page) || 1));
  outlineSeq += 1;
  const key = String(extras.id || `t:${Date.now().toString(36)}-${outlineSeq}`);
  const entry = {
    id: key.startsWith("t:") ? key : `t:${key}`,
    title: extras.title ? String(extras.title) : outlineTitleForPage(dest),
    page: dest,
  };
  if (extras.leafId) {
    entry.leafId = String(extras.leafId);
  }
  return entry;
}

function leafIdAtPage(leaves, page) {
  const leaf = (leaves || [])[Math.max(1, Math.round(Number(page) || 1)) - 1];
  return leaf?.id || "";
}

function pageOfLeafId(leaves, leafId) {
  const index = (leaves || []).findIndex((leaf) => leaf.id === leafId);
  return index < 0 ? 0 : index + 1;
}

/**
 * Older files stored only a page number: those are pinned to whatever leaf sits
 * there today. An entry whose leaf is gone drops out quietly.
 */
export function normalizeOutline(entries, leaves = null) {
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
    if (!page && !raw.leafId) {
      continue;
    }
    let leafId = raw.leafId ? String(raw.leafId) : "";
    let dest = page;
    if (leaves) {
      if (leafId) {
        dest = pageOfLeafId(leaves, leafId);
        if (!dest) {
          continue;
        }
      } else {
        leafId = leafIdAtPage(leaves, page);
        if (!leafId) {
          continue;
        }
      }
    }
    const entry = makeOutlineEntry(dest || page, { ...raw, leafId });
    if (seen.has(entry.id)) {
      continue;
    }
    seen.add(entry.id);
    out.push(entry);
  }
  return out;
}

/**
 * After the ink is baked into the file the leaves start over at 1..N, so the
 * entries drop their leaf anchor and re-attach by page number (#126).
 */
export function flattenOutline(entries, leaves = null) {
  return (entries || []).map((entry) => ({
    id: entry.id,
    title: entry.title,
    page: outlineDestPage(entry, leaves),
  }));
}

/**
 * A new item lands where its page belongs, not at the bottom (#161). Existing
 * order is left alone: only the insertion point is chosen.
 */
export function addOutlineEntry(entries, page, leaves = null) {
  const list = normalizeOutline(entries, leaves);
  const entry = makeOutlineEntry(page, { leafId: leaves ? leafIdAtPage(leaves, page) : "" });
  const dest = outlineDestPage(entry, leaves);
  // After the last item that belongs before it: forgiving when the list is
  // not sorted, and exact when it is.
  let at = 0;
  for (let index = 0; index < list.length; index += 1) {
    if (outlineDestPage(list[index], leaves) <= dest) {
      at = index + 1;
    }
  }
  const out = list.slice();
  out.splice(at, 0, entry);
  return out;
}

/** Where the entry points today: the leaf's slot, not the stored number. */
export function outlineDestPage(entry, leaves = null) {
  if (leaves && entry?.leafId) {
    const page = pageOfLeafId(leaves, entry.leafId);
    if (page) {
      return page;
    }
  }
  return Math.max(1, Math.round(Number(entry?.page) || 1));
}

/**
 * First TOC entry that lands on this page (#215/#217). Null when none; the
 * preview row then keeps the page-number line only.
 */
export function firstOutlineEntryForPage(entries, page, leaves = null) {
  const dest = Math.max(1, Math.round(Number(page) || 1));
  for (const entry of entries || []) {
    if (outlineDestPage(entry, leaves) !== dest) {
      continue;
    }
    if (String(entry.title || "").trim()) {
      return entry;
    }
  }
  return null;
}

/** Title of `firstOutlineEntryForPage`, or empty when that page has no TOC. */
export function firstOutlineTitleForPage(entries, page, leaves = null) {
  const title = firstOutlineEntryForPage(entries, page, leaves)?.title;
  return title ? String(title).trim() : "";
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

/** Plain text only. Callers must not use innerHTML for outline titles. */
export function setOutlineTitleText(node, title) {
  if (!node) {
    return;
  }
  node.textContent = String(title ?? "");
}

/** Title text edits. x deletes. Anything else on the row jumps. */
export function tocRowAction(className) {
  const cls = String(className || "");
  if (cls.includes("preview-toc-title") || cls.includes("preview-toc-edit")) {
    return "edit";
  }
  if (cls.includes("preview-toc-delete")) {
    return "delete";
  }
  return "jump";
}
