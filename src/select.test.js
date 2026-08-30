import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resizeStamp, STAMP_ASPECT, STAMP_HEIGHT_CSS, STAMP_WIDTH_CSS } from "./tools.js";
import { cloneItems, createHistory, recordChange, undoChange } from "./history.js";
import {
  copyItems,
  deleteItems,
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
    assert.equal(isSelectable({ type: "image", locked: true }), false);
    assert.equal(isSelectable({ type: "image", locked: false }), true);
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
    const box = itemBounds({ ...stamp, w: STAMP_WIDTH_CSS, h: STAMP_HEIGHT_CSS }, 400, 600);
    assert.ok(Math.abs(box.w * 400 / (box.h * 600) - STAMP_ASPECT) < 1e-6);
    const grown = resizeStamp({ ...stamp, w: STAMP_WIDTH_CSS, h: STAMP_HEIGHT_CSS }, "se", { x: 0.9, y: 0.85 }, 400, 600);
    assert.ok(Math.abs(grown.w / grown.h - STAMP_ASPECT) < 1e-6);
  });

  it("deletes the current selection and undo restores it", () => {
    const items = [stroke, stamp, { type: "image", locked: false, x: 0.1, y: 0.1, w: 0.2, h: 0.2 }];
    const next = deleteItems(items, [0, 2]);
    assert.equal(next.length, 1);
    assert.equal(next[0], stamp);
    assert.equal(items.length, 3);

    const pages = { 1: cloneItems(items) };
    const history = createHistory();
    const before = cloneItems(pages[1]);
    pages[1] = deleteItems(pages[1], [1]);
    recordChange(history, { page: 1, before, after: pages[1] });
    assert.equal(pages[1].length, 2);
    undoChange(history, pages);
    assert.equal(pages[1].length, 3);
    assert.equal(pages[1][1].stamp, "승인");
  });

  it("does not delete a locked image", () => {
    const locked = { type: "image", locked: true, x: 0.1, y: 0.1, w: 0.2, h: 0.2 };
    const items = [stroke, locked, stamp];
    const next = deleteItems(items, [0, 1, 2]);
    assert.equal(next.length, 1);
    assert.equal(next[0], locked);
    assert.ok(itemBounds(locked, 400, 600));
    assert.equal(isSelectable(locked), false);
  });
});
