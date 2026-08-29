import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextRotation, rotateItem90, rotateItems90, rotatePoint90, rotateRect90 } from "./rotate.js";

describe("page rotate 90", () => {
  it("turns item coordinates 90 degrees right and left", () => {
    assert.deepEqual(rotatePoint90({ x: 0.2, y: 0.1 }, "right"), { x: 0.9, y: 0.2 });
    assert.deepEqual(rotatePoint90({ x: 0.2, y: 0.1 }, "left"), { x: 0.1, y: 0.8 });
    assert.deepEqual(rotateRect90({ x: 0.1, y: 0.2, w: 0.4, h: 0.3 }, "right"), {
      x: 0.5,
      y: 0.1,
      w: 0.3,
      h: 0.4,
    });
    assert.deepEqual(rotateRect90({ x: 0.1, y: 0.2, w: 0.4, h: 0.3 }, "left"), {
      x: 0.2,
      y: 0.5,
      w: 0.3,
      h: 0.4,
    });

    const stroke = {
      type: "pen",
      points: [
        { x: 0.25, y: 0.1 },
        { x: 0.25, y: 0.4 },
      ],
    };
    const right = rotateItem90(stroke, "right");
    assert.deepEqual(right.points, [
      { x: 0.9, y: 0.25 },
      { x: 0.6, y: 0.25 },
    ]);
    const stamp = rotateItem90({ type: "stamp", stamp: "승인", x: 0.2, y: 0.3, tilt: 0 }, "right");
    assert.equal(stamp.x, 0.7);
    assert.equal(stamp.y, 0.2);
    assert.ok(Math.abs(stamp.tilt - Math.PI / 2) < 1e-9);
    const image = rotateItem90({ type: "image", id: "a", x: 0.1, y: 0.2, w: 0.2, h: 0.4, turn: 0 }, "left");
    assert.deepEqual({ x: image.x, y: image.y, w: image.w, h: image.h, turn: image.turn }, {
      x: 0.2,
      y: 0.7,
      w: 0.4,
      h: 0.2,
      turn: 270,
    });
    const mosaic = rotateItems90([{ type: "mosaic", x: 0, y: 0, w: 0.5, h: 0.2 }], "right")[0];
    assert.deepEqual({ x: mosaic.x, y: mosaic.y, w: mosaic.w, h: mosaic.h }, { x: 0.8, y: 0, w: 0.2, h: 0.5 });
    assert.equal(nextRotation(0, "right"), 90);
    assert.equal(nextRotation(0, "left"), 270);
  });
});
