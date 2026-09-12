import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  IMPORT_ACCEPT,
  IMPORT_LABEL,
  IMPORT_MORE,
  IMPORT_PREVIEW_LABEL,
  classifyImportFile,
  importedLeafId,
  insertImportedAfter,
} from "./importPages.js";
import { IMAGE_MAX_BYTES } from "./image.js";
import { inkKey, makePdfLeaf } from "./preview.js";
import { MAX_PDF_BYTES } from "./validate.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const main = readFileSync(join(root, "src/main.js"), "utf8");
const html = readFileSync(join(root, "index.html"), "utf8");

function file({ name = "a.png", type = "image/png", size = 12 } = {}) {
  return { name, type, size };
}

describe("#425 가져오기 분류", () => {
  it("accepts a pdf by type even without a .pdf name", () => {
    assert.deepEqual(classifyImportFile(file({ name: "scan", type: "application/pdf", size: 80 })), { kind: "pdf" });
  });

  it("accepts a pdf by extension when the picker leaves type empty", () => {
    assert.deepEqual(classifyImportFile(file({ name: "notes.PDF", type: "", size: 80 })), { kind: "pdf" });
  });

  it("accepts png/jpeg/webp and refuses svg or an empty pick", () => {
    assert.equal(classifyImportFile(file({ name: "a.png", type: "image/png" })).kind, "image");
    assert.equal(classifyImportFile(file({ name: "a.jpg", type: "image/jpeg" })).kind, "image");
    assert.equal(classifyImportFile(file({ name: "a.webp", type: "image/webp" })).kind, "image");
    assert.match(classifyImportFile(file({ name: "a.svg", type: "image/svg+xml" })).message, /SVG/);
    assert.match(classifyImportFile(null).message, /선택/);
    assert.match(classifyImportFile(file({ size: 0 })).message, /빈 파일/);
  });

  it("rejects an oversized pdf with the same 20MB cap as open", () => {
    const out = classifyImportFile(file({ name: "big.pdf", type: "application/pdf", size: MAX_PDF_BYTES + 1 }));
    assert.equal(out.kind, "reject");
    assert.match(out.message, /20MB/);
  });

  it("rejects an oversized image with the image cap, not the pdf cap", () => {
    const out = classifyImportFile(file({ name: "big.png", type: "image/png", size: IMAGE_MAX_BYTES + 1 }));
    assert.equal(out.kind, "reject");
    assert.match(out.message, /8MB/);
  });

  it("gives each imported leaf its own id", () => {
    assert.notEqual(importedLeafId(), importedLeafId());
    assert.match(importedLeafId(), /^o:imp-/);
  });
});

describe("#425 지금 쪽 뒤에 끼우기", () => {
  it("inserts after the current index, in order, without moving existing ink", () => {
    const leaves = [makePdfLeaf(1), makePdfLeaf(2), makePdfLeaf(3)];
    const pages = { 1: [{ type: "pen" }], 2: [{ type: "pen", w: 2 }], 3: [] };
    const a = { id: "o:imp-a", items: [{ type: "image", src: "a" }] };
    const b = { id: "o:imp-b", items: [{ type: "image", src: "b" }] };
    const out = insertImportedAfter(leaves, pages, 0, [a, b]);
    assert.equal(out.count, 2);
    assert.equal(out.firstAt, 1);
    assert.equal(out.leaves.length, 5);
    assert.equal(out.leaves[0].kind, "pdf");
    assert.equal(out.leaves[1].id, "o:imp-a");
    assert.equal(out.leaves[2].id, "o:imp-b");
    assert.equal(out.leaves[3].pdfPage, 2);
    assert.deepEqual(out.pages[1], [{ type: "pen" }], "1쪽 필기는 그대로");
    assert.deepEqual(out.pages[inkKey(out.leaves[1])], a.items);
    assert.deepEqual(out.pages[inkKey(out.leaves[2])], b.items);
    assert.equal(out.leaves[1].title, "가져온 쪽");
  });

  it("appends after the last page and no-ops on an empty pick", () => {
    const leaves = [makePdfLeaf(1)];
    const none = insertImportedAfter(leaves, { 1: [] }, 0, []);
    assert.equal(none.count, 0);
    assert.equal(none.leaves.length, 1);
    const out = insertImportedAfter(leaves, { 1: [] }, 0, [{ id: "o:imp-z", items: [] }]);
    assert.equal(out.firstAt, 1);
    assert.equal(out.leaves[1].id, "o:imp-z");
  });
});

describe("#425 배선", () => {
  it("offers 페이지 추가·가져오기 on ⋯ and the preview drawer", () => {
    assert.equal(IMPORT_MORE, "importpages");
    assert.equal(IMPORT_LABEL, "페이지 추가·가져오기");
    assert.equal(IMPORT_PREVIEW_LABEL, "페이지 가져오기");
    assert.match(html, /data-more="importpages">페이지 추가·가져오기/);
    assert.match(html, /id="import-pages">페이지 가져오기/);
    assert.match(html, /id="outline-insert">빈 쪽 넣기/);
  });

  it("uses a mobile file picker for images and pdf, without forcing the camera", () => {
    assert.match(html, new RegExp(`id="import-pages-input"[^>]*accept="${IMPORT_ACCEPT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
    assert.doesNotMatch(html, /id="import-pages-input"[^>]*capture/);
    assert.match(html, /id="image-input"/, "⋯ 이미지는 지금 쪽에 얹는 길 — 그대로 둔다");
  });

  it("inserts after the current page and persists leaves + images", () => {
    const pick = main.slice(main.indexOf("function pickImportPages"), main.indexOf("function movePageByDrag"));
    assert.match(pick, /els\.importPagesInput\.click\(\)/);
    const run = main.slice(main.indexOf("function importPageBox"), main.indexOf("function pickImportPages"));
    assert.match(run, /classifyImportFile\(file\)/);
    assert.match(run, /insertImportedAfter\(state\.leaves, state\.pages, index, specs\)/);
    assert.match(run, /const index = state\.page - 1/);
    assert.match(run, /commitBulkChange/, "여러 쪽 undo가 한 번에 돌아가게");
    assert.match(run, /afterPageOp\(index \+ 2\)/, "첫 가져온 쪽 = 지금+1");
    assert.match(run, /containBoxOnPage/, "그림은 쪽 안에 비율 유지");
    assert.match(run, /locked: true/);
    assert.match(run, /pdfjsLib\.getDocument/, "고른 PDF의 모든 쪽");
    assert.match(run, /validatePdfContents/);
    assert.match(run, /interactMode === "view"/);
    const addImage = main.slice(main.indexOf("async function addImageFile"), main.indexOf("function rotateCurrentPage"));
    assert.doesNotMatch(addImage, /insertImportedAfter/, "⋯ 이미지는 쪽을 끼우지 않는다");
  });

  it("wires the overflow action and the preview button to the same picker", () => {
    assert.match(main, /action === "importpages"[\s\S]{0,120}pickImportPages\(\)/);
    assert.match(main, /els\.importPages\.addEventListener\("click", pickImportPages\)/);
    assert.match(main, /els\.importPagesInput\.addEventListener\("change"/);
  });
});
