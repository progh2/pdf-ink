/**
 * Sticker studio (#79). Not the stamp (#50): a stamp is the fixed 108x64 red
 * ellipse, a sticker is cut out of the reader's own picture and filed away.
 */

export const DEFAULT_FOLDER_NAME = "미분류";
export const DEFAULT_FOLDER_ID = "f:default";
export const STICKER_THUMB = 64;
export const STICKER_GAP = 8;
export const FOLDER_ROW = 36;
export const FOLDER_ADD = 32;
export const STUDIO_TOOLS = ["chroma", "eraser", "rotate"];
export const STUDIO_TOOL_LABELS = { chroma: "투명", eraser: "지우개", rotate: "회전" };
export const STUDIO_ROW_HEIGHT = 56;
export const STUDIO_CELL = 44;
export const STUDIO_CELL_GAP = 4;
export const REGION_STROKE_CSS = 1.5;
export const REGION_RADIUS_CSS = 8;
export const REGION_MIN_PX = 8;
export const DROP_WIDTH = 280;
export const DROP_HEIGHT = 160;
export const CHROMA_TOLERANCE = 40;
export const ERASER_RADIUS_CSS = 12;
export const STICKER_MAX_EDGE = 512;

let seq = 0;

function nextId(prefix) {
  seq += 1;
  return `${prefix}:${Date.now().toString(36)}-${seq}`;
}

export function makeFolder(name, id) {
  const label = String(name ?? "").trim();
  return { id: id || nextId("f"), name: label || "새 폴더" };
}

export function defaultFolder() {
  return { id: DEFAULT_FOLDER_ID, name: DEFAULT_FOLDER_NAME };
}

/** 미분류 always exists and always comes first. */
export function normalizeFolders(folders) {
  const out = [defaultFolder()];
  const seen = new Set([DEFAULT_FOLDER_ID]);
  for (const raw of folders || []) {
    if (!raw || typeof raw !== "object" || !raw.id || seen.has(raw.id)) {
      continue;
    }
    seen.add(raw.id);
    out.push({ id: String(raw.id), name: String(raw.name || "폴더") });
  }
  return out;
}

export function addFolder(folders, name) {
  return [...normalizeFolders(folders), makeFolder(name)];
}

export function renameFolder(folders, id, name) {
  const label = String(name ?? "").trim();
  return normalizeFolders(folders).map((folder) =>
    folder.id === id && folder.id !== DEFAULT_FOLDER_ID ? { ...folder, name: label || folder.name } : folder,
  );
}

/** Deleting a folder keeps its stickers: they fall back to 미분류. */
export function deleteFolder(folders, stickers, id) {
  if (id === DEFAULT_FOLDER_ID) {
    return { folders: normalizeFolders(folders), stickers: normalizeStickers(stickers, folders) };
  }
  const nextFolders = normalizeFolders(folders).filter((folder) => folder.id !== id);
  const nextStickers = normalizeStickers(stickers, nextFolders).map((sticker) =>
    sticker.folderId === id ? { ...sticker, folderId: DEFAULT_FOLDER_ID } : sticker,
  );
  return { folders: nextFolders, stickers: nextStickers };
}

export function makeSticker({ src, width, height, folderId = DEFAULT_FOLDER_ID, name = "", id } = {}) {
  return {
    id: id || nextId("s"),
    folderId: folderId || DEFAULT_FOLDER_ID,
    name: String(name || ""),
    src: typeof src === "string" ? src : "",
    width: Math.max(1, Math.round(Number(width) || 1)),
    height: Math.max(1, Math.round(Number(height) || 1)),
    createdAt: Date.now(),
  };
}

/** A sticker whose folder is gone shows up in 미분류 instead of vanishing. */
export function normalizeStickers(stickers, folders) {
  const ids = new Set(normalizeFolders(folders).map((folder) => folder.id));
  return (stickers || [])
    .filter((sticker) => sticker?.id && sticker.src)
    .map((sticker) => ({
      ...sticker,
      folderId: ids.has(sticker.folderId) ? sticker.folderId : DEFAULT_FOLDER_ID,
    }));
}

export function stickersInFolder(stickers, folderId) {
  return (stickers || []).filter((sticker) => sticker.folderId === folderId);
}

export function moveSticker(stickers, id, folderId) {
  return (stickers || []).map((sticker) =>
    sticker.id === id ? { ...sticker, folderId: folderId || DEFAULT_FOLDER_ID } : sticker,
  );
}

