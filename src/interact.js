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

/** Two taps this close together mean "rename", not "go there twice" (#155). */
/** 보기 모드에서 손가락이 이만큼 안 움직였으면 끌기가 아니라 탭 (#178). */
export const PAN_TAP_SLOP_PX = 12;

export const DOUBLE_TAP_MS = 320;
export const DOUBLE_TAP_SLOP_PX = 24;

export function isDoubleTap(now, lastAt, distancePx, withinMs = DOUBLE_TAP_MS, slopPx = DOUBLE_TAP_SLOP_PX) {
  if (!lastAt) {
    return false;
  }
  return Number(now) - Number(lastAt) < withinMs && Number(distancePx) < slopPx;
}

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

/**
 * One stroke belongs to one pointer (#171). A palm that lands on the toolbar
 * is never registered as a pinch, so without this its moves used to be appended
 * to the pen's stroke — the line shot out and back, a triangle.
 */
export function isStrokePointer(activeId, eventId) {
  if (activeId === null || activeId === undefined) {
    return true;
  }
  if (eventId === null || eventId === undefined) {
    return true;
  }
  return activeId === eventId;
}

/** Normalized position from a rect measured once per event, not per sample (#172). */
export function normFromRect(rect, client) {
  const width = Number(rect?.width) || 1;
  const height = Number(rect?.height) || 1;
  return {
    x: (Number(client?.x) - (Number(rect?.left) || 0)) / width,
    y: (Number(client?.y) - (Number(rect?.top) || 0)) / height,
  };
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

/** Every sample of one event at once: one array copy instead of one each (#172). */
export function appendInkPoints(points, samples, prevUpClient) {
  const list = points ? points.slice() : [];
  for (const sample of samples || []) {
    if (!sample?.norm) {
      continue;
    }
    if (!list.length && isReusedInkStart(prevUpClient, sample.client)) {
      continue;
    }
    list.push(sample.norm);
  }
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
  "bake",
  "saveas",
  "export",
  "inkmove",
];
export const M4_OVERFLOW_LABELS = {
  inkmove: "필기 옮기기",
  capture: "영역캡처",
  fullscreen: "전체화면",
  image: "이미지",
  sticker: "스티커",
  rotate: "회전",
  preview: "미리보기",
  save: "저장",
  bake: "PDF에 굽기",
  saveas: "다른 이름으로 저장",
  export: "내보내기",
};

/* ---- 단축키 (#225) ---------------------------------------------------- */

/**
 * PC에서 손이 키보드에 있을 때 쓰는 길. 맥은 Cmd, 나머지는 Ctrl —
 * 어느 쪽이든 같은 뜻이므로 둘 다 받는다.
 */
export function shortcutFor(event) {
  if (!event || !(event.ctrlKey || event.metaKey) || event.altKey) {
    return "";
  }
  const key = String(event.key || "").toLowerCase();
  if (key === "c") {
    return "copy";
  }
  if (key === "v") {
    return "paste";
  }
  if (key === "x") {
    return "cut";
  }
  if (key === "z") {
    // Ctrl+Shift+Z도 다시 실행이다(윈도우 관행).
    return event.shiftKey ? "redo" : "undo";
  }
  if (key === "y") {
    return "redo";
  }
  return "";
}

/** 글씨를 치고 있을 때는 브라우저에게 맡긴다 — 칸 안의 복사는 그쪽 일이다. */
export function shortcutAllowed({ typing = false, overlay = false, action = "" } = {}) {
  if (typing) {
    return false;
  }
  // 시트가 열려 있어도 되돌리기는 통하면 곤란하다: 지금 보는 것과 안 맞는다.
  return !overlay && Boolean(action);
}


/* ---- 도구에 따른 커서·호버 (#234) -------------------------------------- */

/**
 * 마우스 커서는 지금 무엇을 하는지 말해 줘야 한다. 종이 위에서만 바뀐다 —
 * 툴바·시트는 제 커서가 있다.
 */
export function cursorForTool({ interactMode, tool, rectTool, eyedrop = false } = {}) {
  if (eyedrop) {
    return "copy";
  }
  if (normalizeInteractMode(interactMode) === "view") {
    return "grab";
  }
  if (rectTool) {
    return "crosshair";
  }
  if (tool === "select") {
    return "default";
  }
  if (tool === "eraser") {
    // 지우개는 동그라미를 직접 그려 주므로 점만 남긴다.
    return "none";
  }
  if (tool === "stamp") {
    return "copy";
  }
  return "crosshair";
}

/** 펜을 띄웠을 때 그릴 표시의 모양. 도구마다 다르게 보여야 헷갈리지 않는다. */
export function hoverShapeForTool(tool) {
  if (tool === "eraser") {
    return "eraser";
  }
  if (tool === "highlighter") {
    return "highlighter";
  }
  if (tool === "select" || tool === "stamp") {
    return "point";
  }
  return "nib";
}

/** 호버 표시를 띄울 상황인가. 펜이 떠 있고, 그릴 수 있을 때만. */
export function shouldShowHover({ pointerType, buttons = 0, interactMode, overlay = false, onPaper = false } = {}) {
  if (pointerType !== "pen" || buttons !== 0 || overlay || !onPaper) {
    return false;
  }
  return normalizeInteractMode(interactMode) !== "view";
}


/**
 * 펜이 무엇을 보고했는지 사람이 읽을 한 줄 (#234). 「버튼이 안 된다」를
 * 「기기가 버튼을 안 보낸다」와 「우리가 잘못 읽는다」로 가르려면 이게 있어야 한다.
 */
export function describePenEvent(event, buttonMap) {
  if (!event) {
    return "";
  }
  const bits = Number(event.buttons) || 0;
  const names = [];
  if (bits & 1) names.push("촉");
  if (bits & PEN_BARREL_BIT) names.push("배럴");
  if (bits & PEN_SECOND_BIT) names.push("두번째");
  if (bits & PEN_ERASER_BIT) names.push("지우개꼭지");
  const action = penButtonAction({
    pointerType: event.pointerType,
    buttons: event.buttons,
    button: event.button,
    buttonMap,
  });
  return [
    `종류 ${event.pointerType || "?"}`,
    `buttons ${bits}${names.length ? ` (${names.join("+")})` : ""}`,
    `button ${event.button ?? "?"}`,
    `→ ${action || "없음"}`,
  ].join(" · ");
}


/* ---- 화살표키 미세 이동 (#236) ------------------------------------------ */

/** 한 번 누르면 이만큼(쪽 폭의 비율). Shift면 크게, Alt면 한 픽셀씩. */
export const NUDGE_STEP = 0.004;
export const NUDGE_BIG = 0.02;

export function nudgeFor(event, cssWidth = 400, cssHeight = 600) {
  const key = String(event?.key || "");
  const dirs = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const dir = dirs[key];
  if (!dir || event.ctrlKey || event.metaKey) {
    return null;
  }
  // Alt는 화면 한 점만큼 — 종이가 가로세로로 다르므로 축마다 따로 잰다.
  if (event.altKey) {
    return {
      dx: dir[0] / Math.max(1, Number(cssWidth) || 1),
      dy: dir[1] / Math.max(1, Number(cssHeight) || 1),
      step: "point",
    };
  }
  const amount = event.shiftKey ? NUDGE_BIG : NUDGE_STEP;
  return { dx: dir[0] * amount, dy: dir[1] * amount, step: event.shiftKey ? "big" : "small" };
}
