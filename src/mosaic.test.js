import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyMosaicToRgba, mosaicItem } from "./mosaic.js";
import { composePageRgba } from "./capture.js";

function fillRect(data, width, x, y, w, h, rgba) {
  for (let row = y; row < y + h; row += 1) {
    for (let col = x; col < x + w; col += 1) {
      const i = (row * width + col) * 4;
      data[i] = rgba[0];
      data[i + 1] = rgba[1];
      data[i + 2] = rgba[2];
      data[i + 3] = rgba[3];
    }
  }
}

describe("mosaic", () => {
  it("is applied to captured pixels and leaves the outside unchanged", () => {
    const width = 32;
    const height = 16;
    const pdf = new Uint8ClampedArray(width * height * 4);
    const ink = new Uint8ClampedArray(width * height * 4);
    fillRect(pdf, width, 0, 0, width, height, [240, 240, 240, 255]);
    fillRect(ink, width, 0, 0, 16, 16, [200, 10, 10, 255]);
    ink[0] = 12;
    ink[1] = 220;
    ink[2] = 40;
    ink[3] = 255;
    ink[4] = 250;
    ink[5] = 8;
    ink[6] = 8;
    ink[7] = 255;

    const mosaics = [{ x: 0, y: 0, w: 16, h: 16, cell: 8 }];
    const captured = composePageRgba(pdf, ink, width, height, mosaics);
    const beforeOutside = composePageRgba(pdf, ink, width, height, []);

    const first = captured.slice(0, 4);
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const i = (y * width + x) * 4;
        assert.deepEqual([...captured.slice(i, i + 4)], [...first]);
      }
    }
    assert.notDeepEqual([...first], [12, 220, 40, 255]);

    for (let y = 0; y < height; y += 1) {
      for (let x = 16; x < width; x += 1) {
        const i = (y * width + x) * 4;
        assert.deepEqual([...captured.slice(i, i + 4)], [...beforeOutside.slice(i, i + 4)]);
      }
    }

    const raw = new Uint8ClampedArray(ink);
    applyMosaicToRgba(raw, width, height, { x: 0, y: 0, w: 16, h: 16 }, 8);
    assert.equal(raw[0], raw[4]);
    assert.equal(mosaicItem({ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }).type, "mosaic");
  });
});
