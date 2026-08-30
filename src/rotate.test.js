import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addRotation,
  boundsCenter,
  isLockedImage,
  normalizeRotation,
  rotateItem,
  rotateItemAround,
  rotateItems,
  rotateItemsAround,
  rotatePoint,
  rotatePointAround,
  rotateRect,
  rotateRectAround,
} from "./rotate.js";

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

describe("선택 객체 회전", () => {
  it("rotates points and boxes around the selection bounds center", () => {
    const bounds = { x: 0.2, y: 0.2, w: 0.4, h: 0.2 };
    const center = boundsCenter(bounds);
    assert.ok(Math.abs(center.x - 0.4) < 1e-10);
    assert.ok(Math.abs(center.y - 0.3) < 1e-10);
    const aroundPage = rotatePointAround({ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, 90);
    assert.ok(Math.abs(aroundPage.x - 1) < 1e-10);
    assert.ok(Math.abs(aroundPage.y) < 1e-10);
    const moved = rotatePointAround({ x: 0.2, y: 0.2 }, center, 90);
    assert.ok(Math.abs(moved.x - 0.5) < 1e-10);
    assert.ok(Math.abs(moved.y - 0.1) < 1e-10);
    const box = rotateRectAround(bounds, center, 90);
    assert.ok(Math.abs(box.x - 0.3) < 1e-10);
    assert.ok(Math.abs(box.y - 0.1) < 1e-10);
    assert.ok(Math.abs(box.w - 0.2) < 1e-10);
    assert.ok(Math.abs(box.h - 0.4) < 1e-10);
  });

  it("rotates strokes, stamps, images, and snapped shapes around the box center", () => {
    const stroke = {
      type: "pen",
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.4, y: 0.2 },
      ],
    };
    const stamp = { type: "stamp", stamp: "승인", x: 0.3, y: 0.3, tilt: 0 };
    const image = { type: "image", x: 0.2, y: 0.2, w: 0.2, h: 0.1, locked: false, rotate: 0 };
    const shape = {
      type: "pen",
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.4, y: 0.2 },
        { x: 0.4, y: 0.4 },
        { x: 0.2, y: 0.4 },
        { x: 0.2, y: 0.2 },
      ],
    };
    const center = { x: 0.3, y: 0.3 };
    const next = rotateItemsAround([stroke, stamp, image, shape], [0, 1, 2, 3], center, 90);
    assert.ok(Math.abs(next[0].points[0].x - 0.4) < 1e-10);
    assert.ok(Math.abs(next[0].points[0].y - 0.2) < 1e-10);
    assert.ok(Math.abs(next[1].x - 0.3) < 1e-10);
    assert.ok(Math.abs(next[1].y - 0.3) < 1e-10);
    assert.ok(Math.abs(next[1].tilt - Math.PI / 2) < 1e-6);
    assert.ok(Math.abs(next[2].x - 0.3) < 1e-10);
    assert.ok(Math.abs(next[2].y - 0.2) < 1e-10);
    assert.ok(Math.abs(next[2].w - 0.1) < 1e-10);
    assert.ok(Math.abs(next[2].h - 0.2) < 1e-10);
    assert.equal(next[2].rotate, 90);
    assert.ok(Math.abs(next[3].points[1].x - 0.4) < 1e-10);
    assert.ok(Math.abs(next[3].points[1].y - 0.4) < 1e-10);
    assert.equal(rotateItemAround(stroke, center, 0), stroke);
  });

  it("does not rotate a locked image", () => {
    const locked = { type: "image", x: 0.2, y: 0.2, w: 0.3, h: 0.2, locked: true, rotate: 0 };
    const unlocked = { type: "image", x: 0.2, y: 0.2, w: 0.3, h: 0.2, locked: false, rotate: 0 };
    assert.equal(isLockedImage(locked), true);
    assert.equal(isLockedImage(unlocked), false);
    const center = { x: 0.35, y: 0.3 };
    assert.equal(rotateItemAround(locked, center, 90), locked);
    const next = rotateItemsAround([locked, unlocked], [0, 1], center, 90);
    assert.equal(next[0], locked);
    assert.notEqual(next[1], unlocked);
    assert.equal(next[1].rotate, 90);
  });
});
