import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  PAGE_HOLD_MS,
  PAGE_MENU_ACTIONS,
  PAGE_MENU_LABELS,
  canPastePage,
  copyPageLeaf,
  dropIndexAt,
  dropLineTop,
  duplicatePageLeaf,
  movePageLeaf,
  newInkId,
  pastePageLeaf,
  placePageMenu,
  reorderPageLeaf,
  rotatePageLeaf,
} from "./pageOps.js";
import { inkKey, makeOutlineLeaf, makePdfLeaf, normalizeLeaves } from "./preview.js";

function threePages() {
  return [makePdfLeaf(1), makePdfLeaf(2), makePdfLeaf(3)];
}

const stroke = { type: "pen", width: 2, points: [{ x: 0.2, y: 0.2 }] };

describe("#55 미리보기 페이지 조작", () => {
  it("locks the menu to the issue list, no new bar cell", () => {
    assert.deepEqual(PAGE_MENU_ACTIONS, ["copy", "paste", "duplicate", "up", "down", "left", "right"]);
    assert.equal(PAGE_MENU_LABELS.duplicate, "복제");
    assert.equal(PAGE_HOLD_MS, 400);
  });

  it("moves a page up and down, and does nothing at the ends", () => {
    const leaves = threePages();
    assert.deepEqual(movePageLeaf(leaves, 2, -1).map((leaf) => leaf.pdfPage), [1, 3, 2]);
    assert.deepEqual(movePageLeaf(leaves, 0, 1).map((leaf) => leaf.pdfPage), [2, 1, 3]);
    assert.deepEqual(movePageLeaf(leaves, 0, -1).map((leaf) => leaf.pdfPage), [1, 2, 3]);
    assert.deepEqual(movePageLeaf(leaves, 2, 1).map((leaf) => leaf.pdfPage), [1, 2, 3]);
    assert.deepEqual(leaves.map((leaf) => leaf.pdfPage), [1, 2, 3], "source list untouched");
  });

  it("drags a page to any slot", () => {
    const leaves = threePages();
    assert.deepEqual(reorderPageLeaf(leaves, 0, 2).map((leaf) => leaf.pdfPage), [2, 3, 1]);
    assert.deepEqual(reorderPageLeaf(leaves, 2, 0).map((leaf) => leaf.pdfPage), [3, 1, 2]);
  });

  it("turns one page without touching the others", () => {
    const leaves = threePages();
    const right = rotatePageLeaf(leaves, 1, 90);
    assert.deepEqual(right.map((leaf) => leaf.rotate), [0, 90, 0]);
    assert.deepEqual(rotatePageLeaf(right, 1, -90).map((leaf) => leaf.rotate), [0, 0, 0]);
    assert.deepEqual(rotatePageLeaf(right, 1, 270).map((leaf) => leaf.rotate), [0, 0, 0]);
  });

  it("duplicates the page with its ink, but not shared ink", () => {
    const leaves = threePages();
    const pages = { 2: [stroke] };
    const out = duplicatePageLeaf(leaves, pages, 1);
    assert.deepEqual(out.leaves.map((leaf) => leaf.pdfPage), [1, 2, 2, 3]);
    const copy = out.leaves[2];
    assert.notEqual(copy.id, leaves[1].id);
    assert.notEqual(inkKey(copy), inkKey(leaves[1]));
    assert.deepEqual(out.pages[inkKey(copy)], [stroke]);
    // Writing on the copy must not touch the original.
    out.pages[inkKey(copy)].push({ type: "pen", width: 1, points: [] });
    assert.equal(out.pages[2].length, 1);
  });

  it("copies and pastes a page after the chosen one", () => {
    const leaves = threePages();
    const pages = { 1: [stroke] };
    const clip = copyPageLeaf(leaves, pages, 0);
    assert.equal(canPastePage(clip), true);
    assert.equal(canPastePage(null), false);
    const out = pastePageLeaf(leaves, pages, 2, clip);
    assert.deepEqual(out.leaves.map((leaf) => leaf.pdfPage), [1, 2, 3, 1]);
    assert.deepEqual(out.pages[out.key], [stroke]);
    assert.equal(out.at, 3);
    // The clipboard survives a later change to the source page.
    pages[1].push(stroke);
    assert.equal(clip.items.length, 1);
  });

  it("copies an outline leaf as its own blank page", () => {
    const leaves = [makePdfLeaf(1), makeOutlineLeaf("note", { title: "메모" })];
    const pages = { "o:note": [stroke] };
    const out = duplicatePageLeaf(leaves, pages, 1);
    const copy = out.leaves[2];
    assert.equal(copy.kind, "outline");
    assert.equal(copy.title, "메모");
    assert.notEqual(copy.id, leaves[1].id);
    assert.deepEqual(out.pages[inkKey(copy)], [stroke]);
  });

  it("survives a reload: duplicates keep their own ink after normalize", () => {
    const out = duplicatePageLeaf(threePages(), { 2: [stroke] }, 1);
    const reloaded = normalizeLeaves(out.leaves, 3);
    assert.deepEqual(reloaded.map((leaf) => leaf.pdfPage), [1, 2, 2, 3]);
    assert.equal(new Set(reloaded.map((leaf) => leaf.id)).size, 4);
    assert.equal(inkKey(reloaded[1]), "2");
    assert.equal(inkKey(reloaded[2]), inkKey(out.leaves[2]));
  });

  it("hands out a fresh ink id every time", () => {
    assert.notEqual(newInkId(), newInkId());
  });
});

