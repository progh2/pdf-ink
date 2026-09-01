import { defaultToolbarPosition, slotLineWidth } from "./viewport.js";
import { normalizePenButtons } from "./interact.js";
import { clampPreviewWidth, PREVIEW_WIDTH_DEFAULT } from "./pageWindow.js";
import { defaultFloat, floatFromLegacySide, migrateDock } from "./toolbar.js";
import {
  HIGHLIGHTER_OPACITY_DEFAULT,
  PENCIL_COLOR,
  STAMP_COLOR,
  clampOpacity,
  defaultColorForKind,
  normalizeEraseMode,
  normalizeHex,
  normalizeKind,
  normalizeStamp,
} from "./tools.js";

const TOOLBAR_POS_KEY = "pdf-ink:toolbar-pos";
const PREVIEW_WIDTH_KEY = "pdf-ink:preview-width";
const DROPBOX_KEY = "pdf-ink:dropbox";
const PEN_BUTTON_KEY = "pdf-ink:pen-button";
const PEN_BUTTON_MAP_KEY = "pdf-ink:pen-buttons";
const TOOLBAR_FLOAT_KEY = "pdf-ink:toolbar-float";
const SLOTS_KEY = "pdf-ink:pen-slots";
const SLOT_INDEX_KEY = "pdf-ink:slot-index";
const INK_TOOLS_KEY = "pdf-ink:ink-tools";
const VIEW_MODE_KEY = "pdf-ink:view-mode";
const ZOOM_LOCK_KEY = "pdf-ink:zoom-lock";
const INTERACT_KEY = "pdf-ink:interact-mode";
const ERASER_KEY = "pdf-ink:eraser";

export const DEFAULT_SLOTS = [
  { type: "pen", color: "#1A1A1A", width: 2, opacity: HIGHLIGHTER_OPACITY_DEFAULT, stamp: "참 잘했어요" },
  { type: "pen", color: "#C42B2B", width: 2, opacity: HIGHLIGHTER_OPACITY_DEFAULT, stamp: "참 잘했어요" },
  { type: "pen", color: "#1E4B8C", width: 4, opacity: HIGHLIGHTER_OPACITY_DEFAULT, stamp: "참 잘했어요" },
];

export const DEFAULT_ERASER = { mode: "pixel", width: 4 };

export const DEFAULT_INK_TOOLS = {
  pen: { type: "pen", color: "#1A1A1A", width: 2, opacity: HIGHLIGHTER_OPACITY_DEFAULT, stamp: "참 잘했어요" },
  highlighter: {
    type: "highlighter",
    color: "#FFE566",
    width: 8,
    opacity: HIGHLIGHTER_OPACITY_DEFAULT,
    stamp: "참 잘했어요",
  },
  pencil: { type: "pencil", color: PENCIL_COLOR, width: 2, opacity: HIGHLIGHTER_OPACITY_DEFAULT, stamp: "참 잘했어요" },
  stamp: { type: "stamp", color: STAMP_COLOR, width: 2, opacity: HIGHLIGHTER_OPACITY_DEFAULT, stamp: "참 잘했어요" },
};

export const INK_TOOL_KINDS = ["pen", "highlighter", "pencil", "stamp"];

export function normalizeColor(value, fallback = "#1A1A1A") {
  return normalizeHex(value, fallback);
}

export function coerceSlot(slot, fallback = DEFAULT_SLOTS[0]) {
  if (!slot || typeof slot !== "object") {
    return { ...fallback };
  }
  const type = normalizeKind(slot.type);
  return {
    type,
    color: defaultColorForKind(type, slot.color || fallback.color),
    width: slotLineWidth(slot.width ?? fallback.width),
    opacity: clampOpacity(slot.opacity ?? fallback.opacity ?? HIGHLIGHTER_OPACITY_DEFAULT),
    stamp: normalizeStamp(slot.stamp || fallback.stamp),
  };
}

function readRaw(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preference is best-effort.
  }
}

export function loadToolbarPosition(width, height) {
  const fallback = defaultToolbarPosition(width, height);
  return migrateDock(readRaw(TOOLBAR_POS_KEY), fallback);
}

export function saveToolbarPosition(position) {
  const next = migrateDock(position, "");
  if (next) {
    writeRaw(TOOLBAR_POS_KEY, next);
  }
}

export function loadToolbarFloat(width, height) {
  const legacy = readRaw(TOOLBAR_POS_KEY);
  try {
    const raw = readRaw(TOOLBAR_FLOAT_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Number.isFinite(data?.x) && Number.isFinite(data?.y)) {
        return { x: data.x, y: data.y };
      }
    }
  } catch {
    // fall through
  }
  if (legacy === "left" || legacy === "right") {
    return floatFromLegacySide(legacy, width, height);
  }
  return defaultFloat(width, height);
}

export function saveToolbarFloat(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return;
  }
  writeRaw(TOOLBAR_FLOAT_KEY, JSON.stringify({ x: point.x, y: point.y }));
}

