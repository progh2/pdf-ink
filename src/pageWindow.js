/** Visible-window + paint-cache helpers for #85. No toolbar cells. */

export const PAGE_BITMAP_LIMIT = 6;
export const THUMB_BITMAP_LIMIT = 48;
export const PREVIEW_OVERSCAN = 3;
/** How long after the last stroke the open drawer repaints that thumb (#106). */
export const THUMB_REFRESH_MS = 600;
export const SCROLL_OVERSCAN = 2;
export const PAGE_STACK_GAP = 16;

export const PREVIEW_THUMB_WIDTH = 88;
export const PREVIEW_THUMB_HEIGHT = 117;
export const PREVIEW_META_HEIGHT = 44;
export const PREVIEW_ROW_GAP = 6;
export const PREVIEW_LIST_GAP = 8;

/** Drawer width is adjustable (#106), so the thumb and the row grow with it. */
export const PREVIEW_WIDTH_MIN = 96;
export const PREVIEW_WIDTH_MAX = 360;
export const PREVIEW_WIDTH_DEFAULT = 120;
export const PREVIEW_SIDE_PAD = 32;
export const PREVIEW_THUMB_RATIO = PREVIEW_THUMB_HEIGHT / PREVIEW_THUMB_WIDTH;

export function clampPreviewWidth(width) {
  const value = Math.round(Number(width) || PREVIEW_WIDTH_DEFAULT);
  return Math.min(PREVIEW_WIDTH_MAX, Math.max(PREVIEW_WIDTH_MIN, value));
}

export function previewThumbSize(drawerWidth = PREVIEW_WIDTH_DEFAULT) {
  const width = Math.max(24, clampPreviewWidth(drawerWidth) - PREVIEW_SIDE_PAD);
  return { width, height: Math.round(width * PREVIEW_THUMB_RATIO) };
}

export function previewRowBody(drawerWidth = PREVIEW_WIDTH_DEFAULT) {
  return previewThumbSize(drawerWidth).height + PREVIEW_ROW_GAP + PREVIEW_META_HEIGHT;
}

export function previewRowStride(drawerWidth = PREVIEW_WIDTH_DEFAULT) {
  return previewRowBody(drawerWidth) + PREVIEW_LIST_GAP;
}

export function previewListHeight(count, drawerWidth = PREVIEW_WIDTH_DEFAULT) {
  const n = Math.max(0, Math.round(Number(count) || 0));
  if (n <= 0) {
    return 0;
  }
  return n * previewRowBody(drawerWidth) + Math.max(0, n - 1) * PREVIEW_LIST_GAP;
}

export function visibleIndexRange({ scrollTop, viewportHeight, count, itemStride, overscan = 0 }) {
  const n = Math.max(0, Math.round(Number(count) || 0));
  if (n === 0 || !(Number(itemStride) > 0)) {
    return { from: 0, to: -1, count: 0 };
  }
  const top = Math.max(0, Number(scrollTop) || 0);
  const view = Math.max(0, Number(viewportHeight) || 0);
  const pad = Math.max(0, Math.round(Number(overscan) || 0));
  const first = Math.max(0, Math.floor(top / itemStride) - pad);
  const last = Math.min(n - 1, Math.floor((top + view) / itemStride) + pad);
  if (first > last) {
    return { from: 0, to: Math.min(n - 1, pad), count: Math.min(n, pad + 1) };
  }
  return { from: first, to: last, count: last - first + 1 };
}

export function visiblePreviewRows({
  scrollTop,
  viewportHeight,
  count,
  overscan = PREVIEW_OVERSCAN,
} = {}) {
  return visibleIndexRange({
    scrollTop,
    viewportHeight,
    count,
    itemStride: previewRowStride(),
    overscan,
  });
}

export function scrollStackMetrics(pageCount, pageWidth, pageHeight, gap = PAGE_STACK_GAP) {
  const n = Math.max(0, Math.round(Number(pageCount) || 0));
  const w = Math.max(0, Number(pageWidth) || 0);
  const h = Math.max(0, Number(pageHeight) || 0);
  const g = Math.max(0, Number(gap) || 0);
  return {
    count: n,
    pageWidth: w,
    pageHeight: h,
    gap: g,
    stride: h + g,
    width: w,
    height: n === 0 ? 0 : n * h + Math.max(0, n - 1) * g,
  };
}

export function pageStackOffset(pageNum, metrics) {
  const page = Math.max(1, Math.round(Number(pageNum) || 1));
  return (page - 1) * (Number(metrics?.stride) || 0);
}

