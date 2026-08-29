import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addRotation, normalizeRotation, rotateItem, rotateItems, rotatePoint, rotateRect } from "./rotate.js";

describe("페이지 회전", () => {
  it("snaps to quarter turns", () => {
    assert.equal(normalizeRotation(90), 90);
    assert.equal(normalizeRotation(-90), 270);
    assert.equal(addRotation(270, 90), 0);
    assert.equal(addRotation(0, -90), 270);
  });

  it("rotates ink points with the page clockwise", () => {
    assert.deepEqual(rotatePoint({ x: 0, y: 0 }, 90), { x: 1, y: 0 });
    assert.deepEqual(rotatePoint({ x: 1, y: 0 }, 90), { x: 1, y: 1 });
    assert.deepEqual(rotatePoint({ x: 0.25, y: 0.4 }, 180), { x: 0.75, y: 0.6 });
    const left = rotatePoint({ x: 0.2, y: 0.3 }, -90);
    assert.ok(Math.abs(left.x - 0.3) < 1e-10);
    assert.ok(Math.abs(left.y - 0.8) < 1e-10);
  });

  it("rotates strokes, stamps, and boxes together", () => {
    const stroke = {
      type: "pen",
      points: [
        { x: 0.2, y: 0.1 },
        { x: 0.2, y: 0.4 },
      ],
    };
    const stamp = { type: "stamp", stamp: "승인", x: 0.2, y: 0.3, tilt: 0 };
    const mosaic = { type: "mosaic", x: 0.1, y: 0.2, w: 0.2, h: 0.1, cell: 8 };
    const next = rotateItems([stroke, stamp, mosaic], 90);
    assert.deepEqual(next[0].points[0], { x: 0.9, y: 0.2 });
    assert.equal(next[1].x, 0.7);
    assert.equal(next[1].y, 0.2);
    assert.ok(Math.abs(next[1].tilt - Math.PI / 2) < 1e-6);
    const box = rotateRect({ x: 0.1, y: 0.2, w: 0.2, h: 0.1 }, 90);
    assert.ok(Math.abs(box.x - next[2].x) < 1e-10);
    assert.ok(Math.abs(box.y - next[2].y) < 1e-10);
    assert.ok(Math.abs(box.w - next[2].w) < 1e-10);
    assert.ok(Math.abs(box.h - next[2].h) < 1e-10);
    assert.equal(rotateItem(stroke, 0), stroke);
  });
});
