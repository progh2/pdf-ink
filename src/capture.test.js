import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { captureRegionPng, writePngClipboard } from "./capture.js";

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
