export function normalizeInteractMode(value) {
  return value === "view" ? "view" : "edit";
}

export function canCreateInk({ interactMode, penOnly, pointerType, rectTool } = {}) {
  if (normalizeInteractMode(interactMode) === "view") {
    return false;
  }
  if (rectTool) {
    return false;
  }
  if (penOnly && pointerType !== "pen") {
    return false;
  }
  return true;
}

export function shouldPanPointer({ interactMode, penOnly, pointerType, rectTool } = {}) {
  if (normalizeInteractMode(interactMode) === "view") {
    return true;
  }
  if (rectTool) {
    return false;
  }
  return Boolean(penOnly && pointerType !== "pen");
}

export function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(1, Math.max(0, n));
}

export function rectFromPoints(a, b) {
  const ax = clamp01(a?.x);
  const ay = clamp01(a?.y);
  const bx = clamp01(b?.x);
  const by = clamp01(b?.y);
  const x = Math.min(ax, bx);
  const y = Math.min(ay, by);
  return {
    x,
    y,
    w: Math.max(ax, bx) - x,
    h: Math.max(ay, by) - y,
  };
}

export function rectBigEnough(rect, minNorm = 0.012) {
  return Boolean(rect && rect.w >= minNorm && rect.h >= minNorm);
}

export const M4_OVERFLOW_ITEMS = ["mosaic", "capture", "fullscreen"];
export const M4_OVERFLOW_LABELS = {
  mosaic: "마스킹(모자이크)",
  capture: "영역캡처",
  fullscreen: "전체화면",
};
