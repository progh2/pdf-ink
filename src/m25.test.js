import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { M4_OVERFLOW_ITEMS } from "./interact.js";
import { IMAGE_HANDLE_CSS, acceptImageFile, acceptImageSrc } from "./image.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "src/style.css"), "utf8");
const main = readFileSync(join(root, "src/main.js"), "utf8");
const toolbar = html.slice(html.indexOf('id="toolbar"'), html.indexOf('id="workspace"'));
const more = html.slice(html.indexOf('id="more-panel"'), html.indexOf('id="image-input"'));
const header = html.slice(html.indexOf('class="write-top"'), html.indexOf('class="write-body"'));
const drawer = html.slice(html.indexOf('id="preview-drawer"'), html.indexOf('id="preview-backdrop"'));

describe("M4 #25 chrome", () => {
  it("keeps 선택 only inside ⋯, never as a capsule slot", () => {
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.doesNotMatch(html, /id="m4-bar"|id="m4-rail"|class="m4-rail"/);
    assert.doesNotMatch(toolbar, /id="select-btn"|data-tool="select"|선택/);
    assert.doesNotMatch(html, /id="select-btn"|id="rotate-panel"/);
    assert.ok(toolbar.indexOf('id="eraser-btn"') < toolbar.indexOf('id="undo-btn"'));
    assert.ok(toolbar.indexOf('id="undo-btn"') < toolbar.indexOf('id="more-btn"'));
    assert.doesNotMatch(toolbar, /id="prev-btn"|id="next-btn"|id="redo-btn"/);
    assert.match(header, /id="prev-btn"/);
    assert.match(header, /id="next-btn"/);
    assert.match(header, /id="interact-btn"/);
    assert.doesNotMatch(header, /select-btn|undo-btn|more-btn/);
    assert.match(css, /\.tool \{[\s\S]*width: var\(--touch\)/);
    assert.match(css, /--touch: 44px/);
    assert.match(css, /\.toolbar \{[\s\S]*height: 56px/);
    assert.doesNotMatch(main, /selectFitsCapsule|selectBtn/);
  });

  it("puts 선택·이미지·회전(왼쪽/오른쪽)·미리보기 in the same overflow card", () => {
    assert.deepEqual(M4_OVERFLOW_ITEMS, ["mosaic", "capture", "fullscreen", "select", "image", "rotate", "preview"]);
    assert.match(more, /마스킹\(모자이크\)/);
    assert.match(more, /영역캡처/);
    assert.match(more, /전체화면/);
    assert.match(more, /data-more="select">선택/);
    assert.match(more, /이미지/);
    assert.match(more, /data-rotate="-90">왼쪽/);
    assert.match(more, /data-rotate="90">오른쪽/);
    assert.match(more, /class="more-rotate"/);
    assert.match(more, /미리보기/);
    assert.doesNotMatch(more, /data-more="rotate"/);
    assert.doesNotMatch(more, /책갈피|개요 페이지/);
    assert.doesNotMatch(toolbar, /책갈피|개요|이미지|회전|미리보기|선택/);
    assert.match(drawer, /책갈피/);
    assert.match(drawer, /개요/);
    assert.match(drawer, /개요 페이지 넣기/);
    assert.match(css, /\.slot-panel \{[\s\S]*padding: 12px;[\s\S]*border: 1px solid #e6e1d6;[\s\S]*border-radius: 16px/);
    assert.match(css, /\.more-panel button \{[\s\S]*height: 44px/);
    assert.match(css, /\.more-rotate \{[\s\S]*height: 44px/);
    assert.match(css, /\.preview-drawer \{[\s\S]*width: 120px/);
    assert.match(css, /\.preview-thumb \{[\s\S]*width: 88px/);
    assert.match(css, /\.preview-list \{[\s\S]*gap: 8px/);
    assert.match(css, /\.select-hud button \{[\s\S]*height: 44px/);
    assert.equal(IMAGE_HANDLE_CSS, 8);
    assert.match(css, /\.select-handle \{[\s\S]*width: 8px;[\s\S]*height: 8px/);
    assert.match(main, /insertOutlineAfter/);
    assert.match(main, /rotateItems/);
    assert.doesNotMatch(main.slice(main.indexOf("function redoInk"), main.indexOf("function overflowSide")), /showUploadScreen|pages\s*=\s*\{\}/);
    assert.match(main, /bindUndoHold\(els\.undoBtn/);
    assert.match(main, /function redoInk/);
  });

  it("rejects SVG and never reads the clipboard", () => {
    assert.equal(acceptImageFile({ type: "image/svg+xml", name: "a.svg", size: 10 }).ok, false);
    assert.equal(acceptImageFile({ type: "image/png", name: "a.svg", size: 10 }).ok, false);
    assert.equal(acceptImageFile({ type: "image/gif", name: "a.gif", size: 10 }).ok, false);
    assert.equal(acceptImageFile({ type: "image/png", name: "a.png", size: 10 }).ok, true);
    assert.equal(acceptImageFile({ type: "image/jpeg", name: "a.jpg", size: 10 }).ok, true);
    assert.equal(acceptImageFile({ type: "image/webp", name: "a.webp", size: 10 }).ok, true);
    assert.equal(acceptImageSrc("data:image/svg+xml;base64,xx"), false);
    assert.equal(acceptImageSrc("data:image/png;base64,xx"), true);
    assert.doesNotMatch(main, /clipboard\.read|clipboard-read|permissions\.query/);
    assert.doesNotMatch(html, /accept="image\/\*"/);
    assert.match(html, /accept="image\/png,image\/jpeg,image\/webp/);
    assert.match(main, /els\.pasteBtn\.addEventListener\("click"/);
    assert.doesNotMatch(main, /addEventListener\("paste"/);
  });
});
