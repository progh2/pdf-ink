/**
 * PDF `/Outlines` in and out (#145). The table of contents and the bookmarks
 * ride inside the file, so another computer sees them too. Bookmarks live in a
 * named group, which every reader shows as ordinary bookmarks.
 */

export const BOOKMARK_GROUP_TITLE = "책갈피";

export function bookmarkTitle(page) {
  return `${Math.max(1, Math.round(Number(page) || 1))}쪽`;
}

export function pageFromBookmarkTitle(title) {
  const match = /^(\d+)\s*쪽$/.exec(String(title || "").trim());
  return match ? Number(match[1]) : 0;
}

export function isBookmarkGroup(item) {
  return String(item?.title || "").trim() === BOOKMARK_GROUP_TITLE;
}

/**
 * Nested outlines come out in reading order, one flat list. Depth is kept so a
 * caller can indent later if it wants; the drawer stays flat for now.
 */
export function flattenOutlineItems(items, depth = 0) {
  const out = [];
  for (const item of items || []) {
    if (!item || isBookmarkGroup(item)) {
      continue;
    }
    const title = String(item.title || "").trim();
    if (title) {
      out.push({ title, dest: item.dest ?? null, depth });
    }
    if (item.items?.length) {
      out.push(...flattenOutlineItems(item.items, depth + 1));
    }
  }
  return out;
}

/** The pages the file says are bookmarked. */
export function bookmarkPagesFromItems(items) {
  const group = (items || []).find((item) => isBookmarkGroup(item));
  if (!group) {
    return [];
  }
  const pages = [];
  for (const child of group.items || []) {
    const page = pageFromBookmarkTitle(child?.title);
    if (page) {
      pages.push(page);
    }
  }
  return pages;
}

/** Which leaves carry a star, as page numbers. */
export function bookmarkPagesFromLeaves(leaves) {
  const pages = [];
  (leaves || []).forEach((leaf, index) => {
    if (leaf?.bookmark) {
      pages.push(index + 1);
    }
  });
  return pages;
}

export function applyBookmarkPages(leaves, pages) {
  const wanted = new Set((pages || []).map((page) => Math.round(Number(page) || 0)));
  return (leaves || []).map((leaf, index) => ({ ...leaf, bookmark: wanted.has(index + 1) }));
}

/** Nothing to write means no /Outlines at all, not an empty one. */
export function hasOutlineContent(entries, bookmarkPages) {
  return Boolean((entries || []).length || (bookmarkPages || []).length);
}