describe("#55 서랍 드래그·메뉴 자리", () => {
  it("drops into the slot the finger is over", () => {
    const geom = { listTop: 100, scrollTop: 0, stride: 175, count: 5 };
    assert.equal(dropIndexAt({ ...geom, pointerY: 100 }), 0);
    assert.equal(dropIndexAt({ ...geom, pointerY: 280 }), 1);
    assert.equal(dropIndexAt({ ...geom, pointerY: 640 }), 3);
    // Scrolled list counts the scroll.
    assert.equal(dropIndexAt({ ...geom, pointerY: 105, scrollTop: 350 }), 2);
  });

  it("keeps the drop inside the list", () => {
    const geom = { listTop: 100, scrollTop: 0, stride: 175, count: 3 };
    assert.equal(dropIndexAt({ ...geom, pointerY: -500 }), 0);
    assert.equal(dropIndexAt({ ...geom, pointerY: 9000 }), 2);
    assert.equal(dropIndexAt({ pointerY: 200, listTop: 0, scrollTop: 0, stride: 0, count: 3 }), 0);
    assert.equal(dropLineTop(2, 175), 350);
    assert.equal(dropLineTop(-1, 175), 0);
  });

  it("puts the menu beside the drawer and never off screen", () => {
    const top = placePageMenu(200, 120, 800, 7);
    assert.equal(top.left, 128);
    assert.equal(top.top, 200);
    assert.equal(top.height, 7 * 44);
    // A row near the bottom slides the menu up instead of hanging off.
    assert.equal(placePageMenu(760, 120, 800, 7).top, 800 - 308 - 8);
    assert.equal(placePageMenu(-40, 120, 800, 7).top, 8);
  });
});

describe("#55 서랍 배선", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const main = readFileSync(join(here, "main.js"), "utf8");
  const css = readFileSync(join(here, "style.css"), "utf8");
  const html = readFileSync(join(here, "..", "index.html"), "utf8");

  it("keeps the drawer at 120 / thumb 88 / gap 8 and adds no bar cell", () => {
    assert.match(css, /\.preview-drawer \{[\s\S]*width: 120px/);
    assert.match(css, /\.preview-thumb \{[\s\S]*width: 88px[\s\S]*height: 117px/);
    assert.match(css, /\.preview-list-window \{[\s\S]*gap: 8px/);
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.doesNotMatch(html, /data-tool="pageops"|data-more="pageops"/);
  });

  it("puts every locked action in the page menu", () => {
    for (const action of PAGE_MENU_ACTIONS) {
      assert.match(html, new RegExp(`data-page-menu="${action}"`), action);
    }
    assert.match(main, /function runPageMenu/);
    assert.match(main, /rotatePageAt\(pageNum, action === "left" \? -90 : 90\)/);
  });

  it("moves the ink with the page and records both for undo", () => {
    // Page ops go through the leaf ink key, and the history entry carries leaves.
    assert.match(main, /function commitLeafChange\(key, apply\)[\s\S]*leavesBefore/);
    assert.match(main, /commitLeafChange\(out\.key, \(\) => \{[\s\S]*state\.pages = out\.pages/);
    assert.match(main, /commitLeafChange\(inkKey\(leaf\), \(\) => \{[\s\S]*state\.leaves = moved/);
    // Rotating a page still turns its strokes with it.
    assert.match(main, /state\.pages\[key\] = rotateItems\(pageStrokes\(pageNum\), delta\)/);
  });

  it("holds to grab, so a drag reorders instead of scrolling the drawer", () => {
    assert.match(main, /PAGE_HOLD_MS/);
    assert.match(main, /row\.classList\.add\("is-grabbed"\)/);
    assert.match(css, /\.preview-row\.is-grabbed \{[\s\S]*touch-action: none/);
    assert.match(main, /movePageByDrag\(from, to\)/);
    assert.match(main, /pageOfLeaf\(state\.leaves, row\.dataset\.leaf\)/);
  });
});

describe("#55 거른 목록에서는 순서를 안 바꿈", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const main = readFileSync(join(here, "main.js"), "utf8");

  it("only drags in the 전체 filter, where row order is leaf order", () => {
    assert.match(main, /moved > PAGE_DRAG_SLOP_PX && state\.previewFilter === "all"/);
  });
});
