export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const IMAGE_MAX_EDGE = 1600;
export const IMAGE_HANDLE_CSS = 8;
export const RESIZE_HANDLES = ["nw", "ne", "se", "sw"];
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp"];

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(1, Math.max(0, n));
}

export function isImage(item) {
  return item?.type === "image";
}

export function imageItem({
  x = 0.2,
  y = 0.2,
  w = 0.4,
  h = 0.3,
  src = "",
  locked = false,
  crop = null,
  rotate = 0,
  id,
} = {}) {
  const n = Math.round(Number(rotate) / 90) * 90;
  return {
    type: "image",
    id: id || `img-${Math.round(Date.now() % 1e9)}`,
    x: clamp01(x),
    y: clamp01(y),
    w: Math.max(0.04, Number(w) || 0.4),
    h: Math.max(0.04, Number(h) || 0.3),
    src: typeof src === "string" ? src : "",
    locked: Boolean(locked),
    crop: normalizeCrop(crop),
    rotate: Number.isFinite(n) ? ((n % 360) + 360) % 360 : 0,
  };
}

export function normalizeCrop(crop) {
  if (!crop || typeof crop !== "object") {
    return { x: 0, y: 0, w: 1, h: 1 };
  }
  const x = clamp01(crop.x);
  const y = clamp01(crop.y);
  return {
    x,
    y,
    w: Math.max(0.02, Math.min(1 - x, Number(crop.w) || 1)),
    h: Math.max(0.02, Math.min(1 - y, Number(crop.h) || 1)),
  };
}

export function lockImage(item, locked = true) {
  return { ...item, locked: Boolean(locked) };
}

export function cropImage(item, crop) {
  const prev = normalizeCrop(item?.crop);
  const next = normalizeCrop(crop);
  return {
    ...item,
    crop: {
      x: prev.x + next.x * prev.w,
      y: prev.y + next.y * prev.h,
      w: prev.w * next.w,
      h: prev.h * next.h,
    },
  };
}

export function resizeImage(item, handle, point) {
  const x1 = item.x;
  const y1 = item.y;
  const x2 = item.x + item.w;
  const y2 = item.y + item.h;
  const px = Number(point?.x);
  const py = Number(point?.y);
  let left = x1;
  let top = y1;
  let right = x2;
  let bottom = y2;
  if (handle === "nw" || handle === "sw") {
    left = Math.min(px, right - 0.04);
  }
  if (handle === "ne" || handle === "se") {
    right = Math.max(px, left + 0.04);
  }
  if (handle === "nw" || handle === "ne") {
    top = Math.min(py, bottom - 0.04);
  }
  if (handle === "sw" || handle === "se") {
    bottom = Math.max(py, top + 0.04);
  }
  return { ...item, x: left, y: top, w: right - left, h: bottom - top };
}

export function handleAt(bounds, point, hit = 0.038) {
  if (!bounds || !point) {
    return null;
  }
  const corners = {
    nw: { x: bounds.x, y: bounds.y },
    ne: { x: bounds.x + bounds.w, y: bounds.y },
    se: { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
    sw: { x: bounds.x, y: bounds.y + bounds.h },
  };
  let best = null;
  let bestDist = hit;
  for (const name of RESIZE_HANDLES) {
    const dist = Math.hypot(point.x - corners[name].x, point.y - corners[name].y);
    if (dist <= bestDist) {
      best = name;
      bestDist = dist;
    }
  }
  return best;
}

export function acceptImageSrc(src) {
  if (typeof src !== "string" || !src) {
    return false;
  }
  const head = src.slice(0, 64).toLowerCase();
  if (head.includes("svg") || src.includes("<svg") || src.includes("<SVG")) {
    return false;
  }
  return /^data:image\/(png|jpeg|jpg|webp)/i.test(src);
}

export function acceptImageFile(file) {
  if (!file) {
    return { ok: false, message: "이미지를 선택해 주세요." };
  }
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  if (type === "image/svg+xml" || type === "image/svg" || name.endsWith(".svg")) {
    return { ok: false, message: "SVG는 넣을 수 없습니다." };
  }
  const typeOk = IMAGE_TYPES.includes(type);
  const extOk = IMAGE_EXTS.some((ext) => name.endsWith(ext));
  if (!typeOk && !extOk) {
    return { ok: false, message: "PNG, JPEG, WebP만 넣을 수 있습니다." };
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return { ok: false, message: "이미지가 너무 큽니다. 8MB 이하만 넣을 수 있습니다." };
  }
  return { ok: true };
}

export function imageSizeOnPage(imgWidth, imgHeight, cssWidth, cssHeight, maxW = 0.5) {
  const iw = Math.max(1, Number(imgWidth) || 1);
  const ih = Math.max(1, Number(imgHeight) || 1);
  const pageW = Math.max(1, Number(cssWidth) || 1);
  const pageH = Math.max(1, Number(cssHeight) || 1);
  const w = maxW;
  const h = w * (ih / iw) * (pageW / pageH);
  if (h <= 0.62) {
    return { w, h: Math.max(0.08, h) };
  }
  return { w: Math.max(0.08, (0.62 * iw * pageH) / (ih * pageW)), h: 0.62 };
}

export function cropRectOnImage(image, rect) {
  const x = Math.max(0, (rect.x - image.x) / image.w);
  const y = Math.max(0, (rect.y - image.y) / image.h);
  const w = Math.min(1 - x, rect.w / image.w);
  const h = Math.min(1 - y, rect.h / image.h);
  return normalizeCrop({ x, y, w, h });
}
