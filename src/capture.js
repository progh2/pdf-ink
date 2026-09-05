import { applyMosaicToRgba } from "./mosaic.js";

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  CRC_TABLE[index] = crc >>> 0;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes) {
  let a = 1;
  let b = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    a += bytes[index];
    b += a;
    if (index % 5000 === 4999) {
      a %= 65521;
      b %= 65521;
    }
  }
  a %= 65521;
  b %= 65521;
  return ((b << 16) | a) >>> 0;
}

function u32(value) {
  return Uint8Array.of((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
}

function concat(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function pngChunk(type, data) {
  const label = Uint8Array.from(type, (ch) => ch.charCodeAt(0));
  const body = concat([label, data]);
  return concat([u32(data.length), body, u32(crc32(body))]);
}

function zlibStore(data) {
  const parts = [Uint8Array.of(0x78, 0x01)];
  let offset = 0;
  while (offset < data.length) {
    const n = Math.min(65535, data.length - offset);
    const last = offset + n >= data.length ? 1 : 0;
    const header = Uint8Array.of(last, n & 0xff, (n >> 8) & 0xff, ~n & 0xff, (~n >> 8) & 0xff);
    parts.push(header, data.subarray(offset, offset + n));
    offset += n;
  }
  parts.push(u32(adler32(data)));
  return concat(parts);
}

export function composePageRgba(pdf, ink, width, height, mosaicBoxesPx = []) {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < out.length; i += 4) {
    const pdfA = (pdf[i + 3] || 0) / 255;
    const paperR = (pdf[i] || 0) * pdfA + 255 * (1 - pdfA);
    const paperG = (pdf[i + 1] || 0) * pdfA + 255 * (1 - pdfA);
    const paperB = (pdf[i + 2] || 0) * pdfA + 255 * (1 - pdfA);
    const ia = (ink[i + 3] || 0) / 255;
    const pa = 1 - ia;
    out[i] = Math.round((ink[i] || 0) * ia + paperR * pa);
    out[i + 1] = Math.round((ink[i + 1] || 0) * ia + paperG * pa);
    out[i + 2] = Math.round((ink[i + 2] || 0) * ia + paperB * pa);
    out[i + 3] = 255;
  }
  for (const box of mosaicBoxesPx) {
    applyMosaicToRgba(out, width, height, box, box.cell);
  }
  return out;
}

export function cropRgba(data, width, height, box) {
  const x = Math.max(0, Math.min(width - 1, Math.floor(Number(box.x) || 0)));
  const y = Math.max(0, Math.min(height - 1, Math.floor(Number(box.y) || 0)));
  const w = Math.max(1, Math.min(width - x, Math.ceil(Number(box.w) || 0)));
  const h = Math.max(1, Math.min(height - y, Math.ceil(Number(box.h) || 0)));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row += 1) {
    const src = ((y + row) * width + x) * 4;
    out.set(data.subarray(src, src + w * 4), row * w * 4);
  }
  return { data: out, width: w, height: h };
}

/** 우리 메타를 담는 PNG 텍스트 청크 열쇠. 다른 앱은 그냥 지나친다. */
export const CAPTURE_META_KEYWORD = "pdf-ink";

/** tEXt 청크: `keyword\0text`, 둘 다 Latin-1. JSON은 ASCII라 그대로 실린다. */
function textChunk(keyword, text) {
  const body = concat([
    Uint8Array.from(keyword, (ch) => ch.charCodeAt(0) & 0xff),
    Uint8Array.of(0),
    Uint8Array.from(String(text), (ch) => ch.charCodeAt(0) & 0xff),
  ]);
  return pngChunk("tEXt", body);
}

export function encodePngRgba(width, height, rgba, meta = null) {
  const raw = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const dest = y * (1 + width * 4);
    raw[dest] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), dest + 1);
  }
  const ihdr = concat([u32(width), u32(height), Uint8Array.of(8, 6, 0, 0, 0)]);
  const parts = [Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), pngChunk("IHDR", ihdr)];
  // #253: 어디서 오려 냈는지를 그림 안에 심는다. 다른 문서·다른 세션에서
  // 붙여도 원래 자리를 안다. tEXt는 표준이라 뷰어는 무시한다.
  if (meta) {
    let text = "";
    try {
      text = typeof meta === "string" ? meta : JSON.stringify(meta);
    } catch {
      text = "";
    }
    if (text) {
      parts.push(textChunk(CAPTURE_META_KEYWORD, text));
    }
  }
  parts.push(pngChunk("IDAT", zlibStore(raw)), pngChunk("IEND", new Uint8Array(0)));
  return concat(parts);
}

/** 붙일 때: PNG 바이트에서 우리가 심은 위치 메타를 도로 읽는다. 없으면 null. */
export function readPngText(bytes, keyword = CAPTURE_META_KEYWORD) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  // 서명 8 + (길이4 타입4 …데이터… crc4) 반복.
  if (data.length < 8) {
    return null;
  }
  let at = 8;
  while (at + 8 <= data.length) {
    const len = (data[at] << 24) | (data[at + 1] << 16) | (data[at + 2] << 8) | data[at + 3];
    const type = String.fromCharCode(data[at + 4], data[at + 5], data[at + 6], data[at + 7]);
    const start = at + 8;
    if (len < 0 || start + len > data.length) {
      return null;
    }
    if (type === "tEXt") {
      const body = data.subarray(start, start + len);
      const zero = body.indexOf(0);
      if (zero >= 0) {
        const key = String.fromCharCode(...body.subarray(0, zero));
        if (key === keyword) {
          const text = String.fromCharCode(...body.subarray(zero + 1));
          try {
            return JSON.parse(text);
          } catch {
            return null;
          }
        }
      }
    }
    if (type === "IEND") {
      return null;
    }
    at = start + len + 4;
  }
  return null;
}

export function captureRegionPng(pdf, ink, width, height, mosaicBoxesPx, cropBox, meta = null) {
  const composed = composePageRgba(pdf, ink, width, height, mosaicBoxesPx);
  const cropped = cropRgba(composed, width, height, cropBox);
  const png = encodePngRgba(cropped.width, cropped.height, cropped.data, meta);
  return { png, width: cropped.width, height: cropped.height, pixels: cropped.data };
}

export async function writePngClipboard(pngBytes, clipboard, ClipboardItemCtor) {
  const write = clipboard?.write;
  const Item = ClipboardItemCtor;
  if (typeof write !== "function" || typeof Item !== "function") {
    throw new Error("clipboard-unavailable");
  }
  const blob = new Blob([pngBytes], { type: "image/png" });
  await write.call(clipboard, [new Item({ "image/png": blob })]);
}
