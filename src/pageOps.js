import { cloneItems } from "./history.js";
import { inkKey, makeOutlineLeaf, makePdfLeaf, setLeafRotate } from "./preview.js";
import { addRotation } from "./rotate.js";

/** Preview drawer page menu (#55). Hold 400ms or right-click on a thumb. */
export const PAGE_MENU_ACTIONS = ["copy", "paste", "duplicate", "up", "down", "left", "right"];
export const PAGE_MENU_LABELS = {
  copy: "복사",
  paste: "붙여넣기",
  duplicate: "복제",
  up: "위로",
  down: "아래로",
  left: "왼쪽 90°",
  right: "오른쪽 90°",
};
/** One 44 row per action, stacked: the drawer is only 120 wide. */
export const PAGE_MENU_ROW = 44;
export const PAGE_MENU_WIDTH = 140;
export const PAGE_MENU_HEIGHT = 44;
export const PAGE_HOLD_MS = 400;
export const PAGE_DRAG_SLOP_PX = 8;

/** Which slot a drag over the thumb list would drop into (#55). */
export function dropIndexAt({ pointerY, listTop, scrollTop, stride, count } = {}) {
  const n = Math.max(0, Math.round(Number(count) || 0));
  if (n <= 0 || !(Number(stride) > 0)) {
    return 0;
  }
  const y = (Number(pointerY) || 0) - (Number(listTop) || 0) + (Number(scrollTop) || 0);
  const slot = Math.round(y / Number(stride));
  return Math.min(n - 1, Math.max(0, slot));
}

/** Where the drop line sits inside the list content. */
export function dropLineTop(index, stride) {
  return Math.max(0, Math.round(Number(index) || 0) * Math.max(0, Number(stride) || 0));
}

/** Menu placement beside the drawer, kept on screen. */
export function placePageMenu(rowTop, drawerRight, viewHeight, rows, gap = 8) {
  const height = Math.max(1, Math.round(Number(rows) || 1)) * PAGE_MENU_ROW;
  const view = Math.max(1, Number(viewHeight) || 1);
  const top = Math.min(Math.max(gap, Number(rowTop) || 0), Math.max(gap, view - height - gap));
  return { left: (Number(drawerRight) || 0) + gap, top, height };
}

let seq = 0;

/** A copied page carries its own ink, so it gets its own key, never the page number. */
export function newInkId(prefix = "d") {
  seq += 1;
  return `${prefix}:${Date.now().toString(36)}-${seq}`;
}

function freshLeaf(leaf, inkId = newInkId()) {
  if (leaf.kind === "outline") {
    const copy = makeOutlineLeaf(newInkId("o"), { ...leaf, id: undefined });
    copy.title = leaf.title || "개요";
    copy.bookmark = false;
    return copy;
  }
  // Unique id or two rows answer to the same leaf lookup.
  const copy = makePdfLeaf(leaf.pdfPage, {
    ...leaf,
    id: `p${leaf.pdfPage}#${String(inkId).split(":").pop()}`,
    inkId,
  });
  copy.bookmark = false;
  return copy;
}

export function movePageLeaf(leaves, index, delta) {
  const list = (leaves || []).slice();
  const from = Number(index);
  const to = from + Number(delta || 0);
  if (!(from >= 0 && from < list.length) || !(to >= 0 && to < list.length)) {
    return leaves || [];
  }
  const [leaf] = list.splice(from, 1);
  list.splice(to, 0, leaf);
  return list;
}

/** Drag reorder: same as move, but to any slot. */
export function reorderPageLeaf(leaves, from, to) {
  return movePageLeaf(leaves, from, Number(to) - Number(from));
}

export function rotatePageLeaf(leaves, index, delta) {
  const leaf = (leaves || [])[index];
  if (!leaf) {
    return leaves || [];
  }
  return setLeafRotate(leaves, index, addRotation(leaf.rotate, delta));
}

export function copyPageLeaf(leaves, pages, index) {
  const leaf = (leaves || [])[index];
  if (!leaf) {
    return null;
  }
  return { leaf: { ...leaf }, items: cloneItems((pages || {})[inkKey(leaf)] || []) };
}

export function canPastePage(clip) {
  return Boolean(clip?.leaf);
}

/**
 * Inserts a copy right after `index`. The new leaf gets its own id and ink key,
 * so the two pages do not share strokes.
 */
export function pastePageLeaf(leaves, pages, index, clip) {
  if (!canPastePage(clip)) {
    return { leaves: leaves || [], pages: pages || {}, key: null };
  }
  const list = (leaves || []).slice();
  const copy = freshLeaf(clip.leaf);
  const at = Math.min(Math.max(0, Number(index) + 1), list.length);
  list.splice(at, 0, copy);
  const key = inkKey(copy);
  return {
    leaves: list,
    pages: { ...(pages || {}), [key]: cloneItems(clip.items || []) },
    key,
    at,
  };
}

export function duplicatePageLeaf(leaves, pages, index) {
  const clip = copyPageLeaf(leaves, pages, index);
  if (!clip) {
    return { leaves: leaves || [], pages: pages || {}, key: null };
  }
  return pastePageLeaf(leaves, pages, index, clip);
}
