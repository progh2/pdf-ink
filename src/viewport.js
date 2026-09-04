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