export function deleteSticker(stickers, id) {
  return (stickers || []).filter((sticker) => sticker.id !== id);
}

/**
 * Each drawn rectangle is its own sticker, so a drag list never merges into one
 * picture. Rects come in preview css space and land in source pixels.
 */
export function regionPixelRect(rect, previewWidth, previewHeight, imageWidth, imageHeight) {
  const pw = Math.max(1, Number(previewWidth) || 1);
  const ph = Math.max(1, Number(previewHeight) || 1);
  const iw = Math.max(1, Number(imageWidth) || 1);
  const ih = Math.max(1, Number(imageHeight) || 1);
  const left = Math.min(Number(rect?.x1) || 0, Number(rect?.x2) || 0);
  const top = Math.min(Number(rect?.y1) || 0, Number(rect?.y2) || 0);
  const right = Math.max(Number(rect?.x1) || 0, Number(rect?.x2) || 0);
  const bottom = Math.max(Number(rect?.y1) || 0, Number(rect?.y2) || 0);
  const x = Math.round(Math.min(Math.max(0, left), pw) * (iw / pw));
  const y = Math.round(Math.min(Math.max(0, top), ph) * (ih / ph));
  const w = Math.round(Math.min(Math.max(0, right), pw) * (iw / pw)) - x;
  const h = Math.round(Math.min(Math.max(0, bottom), ph) * (ih / ph)) - y;
  if (w < REGION_MIN_PX || h < REGION_MIN_PX) {
    return null;
  }
  return { x, y, w: Math.min(w, iw - x), h: Math.min(h, ih - y) };
}

export const REGION_HANDLE_CSS = 8;
export const REGION_HIT_CSS = 12;
export const REGION_HANDLES = ["nw", "ne", "se", "sw"];

function normRect(rect) {
  return {
    left: Math.min(Number(rect?.x1) || 0, Number(rect?.x2) || 0),
    top: Math.min(Number(rect?.y1) || 0, Number(rect?.y2) || 0),
    right: Math.max(Number(rect?.x1) || 0, Number(rect?.x2) || 0),
    bottom: Math.max(Number(rect?.y1) || 0, Number(rect?.y2) || 0),
  };
}

function cornerPoints(rect) {
  const box = normRect(rect);
  return {
    nw: { x: box.left, y: box.top },
    ne: { x: box.right, y: box.top },
    se: { x: box.right, y: box.bottom },
    sw: { x: box.left, y: box.bottom },
  };
}

/** Corner under the finger, for resizing a drawn region (#100). */
export function regionHandleAt(rect, point, hitPx = REGION_HIT_CSS) {
  const corners = cornerPoints(rect);
  for (const handle of REGION_HANDLES) {
    const corner = corners[handle];
    if (Math.hypot(point.x - corner.x, point.y - corner.y) <= hitPx) {
      return handle;
    }
  }
  return null;
}

export function pointInRegion(rect, point) {
  const box = normRect(rect);
  return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
}

/** Topmost first: the last drawn region wins an overlap. */
export function topRegionAt(regions, point, hitPx = REGION_HIT_CSS) {
  const list = regions || [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (regionHandleAt(list[index], point, hitPx) || pointInRegion(list[index], point)) {
      return index;
    }
  }
  return -1;
}

function clampRect(box, width, height) {
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  return {
    x1: Math.min(Math.max(0, box.left), w),
    y1: Math.min(Math.max(0, box.top), h),
    x2: Math.min(Math.max(0, box.right), w),
    y2: Math.min(Math.max(0, box.bottom), h),
  };
}

/** Dragging inside slides the whole region, never off the picture. */
export function moveRegion(rect, dx, dy, width, height) {
  const box = normRect(rect);
  const w = box.right - box.left;
  const h = box.bottom - box.top;
  const maxX = Math.max(0, (Number(width) || 1) - w);
  const maxY = Math.max(0, (Number(height) || 1) - h);
  const left = Math.min(Math.max(0, box.left + (Number(dx) || 0)), maxX);
  const top = Math.min(Math.max(0, box.top + (Number(dy) || 0)), maxY);
  return { x1: left, y1: top, x2: left + w, y2: top + h };
}

