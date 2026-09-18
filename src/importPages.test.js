// #428: 문서별 비동기 작업·확정 목록·고정 삽입 위치에 맞춰 배선 핀을 갱신했다. 동작은 previewLifecycle.test.js에서 검증한다.
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
import { inkKey, leafPaperBox, makePdfLeaf } from "./preview.js";
import { rotateItem } from "./rotate.js";
import { MAX_PDF_BYTES, maxPdfBytes, sizeLimitLabel } from "./validate.js";

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

  it("rejects an oversized pdf with the same cap as open (#418)", () => {
    // 상한은 기기 메모리에 달렸다. 문구는 그때 실제로 적용된 상한을 말한다.
    const limit = maxPdfBytes(globalThis.navigator?.deviceMemory);
    const out = classifyImportFile(file({ name: "big.pdf", type: "application/pdf", size: MAX_PDF_BYTES + 1 }));
    assert.equal(out.kind, "reject");
    assert.equal(out.message, `파일이 너무 큽니다. ${sizeLimitLabel(limit)} 이하만 올릴 수 있습니다.`);
    assert.doesNotMatch(out.message, /20MB/, "#418 전의 낡은 숫자를 말하지 않는다");
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
    const run = main.slice(main.indexOf("const FULL_PAGE_BOX"), main.indexOf("function pickImportPages"));
    assert.match(run, /classifyImportFile\(file\)/);
    assert.match(run, /insertImportedAfter\(state\.leaves, state\.pages, index, specs\)/);
    assert.match(run, /const index = validImportIndex\(target\)/);
    assert.match(run, /commitBulkChange/, "여러 쪽 undo가 한 번에 돌아가게");
    assert.match(run, /afterPageOp\(index \+ 2\)/, "첫 가져온 쪽 = 지금+1");
    // #454: 쪽이 그림 모양을 가지므로 그림은 종이를 꽉 채운다.
    assert.match(run, /ratio: height \/ width/);
    assert.match(run, /items: \[imageItem\(\{ \.\.\.FULL_PAGE_BOX/);
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

describe("#454 가져온 쪽의 모양이 화면·썸네일·파일에서 같다", () => {
  const main = readFileSync(join(root, "src/main.js"), "utf8");
  const exportSrc = readFileSync(join(root, "src/exportPdf.js"), "utf8");

  it("잎에 비율을 심어 넣는다", () => {
    const out = insertImportedAfter([makePdfLeaf(1)], {}, 0, [{ id: "o:imp-x", title: "그림", ratio: 16 / 9 }]);
    assert.ok(Math.abs(out.leaves[1].ratio - 16 / 9) < 1e-9);
  });

  it("화면 쪽 크기가 제 비율을 쓴다", () => {
    const blank = main.slice(main.indexOf("async function blankPageCss"), main.indexOf("async function blankCellCss"));
    assert.match(blank, /leafPaperBox\(cell\.width, cell\.height, leaf\.ratio, leaf\.rotate\)/);
  });

  it("썸네일도 같은 모양을 쓴다", () => {
    const thumb = main.slice(main.indexOf("async function blankThumbShape"), main.indexOf("const canvasRenderQueue"));
    assert.match(thumb, /leafPaperBox\(cellW, cellH, leaf\.ratio, leaf\.rotate\)/);
  });

  it("내보낸 파일의 쪽도 그 모양이다", () => {
    assert.match(exportSrc, /leafPaperBox\(blankSize\.width, blankSize\.height, plan\.leaf\.ratio, 0\)/);
    assert.match(exportSrc, /out\.addPage\(\[paper\.width, paper\.height\]\)/);
  });

  it("칸보다 좁은 쪽도 가운데 온다", () => {
    assert.match(main, /marginLeft = `\$\{-\(view\.cssWidth \|\| metrics\.pageWidth\) \/ 2\}px`/);
    assert.match(main, /state\.viewMode === "scroll" && state\.scrollLayout[\s\S]{0,120}marginLeft = `\$\{-cssWidth \/ 2\}px`/);
  });

  it("제 모양 쪽이 첫 장이어도 칸은 문서 기본 쪽이다", () => {
    assert.match(main, /firstLeaf\?\.ratio\s*\n?\s*\? \{ width: base\.width, height: base\.height \}/);
  });
});

describe("#454·#452 가져온 세로 그림을 돌려도 종이를 꽉 채운다", () => {
  it("돌린 뒤에도 그림이 종이와 정확히 같다", () => {
    // 칸 400x600에 9:16 그림을 가져오면 종이는 337.5x600이 되고 그림이 꽉 찬다.
    const cell = { width: 400, height: 600 };
    const ratio = 16 / 9;
    const paper = leafPaperBox(cell.width, cell.height, ratio);
    assert.ok(Math.abs(paper.height - 600) < 1e-9);
    const full = { type: "image", x: 0, y: 0, w: 1, h: 1, rotate: 0, src: "x" };

    // 쪽을 90° 돌리면 종이도 눕는다.
    const turned = leafPaperBox(cell.width, cell.height, ratio, 90);
    assert.ok(Math.abs(turned.width / turned.height - ratio) < 1e-9, "비율이 뒤집혀 눕는다");

    // 그림은 돌기 전 쪽 비율로 다시 정규화된다(#452).
    const out = rotateItem(full, 90, paper.width / paper.height);
    assert.equal(out.rotate, 90);
    // 그린 픽셀 크기(돌리기 전)는 새 종이의 높이x너비여야, 90° 돌렸을 때 딱 맞는다.
    assert.ok(Math.abs(out.w * turned.width - turned.height) < 1e-6, "돌린 그림의 폭 = 종이 높이");
    assert.ok(Math.abs(out.h * turned.height - turned.width) < 1e-6, "돌린 그림의 높이 = 종이 너비");
    // 중심은 종이 한가운데 그대로.
    assert.ok(Math.abs(out.x + out.w / 2 - 0.5) < 1e-9);
    assert.ok(Math.abs(out.y + out.h / 2 - 0.5) < 1e-9);
  });
});
