import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { cloneItems, createHistory, recordChange, undoChange } from "./history.js";
import { M4_OVERFLOW_ITEMS } from "./interact.js";
import { MOSAIC_CELL_CSS, mosaicItem } from "./mosaic.js";
import {
  REGION_HOLD_MS,
  REGION_MENU_ACTIONS,
  REGION_MENU_HEIGHT,
  REGION_MENU_LABELS,
  applyRegionMosaic,
  copyRegionItems,
  createRegionHold,
  deleteRegionItems,
  duplicateOffsetForRect,
  duplicateRegionItems,
  persistCaptureAfterUp,
} from "./regionMenu.js";
import { BAR_OVERFLOW_ITEMS, BAR_TOOLS } from "./toolbar.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "src/style.css"), "utf8");
const main = readFileSync(join(root, "src/main.js"), "utf8");
const toolbar = html.slice(html.indexOf('id="toolbar"'), html.indexOf('id="workspace"'));
const more = html.slice(html.indexOf('id="more-panel"'), html.indexOf('id="image-input"'));
const floatBar = html.slice(html.indexOf('id="float-bar"'), html.indexOf('id="shape-chips"'));
const regionMenu = html.slice(html.indexOf('id="region-menu"'), html.indexOf('id="select-layer"'));
const endRect = main.slice(main.indexOf("function endRect"), main.indexOf("function startSelect"));
const captureBranch = endRect.slice(endRect.indexOf('rectTool === "capture"'));

const stroke = {
  type: "pen",
  width: 2,
  points: [
    { x: 0.2, y: 0.2 },
    { x: 0.4, y: 0.2 },
  ],
};
const stamp = { type: "stamp", stamp: "승인", x: 0.7, y: 0.7 };
const region = { x: 0.15, y: 0.15, w: 0.3, h: 0.2 };

