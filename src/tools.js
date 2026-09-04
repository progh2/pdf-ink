export const PEN_PALETTE = [
  { label: "검정", hex: "#1A1A1A" },
  { label: "블루블랙", hex: "#1E3A4C" },
  { label: "파랑", hex: "#1E4B8C" },
  { label: "빨강", hex: "#C42B2B" },
  { label: "세피아", hex: "#6B3A24" },
  { label: "녹", hex: "#1F6B45" },
  { label: "흰색", hex: "#FFFFFF" },
];

/** Custom colours the reader picked, newest first (#158). */
export const RECENT_COLOR_LIMIT = 5;

/** Light swatches need an edge to be visible on cream paper. */
export function isLightHex(hex) {
  const value = normalizeHex(hex, "#1A1A1A");
  const r = Number.parseInt(value.slice(1, 3), 16);
  const g = Number.parseInt(value.slice(3, 5), 16);
  const b = Number.parseInt(value.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 200;
}

export function addRecentColor(list, hex) {
  const value = normalizeHex(hex, "");
  if (!value) {
    return list || [];
  }
  const rest = (list || []).filter((item) => item.toLowerCase() !== value.toLowerCase());
  return [value, ...rest].slice(0, RECENT_COLOR_LIMIT);
}

export const HIGHLIGHTER_PALETTE = [
  { label: "노랑", hex: "#FFE566" },
  { label: "분홍", hex: "#FF8FBF" },
  { label: "주황", hex: "#FFB347" },
  { label: "연두", hex: "#B8E05A" },
  { label: "하늘", hex: "#7EC8E8" },
];

export const HIGHLIGHTER_OPACITY_DEFAULT = 40;

export const PENCIL_COLOR = "#C23A32";
export const PENCIL_LABEL = "색연필";

export const STAMP_LABELS = ["참 잘했어요", "반려", "승인", "진행해", "응아냐"];
export const STAMP_WIDTH_CSS = 108;
export const STAMP_HEIGHT_CSS = 64;
export const STAMP_ASPECT = STAMP_WIDTH_CSS / STAMP_HEIGHT_CSS;
export const STAMP_COLOR = "#C42B2B";
export const STAMP_MIN_SCALE = 0.4;
export const STAMP_MAX_SCALE = 4;
export const STAMP_HANDLE_CSS = 8;

export const SLOT_KINDS = ["pen", "highlighter", "pencil", "stamp"];
export const SLOT_KIND_LABELS = {
  pen: "펜",
  highlighter: "형광",
  pencil: "색연필",
  stamp: "스탬프",
};

export const ERASER_MODES = ["pixel", "stroke"];
export const ERASER_MODE_LABELS = {
  pixel: "픽셀 지우개",
  stroke: "획 지우개",
};

/** Full palette chips stay in the panel (2×3). The bar only shows an 8px mini dot. */
export const TOOLBAR_COLOR_CHIPS = [];

/** Stamp is a 44px icon cell, not a 36px circle beside slots. */
export const TOOLBAR_STAMP_CIRCLE = false;

const OLD_PEN_COLOR = {
  "#D64545": "#C42B2B",
  "#2F6FED": "#1E4B8C",
  "#E6C200": "#1A1A1A",
};

export function normalizeHex(value, fallback = "#1A1A1A") {
  if (typeof value !== "string") {
    return fallback;
  }
  const hex = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return `#${hex.slice(1).toUpperCase()}`;
  }
  if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
    const r = hex[1];
    const g = hex[2];
    const b = hex[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback;
}

export function paletteHexes(palette) {
  return palette.map((item) => item.hex.toUpperCase());
}

export function clampOpacity(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) {
    return HIGHLIGHTER_OPACITY_DEFAULT;
  }
  return Math.min(100, Math.max(1, n));
}

export function highlighterAlpha(opacity = HIGHLIGHTER_OPACITY_DEFAULT) {
  return clampOpacity(opacity) / 100;
}

