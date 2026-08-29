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
  it("keeps undo/redo/overflow off the slot toolbar and omits 선택", () => {
    const toolbar = html.slice(html.indexOf('id="toolbar"'), html.indexOf('id="m4-bar"'));
    assert.equal((toolbar.match(/data-slot="/g) || []).length, 3);
    assert.match(toolbar, /id="eraser-btn"/);
    assert.match(toolbar, /id="settings-btn"/);
    assert.doesNotMatch(toolbar, /undo-btn|redo-btn|more-btn|interact-btn/);
    assert.match(html, /id="m4-bar"/);
    assert.match(html, /aria-label="되돌리기"/);
    assert.doesNotMatch(html.slice(html.indexOf('id="m4-bar"'), html.indexOf('id="workspace"')), /redo-btn|되돌리기 취소|선택/);
    assert.deepEqual(M4_OVERFLOW_ITEMS, ["mosaic", "capture", "fullscreen"]);
    assert.doesNotMatch(html, /data-more="select"|data-tool="select"/);
    assert.doesNotMatch(html, /이미지|회전|미리보기|책갈피/);
    assert.match(css, /\.toolbar \{[\s\S]*height: 56px/);
    assert.match(css, /\.tool \{[\s\S]*width: var\(--touch\)/);
    assert.match(css, /--touch: 44px/);
    assert.match(css, /\.interact-lock \{[\s\S]*width: 32px;[\s\S]*color: #8a8478/);
    assert.match(css, /\.slot-panel \{[\s\S]*padding: 12px;[\s\S]*border: 1px solid #e6e1d6;[\s\S]*border-radius: 16px/);
    assert.match(css, /\.more-panel button \{[\s\S]*height: 44px/);
    assert.match(main, /bindHold\(els\.undoBtn/);
    assert.doesNotMatch(main, /redoBtn/);
  });

  it("does not persist undo or capture buffers, and writes clipboard only on confirm", () => {
    assert.doesNotMatch(history, /localStorage|indexedDB|fetch\(/);
    assert.doesNotMatch(main, /pdf-ink:undo|pdf-ink:history|pdf-ink:capture/);
    assert.doesNotMatch(main, /clipboard\.read/);
    assert.doesNotMatch(capture, /clipboard\.read/);
    assert.match(main, /els\.captureConfirm\.addEventListener\("click"/);
    assert.match(main, /writePngClipboard/);
    assert.equal((main.match(/writePngClipboard/g) || []).length, 2);
    assert.doesNotMatch(html, />저장</);
  });
});