describe("#71 persist-after-up", () => {
  it("keeps the capture region after pointerup", () => {
    const kept = persistCaptureAfterUp("capture", 2, region);
    assert.equal(kept.persist, true);
    assert.deepEqual(kept.pending, { page: 2, rect: region });
    assert.equal(persistCaptureAfterUp("mosaic", 2, region).persist, false);
    assert.match(endRect, /persistCaptureAfterUp/);
    assert.match(captureBranch, /pendingCapture/);
    assert.doesNotMatch(captureBranch, /hideMarquee/);
    assert.doesNotMatch(endRect, /rectTool = null/);
    assert.match(main, /els\.marquee\.classList\.toggle\("is-pending"/);
  });
});

describe("#71 region menu items", () => {
  it("opens a paper-only 복사·복제·삭제·캡처·마스킹 menu", () => {
    assert.equal(REGION_HOLD_MS, 400);
    assert.equal(REGION_MENU_HEIGHT, 44);
    assert.deepEqual(REGION_MENU_ACTIONS, ["copy", "duplicate", "delete", "capture", "mosaic"]);
    assert.deepEqual(
      REGION_MENU_ACTIONS.map((action) => REGION_MENU_LABELS[action]),
      ["복사", "복제", "삭제", "캡처", "마스킹"],
    );
    assert.match(html, /id="region-menu"/);
    assert.match(regionMenu, /data-region="copy">복사/);
    assert.match(regionMenu, /data-region="duplicate">복제/);
    assert.match(regionMenu, /data-region="delete">삭제/);
    assert.match(regionMenu, /data-region="capture">캡처/);
    assert.match(regionMenu, /data-region="mosaic">마스킹/);
    assert.ok(regionMenu.indexOf("복사") < regionMenu.indexOf("복제"));
    assert.ok(regionMenu.indexOf("복제") < regionMenu.indexOf("삭제"));
    assert.ok(regionMenu.indexOf("삭제") < regionMenu.indexOf("캡처"));
    assert.ok(regionMenu.indexOf("캡처") < regionMenu.indexOf("마스킹"));
    assert.doesNotMatch(regionMenu, /연결/);
    assert.doesNotMatch(regionMenu, /float-bar|select-hud/);
    assert.doesNotMatch(floatBar, /id="region-menu"|data-region=/);
    assert.doesNotMatch(floatBar, /복제|캡처|마스킹/);
    assert.match(css, /\.region-menu \{[\s\S]*height: 44px/);
    assert.match(css, /\.region-menu button \{[\s\S]*height: 44px/);
    assert.match(main, /createRegionHold\(/);
    assert.match(main, /REGION_HOLD_MS/);
    assert.match(main, /contextmenu/);
    assert.match(main, /showRegionMenu/);
    assert.match(main, /event\.key === "Escape"/);
    const copied = copyRegionItems([stroke, stamp], region, 400, 600);
    assert.equal(copied.length, 1);
    assert.equal(copied[0].type, "pen");
    assert.equal(stroke.points[0].x, 0.2);
    const offset = duplicateOffsetForRect(region);
    assert.equal(offset.dx, region.w);
    assert.equal(offset.dy, 0);
    const duped = duplicateRegionItems([stroke, stamp], region, 400, 600);
    assert.equal(duped.length, 3);
    assert.equal(duped[2].type, "pen");
    assert.ok(Math.abs(duped[2].points[0].x - (0.2 + region.w)) < 1e-10);
  });

  it("opens the menu after a 400ms hold and not after a short tap", () => {
    let now = 0;
    const timers = new Map();
    let nextId = 1;
    const hold = createRegionHold({
      holdMs: REGION_HOLD_MS,
      setTimeoutFn: (fn, ms) => {
        const id = nextId++;
        timers.set(id, { fn, at: now + ms });
        return id;
      },
      clearTimeoutFn: (id) => {
        timers.delete(id);
      },
    });
    const opened = [];
    hold.begin({ button: 0, clientX: 40, clientY: 50 }, (point) => opened.push(point));
    now = 399;
    for (const [id, timer] of [...timers]) {
      if (timer.at <= now) {
        timers.delete(id);
        timer.fn();
      }
    }
    assert.equal(opened.length, 0);
    now = 400;
    for (const [id, timer] of [...timers]) {
      if (timer.at <= now) {
        timers.delete(id);
        timer.fn();
      }
    }
    assert.equal(opened.length, 1);
    assert.equal(opened[0].x, 40);
    assert.equal(opened[0].y, 50);
  });
});

describe("#71 undo after delete", () => {
  it("removes items in the region and restores them on undo", () => {
    const items = [stroke, stamp];
    const after = deleteRegionItems(items, region, 400, 600);
    assert.equal(after.length, 1);
    assert.equal(after[0], stamp);
    assert.equal(items.length, 2);
    const pages = { 1: cloneItems(after) };
    const history = createHistory();
    recordChange(history, { page: 1, before: items, after });
    undoChange(history, pages);
    assert.equal(pages[1].length, 2);
    assert.equal(pages[1][0].type, "pen");
    assert.match(main, /function deleteRegion/);
    assert.match(main, /deleteRegionItems/);
    assert.match(main, /commitPageChange\(ctx\.pageNum/);
  });
});

describe("#71 capture-confirm removed", () => {
  it("drops #capture-confirm and writes PNG only from 캡처", () => {
    assert.doesNotMatch(html, /id="capture-confirm"|capture-confirm|marquee-confirm/);
    assert.doesNotMatch(main, /captureConfirm|captureConfirmArmedAt/);
    assert.doesNotMatch(css, /marquee-confirm/);
    assert.match(html, /data-region="capture">캡처/);
    assert.match(main, /writePngClipboard/);
    assert.doesNotMatch(main, /clipboard\.read|clipboard-read/);
    assert.equal((main.match(/writePngClipboard/g) || []).length, 2);
  });
});

describe("#71 no extra toolbar cells and ⋯ drops mosaic", () => {
  it("keeps the bar cells and removes 마스킹 from ⋯", () => {
    assert.deepEqual(BAR_TOOLS, [
      "pen",
      "highlighter",
      "pencil",
      "eraser",
      "select",
      "stamp",
      "undo",
      "redo",
      "more",
    ]);
    assert.deepEqual(M4_OVERFLOW_ITEMS, [
      "capture",
      "fullscreen",
      "image",
      "rotate",
      "preview",
      "save",
      "export",
    ]);
    assert.deepEqual(BAR_OVERFLOW_ITEMS, M4_OVERFLOW_ITEMS);
    assert.doesNotMatch(more, /마스킹|data-more="mosaic"/);
    assert.match(more, /영역캡처/);
    assert.doesNotMatch(toolbar, /region-menu|data-region=|복제|캡처|마스킹/);
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.doesNotMatch(html, /연결/);
    assert.match(main, /action !== "capture"/);
    assert.doesNotMatch(main.slice(main.indexOf("function selectMoreAction"), main.indexOf("async function toggleFullscreen")), /action === "mosaic"/);
  });

  it("applies the same mosaic item as the old ⋯ mosaic", () => {
    const items = [stroke];
    const next = applyRegionMosaic(items, region);
    assert.equal(items.length, 1);
    assert.equal(next.length, 2);
    assert.deepEqual(next[1], mosaicItem(region, MOSAIC_CELL_CSS));
    assert.match(main, /applyRegionMosaic/);
  });
});
