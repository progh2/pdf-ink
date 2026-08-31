import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { resizeStamp, STAMP_ASPECT, STAMP_HEIGHT_CSS, STAMP_WIDTH_CSS } from "./tools.js";
import {
  copyItems,
  deleteSelectedItems,
  isSelectable,
  itemBounds,
  lockedImageAt,
  offsetItems,
  pasteItems,
  pickItemsAt,
  pickItemsInRect,
  ROTATE_HANDLE_COLOR,
  ROTATE_HANDLE_GAP_CSS,
  ROTATE_HANDLE_SIZE_CSS,
  ROTATE_HANDLE_STROKE_CSS,
  isStrokeItem,
  rotateHandleAt,
  rotateHandleCenter,
  selectedBounds,
  selectHudTop,
  strokeHitsPoint,
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

  it("places a rotate handle above the selection box and wraps a rotated image", () => {
    assert.equal(ROTATE_HANDLE_SIZE_CSS, 16);
    assert.equal(ROTATE_HANDLE_STROKE_CSS, 1.6);
    assert.equal(ROTATE_HANDLE_GAP_CSS, 20);
    assert.equal(ROTATE_HANDLE_COLOR, "#2C2A26");
    const bounds = { x: 0.2, y: 0.2, w: 0.4, h: 0.3 };
    const handle = rotateHandleCenter(bounds, 600);
    assert.ok(Math.abs(handle.x - 0.4) < 1e-10);
    assert.ok(Math.abs(handle.y - (0.2 - 20 / 600)) < 1e-10);
    assert.equal(rotateHandleAt(bounds, handle, 400, 600), "rotate");
    assert.equal(rotateHandleAt(bounds, { x: 0.4, y: 0.35 }, 400, 600), null);
    const image = { type: "image", x: 0.3, y: 0.4, w: 0.4, h: 0.2, locked: false, rotate: 90 };
    const box = itemBounds(image, 400, 400);
    assert.ok(Math.abs(box.w - 0.2) < 1e-10);
    assert.ok(Math.abs(box.h - 0.4) < 1e-10);
    assert.ok(Math.abs(box.x + box.w / 2 - 0.5) < 1e-10);
    assert.ok(Math.abs(box.y + box.h / 2 - 0.5) < 1e-10);
    assert.equal(itemBounds({ type: "image", locked: true, x: 0.2, y: 0.2, w: 0.2, h: 0.2 }), null);
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

describe("첫 사용 선택 (#86)", () => {
  const curve = {
    type: "pen",
    width: 2,
    points: [
      { x: 0.2, y: 0.2 },
      { x: 0.5, y: 0.5 },
      { x: 0.8, y: 0.2 },
    ],
  };

  it("grabs a thin stroke tapped a few px off the ink", () => {
    const hair = { type: "pen", width: 1, points: [{ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 }] };
    assert.equal(strokeHitsPoint(hair, { x: 0.5, y: 0.5 }, 400, 600), true);
    // 3 css px below the ink on a 600 css px page.
    assert.equal(strokeHitsPoint(hair, { x: 0.5, y: 0.505 }, 400, 600), true);
    assert.deepEqual(pickItemsAt([hair], { x: 0.5, y: 0.505 }, 400, 600), [0]);
  });

  it("does not grab the empty middle of a curve's box", () => {
    assert.equal(strokeHitsPoint(curve, { x: 0.5, y: 0.22 }, 400, 600), false);
    assert.deepEqual(pickItemsAt([curve], { x: 0.5, y: 0.22 }, 400, 600), []);
    assert.equal(strokeHitsPoint(curve, { x: 0.5, y: 0.5 }, 400, 600), true);
  });

  it("still grabs the stamp by its box", () => {
    const items = [curve, stamp];
    assert.deepEqual(pickItemsAt(items, { x: 0.7, y: 0.7 }, 400, 600), [1]);
    assert.equal(isStrokeItem(curve), true);
    assert.equal(isStrokeItem(stamp), false);
  });

  it("marquee still uses the box, so a curve is caught by a box over it", () => {
    assert.deepEqual(pickItemsInRect([curve], { x: 0.1, y: 0.1, w: 0.8, h: 0.6 }, 400, 600), [0]);
  });

  it("puts the float bar under the selection when it fits", () => {
    assert.deepEqual(selectHudTop({ top: 100, bottom: 200 }, 56, 800), { top: 208, placement: "below" });
  });

  it("flips the float bar above a selection near the bottom", () => {
    const spot = selectHudTop({ top: 600, bottom: 760 }, 56, 800);
    assert.equal(spot.placement, "above");
    assert.equal(spot.top, 536);
    assert.ok(spot.top + 56 <= 600, "bar must not cover the object");
  });

  it("clamps only when the selection fills the screen", () => {
    const spot = selectHudTop({ top: 0, bottom: 800 }, 56, 800);
    assert.equal(spot.placement, "clamped");
    assert.ok(spot.top >= 8 && spot.top + 56 <= 800);
  });
});

describe("#104 고정한 이미지 집기", () => {
  const locked = { type: "image", locked: true, x: 0.2, y: 0.2, w: 0.4, h: 0.3, src: "x" };
  const free = { type: "image", locked: false, x: 0.6, y: 0.6, w: 0.2, h: 0.2, src: "y" };

  it("finds a locked image under the finger, but only a locked one", () => {
    const items = [locked, free, stroke];
    assert.equal(lockedImageAt(items, { x: 0.3, y: 0.3 }, 400, 600), 0);
    assert.equal(lockedImageAt(items, { x: 0.65, y: 0.65 }, 400, 600), -1, "a free image is not this menu's job");
    assert.equal(lockedImageAt(items, { x: 0.95, y: 0.05 }, 400, 600), -1);
  });

  it("still refuses to select it, so the lock keeps holding", () => {
    assert.equal(isSelectable(locked), false);
    assert.deepEqual(pickItemsAt([locked], { x: 0.3, y: 0.3 }, 400, 600), []);
  });

  it("takes the topmost when locked images overlap", () => {
    const under = { ...locked, src: "under" };
    const over = { ...locked, src: "over" };
    assert.equal(lockedImageAt([under, over], { x: 0.3, y: 0.3 }, 400, 600), 1);
  });
});

describe("#104 배선", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const main = readFileSync(join(here, "main.js"), "utf8");
  const html = readFileSync(join(here, "..", "index.html"), "utf8");

  it("arms the hold only for the select tool in edit mode", () => {
    assert.match(main, /function armLockHold[\s\S]*state\.tool !== "select" \|\| state\.interactMode === "view"/);
    assert.match(main, /lockedImageAt\(items, point, cssW, cssH\)/);
    assert.match(main, /PAGE_HOLD_MS/);
  });

  it("unlocks through the menu and records it for undo", () => {
    assert.match(html, /data-lock-menu="unlock">고정 해제/);
    assert.match(main, /function unlockFromMenu[\s\S]*commitPageChange/);
    assert.match(main, /lockImage\(item, false\)/);
    // The freed image is selected right away, ready for the #68 handle.
    assert.match(main, /state\.selectIndices = \[spot\.index\]/);
  });

  it("drops the hold only once the finger really travels (#109)", () => {
    // A still finger still emits pointermove, so cancelling on any move meant
    // the menu never appeared.
    assert.match(main, /function moveSelect\(event\) \{\s*cancelLockHoldIfMoved\(event\)/);
    assert.match(main, /function endSelect\(event\) \{[\s\S]{0,200}cancelLockHold\(\)/);
    assert.match(main, /function movePan\(event\) \{\s*cancelLockHold\(\)/);
    assert.match(main, /function cancelLockHoldIfMoved[\s\S]*> slopPx/);
    assert.match(main, /lockHoldFrom = at;/);
  });
});

describe("#110 선택 칸이 영역캡처를 겸함", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const main = readFileSync(join(here, "main.js"), "utf8");
  const html = readFileSync(join(here, "..", "index.html"), "utf8");

  it("leaves an area only when the box caught nothing", () => {
    const end = main.slice(main.indexOf("function endSelect"), main.indexOf("function moveSelect"));
    const marquee = main.slice(main.indexOf('if (drag.mode === "marquee")'));
    assert.match(marquee, /boxed && !state\.selectIndices\.length/);
    assert.match(marquee, /state\.pendingCapture = \{ page: drag\.page, rect \}/);
    assert.ok(end.length >= 0);
  });

  it("keeps the ⋯ card free of 영역캡처 and adds no bar cell", () => {
    assert.doesNotMatch(html, /data-more="capture"/);
    assert.match(html, /data-tool="select"/);
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
  });

  it("still selects when the box catches something", () => {
    const items = [stroke, stamp];
    assert.deepEqual(pickItemsInRect(items, { x: 0.15, y: 0.15, w: 0.3, h: 0.2 }, 400, 600), [0]);
  });
});
