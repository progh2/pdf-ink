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
  it("keeps undo/overflow inside the slot toolbar capsule opposite the 3 slots", () => {
    const rail = html.slice(html.indexOf('class="toolbar-rail"'), html.indexOf('id="workspace"'));
    const toolbar = html.slice(html.indexOf('id="toolbar"'), html.indexOf('id="workspace"'));
    const header = html.slice(html.indexOf('class="write-top"'), html.indexOf('class="write-body"'));
    assert.doesNotMatch(html, /class="m4-rail"|id="m4-rail"|id="m4-bar"/);
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.match(rail, /id="toolbar"/);
    assert.match(rail, /id="undo-btn"/);
    assert.match(rail, /id="more-btn"/);
    assert.match(toolbar, /id="undo-btn"/);
    assert.match(toolbar, /id="more-btn"/);
    assert.match(toolbar, /toolbar-cluster/);
    assert.ok(toolbar.indexOf('data-slot="0"') < toolbar.indexOf('id="undo-btn"'));
    assert.ok(toolbar.indexOf('id="eraser-btn"') < toolbar.indexOf('id="undo-btn"'));
    assert.ok(toolbar.indexOf('id="undo-btn"') < toolbar.indexOf('id="more-btn"'));
    assert.equal((toolbar.match(/data-slot="/g) || []).length, 3);
    assert.match(toolbar, /id="eraser-btn"/);
    assert.match(toolbar, /id="settings-btn"/);
    assert.doesNotMatch(toolbar, /id="prev-btn"|id="next-btn"|id="redo-btn"|interact-btn/);
    assert.match(header, /id="prev-btn"/);
    assert.match(header, /id="next-btn"/);
    assert.match(css, /\.toolbar \{[\s\S]*justify-content: space-between/);
    assert.match(css, /\[data-toolbar="left"\] \.toolbar,[\s\S]*height: auto/);
    assert.match(main, /armStayOnWrite/);
    assert.doesNotMatch(main.slice(main.indexOf("function redoInk"), main.indexOf("function overflowSide")), /showUploadScreen|pages\s*=\s*\{\}/);
    const railCss = css.slice(css.indexOf(".toolbar-rail {"), css.indexOf(".write-screen[data-toolbar=\"left\"] .toolbar-rail"));
    assert.doesNotMatch(railCss, /space-between/);
    assert.match(html, /aria-label="되돌리기"/);
    assert.doesNotMatch(html, /id="redo-btn"|data-more="select"/);
    assert.doesNotMatch(header, /undo-btn|more-btn/);
    assert.match(header, /id="interact-btn"/);
    assert.deepEqual(M4_OVERFLOW_ITEMS, ["mosaic", "capture", "fullscreen"]);
    assert.doesNotMatch(html, /data-more="select"|data-tool="select"/);
    assert.doesNotMatch(html, /이미지|회전|미리보기|책갈피/);
    assert.match(css, /\.toolbar \{[\s\S]*height: 56px/);
    assert.match(css, /\.tool \{[\s\S]*width: var\(--touch\)/);
    assert.match(css, /--touch: 44px/);
    assert.match(css, /\.interact-lock \{[\s\S]*width: 32px;[\s\S]*color: #8a8478/);
    assert.match(css, /\.slot-panel \{[\s\S]*padding: 12px;[\s\S]*border: 1px solid #e6e1d6;[\s\S]*border-radius: 16px/);
    assert.match(css, /\.more-panel button \{[\s\S]*height: 44px/);
    assert.match(main, /bindUndoHold\(els\.undoBtn\)/);
    assert.match(main, /function bindUndoHold/);
    assert.match(main, /didLong = true;[\s\S]*redoInk\(\)/);
    assert.match(main, /placeOverflowPanel[\s\S]*left = "-9999px"/);
    assert.match(css, /\.more-panel \{[\s\S]*left: -9999px/);
    assert.doesNotMatch(main, /redoBtn/);
  });

  it("does not start ink while mosaic/capture is armed, and keeps capture until confirm", () => {
    const startStroke = main.slice(main.indexOf("function startStroke"), main.indexOf("function moveStroke"));
    const endRect = main.slice(main.indexOf("function endRect"), main.indexOf("let captureWriting"));
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
    assert.match(main, /els\.captureConfirm\.addEventListener\("click"/);
    assert.match(main, /writePngClipboard/);
    assert.equal((main.match(/writePngClipboard/g) || []).length, 2);
    assert.doesNotMatch(html, />저장</);
  });
});
