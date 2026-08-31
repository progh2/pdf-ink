import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { cloneItems, createHistory, recordChange, undoChange } from "./history.js";
import { mosaicItem } from "./mosaic.js";
import {
  bindMarqueeHold,
  MARQUEE_HOLD_MS,
  MARQUEE_MENU_ACTIONS,
  MARQUEE_MENU_HEIGHT,
  MARQUEE_MENU_LABELS,
  placeMarqueeMenu,
} from "./marqueeHold.js";
import {
  copyItemsInRect,
  deleteItemsInRect,
  duplicateItemsInRect,
} from "./select.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "src/style.css"), "utf8");
const main = readFileSync(join(root, "src/main.js"), "utf8");
const toolbar = html.slice(html.indexOf('id="toolbar"'), html.indexOf('id="workspace"'));
const more = html.slice(html.indexOf('id="more-panel"'), html.indexOf('id="image-input"'));
const marquee = html.slice(html.indexOf('id="marquee"'), html.indexOf('id="select-layer"'));
const hud = html.slice(html.indexOf('id="float-bar"'), html.indexOf('id="shape-chips"'));

function createClock() {
  let now = 0;
  const timers = new Map();
  let nextId = 1;
  return {
    now: () => now,
    setTimeoutFn: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { fn, at: now + ms });
      return id;
    },
    clearTimeoutFn: (id) => {
      timers.delete(id);
    },
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.fn();
        }
      }
    },
  };
}

function createEl() {
  const el = new EventTarget();
  el.setPointerCapture = () => {};
  return el;
}

const stroke = {
  type: "pen",
  width: 2,
  points: [
    { x: 0.2, y: 0.2 },
    { x: 0.4, y: 0.2 },
  ],
};
const stamp = { type: "stamp", stamp: "승인", x: 0.7, y: 0.7 };
const outside = {
  type: "pen",
  width: 2,
  points: [
    { x: 0.9, y: 0.9 },
    { x: 0.95, y: 0.95 },
  ],
};

