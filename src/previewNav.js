/** Visible-window + LRU cache helpers for #85 preview navigation. */

export const PREVIEW_OVERSCAN = 4;
export const SCROLL_STAGE_OVERSCAN = 2;
export const SCROLL_STAGE_GAP = 16;
export const PAGE_BITMAP_LIMIT = 8;
export const THUMB_CACHE_LIMIT = 64;

export const PREVIEW_THUMB_CSS = 88;
export const PREVIEW_THUMB_RATIO = 4 / 3;
export const PREVIEW_ROW_INNER_GAP = 6;
export const PREVIEW_META_MIN = 32;
export const PREVIEW_LIST_GAP = 8;

export function previewRowStride(thumbCss = PREVIEW_THUMB_CSS, listGap = PREVIEW_LIST_GAP) {
  const thumbH = Number(thumbCss) * PREVIEW_THUMB_RATIO;
  return thumbH + PREVIEW_ROW_INNER_GAP + PREVIEW_META_MIN + Number(listGap);
}

export function visibleIndexWindow({
  scrollTop,
  clientHeight,
  itemStride,
  count,
  overscan = PREVIEW_OVERSCAN,
}) {
  const n = Math.max(0, Math.round(Number(count) || 0));
  if (n <= 0 || !(itemStride > 0)) {
    return { from: 0, to: -1 };
  }
  const top = Math.max(0, Number(scrollTop) || 0);
  const height = Math.max(0, Number(clientHeight) || 0);
  const first = Math.floor(top / itemStride);
  const last = Math.floor((top + height) / itemStride);
  const pad = Math.max(0, Math.round(Number(overscan) || 0));
  return {
    from: Math.max(0, first - pad),
    to: Math.min(n - 1, last + pad),
  };
}

export function visiblePageWindow({
  scrollTop,
  clientHeight,
  pageHeight,
  gap = SCROLL_STAGE_GAP,
  count,
  scale = 1,
  overscan = SCROLL_STAGE_OVERSCAN,
}) {
  const n = Math.max(0, Math.round(Number(count) || 0));
  if (n <= 0 || !(pageHeight > 0)) {
    return { from: 1, to: 0 };
  }
  const stride = pageHeight + Math.max(0, Number(gap) || 0);
  const zoom = Number(scale) > 0 ? Number(scale) : 1;
  const top = Math.max(0, Number(scrollTop) || 0) / zoom;
  const height = Math.max(0, Number(clientHeight) || 0) / zoom;
  const first = Math.floor(top / stride) + 1;
  const last = Math.floor((top + height) / stride) + 1;
  const pad = Math.max(0, Math.round(Number(overscan) || 0));
  return {
    from: Math.max(1, first - pad),
    to: Math.min(n, last + pad),
  };
}

export function scrollStackHeight(count, pageHeight, gap = SCROLL_STAGE_GAP) {
  const n = Math.max(0, Math.round(Number(count) || 0));
  if (n <= 0 || !(pageHeight > 0)) {
    return 0;
  }
  return n * pageHeight + (n - 1) * Math.max(0, Number(gap) || 0);
}

export function pageOffsetTop(pageNum, pageHeight, gap = SCROLL_STAGE_GAP) {
  const page = Math.max(1, Math.round(Number(pageNum) || 1));
  return (page - 1) * (pageHeight + Math.max(0, Number(gap) || 0));
}

export function leafCacheKey(leaf) {
  if (!leaf) {
    return "";
  }
  return `${leaf.id}:${leaf.kind}:${leaf.rotate || 0}:${leaf.pdfPage || 0}`;
}

export function lruMapSet(map, key, value, limit) {
  if (!key) {
    return map;
  }
  if (map.has(key)) {
    map.delete(key);
  }
  map.set(key, value);
  const max = Math.max(1, Math.round(Number(limit) || 1));
  while (map.size > max) {
    const oldest = map.keys().next().value;
    map.delete(oldest);
  }
  return map;
}

export function lruMapGet(map, key) {
  if (!key || !map.has(key)) {
    return undefined;
  }
  const value = map.get(key);
  map.delete(key);
  map.set(key, value);
  return value;
}

export function pageFromScrollMid(scrollTop, clientHeight, pageHeight, gap, count, scale = 1) {
  const n = Math.max(1, Math.round(Number(count) || 1));
  if (!(pageHeight > 0)) {
    return 1;
  }
  const zoom = Number(scale) > 0 ? Number(scale) : 1;
  const mid = (Math.max(0, Number(scrollTop) || 0) + Math.max(0, Number(clientHeight) || 0) / 2) / zoom;
  const stride = pageHeight + Math.max(0, Number(gap) || 0);
  return Math.min(n, Math.max(1, Math.floor(mid / stride) + 1));
}