export function hexToRgba(hex, alpha) {
  const value = normalizeHex(hex).slice(1);
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function highlighterStrokeStyle(hex, opacity = HIGHLIGHTER_OPACITY_DEFAULT) {
  return hexToRgba(hex, highlighterAlpha(opacity));
}

export function colorInPalette(hex, palette) {
  const value = normalizeHex(hex);
  return palette.some((item) => item.hex.toUpperCase() === value);
}

export function defaultColorForKind(kind, current) {
  if (kind === "stamp") {
    return STAMP_COLOR;
  }
  if (kind === "pencil") {
    return PENCIL_COLOR;
  }
  if (kind === "highlighter") {
    const hex = normalizeHex(current, HIGHLIGHTER_PALETTE[0].hex);
    return colorInPalette(hex, HIGHLIGHTER_PALETTE) ? hex : HIGHLIGHTER_PALETTE[0].hex;
  }
  const mapped = OLD_PEN_COLOR[normalizeHex(current)] || normalizeHex(current);
  return colorInPalette(mapped, PEN_PALETTE) ? mapped : PEN_PALETTE[0].hex;
}

export function normalizeStamp(label) {
  return STAMP_LABELS.includes(label) ? label : STAMP_LABELS[0];
}

export function normalizeKind(value) {
  return SLOT_KINDS.includes(value) ? value : "pen";
}

export function normalizeEraseMode(value) {
  return ERASER_MODES.includes(value) ? value : "pixel";
}

export function stampLines(label) {
  if (label === "참 잘했어요") {
    return ["참 잘", "했어요"];
  }
  return [label];
}

/** CSS-pixel size of a stamp, aspect locked to the default oval. */
export function stampItemSize(item) {
  const w = Number(item?.w);
  const h = Number(item?.h);
  if (Number.isFinite(w) && w > 0) {
    return { w, h: w / STAMP_ASPECT };
  }
  if (Number.isFinite(h) && h > 0) {
    return { w: h * STAMP_ASPECT, h };
  }
  return { w: STAMP_WIDTH_CSS, h: STAMP_HEIGHT_CSS };
}

/**
 * Horizontal oval + in-stamp text metrics.
 * Canvas paintStamp and the stamp-panel preview share this. No caption below.
 */
export function stampPaintLayout(label, scale = 1, size) {
  const lines = stampLines(normalizeStamp(label));
  const box = stampItemSize(size);
  const width = box.w * scale;
  const height = box.h * scale;
  const rx = width / 2;
  const ry = height / 2;
  const ringGap = Math.max(2.4 * scale, height * 0.055);
  const outerWidth = Math.max(1.8 * scale, height * 0.045);
  const innerWidth = Math.max(1.1 * scale, height * 0.028);
  const inset = ringGap + (outerWidth + innerWidth) / 2;
  const innerRx = Math.max(4 * scale, rx - inset);
  const innerRy = Math.max(3 * scale, ry - inset);
  const fontSize =
    lines.length > 1 ? Math.min(innerRy * 0.7, innerRx * 0.38) : Math.min(innerRy * 0.92, innerRx * 0.48);
  const lineHeight = fontSize * 1.12;
  const textBlock = lines.length * lineHeight;
  const textStart = -textBlock / 2 + lineHeight / 2;
  const textYs = lines.map((_, index) => textStart + index * lineHeight);
  return {
    width,
    height,
    rx,
    ry,
    innerRx,
    innerRy,
    fontSize,
    lineHeight,
    lines,
    textYs,
    inkColor: STAMP_COLOR,
    outerWidth,
    innerWidth,
    ringGap,
  };
}

/** GoodNotes-style corner scale: opposite corner stays, aspect stays. */
export function resizeStamp(item, handle, point, cssWidth = 400, cssHeight = 600) {
  const size = stampItemSize(item);
  const pageW = Math.max(1, Number(cssWidth) || 1);
  const pageH = Math.max(1, Number(cssHeight) || 1);
  const halfW = size.w / pageW / 2;
  const halfH = size.h / pageH / 2;
  const left = item.x - halfW;
  const top = item.y - halfH;
  const right = item.x + halfW;
  const bottom = item.y + halfH;
  const anchors = {
    nw: { x: right, y: bottom },
    ne: { x: left, y: bottom },
    se: { x: left, y: top },
    sw: { x: right, y: top },
  };
  const anchor = anchors[handle] || anchors.se;
  const dw = Math.abs((Number(point?.x) - anchor.x) * pageW);
  const dh = Math.abs((Number(point?.y) - anchor.y) * pageH);
  const nextW = Math.min(
    STAMP_WIDTH_CSS * STAMP_MAX_SCALE,
    Math.max(STAMP_WIDTH_CSS * STAMP_MIN_SCALE, Math.max(dw, dh * STAMP_ASPECT)),
  );
  const nextH = nextW / STAMP_ASPECT;
  const signX = handle === "ne" || handle === "se" ? 1 : -1;
  const signY = handle === "se" || handle === "sw" ? 1 : -1;
  return {
    ...item,
    x: anchor.x + (signX * nextW) / pageW / 2,
    y: anchor.y + (signY * nextH) / pageH / 2,
    w: nextW,
    h: nextH,
  };
}

export function colorLabel(hex, kind = "pen") {
  if (kind === "pencil") {
    return PENCIL_LABEL;
  }
  const value = normalizeHex(hex);
  const palette = kind === "highlighter" ? HIGHLIGHTER_PALETTE : PEN_PALETTE;
  return palette.find((item) => item.hex.toUpperCase() === value)?.label || SLOT_KIND_LABELS[kind] || "펜";
}

export function slotAriaLabel(slot) {
  const kind = normalizeKind(slot?.type);
  if (kind === "stamp") {
    return `${normalizeStamp(slot.stamp)} 스탬프`;
  }
  const name = colorLabel(slot.color, kind);
  return `${name} ${SLOT_KIND_LABELS[kind]}, 굵기 ${slot.width}`;
}

/* ---- 색상환 (#206) ----------------------------------------------------- */

/**
 * 옛 페인터의 색상환처럼: 각도가 색상(H), 중심에서의 거리가 채도(S),
 * 밝기(V)는 옆의 미끄럼대. 순수 계산만 여기 두고 그리기는 배선이 한다.
 */
export function hsvToHex(h, s, v) {
  const hue = ((Number(h) % 360) + 360) % 360;
  const sat = Math.min(1, Math.max(0, Number(s) || 0));
  const val = Math.min(1, Math.max(0, Number(v) || 0));
  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;
  let rgb = [0, 0, 0];
  if (hue < 60) rgb = [c, x, 0];
  else if (hue < 120) rgb = [x, c, 0];
  else if (hue < 180) rgb = [0, c, x];
  else if (hue < 240) rgb = [0, x, c];
  else if (hue < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const to = (part) => Math.round((part + m) * 255).toString(16).padStart(2, "0");
  return `#${to(rgb[0])}${to(rgb[1])}${to(rgb[2])}`.toUpperCase();
}

export function hexToHsv(hex) {
  const value = normalizeHex(hex, "#1A1A1A");
  const r = Number.parseInt(value.slice(1, 3), 16) / 255;
  const g = Number.parseInt(value.slice(3, 5), 16) / 255;
  const b = Number.parseInt(value.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return { h: (h + 360) % 360, s: max === 0 ? 0 : d / max, v: max };
}

/** 원판 위의 한 점 → 색상·채도. 원 밖을 눌러도 가장자리 색으로 잡아 준다. */
export function wheelPick(x, y, cx, cy, radius) {
  const dx = Number(x) - Number(cx);
  const dy = Number(y) - Number(cy);
  const dist = Math.hypot(dx, dy);
  const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  return { h, s: Math.min(1, radius > 0 ? dist / radius : 0) };
}

/** 색상·채도 → 원판 위의 자리. 지금 색을 점으로 보여 줄 때 쓴다. */
export function wheelSpot(h, s, cx, cy, radius) {
  const angle = (((Number(h) || 0) % 360) * Math.PI) / 180;
  const dist = Math.min(1, Math.max(0, Number(s) || 0)) * radius;
  return { x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist };
}

/** 굵기 표시는 한 자리면 된다: 0.5 → "0.5", 3 → "3". */
export function widthLabel(width) {
  const value = Math.round((Number(width) || 0) * 10) / 10;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
