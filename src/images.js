export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_HANDLE_PX = 8;

export const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
export const ALLOWED_IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp"];

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

export function imageTooLarge(size) {
  return Number(size) > MAX_IMAGE_BYTES;
}

export function isSvgImage(file) {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "");
  return type === "image/svg+xml" || type === "image/svg" || /\.svgz?$/i.test(name);
}

export function isAllowedImageType(type) {
  return ALLOWED_IMAGE_TYPES.has(String(type || "").toLowerCase());
}

export function isAllowedImageName(name) {
  const lower = String(name || "").toLowerCase();
  if (!lower) {
    return false;
  }
  if (/\.svgz?$/i.test(lower)) {
    return false;
  }
  return ALLOWED_IMAGE_EXTS.some((ext) => lower.endsWith(ext));
}

export function validateImageFile(file) {
  if (!file) {
    return { ok: false, message: "이미지를 선택해 주세요." };
  }
  if (isSvgImage(file)) {
    return { ok: false, message: "SVG 이미지는 넣을 수 없습니다." };
  }
  if (file.size === 0) {
    return { ok: false, message: "빈 파일은 넣을 수 없습니다." };
  }
  if (imageTooLarge(file.size)) {
    return { ok: false, message: "이미지가 너무 큽니다. 10MB 이하만 넣을 수 있습니다." };
  }
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "");
  if (type && !isAllowedImageType(type)) {
    return { ok: false, message: "PNG, JPEG, WebP만 넣을 수 있습니다." };
  }
  if (name && !isAllowedImageName(name) && !isAllowedImageType(type)) {
    return { ok: false, message: "PNG, JPEG, WebP만 넣을 수 있습니다." };
  }
  if (!type && !name) {
    return { ok: true };
  }
  if (!isAllowedImageType(type) && !isAllowedImageName(name)) {
    return { ok: false, message: "PNG, JPEG, WebP만 넣을 수 있습니다." };
  }
  return { ok: true };
}

function isPngHeader(bytes) {
  return bytes.length >= 4 && PNG_MAGIC.every((value, index) => bytes[index] === value);
}

function isJpegHeader(bytes) {
  return bytes.length >= 3 && JPEG_MAGIC.every((value, index) => bytes[index] === value);
}

function isWebpHeader(bytes) {
  if (bytes.length < 12) {
    return false;
  }
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  return riff === "RIFF" && webp === "WEBP";
}

export function looksLikeSvgBytes(bytes) {
  let text = "";
  const limit = Math.min(bytes.length, 256);
  for (let index = 0; index < limit; index += 1) {
    text += String.fromCharCode(bytes[index]);
  }
  const trimmed = text.replace(/^\uFEFF/, "").trimStart().toLowerCase();
  return trimmed.startsWith("<svg") || trimmed.startsWith("<?xml") || trimmed.includes("<svg");
}

export async function validateImageContents(file) {
  if (isSvgImage(file)) {
    return { ok: false, message: "SVG 이미지는 넣을 수 없습니다." };
  }
  const header = new Uint8Array(await file.slice(0, 256).arrayBuffer());
  if (looksLikeSvgBytes(header)) {
    return { ok: false, message: "SVG 이미지는 넣을 수 없습니다." };
  }
  if (isPngHeader(header) || isJpegHeader(header) || isWebpHeader(header)) {
    return { ok: true };
  }
  return { ok: false, message: "PNG, JPEG, WebP만 넣을 수 있습니다." };
}

export function isImageItem(item) {
  return item?.type === "image";
}

export function isFixedImage(item) {
  return isImageItem(item) && Boolean(item.fixed);
}

export function imageInkItem({ id, x, y, w, h, fixed = false, crop = null, turn = 0 }) {
  return {
    type: "image",
    id,
    x,
    y,
    w,
    h,
    fixed: Boolean(fixed),
    crop: crop || null,
    turn: Number(turn) || 0,
  };
}

export function fitImageRect(naturalW, naturalH, maxW = 0.45, maxH = 0.45) {
  const aspect = Math.max(Number(naturalW) || 1, 1) / Math.max(Number(naturalH) || 1, 1);
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

export function newImageId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `img-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function bakeCrop(item, crop) {
  const prev = item.crop || { x: 0, y: 0, w: 1, h: 1 };
  const nextCrop = {
    x: prev.x + crop.x * prev.w,
    y: prev.y + crop.y * prev.h,
    w: prev.w * crop.w,
    h: prev.h * crop.h,
  };
  return {
    ...item,
    crop: nextCrop,
    x: item.x + item.w * crop.x,
    y: item.y + item.h * crop.y,
    w: item.w * crop.w,
    h: item.h * crop.h,
  };
}

export function fileFromPasteEvent(event) {
  const items = event?.clipboardData?.items;
  if (items) {
    for (const item of items) {
      if (item?.kind === "file") {
        const file = item.getAsFile?.() || null;
        if (file && validateImageFile(file).ok) {
          return file;
        }
      }
    }
  }
  const files = event?.clipboardData?.files;
  if (files?.length) {
    for (const file of files) {
      if (file && validateImageFile(file).ok) {
        return file;
      }
    }
  }
  return null;
}
