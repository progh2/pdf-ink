import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { BAR_TOOLS } from "./toolbar.js";
import { STAMP_HEIGHT_CSS, STAMP_WIDTH_CSS, stampPaintLayout } from "./tools.js";
import {
  STAMP_GHOST_ALPHA,
  createStampGhost,
  followStampGhost,
  hideStampGhostOnToolChange,
  stampGhostItem,
  stampGhostVisible,
  stampPlaceFromGhost,
} from "./stampGhost.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const main = readFileSync(join(root, "src/main.js"), "utf8");
const inkSrc = readFileSync(join(root, "src/ink.js"), "utf8");
const toolbar = html.slice(html.indexOf('id="toolbar"'), html.indexOf('id="workspace"'));
const paintStampSrc = inkSrc.slice(inkSrc.indexOf("export function paintStamp"), inkSrc.indexOf("export function paintErase"));

describe("#69 stamp ghost 40% 108×64", () => {
  it("uses 40% alpha and the real 108×64 oval with the chosen phrase", () => {
    assert.equal(STAMP_GHOST_ALPHA, 0.4);
    assert.equal(STAMP_WIDTH_CSS, 108);
    assert.equal(STAMP_HEIGHT_CSS, 64);
    const ghost = stampGhostItem("승인", 0.3, 0.4);
    assert.equal(ghost.type, "stamp");
    assert.equal(ghost.ghost, true);
    assert.equal(ghost.alpha, 0.4);
    assert.equal(ghost.stamp, "승인");
    assert.equal(ghost.w, 108);
    assert.equal(ghost.h, 64);
    const layout = stampPaintLayout(ghost.stamp);
    assert.equal(layout.width, 108);
    assert.equal(layout.height, 64);
    assert.ok(layout.rx > layout.ry);
    assert.deepEqual(stampGhostItem("응아냐", 0.1, 0.2).stamp, "응아냐");
    assert.match(paintStampSrc, /item\.ghost/);
    assert.match(paintStampSrc, /STAMP_GHOST_ALPHA/);
    assert.match(inkSrc, /from "\.\/stampGhost\.js"/);
  });

  it("follows the pointer", () => {
    const tracker = createStampGhost();
    tracker.follow({ tool: "stamp", label: "반려", point: { x: 0.2, y: 0.3 } });
    assert.equal(tracker.get().x, 0.2);
    assert.equal(tracker.get().y, 0.3);
    tracker.follow({ tool: "stamp", label: "반려", point: { x: 0.81, y: 0.66 } });
    assert.equal(tracker.get().x, 0.81);
    assert.equal(tracker.get().y, 0.66);
    const moved = followStampGhost(tracker.get(), { x: 0.11, y: 0.22 }, "반려");
    assert.equal(moved.x, 0.11);
    assert.equal(moved.y, 0.22);
    assert.equal(moved.stamp, "반려");
    assert.match(main, /trackStampGhost/);
    assert.match(main, /showStampGhostAt/);
    assert.match(main, /followStampGhost|stampGhostItem/);
    assert.match(main, /onWorkspacePointerMove/);
  });

  it("places the stamp on pointerup where the ghost was", () => {
    const tracker = createStampGhost();
    tracker.follow({ tool: "stamp", label: "진행해", point: { x: 0.55, y: 0.61 } });
    assert.deepEqual(tracker.placePoint(), { x: 0.55, y: 0.61 });
    assert.deepEqual(stampPlaceFromGhost(tracker.get()), { x: 0.55, y: 0.61 });
    assert.equal(stampPlaceFromGhost(null), null);
    const endFn = main.slice(main.indexOf("function endStroke"), main.indexOf("function bindHold"));
    assert.match(endFn, /stampPlaceFromGhost/);
    assert.match(endFn, /placeStamp/);
    assert.doesNotMatch(endFn, /STAMP_TAP_SLOP/);
    assert.match(main, /pendingStamp\.point/);
  });

  it("hides the ghost when the tool changes", () => {
    const tracker = createStampGhost();
    tracker.follow({ tool: "stamp", label: "승인", point: { x: 0.1, y: 0.1 } });
    assert.ok(tracker.get());
    assert.equal(stampGhostVisible("stamp"), true);
    assert.equal(stampGhostVisible("pen"), false);
    assert.equal(stampGhostVisible("stamp", "view"), false);
    tracker.hideIfToolChanged("pen");
    assert.equal(tracker.get(), null);
    tracker.follow({ tool: "stamp", label: "승인", point: { x: 0.1, y: 0.1 } });
    assert.ok(hideStampGhostOnToolChange("stamp", tracker.get()));
    assert.equal(hideStampGhostOnToolChange("eraser", tracker.get()), null);
    assert.equal(hideStampGhostOnToolChange("select", tracker.get()), null);
    tracker.hideIfToolChanged("stamp");
    assert.ok(tracker.get());
    tracker.hide();
    assert.equal(tracker.get(), null);
    const syncFn = main.slice(main.indexOf("function syncToolSelection"), main.indexOf("function setPenOnly"));
    assert.match(syncFn, /clearStampGhost/);
    assert.match(main, /function abortStroke[\s\S]*clearStampGhost/);
  });

  it("does not add a toolbar or capsule cell", () => {
    assert.deepEqual(BAR_TOOLS, [
      "pen",
      "highlighter",
      "pencil",
      "eraser",
      "select",
      "stamp",
      "preview",
      "undo",
      "redo",
      "more",
    ]);
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.match(toolbar, /id="stamp-btn"/);
    assert.doesNotMatch(toolbar, /stamp-ghost|ghost-btn|id="stamp-preview"|#68|rotateHandle|crop-handle/);
    assert.doesNotMatch(html, /id="m4-bar"|id="m4-rail"/);
  });
});
