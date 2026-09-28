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

/** #335: 행 비율은 문서를 따라간다 — 가로 문서에서 위아래 공백이 사라진다. */
export function previewThumbSize(drawerWidth = PREVIEW_WIDTH_DEFAULT, ratio = PREVIEW_THUMB_RATIO) {
  const width = Math.max(24, clampPreviewWidth(drawerWidth) - PREVIEW_SIDE_PAD);
  return { width, height: Math.round(width * (Number(ratio) > 0 ? ratio : PREVIEW_THUMB_RATIO)) };
}

export function previewRowBody(drawerWidth = PREVIEW_WIDTH_DEFAULT, ratio = PREVIEW_THUMB_RATIO) {
  return previewThumbSize(drawerWidth, ratio).height + PREVIEW_ROW_GAP + PREVIEW_META_HEIGHT;
}

export function previewRowStride(drawerWidth = PREVIEW_WIDTH_DEFAULT, ratio = PREVIEW_THUMB_RATIO) {
  return previewRowBody(drawerWidth, ratio) + PREVIEW_LIST_GAP;
}

export function previewListHeight(count, drawerWidth = PREVIEW_WIDTH_DEFAULT, ratio = PREVIEW_THUMB_RATIO) {
  const n = Math.max(0, Math.round(Number(count) || 0));
  if (n <= 0) {
    return 0;
  }
  return n * previewRowBody(drawerWidth, ratio) + Math.max(0, n - 1) * PREVIEW_LIST_GAP;
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

/**
 * The window, the spacer and the translate must agree on the row height, or a
 * widened drawer scrolls into nothing (#141).
 */
export function visiblePreviewRows({
  scrollTop,
  viewportHeight,
  count,
  overscan = PREVIEW_OVERSCAN,
  drawerWidth = PREVIEW_WIDTH_DEFAULT,
  ratio = PREVIEW_THUMB_RATIO,
} = {}) {
  return visibleIndexRange({
    scrollTop,
    viewportHeight,
    count,
    itemStride: previewRowStride(drawerWidth, ratio),
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

/**
 * 「지금 쪽」을 스크롤 자리에서 잰다.
 *
 * #458: 예전엔 화면 **한가운데**에 걸린 쪽을 골랐다. 쪽이 화면보다 짧으면
 * (세로로 든 폰 + 가로로 긴 쪽) 맨 위에 1쪽이 있어도 가운데는 2쪽이라
 * 「지금 쪽」이 한 칸 밀렸고, 그 쪽으로 가는 링크가 먹통이 됐다. 이제 재는
 * 자리는 **위에서 반 쪽 내려온 곳**이다(화면 절반을 넘지 않는다). 쪽이 화면보다
 * 길면 예전과 같은 한가운데고, 짧으면 맨 위에 걸린 쪽이 된다.
 *
 * 끝자락에서는 맨 위에 걸 수 없는 쪽들이 있다(마지막 화면에 여러 장이 든다).
 * `scrollMax`를 주면 마지막 구간에서 재는 자리가 화면 아래쪽으로 쓸려 내려가
 * 마지막 쪽까지 차례가 온다.
 */
export function pageAtScrollMid({ scrollTop, viewportHeight, scale = 1, metrics, offset = 0, scrollMax = null } = {}) {
  const n = Math.max(0, Number(metrics?.count) || 0);
  if (n <= 0) {
    return 1;
  }
  const zoom = Number(scale) > 0 ? Number(scale) : 1;
  const pageH = (Number(metrics.pageHeight) || 0) * zoom;
  const stride = (Number(metrics.stride) || 0) * zoom;
  if (!(stride > 0)) {
    return 1;
  }
  const top = Math.max(0, Number(scrollTop) || 0);
  const view = Math.max(0, Number(viewportHeight) || 0);
  const lead = Math.min(view / 2, pageH / 2);
  let anchor = lead;
  const span = view - 2 * lead;
  const max = Number(scrollMax);
  if (span > 0 && Number.isFinite(max) && max > 0) {
    const sweep = Math.min(span, max);
    const tail = Math.max(0, max - top);
    if (tail < sweep) {
      anchor = lead + span * (1 - tail / sweep);
    }
  }
  const probe = Math.max(0, top - (Number(offset) || 0)) + anchor;
  let best = 1;
  let bestDist = Infinity;
  for (let page = 1; page <= n; page += 1) {
    const center = (page - 1) * stride + pageH / 2;
    const dist = Math.abs(center - probe);
    if (dist < bestDist) {
      bestDist = dist;
      best = page;
    }
  }
  return best;
}

/** 링크·쪽 단추로 간 쪽은 손이 다시 움직이기 전까지 「지금 쪽」이다. */
export const PAGE_PIN_SETTLE_MS = 1500;

/**
 * #458: 끝자락의 쪽은 맨 위에 걸 수 없어서, 스크롤 자리만으로 재면 「11쪽으로」
 * 갔는데 표시는 12쪽이 된다. 그래서 일부러 간 쪽은 **붙잡아 둔다.** 부드러운
 * 스크롤이 도착하기 전(settle)에는 무조건, 그 뒤로는 그 쪽이 화면에 조금이라도
 * 보이는 동안. 손이 움직이면(포인터·휠) 부르는 쪽에서 핀을 푼다.
 */
export function pinnedPageHolds({ pin, now = 0, scrollTop, viewportHeight, scale = 1, metrics, offset = 0 } = {}) {
  const page = Math.round(Number(pin?.page) || 0);
  const count = Math.max(0, Number(metrics?.count) || 0);
  if (page < 1 || page > count) {
    return false;
  }
  if (Number(now) - Number(pin.at || 0) < PAGE_PIN_SETTLE_MS) {
    return true;
  }
  const zoom = Number(scale) > 0 ? Number(scale) : 1;
  const pageTop = (page - 1) * (Number(metrics.stride) || 0) * zoom + (Number(offset) || 0);
  const pageBottom = pageTop + (Number(metrics.pageHeight) || 0) * zoom;
  const viewTop = Math.max(0, Number(scrollTop) || 0);
  const viewBottom = viewTop + Math.max(0, Number(viewportHeight) || 0);
  return pageBottom > viewTop && pageTop < viewBottom;
}

/**
 * #308: `onEvict`는 값이 캐시에서 밀려날 때(교체·넘침·delete·clear) 불린다.
 * iOS 웹킷은 캔버스 백킹 메모리를 참조가 끊겨도 한참 쥐고 있어, 핀치를 반복하면
 * 버린 스냅샷이 쌓여 캔버스 메모리 한도를 넘겨 탭이 죽었다 — 버릴 때 즉시
 * width=0으로 해제하려고 콜백을 받는다.
 */
export function createPaintCache(limit = 8, onEvict = null) {
  const max = Math.max(1, Math.round(Number(limit) || 8));
  const map = new Map();
  const drop = (value) => {
    if (typeof onEvict === "function") {
      // #428: 해제 실패가 캐시 한도·문서 전환을 중단하면 안 된다.
      try { onEvict(value); } catch { /* 이미 해제된 자원도 버린다. */ }
    }
  };
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
        const old = map.get(key);
        map.delete(key);
        if (old !== value) {
          drop(old);
        }
      }
      map.set(key, value);
      while (map.size > max) {
        const oldest = map.keys().next().value;
        const old = map.get(oldest);
        map.delete(oldest);
        drop(old);
      }
      return value;
    },
    has(key) {
      return map.has(key);
    },
    delete(key) {
      const old = map.get(key);
      const removed = map.delete(key);
      if (removed) drop(old);
      return removed;
    },
    clear() {
      const values = [...map.values()];
      map.clear();
      for (const value of values) {
        drop(value);
      }
    },
    get size() {
      return map.size;
    },
    keys() {
      return [...map.keys()];
    },
  };
}

/**
 * A stable stand-in for "the ink on this page" (#143). Survives a reload, so a
 * stored thumb still matches, and changes when the ink really changes.
 */
export function inkSignature(items) {
  const list = items || [];
  let points = 0;
  let sum = 0;
  for (const item of list) {
    const pts = item?.points || [];
    points += pts.length;
    const first = pts[0];
    const last = pts[pts.length - 1];
    sum += Math.round(((first?.x || item?.x || 0) + (last?.y || item?.y || 0)) * 1000);
  }
  return `${list.length}.${points}.${sum}`;
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
