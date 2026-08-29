import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { M4_OVERFLOW_ITEMS } from "./interact.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(srcDir, "style.css"), "utf8");
const main = readFileSync(join(srcDir, "main.js"), "utf8");
const images = readFileSync(join(srcDir, "images.js"), "utf8");
const capture = readFileSync(join(srcDir, "capture.js"), "utf8");
const history = readFileSync(join(srcDir, "history.js"), "utf8");
const toolbar = html.slice(html.indexOf('id="toolbar"'), html.indexOf('id="workspace"'));
const more = html.slice(html.indexOf('id="more-panel"'), html.indexOf('id="marquee"'));
const header = html.slice(html.indexOf('class="write-top"'), html.indexOf('class="write-body"'));
const srcFiles = readdirSync(srcDir)
  .filter((name) => name.endsWith(".js") && !name.endsWith(".test.js"))
  .map((name) => ({ name, text: readFileSync(join(srcDir, name), "utf8") }));

describe("#25 overflow select/image/rotate/preview", () => {
  it("puts select/image/rotate/preview in the more panel, rotate as one row two cells", () => {
    assert.match(more, /data-more="select">선택/);
    assert.match(more, /data-more="image">이미지/);
    assert.match(more, /data-more="preview">미리보기/);
    assert.match(more, /마스킹\(모자이크\)/);
    assert.match(more, /영역캡처/);
    assert.match(more, /전체화면/);
    assert.match(more, /more-rotate-title">회전/);
    assert.equal((more.match(/data-more-row="rotate"/g) || []).length, 1);
    assert.equal((more.match(/data-rotate="/g) || []).length, 2);
    assert.match(more, /data-rotate="left">왼쪽/);
    assert.match(more, /data-rotate="right">오른쪽/);
    assert.doesNotMatch(more, /data-more="rotate-left"|data-more="rotate-right"/);
    const rotateBlock = more.slice(more.indexOf('data-more-row="rotate"'), more.indexOf('data-more="preview"'));
    assert.doesNotMatch(rotateBlock, /data-more="/);
    assert.match(css, /\.more-rotate \{[\s\S]*height: 44px/);
    assert.match(css, /\.more-rotate \{[\s\S]*grid-template-columns: 36px 1fr 1fr/);
    assert.match(css, /\.more-panel button \{[\s\S]*height: 44px/);
    assert.deepEqual(M4_OVERFLOW_ITEMS, ["mosaic", "capture", "fullscreen", "select", "image", "rotate", "preview"]);
  });

  it("keeps the capsule free of select/image/rotate/preview/undo-extra buttons", () => {
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.doesNotMatch(toolbar, /data-more="select"|data-tool="select"|선택/);
    assert.doesNotMatch(toolbar, /이미지|회전|미리보기|책갈피/);
    assert.doesNotMatch(toolbar, /id="redo-btn"|id="select-btn"|id="image-btn"|id="rotate-btn"|id="preview-btn"/);
    assert.match(toolbar, /id="undo-btn"/);
    assert.match(toolbar, /id="more-btn"/);
    assert.equal((toolbar.match(/data-slot="/g) || []).length, 3);
    assert.match(toolbar, /id="eraser-btn"/);
    assert.doesNotMatch(header, /undo-btn|more-btn|select-btn|image-btn/);
    assert.match(header, /id="interact-btn"/);
    assert.match(css, /\.toolbar \{[\s\S]*height: 56px/);
    assert.match(css, /--touch: 44px/);
  });

  it("does not add a second m4-rail pill", () => {
    assert.doesNotMatch(html, /class="m4-rail"|id="m4-rail"|id="m4-bar"/);
    const railCss = css.slice(css.indexOf(".toolbar-rail {"), css.indexOf(".write-screen[data-toolbar=\"left\"] .toolbar-rail"));
    assert.doesNotMatch(railCss, /space-between/);
  });

  it("never uses clipboard.read / clipboard.readText / clipboard-read", () => {
    for (const file of srcFiles) {
      assert.doesNotMatch(file.text, /clipboard\.read\b|clipboard\.readText\b|clipboard-read/, file.name);
    }
    assert.doesNotMatch(html, /clipboard-read/);
    assert.doesNotMatch(main, /navigator\.clipboard\.read/);
    assert.doesNotMatch(images, /clipboard\.read/);
    assert.doesNotMatch(capture, /clipboard\.read|clipboard-read/);
    assert.match(main, /imagePasteArmed/);
    assert.match(main, /fileFromPasteEvent/);
    assert.match(main, /armImagePaste/);
    assert.match(main, /validateImageFile/);
    assert.match(main, /validateImageContents/);
    assert.match(html, /id="image-input"/);
    assert.match(html, /accept="image\/png,image\/jpeg,image\/webp/);
    assert.doesNotMatch(html, /id="image-input"[^>]*accept="image\/\*"/);
    assert.doesNotMatch(html, /id="image-input"[^>]*\.svg/);
    assert.match(main, /writePngClipboard/);
    assert.equal((main.match(/writePngClipboard/g) || []).length, 2);
    assert.match(main, /els\.captureConfirm\.addEventListener\("click"/);
    assert.doesNotMatch(history, /localStorage|indexedDB|fetch\(/);
  });
});