describe("#71 영역 선택 유지·메뉴", () => {
  it("keeps a 400ms paper menu of 복사·복제·삭제·캡처·마스킹 at height 44", () => {
    assert.equal(MARQUEE_HOLD_MS, 400);
    assert.equal(MARQUEE_MENU_HEIGHT, 44);
    assert.deepEqual(MARQUEE_MENU_ACTIONS, ["copy", "duplicate", "delete", "capture", "mosaic"]);
    assert.deepEqual(
      MARQUEE_MENU_ACTIONS.map((key) => MARQUEE_MENU_LABELS[key]),
      ["복사", "복제", "삭제", "캡처", "마스킹"],
    );
    assert.match(marquee, /data-marquee="copy">복사/);
    assert.match(marquee, /data-marquee="duplicate">복제/);
    assert.match(marquee, /data-marquee="delete">삭제/);
    assert.match(marquee, /data-marquee="capture">캡처/);
    assert.match(marquee, /data-marquee="mosaic">마스킹/);
    assert.match(marquee, /data-marquee="link">연결/);
    assert.doesNotMatch(marquee, /id="capture-confirm"|marquee-confirm/);
    assert.doesNotMatch(hud, /data-marquee=/);
    assert.match(css, /\.marquee-menu \{[\s\S]*height: 44px/);
    assert.match(css, /\.marquee-menu button \{[\s\S]*height: 44px/);
    assert.match(main, /bindMarqueeHold\(els\.marqueeBox/);
    assert.match(main, /from "\.\/marqueeHold\.js"/);
    assert.match(main, /event\.key === "Escape" && state\.pendingCapture/);
    assert.match(main, /hideMarquee\(\)/);
  });

  it("starts from the select box, keeps it on lift, and drops ⋯ 마스킹 (#110)", () => {
    const endRect = main.slice(main.indexOf("function endRect"), main.indexOf("function startSelect"));
    const captureEnd = endRect.slice(endRect.indexOf('rectTool === "capture"'));
    // #110: the box now comes from the select cell, not a ⋯ row.
    assert.doesNotMatch(more, /영역캡처|data-more="capture"/);
    assert.match(html, /data-tool="select"/);
    assert.doesNotMatch(more, /마스킹\(모자이크\)|data-more="mosaic"/);
    assert.doesNotMatch(toolbar, /영역캡처|마스킹|data-more="capture"|data-marquee=/);
    assert.match(captureEnd, /state\.pendingCapture = \{ page, rect \}/);
    assert.doesNotMatch(captureEnd, /hideMarquee\(\)/);
    assert.match(captureEnd, /updateMarquee\(\)/);
    assert.doesNotMatch(html, /id="capture-confirm"/);
    assert.doesNotMatch(main, /captureConfirm|capture-confirm/);
    assert.match(main, /if \(action !== "capture"\)/);
  });

  it("does not mix the paper menu with #float-bar or add a toolbar cell", () => {
    assert.match(html, /id="float-bar"/);
    assert.doesNotMatch(marquee, /float-bar|select-hud/);
    assert.doesNotMatch(toolbar, /id="marquee-menu"|data-marquee=/);
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.match(main, /function copyRegion/);
    assert.match(main, /function duplicateRegion/);
    assert.match(main, /function deleteRegion/);
    assert.match(main, /function mosaicRegion/);
    assert.match(main, /confirmCapture/);
    assert.doesNotMatch(hud, /연결|data-marquee="link"/);
  });

  it("fires the menu at 400ms or on right-click, not before", () => {
    const clock = createClock();
    const el = createEl();
    let holds = 0;
    bindMarqueeHold(el, {
      onHold: () => {
        holds += 1;
      },
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    el.dispatchEvent(Object.assign(new Event("pointerdown"), { button: 0, pointerId: 1, clientX: 10, clientY: 10 }));
    clock.advance(399);
    assert.equal(holds, 0);
    clock.advance(1);
    assert.equal(holds, 1);
    el.dispatchEvent(Object.assign(new Event("contextmenu"), { clientX: 10, clientY: 10 }));
    assert.equal(holds, 1);

    const el2 = createEl();
    let early = 0;
    const clock2 = createClock();
    bindMarqueeHold(el2, {
      onHold: () => {
        early += 1;
      },
      setTimeoutFn: clock2.setTimeoutFn,
      clearTimeoutFn: clock2.clearTimeoutFn,
    });
    el2.dispatchEvent(Object.assign(new Event("pointerdown"), { button: 0, pointerId: 2, clientX: 4, clientY: 4 }));
    clock2.advance(200);
    el2.dispatchEvent(Object.assign(new Event("pointerup"), { pointerId: 2 }));
    clock2.advance(400);
    assert.equal(early, 0);
    el2.dispatchEvent(new Event("contextmenu"));
    assert.equal(early, 1);
  });

  it("fires onTap on a short lift, not after a hold", () => {
    const clock = createClock();
    const el = createEl();
    let taps = 0;
    let holds = 0;
    bindMarqueeHold(el, {
      onHold: () => {
        holds += 1;
      },
      onTap: () => {
        taps += 1;
      },
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    el.dispatchEvent(Object.assign(new Event("pointerdown"), { button: 0, pointerId: 3, clientX: 8, clientY: 8 }));
    clock.advance(100);
    el.dispatchEvent(Object.assign(new Event("pointerup"), { pointerId: 3 }));
    assert.equal(taps, 1);
    assert.equal(holds, 0);

    el.dispatchEvent(Object.assign(new Event("pointerdown"), { button: 0, pointerId: 4, clientX: 8, clientY: 8 }));
    clock.advance(400);
    el.dispatchEvent(Object.assign(new Event("pointerup"), { pointerId: 4 }));
    assert.equal(holds, 1);
    assert.equal(taps, 1);
  });

  it("keeps the menu on the paper", () => {
    const paper = { left: 40, top: 80, width: 200, height: 300 };
    const below = placeMarqueeMenu({ left: 50, top: 100, width: 80, height: 40 }, paper, 160);
    assert.equal(below.left, 50);
    assert.equal(below.top, 148);
    const flipped = placeMarqueeMenu({ left: 50, top: 330, width: 80, height: 40 }, paper, 160);
    assert.ok(flipped.top + 44 <= 380);
    assert.ok(flipped.left >= 40);
    assert.ok(flipped.left + 160 <= 240);
  });

  it("copies, duplicates, deletes, and mosaics items in the region, and undo restores delete", () => {
    const items = [stroke, stamp, outside];
    const rect = { x: 0.15, y: 0.15, w: 0.3, h: 0.2 };
    const copied = copyItemsInRect(items, rect, 400, 600);
    assert.equal(copied.length, 1);
    assert.equal(copied[0].type, "pen");
    assert.equal(items[0].points[0].x, 0.2);
    const duped = duplicateItemsInRect(items, rect, 400, 600);
    assert.equal(duped.length, 4);
    assert.ok(Math.abs(duped[3].points[0].x - 0.24) < 1e-10);
    assert.equal(duped[1], stamp);
    const gone = deleteItemsInRect(items, rect, 400, 600);
    assert.deepEqual(
      gone.map((item) => item.type),
      ["stamp", "pen"],
    );
    const pages = { 1: cloneItems(gone) };
    const history = createHistory();
    recordChange(history, { page: 1, before: items, after: gone });
    undoChange(history, pages);
    assert.equal(pages[1].length, 3);
    assert.equal(pages[1][0].type, "pen");
    const masked = items.concat([mosaicItem(rect)]);
    assert.equal(masked[masked.length - 1].type, "mosaic");
    assert.equal(masked[masked.length - 1].x, rect.x);
    assert.match(main, /mosaicItem\(ctx\.pending\.rect, MOSAIC_CELL_CSS\)/);
    assert.match(main, /commitPageChange\(ctx\.pending\.page/);
  });
});
