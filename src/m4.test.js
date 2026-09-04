import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { M4_OVERFLOW_ITEMS } from "./interact.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "src/style.css"), "utf8");
const main = readFileSync(join(root, "src/main.js"), "utf8");
const history = readFileSync(join(root, "src/history.js"), "utf8");
const capture = readFileSync(join(root, "src/capture.js"), "utf8");

describe("M4 #31 chrome", () => {
  it("keeps undo/overflow on the one utility bar and view/edit on the header lock", () => {
    const rail = html.slice(html.indexOf('class="toolbar-rail"'), html.indexOf('id="workspace"'));
    const toolbar = html.slice(html.indexOf('id="toolbar"'), html.indexOf('id="workspace"'));
    const header = html.slice(html.indexOf('class="write-top"'), html.indexOf('class="write-body"'));
    assert.doesNotMatch(html, /class="m4-rail"|id="m4-rail"|id="m4-bar"/);
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.match(rail, /id="toolbar"/);
    assert.match(rail, /id="undo-btn"/);
    assert.match(rail, /id="more-btn"/);
    assert.match(toolbar, /id="undo-btn"/);
    assert.match(toolbar, /id="redo-btn"/);
    assert.match(toolbar, /id="more-btn"/);
    assert.doesNotMatch(toolbar, /toolbar-cluster|data-slot=/);
    assert.ok(toolbar.indexOf('id="eraser-btn"') < toolbar.indexOf('id="undo-btn"'));
    assert.ok(toolbar.indexOf('id="undo-btn"') < toolbar.indexOf('id="redo-btn"'));
    assert.ok(toolbar.indexOf('id="redo-btn"') < toolbar.indexOf('id="more-btn"'));
    assert.match(toolbar, /id="eraser-btn"/);
    assert.match(toolbar, /id="select-btn"/);
    assert.doesNotMatch(toolbar, /id="prev-btn"|id="next-btn"|interact-btn/);
    assert.match(header, /id="prev-btn"/);
    assert.match(header, /id="next-btn"/);
    assert.match(main, /armStayOnWrite/);
    assert.doesNotMatch(main.slice(main.indexOf("function redoInk"), main.indexOf("function overflowSide")), /showUploadScreen|pages\s*=\s*\{\}/);
    assert.match(html, /aria-label="되돌리기"/);
    assert.match(html, /id="redo-btn"/);
    assert.doesNotMatch(header, /undo-btn|more-btn/);
    assert.match(header, /id="interact-btn"/);
    assert.deepEqual(M4_OVERFLOW_ITEMS, [
      "fullscreen",
      "image",
      "sticker",
      "rotate",
      "save",
      "bake",
      "saveas",
      "export",
      "inkmove",
    ]);
    assert.match(toolbar, /id="undo-btn"/);
    assert.doesNotMatch(toolbar, /책갈피|이미지|회전/);
    assert.match(html, /data-more="image">이미지/);
    assert.match(html, /data-rotate="-90">왼쪽/);
    assert.match(html, /id="preview-btn"/);
    assert.doesNotMatch(html, /id="rotate-panel"|data-more="rotate"/);
    assert.match(html, /id="preview-drawer"/);
    assert.match(html, /data-preview-filter="bookmarks">책갈피/);
    assert.doesNotMatch(html, /id="m4-bar"|id="m4-rail"|class="m4-rail"/);
    assert.match(css, /\.toolbar \{[\s\S]*height: 56px/);
    assert.match(css, /\.tool \{[\s\S]*width: var\(--cell\)/);
    assert.match(css, /--cell: 44px/);
    assert.match(css, /\.interact-lock \{[\s\S]*color: #8a8478/);
    assert.match(css, /\.interact-lock-icon \{[\s\S]*width: 32px;[\s\S]*height: 32px/);
    assert.match(header, /보기|편집/);
    assert.doesNotMatch(header, /읽기/);
    assert.match(css, /\.slot-panel \{[\s\S]*padding: 12px;[\s\S]*border: 1px solid #e6e1d6;[\s\S]*border-radius: 16px/);
    assert.match(css, /\.more-panel button \{[\s\S]*height: 44px/);
    assert.match(main, /bindUndoHold\(els\.undoBtn,\s*\{\s*onUndo:\s*undoInk,\s*onRedo:\s*redoInk/);
    assert.match(main, /from "\.\/undoHold\.js"/);
    assert.match(main, /placeOverflowPanel[\s\S]*left = "-9999px"/);
    assert.match(css, /\.more-panel \{[\s\S]*left: -9999px/);
  });

  it("does not start ink while mosaic/capture is armed, and keeps capture until confirm", () => {
    const startStroke = main.slice(main.indexOf("function startStroke"), main.indexOf("function moveStroke"));
    const endRect = main.slice(main.indexOf("function endRect"), main.indexOf("function startSelect"));
    assert.match(startStroke, /if \(state\.rectTool\)/);
    assert.match(main, /ignoreAfterPanel/);
    assert.doesNotMatch(endRect, /rectTool = null/);
    assert.match(main, /els\.moreBtn\.addEventListener\("click", \(event\) => \{[\s\S]*stopPropagation/);
  });

  it("does not persist undo or capture buffers, and writes clipboard only on confirm", () => {
    assert.doesNotMatch(history, /localStorage|indexedDB|fetch\(/);
    assert.doesNotMatch(main, /pdf-ink:undo|pdf-ink:history|pdf-ink:capture/);
    assert.doesNotMatch(main, /clipboard\.read|clipboard-read/);
    assert.doesNotMatch(capture, /clipboard\.read|clipboard-read/);
    assert.doesNotMatch(html, /id="capture-confirm"|마스킹\(모자이크\)|data-more="mosaic"/);
    // #121: 메뉴는 click 대신 위임 pointerup으로 실행된다(누른 채 떼도 동작).
    assert.match(main, /bindMenuRelease\(els\.marqueeMenu, "marquee", runMarqueeAction\)/);
    assert.match(main, /writePngClipboard/);
    assert.equal((main.match(/writePngClipboard/g) || []).length, 2);
    assert.match(html, /data-more="save">저장/);
  });
});
