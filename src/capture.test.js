import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  captureRegionPng,
  encodePngRgba,
  readPngText,
  writePngClipboard,
} from "./capture.js";

describe("영역캡처", () => {
  it("produces a PNG without throwing", () => {
    const width = 12;
    const height = 10;
    const pdf = new Uint8ClampedArray(width * height * 4);
    const ink = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < pdf.length; i += 4) {
      pdf[i] = 230;
      pdf[i + 1] = 226;
      pdf[i + 2] = 214;
      pdf[i + 3] = 255;
    }
    ink[20] = 20;
    ink[21] = 20;
    ink[22] = 20;
    ink[23] = 255;
    const result = captureRegionPng(
      pdf,
      ink,
      width,
      height,
      [{ x: 0, y: 0, w: 6, h: 6, cell: 3 }],
      { x: 1, y: 1, w: 8, h: 7 },
    );
    assert.ok(result.png.byteLength > 8);
    assert.equal(result.png[0], 0x89);
    assert.equal(String.fromCharCode(result.png[1], result.png[2], result.png[3]), "PNG");
    assert.equal(result.width, 8);
    assert.equal(result.height, 7);
  });

  it("bakes mosaic into the cropped PNG and keeps a paper background", () => {
    const width = 16;
    const height = 8;
    const pdf = new Uint8ClampedArray(width * height * 4);
    const ink = new Uint8ClampedArray(width * height * 4);
    ink[0] = 10;
    ink[1] = 200;
    ink[2] = 30;
    ink[3] = 255;
    ink[4] = 240;
    ink[5] = 20;
    ink[6] = 20;
    ink[7] = 255;
    const result = captureRegionPng(
      pdf,
      ink,
      width,
      height,
      [{ x: 0, y: 0, w: 8, h: 8, cell: 4 }],
      { x: 0, y: 0, w: 8, h: 8 },
    );
    assert.equal(result.png[0], 0x89);
    assert.equal(String.fromCharCode(result.png[1], result.png[2], result.png[3]), "PNG");
    const first = result.pixels.slice(0, 4);
    assert.equal(first[3], 255);
    for (let i = 0; i < 4 * 4; i += 1) {
      const px = (Math.floor(i / 4) * result.width + (i % 4)) * 4;
      assert.deepEqual([...result.pixels.slice(px, px + 4)], [...first]);
    }
    assert.notDeepEqual([...first], [10, 200, 30, 255]);
  });

  it("writes PNG only through the provided clipboard write", async () => {
    const written = [];
    await writePngClipboard(Uint8Array.of(137, 80, 78, 71), {
      write: async (items) => {
        written.push(items);
      },
    }, class ClipboardItem {
      constructor(items) {
        this.items = items;
      }
    });
    assert.equal(written.length, 1);
    assert.equal(written[0][0].items["image/png"].type, "image/png");
  });
});

describe("#253 캡처에 위치를 심어 보내기", () => {
  it("carries the rect through the PNG and back", () => {
    const meta = { app: "pdf-ink", v: 1, rect: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } };
    const png = encodePngRgba(3, 2, new Uint8ClampedArray(3 * 2 * 4), meta);
    assert.deepEqual(readPngText(png), meta);
  });

  it("adds no chunk when there is no meta — a plain PNG stays plain", () => {
    const png = encodePngRgba(2, 2, new Uint8ClampedArray(16));
    assert.equal(readPngText(png), null);
  });

  it("captureRegionPng embeds what it is handed", () => {
    const px = new Uint8ClampedArray(4 * 4 * 4);
    const result = captureRegionPng(px, px, 4, 4, [], { x: 0, y: 0, w: 4, h: 4 }, { app: "pdf-ink", rect: { x: 0.5, y: 0.5, w: 0.2, h: 0.2 } });
    assert.equal(readPngText(result.png).rect.x, 0.5);
  });

  it("reads nothing out of bytes that are not our PNG", () => {
    assert.equal(readPngText(new Uint8Array([1, 2, 3])), null);
    assert.equal(readPngText(new Uint8Array(0)), null);
  });

  it("survives a foreign tEXt chunk without choking", () => {
    // 다른 앱이 자기 키워드로 tEXt를 넣은 경우: 우리 것이 아니면 null.
    const png = encodePngRgba(2, 2, new Uint8ClampedArray(16), null);
    assert.equal(readPngText(png, "someone-else"), null);
  });
});

describe("#253 배선", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const main = readFileSync(join(root, "src/main.js"), "utf8");

  it("embeds the source rect when capturing", () => {
    const cap = main.slice(main.indexOf("async function confirmCapture"), main.indexOf("function leavesNeedRebuild"));
    assert.match(cap, /const meta = \{ app: "pdf-ink", v: 1, rect: \{ \.\.\.pending\.rect \} \}/);
    assert.match(cap, /captureRegionPng\([^)]*boxes, crop, meta\)/);
  });

  it("reads the embedded rect on a native paste and places by it", () => {
    assert.match(main, /function pngMetaRect\(bytes\)/);
    assert.match(main, /meta\?\.app === "pdf-ink" \? meta\.rect : null/);
    assert.match(main, /await found\.file\.arrayBuffer\(\)/);
    assert.match(main, /pngMetaRect\(bytes\)/);
    const paste = main.slice(main.indexOf("async function pasteImageAt"), main.indexOf("function beginCrop"));
    // #256: 지문 매칭(known)이 최우선.
    assert.match(paste, /const home = known\?\.rect \|\| state\.captureFrom\?\.rect \|\| null/);
  });
});
