export const MIN_SCALE = 1;
export const MAX_SCALE = 5;

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

export function slotLineWidth(step) {
  const n = Math.round(Number(step));
  return clamp(Number.isFinite(n) ? n : 2, 1, 10);
}

export function constrainPan(panX, panY, scale, pageW, pageH, viewW, viewH) {
  if (scale <= 1.001) {
    return { x: 0, y: 0 };
  }
  const extraX = Math.max(0, (pageW * scale - viewW) / 2);
  const extraY = Math.max(0, (pageH * scale - viewH) / 2);
  const slack = 32;
  return {
    x: clamp(panX, -extraX - slack, extraX + slack),
    y: clamp(panY, -extraY - slack, extraY + slack),
  };
}

export const POSITIONS = ["top", "left", "right", "bottom"];
export const VIEW_MODES = ["page", "scroll"];
