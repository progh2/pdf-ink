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