/** Dragging a corner moves that corner only, the opposite one stays put. */
export function resizeRegion(rect, handle, point, width, height) {
  const box = normRect(rect);
  const next = { ...box };
  if (String(handle).includes("w")) {
    next.left = point.x;
  } else {
    next.right = point.x;
  }
  if (String(handle).includes("n")) {
    next.top = point.y;
  } else {
    next.bottom = point.y;
  }
  return clampRect(
    {
      left: Math.min(next.left, next.right),
      top: Math.min(next.top, next.bottom),
      right: Math.max(next.left, next.right),
      bottom: Math.max(next.top, next.bottom),
    },
    width,
    height,
  );
}

export function deleteRegionAt(regions, index) {
  return (regions || []).filter((_, at) => at !== index);
}

export function wholeImageRect(imageWidth, imageHeight) {
  return { x: 0, y: 0, w: Math.max(1, Math.round(imageWidth)), h: Math.max(1, Math.round(imageHeight)) };
}

/** Longest edge capped, so a phone photo does not fill IndexedDB. */
export function stickerFitSize(width, height, maxEdge = STICKER_MAX_EDGE) {
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const edge = Math.max(w, h);
  if (edge <= maxEdge) {
    return { width: Math.round(w), height: Math.round(h) };
  }
  const scale = maxEdge / edge;
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** Free angle, no 90 snap (#79 lock). Bounding box of the turned picture. */
export function rotatedSize(width, height, degrees) {
  const rad = ((Number(degrees) || 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  return {
    width: Math.max(1, Math.round(w * cos + h * sin)),
    height: Math.max(1, Math.round(w * sin + h * cos)),
  };
}

export function normalizeAngle(degrees) {
  const value = Number(degrees) || 0;
  return ((value % 360) + 360) % 360;
}

function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/** Makes one colour see-through, for a sticker cut off a white background. */
export function applyChroma(rgba, color, tolerance = CHROMA_TOLERANCE) {
  const out = new Uint8ClampedArray(rgba);
  const limit = Math.max(0, Number(tolerance) || 0);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 0) {
      continue;
    }
    if (colorDistance(out[i], out[i + 1], out[i + 2], color.r, color.g, color.b) <= limit) {
      out[i + 3] = 0;
    }
  }
  return out;
}

export function pixelAt(rgba, width, x, y) {
  const i = (Math.round(y) * Math.max(1, Math.round(width)) + Math.round(x)) * 4;
  if (i < 0 || i + 3 >= rgba.length) {
    return null;
  }
  return { r: rgba[i], g: rgba[i + 1], b: rgba[i + 2], a: rgba[i + 3] };
}

/** Studio eraser: clears a round patch, alpha only. */
export function eraseCircle(rgba, width, height, cx, cy, radius) {
  const out = new Uint8ClampedArray(rgba);
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const r = Math.max(1, Number(radius) || 1);
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(h - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
        out[(y * w + x) * 4 + 3] = 0;
      }
    }
  }
  return out;
}

export const STUDIO_HANDLE_CSS = 8;
export const STUDIO_HANDLES = ["nw", "ne", "se", "sw"];
export const STUDIO_SCALE_MIN = 0.25;
export const STUDIO_SCALE_MAX = 4;

/**
 * Corner size in the studio: dragging a corner scales the whole sticker, shape
 * kept, so it never turns into a squashed picture (#79).
 */
export function cornerScale(width, height, handle, dx, dy, startScale = 1) {
  const w = Math.max(1, Number(width) || 1);
  const signX = String(handle).includes("w") ? -1 : 1;
  const signY = String(handle).includes("n") ? -1 : 1;
  const grow = (signX * (Number(dx) || 0) + signY * (Number(dy) || 0)) / 2;
  const next = (Number(startScale) || 1) + (grow * 2) / w;
  return Math.min(STUDIO_SCALE_MAX, Math.max(STUDIO_SCALE_MIN, next));
}

export function scaledSize(width, height, scale) {
  const factor = Math.min(STUDIO_SCALE_MAX, Math.max(STUDIO_SCALE_MIN, Number(scale) || 1));
  return {
    width: Math.max(1, Math.round((Number(width) || 1) * factor)),
    height: Math.max(1, Math.round((Number(height) || 1) * factor)),
  };
}

/** Placed size on the page: a sticker keeps its shape, capped to a third. */
export function stickerSizeOnPage(width, height, pageCssWidth, pageCssHeight, share = 0.34) {
  const pw = Math.max(1, Number(pageCssWidth) || 1);
  const ph = Math.max(1, Number(pageCssHeight) || 1);
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const scale = Math.min((pw * share) / w, (ph * share) / h, 1);
  return { w: (w * scale) / pw, h: (h * scale) / ph };
}
