/** #157: 맞춤 크기의 70%까지 줄여 볼 수 있다. */
export const MIN_SCALE = 0.7;
export const MAX_SCALE = 8;

/** Bitmap budget per page. A phone cannot hold a 3x poster (#96). */
export const MAX_PAGE_PIXELS = 6_000_000;
/** Re-render steps. Between them the CSS transform stretches, as before. */
export const RENDER_STEPS = [1, 1.5, 2, 3];

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function clampScale(scale) {
  return clamp(Number(scale) || MIN_SCALE, MIN_SCALE, MAX_SCALE);
}

export function pointerDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pointerMidpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function scaleFromPinch(startDistance, currentDistance, startScale) {
  if (!(startDistance > 0)) {
    return clampScale(startScale);
  }
  return clampScale(startScale * (currentDistance / startDistance));
}

export function defaultToolbarPosition(width, height) {
  const narrowPortrait = width < 600 && height >= width;
  return narrowPortrait ? "top" : "bottom";
}

export function slotLineWidth(value) {
  const width = Number(value);
  if (!Number.isFinite(width)) {
    return 2;
  }
  // #206: 가는 글씨용 0.5까지. 반 칸 단위로 맞춘다.
  return Math.min(10, Math.max(0.5, Math.round(width * 2) / 2));
}

/**
 * Bitmap pixels per layout CSS pixel. Uses the page's laid-out size, not
 * getBoundingClientRect(), so pinch zoom / DPR / CSS transforms cannot make
 * a live stroke thicker or thinner than the same stroke after commit.
 */
export function inkCanvasScale(pixelWidth, cssWidth) {
  const pixel = Number(pixelWidth);
  const css = Number(cssWidth);
  if (!(pixel > 0) || !(css > 0)) {
    return 1;
  }
  return pixel / css;
}

/**
 * Room to push the paper out from under the bar, on all four sides (#94).
 * The bar's thin side (56) plus the 8 it sits off the edge.
 */
export const PAN_MARGIN_PX = 64;

/**
 * Pans within the zoomed overflow plus the margin. The margin applies at fit
 * scale too, so a page that ends at the screen edge can still be nudged in.
 * The paper itself is never resized (#30).
 */
/**
 * How much sharper to render the page for the current zoom: the largest step
 * at or below the zoom that still fits the pixel budget (#96).
 */
export function renderZoomFactor(userScale, pixelWidth, pixelHeight, maxPixels = MAX_PAGE_PIXELS) {
  const base = Math.max(1, Number(pixelWidth) || 1) * Math.max(1, Number(pixelHeight) || 1);
  const budget = Math.sqrt(Math.max(1, Number(maxPixels) || 1) / base);
  const want = Math.max(1, Number(userScale) || 1);
  let best = 1;
  for (const step of RENDER_STEPS) {
    if (step <= want + 1e-9 && step <= budget + 1e-9) {
      best = step;
    }
  }
  return best;
}

/**
 * #354: 뷰포트 선명 오버레이 계획. 화면(workRect)과 각 페이지의 화면 사각형이
 * 겹치는 부분만 골라, 오버레이 기기픽셀 좌표(d*)와 페이지 정규 소스(s*)를 낸다.
 * 오버레이 픽셀이 예산을 넘으면 배율을 균일하게 낮춘다 — 메모리는 화면 한 장.
 */
/**
 * #386: 그렸다고 칠해진 것은 아니다. 오버레이 표본의 밝기 폭이 평평한데 원본
 * 페이지 캔버스의 같은 자리엔 내용이 있으면, 모바일 GPU가 조용히 건너뛴 것이다.
 */
export function sliceNeedsFallback(overlaySpread, sourceSpread, threshold = 8) {
  return Number(overlaySpread) <= threshold && Number(sourceSpread) > threshold;
}

export function sharpOverlayJobs({ workRect, pages, dpr = 1, maxPixels = 9_000_000, maxPagePx = 16_000 } = {}) {
  const w = Math.max(1, Number(workRect?.width) || 1);
  const h = Math.max(1, Number(workRect?.height) || 1);
  let scale = Math.max(0.1, Number(dpr) || 1);
  if (w * h * scale * scale > maxPixels) {
    scale = Math.sqrt(maxPixels / (w * h));
  }
  // #386: 확대가 깊어지면 페이지의 기기픽셀 폭이 폭주해 모바일 래스터가 조용히
  // 빈 화면을 남긴다 — 검증된 범위로 묶는다(그래도 기본 렌더보다 훨씬 선명).
  const widest = Math.max(0, ...(pages || []).map((item) => Number(item?.rect?.width) || 0));
  if (widest > 0 && widest * scale > maxPagePx) {
    scale = Math.min(scale, maxPagePx / widest);
  }
  const jobs = [];
  for (const page of pages || []) {
    const r = page?.rect;
    if (!r || !(r.width > 0) || !(r.height > 0)) {
      continue;
    }
    const left = Math.max(r.left, workRect.left);
    const top = Math.max(r.top, workRect.top);
    const right = Math.min(r.left + r.width, workRect.left + w);
    const bottom = Math.min(r.top + r.height, workRect.top + h);
    if (right <= left || bottom <= top) {
      continue;
    }
    jobs.push({
      pageNum: page.pageNum,
      dx: (left - workRect.left) * scale,
      dy: (top - workRect.top) * scale,
      dw: (right - left) * scale,
      dh: (bottom - top) * scale,
      sx: (left - r.left) / r.width,
      sy: (top - r.top) / r.height,
      sw: (right - left) / r.width,
      sh: (bottom - top) / r.height,
      pagePxW: r.width * scale,
      pagePxH: r.height * scale,
    });
  }
  // 반올림이 예산을 넘길 수 있어 내림 — 오버레이는 절대 예산 초과 금지.
  return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)), scale, jobs };
}

export function constrainPan(panX, panY, scale, pageW, pageH, viewW, viewH, margin = PAN_MARGIN_PX) {
  const room = Math.max(0, Number(margin) || 0);
  const extraX = Math.max(0, (pageW * scale - viewW) / 2) + room;
  const extraY = Math.max(0, (pageH * scale - viewH) / 2) + room;
  return {
    x: clamp(panX, -extraX, extraX),
    y: clamp(panY, -extraY, extraY),
  };
}

export const POSITIONS = ["top", "bottom", "float"];
export const VIEW_MODES = ["page", "scroll"];
