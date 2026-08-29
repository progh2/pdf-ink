import { defaultToolbarPosition, slotLineWidth } from "./viewport.js";
import {
  HIGHLIGHTER_OPACITY_DEFAULT,
  clampOpacity,
  defaultColorForKind,
  normalizeEraseMode,
  normalizeHex,
  normalizeKind,
  normalizeStamp,
} from "./tools.js";

const TOOLBAR_POS_KEY = "pdf-ink:toolbar-pos";
const SLOTS_KEY = "pdf-ink:pen-slots";
const SLOT_INDEX_KEY = "pdf-ink:slot-index";
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
  const raw = readRaw(TOOLBAR_POS_KEY);
  if (raw === "top" || raw === "left" || raw === "right" || raw === "bottom") {
    return raw;
  }
  return defaultToolbarPosition(width, height);
}

export function saveToolbarPosition(position) {
  if (position === "top" || position === "left" || position === "right" || position === "bottom") {
    writeRaw(TOOLBAR_POS_KEY, position);
  }
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
