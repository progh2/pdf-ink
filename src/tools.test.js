import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  HIGHLIGHTER_OPACITY_DEFAULT,
  HIGHLIGHTER_PALETTE,
  PEN_PALETTE,
  PENCIL_COLOR,
  SLOT_KINDS,
  STAMP_COLOR,
  STAMP_LABEL_COLOR,
  STAMP_LABEL_GAP_CSS,
  TOOLBAR_STAMP_CIRCLE,
  STAMP_DIAMETER_CSS,
  STAMP_LABELS,
  stampPaintLayout,
  TOOLBAR_COLOR_CHIPS,
  colorInPalette,
  defaultColorForKind,
  highlighterAlpha,
  highlighterStrokeStyle,
  paletteHexes,
  slotAriaLabel,
} from "./tools.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const main = readFileSync(join(root, "src/main.js"), "utf8");
const toolbar = html.slice(html.indexOf('id="toolbar"'), html.indexOf('id="workspace"'));
const more = html.slice(html.indexOf('id="more-panel"'), html.indexOf('id="image-input"'));

describe("pen palette", () => {
  it("uses the locked hex values", () => {
    assert.deepEqual(paletteHexes(PEN_PALETTE), [
      "#1A1A1A",
      "#1E3A4C",
      "#1E4B8C",
      "#C42B2B",
      "#6B3A24",
      "#1F6B45",
    ]);
  });
});

describe("highlighter palette", () => {
  it("uses the locked hex values", () => {
    assert.deepEqual(paletteHexes(HIGHLIGHTER_PALETTE), [
      "#FFE566",
      "#FF8FBF",
      "#FFB347",
      "#B8E05A",
      "#7EC8E8",
    ]);
  });

  it("uses alpha from 투명도 기본 40, not opaque fill", () => {
    assert.equal(HIGHLIGHTER_OPACITY_DEFAULT, 40);
    assert.equal(highlighterAlpha(40), 0.4);
    assert.ok(highlighterAlpha() < 1);
    assert.equal(highlighterStrokeStyle("#FFE566"), "rgba(255, 229, 102, 0.4)");
    assert.match(highlighterStrokeStyle("#FF8FBF", 40), /^rgba\(255, 143, 191, 0\.4\)$/);
  });
});

describe("색연필", () => {
  it("defaults to the grading red, not the old #E03C31", () => {
    assert.equal(PENCIL_COLOR, "#C23A32");
    assert.notEqual(PENCIL_COLOR, "#E03C31");
    assert.equal(defaultColorForKind("pencil", "#1A1A1A"), "#C23A32");
    assert.equal(defaultColorForKind("pencil", "#C42B2B"), "#C23A32");
  });
});

describe("스탬프", () => {
  it("has the five grading labels and a 72 CSS px circle", () => {
    assert.deepEqual(STAMP_LABELS, ["참 잘했어요", "반려", "승인", "진행해", "응아냐"]);
    assert.equal(STAMP_DIAMETER_CSS, 72);
    assert.equal(STAMP_COLOR, "#C42B2B");
    assert.equal(STAMP_LABEL_COLOR, "#5C574E");
    assert.equal(STAMP_LABEL_GAP_CSS, 8);
    const layout = stampPaintLayout("참 잘했어요");
    assert.ok(layout.labelTop >= layout.radius + layout.gap);
  });
});

describe("toolbar", () => {
  it("has no color chips on the bar and keeps the 2×3 palette in the panel", () => {
    assert.equal(TOOLBAR_STAMP_CIRCLE, false);
    assert.deepEqual(TOOLBAR_COLOR_CHIPS, []);
    assert.doesNotMatch(toolbar, /slot-color|data-color=/);
    assert.doesNotMatch(toolbar, /stamp-mini|stamp-preview/);
    assert.doesNotMatch(toolbar, /#D64545|#2F6FED|#E6C200|#E03C31/i);
    assert.doesNotMatch(toolbar, /data-slot=/);
    assert.match(toolbar, /id="eraser-btn"/);
    assert.match(toolbar, /id="pen-btn"/);
    assert.match(toolbar, /id="select-btn"/);
    assert.match(toolbar, /id="stamp-btn"/);
    assert.match(toolbar, /id="redo-btn"/);
    assert.doesNotMatch(toolbar, /id="prev-btn"|id="next-btn"/);
    assert.match(html, /id="prev-btn"/);
    assert.match(html, /id="next-btn"/);
    assert.match(html, /id="slot-panel"/);
    assert.match(html, /id="slot-palette"/);
    assert.match(html, /data-kind="pen">펜/);
    assert.match(html, /data-kind="highlighter">형광/);
    assert.match(html, /data-kind="pencil">색연필/);
    assert.match(html, /data-kind="stamp">스탬프/);
    assert.match(html, /id="slot-stamp"/);
    assert.match(html, /id="stamp-preview"/);
    assert.match(html, /id="stamp-phrases"/);
    assert.deepEqual(STAMP_LABELS, ["참 잘했어요", "반려", "승인", "진행해", "응아냐"]);
    assert.doesNotMatch(html, /스포이드|eyedropper/i);
    assert.deepEqual(SLOT_KINDS, ["pen", "highlighter", "pencil", "stamp"]);
    assert.match(toolbar, /id="undo-btn"/);
    assert.match(toolbar, /id="more-btn"/);
    assert.doesNotMatch(html, /id="m4-bar"|id="m4-rail"/);
    assert.match(more, /마스킹\(모자이크\)/);
    assert.match(more, /영역캡처/);
    assert.match(more, /전체화면/);
    assert.doesNotMatch(more, /data-more="select"/);
    assert.match(more, /이미지/);
    assert.match(more, /왼쪽/);
    assert.match(more, /오른쪽/);
    assert.match(more, /미리보기/);
    assert.match(more, /data-more="save">저장/);
    assert.match(more, /data-more="export">내보내기/);
    assert.doesNotMatch(more, /책갈피/);
    assert.doesNotMatch(toolbar, /책갈피|개요 페이지/);
    assert.match(html, /id="interact-btn"/);
  });
});

describe("slot defaults", () => {
  it("snaps pen and highlighter colors to the locked palettes", () => {
    assert.equal(defaultColorForKind("pen", "#D64545"), "#C42B2B");
    assert.equal(defaultColorForKind("highlighter", "#E6C200"), "#FFE566");
    assert.ok(colorInPalette(defaultColorForKind("pen", "#1E4B8C"), PEN_PALETTE));
    assert.equal(slotAriaLabel({ type: "stamp", stamp: "반려", width: 2 }), "반려 스탬프");
  });
});

describe("#32 stroke scale", () => {
  it("keeps inkCanvasScale and does not size strokes from getBoundingClientRect", () => {
    const scaleFn = main.slice(main.indexOf("function strokeScale"), main.indexOf("function drawStrokesOn"));
    assert.match(scaleFn, /inkCanvasScale/);
    assert.doesNotMatch(scaleFn, /getBoundingClientRect/);
  });
});

describe("stamp persistence", () => {
  it("stores stamps on the ink layer, not a separate stamp key", () => {
    assert.match(main, /stampInkItem/);
    assert.match(main, /persistStrokes/);
    assert.doesNotMatch(main, /pdf-ink:stamp|loadStamp|saveStamp/);
  });
});

describe("stamp erase path", () => {
  it("applies pixel and stroke erasers through applyEraserToInk so stamps leave the layer", () => {
    assert.match(main, /applyEraserToInk/);
    assert.match(main, /removeHitStamps/);
    assert.match(main, /paintStampPreview/);
    assert.match(main, /paintStamp\(/);
  });
});
