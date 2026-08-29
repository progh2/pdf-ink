export const PEN_PALETTE = [
  { label: "검정", hex: "#1A1A1A" },
  { label: "블루블랙", hex: "#1E3A4C" },
  { label: "파랑", hex: "#1E4B8C" },
  { label: "빨강", hex: "#C42B2B" },
  { label: "세피아", hex: "#6B3A24" },
  { label: "녹", hex: "#1F6B45" },
];

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
export const STAMP_DIAMETER_CSS = 72;
export const STAMP_COLOR = "#C42B2B";

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

/** Colors never appear as a toolbar row; they live in the slot panel only. */
export const TOOLBAR_COLOR_CHIPS = [];

/** Stamp is the 4th slot-panel tab. A 36px circle beside slots is a spec fail. */
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