export function visibleScrollPages({
  scrollTop,
  viewportHeight,
  scale = 1,
  metrics,
  overscan = SCROLL_OVERSCAN,
  currentPage = 1,
  offset = 0,
} = {}) {
  const n = Math.max(0, Number(metrics?.count) || 0);
  if (n <= 0) {
    return { from: 1, to: 0, count: 0 };
  }
  const zoom = Number(scale) > 0 ? Number(scale) : 1;
  const stride = (Number(metrics.stride) || 0) * zoom;
  const fallback = Math.min(n, Math.max(1, Math.round(Number(currentPage) || 1)));
  if (!(stride > 0)) {
    return { from: fallback, to: fallback, count: 1 };
  }
  // The stack starts below the scroll padding that clears the bar (#94).
  const top = Math.max(0, (Number(scrollTop) || 0) - (Number(offset) || 0));
  const view = Math.max(0, Number(viewportHeight) || 0);
  const pad = Math.max(0, Math.round(Number(overscan) || 0));
  const from = Math.max(1, Math.floor(top / stride) + 1 - pad);
  const to = Math.min(n, Math.ceil((top + Math.max(view, 1)) / stride) + pad);
  if (from > to) {
    return { from: fallback, to: fallback, count: 1 };
  }
  return { from, to, count: to - from + 1 };
}

export function pageAtScrollMid({ scrollTop, viewportHeight, scale = 1, metrics, offset = 0 } = {}) {
  const n = Math.max(0, Number(metrics?.count) || 0);
  if (n <= 0) {
    return 1;
  }
  const zoom = Number(scale) > 0 ? Number(scale) : 1;
  const mid =
    Math.max(0, (Number(scrollTop) || 0) - (Number(offset) || 0)) +
    Math.max(0, Number(viewportHeight) || 0) / 2;
  const pageH = (Number(metrics.pageHeight) || 0) * zoom;
  const stride = (Number(metrics.stride) || 0) * zoom;
  if (!(stride > 0)) {
    return 1;
  }
  let best = 1;
  let bestDist = Infinity;
  for (let page = 1; page <= n; page += 1) {
    const center = (page - 1) * stride + pageH / 2;
    const dist = Math.abs(center - mid);
    if (dist < bestDist) {
      bestDist = dist;
      best = page;
    }
  }
  return best;
}

export function createPaintCache(limit = 8) {
  const max = Math.max(1, Math.round(Number(limit) || 8));
  const map = new Map();
  return {
    limit: max,
    get(key) {
      if (!map.has(key)) {
        return null;
      }
      const value = map.get(key);
      map.delete(key);
      map.set(key, value);
      return value;
    },
    set(key, value) {
      if (map.has(key)) {
        map.delete(key);
      }
      map.set(key, value);
      while (map.size > max) {
        const oldest = map.keys().next().value;
        map.delete(oldest);
      }
      return value;
    },
    has(key) {
      return map.has(key);
    },
    delete(key) {
      return map.delete(key);
    },
    clear() {
      map.clear();
    },
    get size() {
      return map.size;
    },
    keys() {
      return [...map.keys()];
    },
  };
}

export function thumbCacheKey(leaf, thumbWidth = PREVIEW_THUMB_WIDTH, ink = 0) {
  if (!leaf) {
    return "empty";
  }
  // Width and ink stamp are part of the key: a wider drawer or a new stroke
  // must not reuse the old picture (#106).
  return `${leaf.id}:${leaf.rotate || 0}:${leaf.kind}:${Math.round(thumbWidth)}:${ink}`;
}

export function pageBitmapKey(leaf, extras = {}) {
  const id = leaf?.id || "empty";
  const rotate = leaf?.rotate || 0;
  const w = Math.round(Number(extras.cssWidth) || 0);
  const h = Math.round(Number(extras.cssHeight) || 0);
  const mode = extras.viewMode || "page";
  // The zoom render step is part of the key, or a blurry bitmap comes back (#96).
  const factor = Number(extras.factor) > 0 ? Number(extras.factor) : 1;
  return `${id}:${rotate}:${mode}:${w}x${h}@${factor}`;
}

/**
 * Changing page must never rebuild the preview list or paint every leaf.
 * Only move is-current (and optionally paint the visible window).
 */
export function previewUpdateOnPageChange({ drawerOpen = false, tab = "pages", listBuilt = false } = {}) {
  const open = Boolean(drawerOpen);
  return {
    rebuildList: false,
    paintAllThumbs: false,
    moveCurrent: open,
    paintVisible: open && tab === "pages" && Boolean(listBuilt),
  };
}

export function previewPaintsForPlan(plan, leafCount, viewportHeight = 640, scrollTop = 0) {
  if (plan?.rebuildList || plan?.paintAllThumbs) {
    return Math.max(0, Math.round(Number(leafCount) || 0));
  }
  if (!plan?.paintVisible) {
    return 0;
  }
  return visiblePreviewRows({
    scrollTop,
    viewportHeight,
    count: leafCount,
  }).count;
}

export function markCurrentRows(rows, currentPage) {
  const page = Math.round(Number(currentPage) || 0);
  return (rows || []).map((row) => ({
    ...row,
    current: row.page === page,
  }));
}
