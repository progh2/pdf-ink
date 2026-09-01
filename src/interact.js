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

/** Pointer Events bits: 2 barrel, 4 second (middle), 32 the inverted eraser tip. */
export const PEN_BARREL_BIT = 2;
export const PEN_SECOND_BIT = 4;
export const PEN_ERASER_BIT = 32;
export const PEN_BARREL_BUTTON = 2;
export const PEN_SECOND_BUTTON = 1;
export const PEN_ERASER_BUTTON = 5;

export const PEN_ACTIONS = ["eraser", "select", "none"];
export const PEN_ACTION_LABELS = { eraser: "지우개", select: "선택", none: "없음" };
export const PEN_BUTTON_DEFAULTS = { barrel: "eraser", second: "select" };

export function normalizePenAction(value, fallback = "eraser") {
  return PEN_ACTIONS.includes(value) ? value : fallback;
}

export function normalizePenButtons(map) {
  return {
    barrel: normalizePenAction(map?.barrel, PEN_BUTTON_DEFAULTS.barrel),
    second: normalizePenAction(map?.second, PEN_BUTTON_DEFAULTS.second),
  };
}

/**
 * What this pen gesture should do (#139). The eraser end always erases: it is a
 * physical eraser, not a button to assign. A mouse never gets here.
 */
export function penButtonAction({ pointerType, buttons, button, buttonMap, enabled = true } = {}) {
  if (!enabled || pointerType !== "pen") {
    return null;
  }
  const map = normalizePenButtons(buttonMap);
  const bits = Number(buttons) || 0;
  if (bits & PEN_ERASER_BIT || button === PEN_ERASER_BUTTON) {
    return "eraser";
  }
  let action = null;
  if (bits & PEN_SECOND_BIT || button === PEN_SECOND_BUTTON) {
    action = map.second;
  } else if (bits & PEN_BARREL_BIT || button === PEN_BARREL_BUTTON) {
    action = map.barrel;
  }
  return action && action !== "none" ? action : null;
}

/** Which buttons may start a stroke: a pen also comes in on 1, 2 and 5. */
export function allowsInkButton({ pointerType, button } = {}) {
  if (button === undefined || button === 0) {
    return true;
  }
  if (pointerType !== "pen") {
    return false;
  }
  return [PEN_SECOND_BUTTON, PEN_BARREL_BUTTON, PEN_ERASER_BUTTON].includes(button);
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
  "fullscreen",
  "image",
  "sticker",
  "rotate",
  "save",
  "export",
];
export const M4_OVERFLOW_LABELS = {
  capture: "영역캡처",
  fullscreen: "전체화면",
  image: "이미지",
  sticker: "스티커",
  rotate: "회전",
  preview: "미리보기",
  save: "저장",
  export: "내보내기",
};
