import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { M4_OVERFLOW_ITEMS, overflowItems, selectFitsCapsule } from "./interact.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "src/style.css"), "utf8");
const main = readFileSync(join(root, "src/main.js"), "utf8");
const toolbar = html.slice(html.indexOf('id="toolbar"'), html.indexOf('id="workspace"'));
const more = html.slice(html.indexOf('id="more-panel"'), html.indexOf('id="rotate-panel"'));
const header = html.slice(html.indexOf('class="write-top"'), html.indexOf('class="write-body"'));
const drawer = html.slice(html.indexOf('id="preview-drawer"'), html.indexOf('id="preview-backdrop"'));

describe("M4 #25 chrome", () => {
  it("keeps 선택 in the same capsule as undo/⋯, opposite the 3 slots", () => {
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.doesNotMatch(html, /id="m4-bar"|id="m4-rail"|class="m4-rail"/);
    assert.match(toolbar, /id="select-btn"/);
    assert.match(toolbar, /aria-label="선택"/);
    assert.ok(toolbar.indexOf('data-slot="0"') < toolbar.indexOf('id="select-btn"'));
    assert.ok(toolbar.indexOf('id="eraser-btn"') < toolbar.indexOf('id="select-btn"'));
    assert.ok(toolbar.indexOf('id="select-btn"') < toolbar.indexOf('id="undo-btn"'));
    assert.ok(toolbar.indexOf('id="undo-btn"') < toolbar.indexOf('id="more-btn"'));
    assert.doesNotMatch(toolbar, /id="prev-btn"|id="next-btn"|id="redo-btn"/);
    assert.match(header, /id="prev-btn"/);
    assert.match(header, /id="next-btn"/);
    assert.match(header, /id="interact-btn"/);
    assert.doesNotMatch(header, /select-btn|undo-btn|more-btn/);
    assert.match(css, /\.tool \{[\s\S]*width: var\(--touch\)/);
    assert.match(css, /--touch: 44px/);
    assert.match(css, /\.toolbar \{[\s\S]*height: 56px/);
    assert.match(main, /selectFitsCapsule/);
    assert.match(main, /els\.selectBtn\.hidden = compact/);
    assert.equal(selectFitsCapsule({ width: 360, height: 780, position: "top" }), false);
    assert.equal(selectFitsCapsule({ width: 900, height: 700, position: "bottom" }), true);
  });

  it("puts 이미지·회전·미리보기 in the same overflow card; bookmarks stay in the drawer", () => {
    assert.deepEqual(M4_OVERFLOW_ITEMS, ["mosaic", "capture", "fullscreen", "image", "rotate", "preview"]);
    assert.deepEqual(overflowItems(true)[0], "select");
    assert.match(more, /마스킹\(모자이크\)/);
    assert.match(more, /영역캡처/);
    assert.match(more, /전체화면/);
    assert.match(more, /이미지/);
    assert.match(more, /회전/);
    assert.match(more, /미리보기/);
    assert.doesNotMatch(more, /책갈피|개요 페이지/);
    assert.doesNotMatch(toolbar, /책갈피|개요|이미지|회전|미리보기/);
    assert.match(drawer, /책갈피/);
    assert.match(drawer, /개요/);
    assert.match(drawer, /개요 페이지 넣기/);
    assert.match(css, /\.slot-panel \{[\s\S]*padding: 12px;[\s\S]*border: 1px solid #e6e1d6;[\s\S]*border-radius: 16px/);
    assert.match(css, /\.more-panel button \{[\s\S]*height: 44px/);
    assert.match(main, /data-rotate/);
    assert.match(main, /insertOutlineAfter/);
    assert.match(main, /rotateItems/);
    assert.doesNotMatch(main.slice(main.indexOf("function redoInk"), main.indexOf("function overflowSide")), /showUploadScreen|pages\s*=\s*\{\}/);
    assert.match(main, /bindUndoHold\(els\.undoBtn/);
    assert.match(main, /function redoInk/);
  });
});
