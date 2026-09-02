/** Locked GoodNotes 4 utility bar. One bar, no wrap, no second pill. */
export const BAR_HEIGHT = 56;
export const BAR_PAD = 8;
export const BAR_RADIUS = 28;
export const BAR_BORDER = "#E6E1D6";
export const BAR_BG = "#FFFFFF";

export const CELL = 44;
export const CELL_GAP = 4;
export const CELL_NARROW = 36;
export const CELL_GAP_NARROW = 2;
export const NARROW_BAR_WIDTH = 444;

export const ICON = 22;
export const ICON_NARROW = 20;
export const ICON_COLOR = "#2C2A26";
export const CELL_SELECTED = "#EDE8DC";

export const COLOR_DOT = 8;
export const GRIP_WIDTH = 16;
export const GRIP_DOT = "#D4CFC4";

export const DOCK_BAND_PX = 72;

/** #119: 미리보기는 헤더 아이콘으로 갔다. 바는 다시 9칸. */
export const BAR_TOOLS = [
  "pen",
  "highlighter",
  "pencil",
  "eraser",
  "select",
  "stamp",
  "undo",
  "redo",
  "more",
];

export const COLOR_DOT_TOOLS = ["pen", "highlighter", "pencil"];

export const BAR_OVERFLOW_ITEMS = [
  "fullscreen",
  "image",
  "sticker",
  "rotate",
  "save",
  "bake",
  "export",
];

export const DOCK_POSITIONS = ["top", "bottom", "left", "right", "float"];

/** Left/right are vertical rails over the paper, never a column that squashes it (#30 #49). */
export function isRail(position) {
  return position === "left" || position === "right";
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeDock(value, fallback = "top") {
  return DOCK_POSITIONS.includes(value) ? value : fallback;
}

export function migrateDock(value, fallback = "top") {
  return normalizeDock(value, fallback);
}

export function barNaturalWidth(narrow = false) {
  const cell = narrow ? CELL_NARROW : CELL;
  const gap = narrow ? CELL_GAP_NARROW : CELL_GAP;
  return BAR_PAD * 2 + GRIP_WIDTH + BAR_TOOLS.length * cell + (BAR_TOOLS.length - 1) * gap;
}

/** A rail stacks the same cells, so its length is the bar width formula. */
export function barNaturalHeight(narrow = false) {
  return barNaturalWidth(narrow);
}

export function useNarrowCells(availableWidth) {
  return Number(availableWidth) < NARROW_BAR_WIDTH;
}

/** A rail goes narrow when the full-size stack would not fit the screen height. */
export function useNarrowRail(availableHeight) {
  return Number(availableHeight) < barNaturalHeight(false) + 16;
}

export function barLength(position, narrow = false) {
  return isRail(position) ? barNaturalHeight(narrow) : barNaturalWidth(narrow);
}

export function constrainFloat(x, y, viewW, viewH, barW = barNaturalWidth(false), barH = BAR_HEIGHT) {
  const width = Math.max(1, Number(viewW) || 1);
  const height = Math.max(1, Number(viewH) || 1);
  const bw = Math.min(barW, width - 16);
  const bh = Math.min(barH, height - 16);
  return {
    x: clamp(Math.round(Number(x) || 0), 8, Math.max(8, width - bw - 8)),
    y: clamp(Math.round(Number(y) || 0), 8, Math.max(8, height - bh - 8)),
  };
}

/**
 * Long-press-drag release: top/bottom bands first, then the left/right rails
 * (#49), otherwise the bar floats where it was dropped.
 */
export function snapDockFromPoint(clientX, clientY, viewW, viewH, barW, barH, grabOffsetX = 20, grabOffsetY = 28) {
  const width = Math.max(1, Number(viewW) || 1);
  const height = Math.max(1, Number(viewH) || 1);
  const x = Number(clientX) || 0;
  const y = Number(clientY) || 0;
  if (y < DOCK_BAND_PX) {
    return { pos: "top" };
  }
  if (y > height - DOCK_BAND_PX) {
    return { pos: "bottom" };
  }
  if (x < DOCK_BAND_PX) {
    return { pos: "left" };
  }
  if (x > width - DOCK_BAND_PX) {
    return { pos: "right" };
  }
  return {
    pos: "float",
    ...constrainFloat(
      (Number(clientX) || 0) - grabOffsetX,
      (Number(clientY) || 0) - grabOffsetY,
      width,
      height,
      barW,
      barH,
    ),
  };
}

export function defaultFloat(width, height) {
  const barW = barNaturalWidth(useNarrowCells(width));
  return constrainFloat(16, 72, width, height, barW, BAR_HEIGHT);
}

export function floatFromLegacySide(side, width, height) {
  const barW = barNaturalWidth(useNarrowCells(width));
  const y = Math.max(56, Math.round((Number(height) || 600) / 2 - BAR_HEIGHT / 2));
  if (side === "right") {
    return constrainFloat((Number(width) || 400) - barW - 8, y, width, height, barW, BAR_HEIGHT);
  }
  return constrainFloat(8, y, width, height, barW, BAR_HEIGHT);
}
