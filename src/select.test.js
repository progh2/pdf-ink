import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  copyItems,
  isSelectable,
  itemBounds,
  offsetItems,
  pasteItems,
  pickItemsAt,
  pickItemsInRect,
  selectedBounds,
  translateItem,
  translateItems,
} from "./select.js";

const stroke = {
  type: "pen",
  width: 2,
  points: [
    { x: 0.2, y: 0.2 },
    { x: 0.4, y: 0.2 },
  ],
};
const stamp = { type: "stamp", stamp: "승인", x: 0.7, y: 0.7 };
const erase = { type: "erase", erase: true, eraseMode: "pixel", points: [{ x: 0.1, y: 0.1 }], width: 4 };

describe("선택", () => {
  it("does not treat eraser entries as selectable", () => {
    assert.equal(isSelectable(stroke), true);
    assert.equal(isSelectable(stamp), true);
    assert.equal(isSelectable(erase), false);
  });

  it("grabs a stroke or stamp at a point and in a box", () => {
    const items = [stroke, stamp, erase];
    assert.deepEqual(pickItemsAt(items, { x: 0.3, y: 0.2 }, 400, 600), [0]);
    assert.ok(pickItemsAt(items, { x: 0.7, y: 0.7 }, 400, 600).includes(1));
    assert.deepEqual(pickItemsInRect(items, { x: 0.15, y: 0.15, w: 0.3, h: 0.2 }, 400, 600), [0]);
  });

  it("moves and copies selected items without mutating the source", () => {
    const items = [stroke, stamp];
    const moved = translateItems(items, [0], 0.1, 0.05);
    assert.equal(items[0].points[0].x, 0.2);
    assert.ok(Math.abs(moved[0].points[0].x - 0.3) < 1e-10);
    assert.ok(Math.abs(moved[0].points[0].y - 0.25) < 1e-10);
    assert.equal(moved[1], stamp);
    const copied = copyItems(items, [1], 0.04, 0.04);
    assert.equal(copied.length, 1);
    assert.equal(copied[0].x, 0.74);
    assert.equal(stamp.x, 0.7);
    const pasted = pasteItems(items, copied);
    assert.equal(pasted.length, 3);
    assert.equal(pasted[2].stamp, "승인");
  });

  it("nudges a clipboard paste and unions selected bounds", () => {
    const nudged = offsetItems([translateItem(stamp, 0, 0)], 0.04, 0.04);
    assert.equal(nudged[0].x, 0.74);
    const bounds = selectedBounds([stroke, stamp], [0, 1], 400, 600);
    assert.ok(bounds.w > 0.2);
    assert.ok(itemBounds(stamp, 400, 600).w > 0);
  });
});
