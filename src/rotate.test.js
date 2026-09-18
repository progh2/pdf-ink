import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addRotation,
  angleDegFromCenter,
  imagePaintDest,
  normalizeRotation,
  rotateItem,
  rotateItemAround,
  rotateItems,
  rotatePoint,
  rotatePointAround,
  rotateRect,
  rotateSelectedItems,
  wrapRotation,
} from "./rotate.js";
import { cloneItems, createHistory, recordChange, undoChange } from "./history.js";

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

  it("paints the stored box and keeps a free angle", () => {
    const dest = imagePaintDest({ w: 0.4, h: 0.2, rotate: 45 }, 1000, 500);
    assert.equal(dest.rotate, 45);
    assert.equal(dest.destW, 400);
    assert.equal(dest.destH, 100);
    const turned = imagePaintDest({ w: 0.4, h: 0.2, rotate: 90 }, 1000, 500);
    assert.equal(turned.rotate, 90);
    assert.equal(turned.destW, 400);
    assert.equal(turned.destH, 100);
    const upright = imagePaintDest({ w: 0.4, h: 0.2, rotate: 0 }, 1000, 500);
    assert.equal(upright.rotate, 0);
    assert.equal(upright.destW, 400);
    assert.equal(upright.destH, 100);
  });

  it("rotates freely around the selection center with no 90 snap", () => {
    const center = { x: 0.5, y: 0.5 };
    const tilted = rotatePointAround({ x: 0.6, y: 0.5 }, 45, center, 400, 400);
    const step = Math.SQRT1_2 * 0.1;
    assert.ok(Math.abs(tilted.x - (0.5 + step)) < 1e-10);
    assert.ok(Math.abs(tilted.y - (0.5 + step)) < 1e-10);
    assert.equal(wrapRotation(-30), 330);
    assert.ok(Math.abs(angleDegFromCenter(center, { x: 0.6, y: 0.5 }, 400, 400)) < 1e-10);
    assert.ok(Math.abs(angleDegFromCenter(center, { x: 0.5, y: 0.6 }, 400, 400) - 90) < 1e-10);
    const stroke = {
      type: "pen",
      points: [
        { x: 0.6, y: 0.5 },
        { x: 0.7, y: 0.5 },
      ],
    };
    const image = { type: "image", x: 0.3, y: 0.4, w: 0.4, h: 0.2, locked: false, rotate: 0 };
    const next = rotateSelectedItems([stroke, image], [0, 1], 33, center, 400, 400);
    assert.ok(Math.abs(next[0].points[0].x - 0.6) > 0.01);
    assert.ok(Math.abs(next[0].points[0].x - 0.5) > 0.01);
    assert.equal(next[1].w, 0.4);
    assert.equal(next[1].h, 0.2);
    assert.ok(Math.abs(next[1].rotate - 33) < 1e-10);
    assert.ok(Math.abs(next[1].x - 0.3) < 1e-10);
    assert.ok(Math.abs(next[1].y - 0.4) < 1e-10);
  });

  it("restores a free rotation through undo", () => {
    const items = [
      {
        type: "pen",
        points: [
          { x: 0.2, y: 0.2 },
          { x: 0.4, y: 0.2 },
        ],
      },
    ];
    const after = rotateSelectedItems(items, [0], 40, { x: 0.3, y: 0.2 }, 400, 400);
    const pages = { 1: cloneItems(after) };
    const history = createHistory();
    recordChange(history, { page: 1, before: items, after });
    undoChange(history, pages);
    assert.deepEqual(pages[1][0].points, items[0].points);
  });
});

describe("#452 쪽을 돌리면 그림도 같이 돈다", () => {
  const page = { w: 400, h: 600 };
  const aspect = page.w / page.h;

  it("꽉 찬 그림은 돌린 쪽을 그대로 채운다", () => {
    const img = { type: "image", x: 0, y: 0, w: 1, h: 1, rotate: 0, src: "x" };
    const out = rotateItem(img, 90, aspect);
    assert.equal(out.rotate, 90, "그림이 돈다");
    // 돌린 쪽은 600x400. 그리기 전 픽셀 크기는 그대로 400x600이어야,
    // 중심에서 90° 돌렸을 때 새 쪽을 정확히 채운다.
    assert.ok(Math.abs(out.w * page.h - page.w) < 1e-9);
    assert.ok(Math.abs(out.h * page.w - page.h) < 1e-9);
    // 중심은 쪽 한가운데 그대로.
    assert.ok(Math.abs(out.x + out.w / 2 - 0.5) < 1e-9);
    assert.ok(Math.abs(out.y + out.h / 2 - 0.5) < 1e-9);
  });

  it("네 번 돌리면 제자리로 온다", () => {
    const img = { type: "image", x: 0.1, y: 0.25, w: 0.8, h: 0.5, rotate: 0, src: "x" };
    let out = img;
    let a = aspect;
    for (let turn = 0; turn < 4; turn += 1) {
      out = rotateItem(out, 90, a);
      a = 1 / a; // 쪽도 함께 돌았다
    }
    assert.equal(out.rotate, 0);
    for (const key of ["x", "y", "w", "h"]) {
      assert.ok(Math.abs(out[key] - img[key]) < 1e-9, `${key}가 제자리로`);
    }
  });

  it("180°는 상자 모양을 바꾸지 않는다", () => {
    const img = { type: "image", x: 0.1, y: 0.2, w: 0.5, h: 0.4, rotate: 0, src: "x" };
    const out = rotateItem(img, 180, aspect);
    assert.equal(out.rotate, 180);
    assert.ok(Math.abs(out.w - img.w) < 1e-9);
    assert.ok(Math.abs(out.h - img.h) < 1e-9);
  });

  it("이미 돌아가 있던 그림은 더해서 돈다", () => {
    const img = { type: "image", x: 0.2, y: 0.2, w: 0.4, h: 0.4, rotate: 300, src: "x" };
    assert.equal(rotateItem(img, 90, aspect).rotate, 30);
  });

  it("가림 상자는 내용 방향이 없으므로 상자만 돈다", () => {
    const mask = { type: "mosaic", x: 0.1, y: 0.2, w: 0.6, h: 0.3 };
    const out = rotateItem(mask, 90, aspect);
    assert.equal(out.rotate, undefined);
    assert.ok(Math.abs(out.w - mask.h) < 1e-9);
    assert.ok(Math.abs(out.h - mask.w) < 1e-9);
  });

  it("획은 예전 그대로 점을 돌린다", () => {
    const stroke = { type: "pen", width: 2, points: [{ x: 0.2, y: 0.4 }] };
    const out = rotateItem(stroke, 90, aspect);
    assert.deepEqual(out.points, [rotatePoint({ x: 0.2, y: 0.4 }, 90)]);
  });
});
