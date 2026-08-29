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

export function encodePngRgba(width, height, rgba) {
  const raw = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const dest = y * (1 + width * 4);
    raw[dest] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), dest + 1);
  }
  const ihdr = concat([u32(width), u32(height), Uint8Array.of(8, 6, 0, 0, 0)]);
  return concat([
    Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlibStore(raw)),
    pngChunk("IEND", new Uint8Array(0)),
  ]);
}

export function captureRegionPng(pdf, ink, width, height, mosaicBoxesPx, cropBox) {
  const composed = composePageRgba(pdf, ink, width, height, mosaicBoxesPx);
  const cropped = cropRgba(composed, width, height, cropBox);
  const png = encodePngRgba(cropped.width, cropped.height, cropped.data);
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
