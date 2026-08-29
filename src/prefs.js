import { defaultToolbarPosition, slotLineWidth } from "./viewport.js";

const TOOLBAR_POS_KEY = "pdf-ink:toolbar-pos";
const SLOTS_KEY = "pdf-ink:pen-slots";
const SLOT_INDEX_KEY = "pdf-ink:slot-index";
const VIEW_MODE_KEY = "pdf-ink:view-mode";
const ZOOM_LOCK_KEY = "pdf-ink:zoom-lock";

export const SLOT_COLORS = ["#1A1A1A", "#D64545", "#2F6FED", "#E6C200"];

export const DEFAULT_SLOTS = [
  { type: "pen", color: "#1A1A1A", width: 2 },
  { type: "pen", color: "#D64545", width: 2 },
  { type: "pen", color: "#2F6FED", width: 4 },
];

export function normalizeColor(value, fallback = "#1A1A1A") {
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

function normalizeSlot(slot, fallback) {
  if (!slot || typeof slot !== "object") {
    return { ...fallback };
  }
  return {
    type: "pen",
    color: normalizeColor(slot.color, fallback.color),
    width: slotLineWidth(slot.width ?? fallback.width),
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
    return [0, 1, 2].map((index) => normalizeSlot(data[index], DEFAULT_SLOTS[index]));
  } catch {
    return DEFAULT_SLOTS.map((slot) => ({ ...slot }));
  }
}

export function saveSlots(slots) {
  writeRaw(SLOTS_KEY, JSON.stringify(slots.slice(0, 3).map((slot, index) => normalizeSlot(slot, DEFAULT_SLOTS[index]))));
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