export function loadSlots() {
  try {
    const raw = readRaw(SLOTS_KEY);
    if (!raw) {
      return DEFAULT_SLOTS.map((slot) => ({ ...slot }));
    }
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || data.length < 3) {
      return DEFAULT_SLOTS.map((slot) => ({ ...slot }));
    }
    return [0, 1, 2].map((index) => coerceSlot(data[index], DEFAULT_SLOTS[index]));
  } catch {
    return DEFAULT_SLOTS.map((slot) => ({ ...slot }));
  }
}

export function saveSlots(slots) {
  writeRaw(
    SLOTS_KEY,
    JSON.stringify(slots.slice(0, 3).map((slot, index) => coerceSlot(slot, DEFAULT_SLOTS[index]))),
  );
}

export function coerceInkTool(kind, value) {
  const fallback = DEFAULT_INK_TOOLS[kind] || DEFAULT_INK_TOOLS.pen;
  const slot = coerceSlot({ ...(value || {}), type: kind }, fallback);
  return { ...slot, type: kind };
}

export function coerceInkTools(value) {
  const tools = {};
  for (const kind of INK_TOOL_KINDS) {
    tools[kind] = coerceInkTool(kind, value?.[kind]);
  }
  return tools;
}

function inkToolsFromSlots(slots) {
  const list = Array.isArray(slots) ? slots : [];
  const pick = (kind) => list.find((slot) => slot?.type === kind);
  return coerceInkTools({
    pen: pick("pen") || list[0],
    highlighter: pick("highlighter"),
    pencil: pick("pencil"),
    stamp: pick("stamp") || list.find((slot) => slot?.stamp),
  });
}

export function loadInkTools() {
  try {
    const raw = readRaw(INK_TOOLS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        return coerceInkTools(data);
      }
    }
  } catch {
    // fall through to slots
  }
  return inkToolsFromSlots(loadSlots());
}

export function saveInkTools(tools) {
  const next = coerceInkTools(tools);
  writeRaw(INK_TOOLS_KEY, JSON.stringify(next));
  saveSlots([next.pen, next.highlighter, next.pencil]);
}

export function loadSlotIndex() {
  const index = Number(readRaw(SLOT_INDEX_KEY));
  return index === 0 || index === 1 || index === 2 ? index : 0;
}

export function saveSlotIndex(index) {
  if (index === 0 || index === 1 || index === 2) {
    writeRaw(SLOT_INDEX_KEY, String(index));
  }
}

export function loadViewMode() {
  const raw = readRaw(VIEW_MODE_KEY);
  return raw === "scroll" ? "scroll" : "page";
}

export function saveViewMode(mode) {
  writeRaw(VIEW_MODE_KEY, mode === "scroll" ? "scroll" : "page");
}

export function loadZoomLock() {
  return readRaw(ZOOM_LOCK_KEY) === "1";
}

export function saveZoomLock(on) {
  writeRaw(ZOOM_LOCK_KEY, on ? "1" : "0");
}

export function loadInteractMode() {
  return readRaw(INTERACT_KEY) === "view" ? "view" : "edit";
}

export function saveInteractMode(mode) {
  writeRaw(INTERACT_KEY, mode === "view" ? "view" : "edit");
}

export function coerceEraser(value) {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_ERASER };
  }
  return {
    mode: normalizeEraseMode(value.mode),
    width: slotLineWidth(value.width ?? DEFAULT_ERASER.width),
  };
}

export function loadEraser() {
  try {
    const raw = readRaw(ERASER_KEY);
    if (!raw) {
      return { ...DEFAULT_ERASER };
    }
    return coerceEraser(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_ERASER };
  }
}

export function saveEraser(eraser) {
  writeRaw(ERASER_KEY, JSON.stringify(coerceEraser(eraser)));
}

/** Drawer width the reader dragged to (#106). */
export function loadPreviewWidth() {
  const raw = readRaw(PREVIEW_WIDTH_KEY);
  return raw ? clampPreviewWidth(Number(raw)) : PREVIEW_WIDTH_DEFAULT;
}

export function savePreviewWidth(width) {
  writeRaw(PREVIEW_WIDTH_KEY, String(clampPreviewWidth(width)));
}

/** Dropbox tokens stay in this browser (#82). Nothing is sent to a server of ours. */
export function loadDropboxSession() {
  try {
    const raw = readRaw(DROPBOX_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data?.refreshToken ? data : null;
  } catch {
    return null;
  }
}

export function saveDropboxSession(session) {
  if (!session?.refreshToken) {
    return;
  }
  writeRaw(DROPBOX_KEY, JSON.stringify(session));
}

export function clearDropboxSession() {
  try {
    localStorage.removeItem(DROPBOX_KEY);
  } catch {
    // best effort
  }
}

/** 펜 버튼 (#137·#139). Default on, and each button can be assigned. */
export function loadPenButtonErase() {
  return readRaw(PEN_BUTTON_KEY) !== "0";
}

export function savePenButtonErase(on) {
  writeRaw(PEN_BUTTON_KEY, on ? "1" : "0");
}

export function loadPenButtons() {
  try {
    return normalizePenButtons(JSON.parse(readRaw(PEN_BUTTON_MAP_KEY) || "null"));
  } catch {
    return normalizePenButtons(null);
  }
}

export function savePenButtons(map) {
  writeRaw(PEN_BUTTON_MAP_KEY, JSON.stringify(normalizePenButtons(map)));
}
