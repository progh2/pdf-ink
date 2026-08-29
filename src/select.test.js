import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cloneItemsWithOffset, isSelectable, PASTE_OFFSET, translateItem } from "./select.js";

describe("select/copy/paste", () => {
  it("moves and clones items on the same page with an offset", () => {
    const stroke = { type: "pen", points: [{ x: 0.2, y: 0.3 }, { x: 0.4, y: 0.3 }] };
    const stamp = { type: "stamp", stamp: "승인", x: 0.5, y: 0.5 };
    const image = { type: "image", id: "a", x: 0.1, y: 0.1, w: 0.2, h: 0.2, fixed: false };
    const locked = { type: "image", id: "b", x: 0.7, y: 0.7, w: 0.1, h: 0.1, fixed: true };
    assert.equal(isSelectable(stroke), true);
    assert.equal(isSelectable(stamp), true);
    assert.equal(isSelectable(image), true);
    assert.equal(isSelectable(locked), false);
    assert.equal(isSelectable({ type: "mosaic", x: 0, y: 0, w: 0.2, h: 0.2 }), false);
    const moved = translateItem(stroke, 0.05, 0.1);
    assert.deepEqual(moved.points[0], { x: 0.25, y: 0.4 });
    const clones = cloneItemsWithOffset([stroke, stamp]);
    assert.equal(clones[0].points[0].x, stroke.points[0].x + PASTE_OFFSET);
    assert.equal(clones[1].x, stamp.x + PASTE_OFFSET);
    assert.equal(clones[1].y, stamp.y + PASTE_OFFSET);
  });
});
