import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cloneItems, createHistory, recordChange, undoChange } from "./history.js";
import {
  addRotation,
  imagePaintDest,
  normalizeRotation,
  pointerAngleDeg,
  rotateDragDelta,
  rotateItem,
  rotateItemAround,
  rotateItems,
  rotatePoint,
  rotatePointAround,
  rotateRect,
  rotateSelectedItems,
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

describe("선택 회전", () => {
  it("rotates around the selection center in CSS pixels", () => {
    const center = { x: 0.5, y: 0.5 };
    const right = rotatePointAround({ x: 0.6, y: 0.5 }, 90, center, 400, 400);
    assert.ok(Math.abs(right.x - 0.5) < 1e-10);
    assert.ok(Math.abs(right.y - 0.6) < 1e-10);
    const tall = rotatePointAround({ x: 0.6, y: 0.5 }, 90, center, 400, 600);
    assert.ok(Math.abs(tall.x - 0.5) < 1e-10);
    assert.ok(Math.abs(tall.y - (0.5 + 0.1 * (400 / 600))) < 1e-10);
    const left = rotatePointAround({ x: 0.6, y: 0.5 }, -90, center, 400, 400);
    assert.ok(Math.abs(left.x - 0.5) < 1e-10);
    assert.ok(Math.abs(left.y - 0.4) < 1e-10);
  });

  it("turns selected strokes, stamps, shapes, and images together", () => {
    const center = { x: 0.4, y: 0.4 };
    const stroke = {
      type: "pen",
      points: [
        { x: 0.3, y: 0.4 },
        { x: 0.5, y: 0.4 },
      ],
    };
    const shape = {
      type: "pen",
      points: [
        { x: 0.3, y: 0.3 },
        { x: 0.5, y: 0.3 },
        { x: 0.5, y: 0.5 },
        { x: 0.3, y: 0.5 },
        { x: 0.3, y: 0.3 },
      ],
    };
    const stamp = { type: "stamp", stamp: "승인", x: 0.4, y: 0.3, tilt: 0 };
    const image = { type: "image", x: 0.3, y: 0.3, w: 0.2, h: 0.2, locked: false, rotate: 0 };
    const next = rotateSelectedItems([stroke, shape, stamp, image], [0, 1, 2, 3], 90, center, 400, 400);
    assert.ok(Math.abs(next[0].points[0].x - 0.4) < 1e-10);
    assert.ok(Math.abs(next[0].points[0].y - 0.3) < 1e-10);
    assert.ok(Math.abs(next[1].points[1].x - 0.5) < 1e-10);
    assert.ok(Math.abs(next[1].points[1].y - 0.5) < 1e-10);
    assert.ok(Math.abs(next[2].x - 0.5) < 1e-10);
    assert.ok(Math.abs(next[2].y - 0.4) < 1e-10);
    assert.ok(Math.abs(next[2].tilt - Math.PI / 2) < 1e-6);
    assert.ok(Math.abs(next[3].x - 0.3) < 1e-10);
    assert.ok(Math.abs(next[3].y - 0.3) < 1e-10);
    assert.equal(next[3].rotate, 90);
    assert.equal(stroke.points[0].x, 0.3);
    assert.equal(image.rotate, 0);
  });

  it("leaves a locked image unmoved and unrotated", () => {
    const locked = { type: "image", x: 0.2, y: 0.2, w: 0.3, h: 0.2, locked: true, rotate: 0 };
    const center = { x: 0.35, y: 0.3 };
    assert.equal(rotateItemAround(locked, 90, center, 400, 600), locked);
    const next = rotateSelectedItems([locked], [0], 90, center, 400, 600);
    assert.equal(next[0], locked);
  });

  it("drags around the bounds center without a 90 snap", () => {
    const center = { x: 0.5, y: 0.5 };
    const handle = { x: 0.5, y: 0.2 };
    const dragged = { x: 0.8, y: 0.5 };
    const delta = rotateDragDelta(handle, dragged, center, 400, 400);
    assert.ok(Math.abs(delta - 90) < 1e-6);
    const free = rotateDragDelta(handle, { x: 0.7, y: 0.3 }, center, 400, 400);
    assert.ok(free > 0 && free < 90);
    assert.ok(Math.abs(free - 90) > 10);
    const start = pointerAngleDeg(handle, center, 400, 400);
    const now = pointerAngleDeg({ x: 0.7, y: 0.3 }, center, 400, 400);
    assert.ok(Math.abs(now - start - free) < 1e-10);

    const stroke = {
      type: "pen",
      points: [
        { x: 0.5, y: 0.4 },
        { x: 0.6, y: 0.4 },
      ],
    };
    const stamp = { type: "stamp", stamp: "승인", x: 0.5, y: 0.35, tilt: 0 };
    const shape = {
      type: "pen",
      points: [
        { x: 0.4, y: 0.4 },
        { x: 0.6, y: 0.4 },
        { x: 0.6, y: 0.6 },
        { x: 0.4, y: 0.6 },
        { x: 0.4, y: 0.4 },
      ],
    };
    const image = { type: "image", x: 0.4, y: 0.4, w: 0.2, h: 0.2, locked: false, rotate: 0 };
    const angle = 37;
    const next = rotateSelectedItems([stroke, shape, stamp, image], [0, 1, 2, 3], angle, center, 400, 400);
    const moved = rotatePointAround({ x: 0.6, y: 0.4 }, angle, center, 400, 400);
    assert.ok(Math.abs(next[0].points[1].x - moved.x) < 1e-10);
    assert.ok(Math.abs(next[0].points[1].y - moved.y) < 1e-10);
    assert.ok(Math.abs(next[1].points[0].x - rotatePointAround(shape.points[0], angle, center, 400, 400).x) < 1e-10);
    assert.ok(Math.abs(next[2].tilt - (37 * Math.PI) / 180) < 1e-6);
    assert.ok(Math.abs(next[3].rotate - 37) < 1e-10);
    assert.ok(next[3].rotate !== 0 && next[3].rotate !== 90);
    assert.equal(normalizeRotation(next[3].rotate), 0);
    assert.equal(stroke.points[1].x, 0.6);
    assert.equal(image.rotate, 0);
  });

  it("leaves a locked image unmoved during a handle drag", () => {
    const locked = { type: "image", x: 0.2, y: 0.2, w: 0.3, h: 0.2, locked: true, rotate: 0 };
    const open = { type: "image", x: 0.6, y: 0.6, w: 0.1, h: 0.1, locked: false, rotate: 0 };
    const center = { x: 0.45, y: 0.45 };
    const next = rotateSelectedItems([locked, open], [0, 1], 37, center, 400, 600);
    assert.equal(next[0], locked);
    assert.equal(next[0].rotate, 0);
    assert.ok(Math.abs(next[1].rotate - 37) < 1e-10);
    assert.equal(rotateItemAround(locked, 37, center, 400, 600), locked);
  });

  it("restores a free rotation through undo", () => {
    const stroke = {
      type: "pen",
      points: [
        { x: 0.4, y: 0.5 },
        { x: 0.6, y: 0.5 },
      ],
    };
    const image = { type: "image", x: 0.3, y: 0.3, w: 0.2, h: 0.2, locked: false, rotate: 0 };
    const before = [stroke, image];
    const after = rotateSelectedItems(before, [0, 1], 37, { x: 0.5, y: 0.5 }, 400, 400);
    assert.ok(Math.abs(after[1].rotate - 37) < 1e-10);
    const pages = { 1: cloneItems(after) };
    const history = createHistory();
    recordChange(history, { page: 1, before, after });
    undoChange(history, pages);
    assert.equal(pages[1][0].points[0].x, 0.4);
    assert.equal(pages[1][0].points[1].x, 0.6);
    assert.equal(pages[1][1].rotate, 0);
    assert.equal(pages[1][1].x, 0.3);
  });

  it("swaps paint dest so a 90-degree image fills its box", () => {
    const dest = imagePaintDest({ w: 0.4, h: 0.2, rotate: 90 }, 1000, 500);
    assert.equal(dest.rotate, 90);
    assert.equal(dest.destW, 100);
    assert.equal(dest.destH, 400);
    const upright = imagePaintDest({ w: 0.4, h: 0.2, rotate: 0 }, 1000, 500);
    assert.equal(upright.rotate, 0);
    assert.equal(upright.destW, 400);
    assert.equal(upright.destH, 100);
  });
});
