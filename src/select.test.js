import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resizeStamp, STAMP_ASPECT, STAMP_HEIGHT_CSS, STAMP_WIDTH_CSS } from "./tools.js";
import {
  copyItems,
  deleteSelectedItems,
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
import { cloneItems, createHistory, recordChange, undoChange } from "./history.js";

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

  it("deletes the selection and leaves locked images", () => {
    const image = { type: "image", locked: false, x: 0.1, y: 0.1, w: 0.2, h: 0.2 };
    const locked = { type: "image", locked: true, x: 0.5, y: 0.5, w: 0.2, h: 0.2 };
    const items = [stroke, stamp, image, locked];
    const gone = deleteSelectedItems(items, [0, 1]);
    assert.deepEqual(
      gone.map((item) => item.type),
      ["image", "image"],
    );
    assert.equal(gone[0], image);
    assert.equal(gone[1], locked);
    const mixed = deleteSelectedItems(items, [2, 3]);
    assert.deepEqual(
      mixed.map((item) => item.type),
      ["pen", "stamp", "image"],
    );
    assert.equal(mixed[2], locked);
    const kept = deleteSelectedItems(items, [3]);
    assert.equal(kept, items);
    assert.equal(items.length, 4);
  });

  it("restores deleted items through undo", () => {
    const items = [stroke, stamp];
    const after = deleteSelectedItems(items, [0]);
    const pages = { 1: cloneItems(after) };
    const history = createHistory();
    recordChange(history, { page: 1, before: items, after });
    undoChange(history, pages);
    assert.equal(pages[1].length, 2);
    assert.equal(pages[1][0].type, "pen");
    assert.equal(pages[1][1].type, "stamp");
  });
});
