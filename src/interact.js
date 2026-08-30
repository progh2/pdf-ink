export function normalizeInteractMode(value) {
  return value === "view" ? "view" : "edit";
}

export const INTERACT_LOCKED_LABEL = "보기";
export const INTERACT_UNLOCKED_LABEL = "편집";

export function interactModeLabel(mode) {
  return normalizeInteractMode(mode) === "view"
    ? INTERACT_LOCKED_LABEL
    : INTERACT_UNLOCKED_LABEL;
}

export function canCreateInk({ interactMode, penOnly, pointerType, rectTool, tool } = {}) {
  if (normalizeInteractMode(interactMode) === "view") {
    return false;
  }
  if (rectTool) {
    return false;
  }
  if (tool === "select") {
    return false;
  }
  if (penOnly && pointerType !== "pen") {
    return false;
  }
  return true;
}

/** One line, no bar cell: why the stroke did not appear (#86). */
export const VIEW_NOTICE_TEXT = "보기 중";
export const VIEW_NOTICE_MS = 1400;
export const VIEW_NOTICE_COOLDOWN_MS = 2000;

const DRAW_TOOLS = ["pen", "highlighter", "pencil", "eraser", "stamp"];

/**
 * Drawing while locked is ignored, but not silently: say "보기 중" once per
 * cooldown so a tap that leaves no ink is explained (#86).
 */
export function shouldNoticeViewMode({ interactMode, tool, rectTool, now = 0, lastAt = null, cooldownMs = VIEW_NOTICE_COOLDOWN_MS } = {}) {
  if (normalizeInteractMode(interactMode) !== "view") {
    return false;
  }
  if (rectTool || !DRAW_TOOLS.includes(tool)) {
    return false;
  }
  if (lastAt == null) {
    return true;
  }
  return Number(now) - Number(lastAt) >= cooldownMs;
}

/** Pixel slop for "this pointerdown reused the last pointerup coordinate". */
export const REUSED_INK_START_SLOP_PX = 2;

export function isReusedInkStart(prevUpClient, nextClient, slopPx = REUSED_INK_START_SLOP_PX) {
  if (!prevUpClient || !nextClient) {
    return false;
  }
  const dx = Number(nextClient.x) - Number(prevUpClient.x);
  const dy = Number(nextClient.y) - Number(prevUpClient.y);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
    return false;
  }
  return Math.hypot(dx, dy) <= slopPx;
}

export function beginInkPoints(downNorm, downClient, prevUpClient) {
  if (isReusedInkStart(prevUpClient, downClient)) {
    return [];
  }
  return downNorm ? [downNorm] : [];
}

export function appendInkPoint(points, moveNorm, moveClient, prevUpClient) {
  const list = points ? points.slice() : [];
  if (!moveNorm) {
    return list;
  }
  if (!list.length && isReusedInkStart(prevUpClient, moveClient)) {
    return list;
  }
  list.push(moveNorm);
  return list;
}

export function finishInkPoints(points, upNorm, upClient, prevUpClient) {
  const list = points ? points.slice() : [];
  if (list.length) {
    return list;
  }
  if (upNorm && !isReusedInkStart(prevUpClient, upClient)) {
    return [upNorm];
  }
  return [];
}

export function shouldPanPointer({ interactMode, penOnly, pointerType, rectTool, tool } = {}) {
  if (normalizeInteractMode(interactMode) === "view") {
    return true;
  }
  if (rectTool) {
    return false;
  }
  if (tool === "select") {
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

export const M4_OVERFLOW_ITEMS = [
  "capture",
  "fullscreen",
  "image",
  "rotate",
  "preview",
  "save",
  "export",
];
export const M4_OVERFLOW_LABELS = {
  capture: "영역캡처",
  fullscreen: "전체화면",
  image: "이미지",
  rotate: "회전",
  preview: "미리보기",
  save: "저장",
  export: "내보내기",
};
