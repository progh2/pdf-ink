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
  STAMP_DIAMETER_CSS,
  STAMP_LABELS,
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
  it("defaults to the grading red", () => {
    assert.equal(PENCIL_COLOR, "#C23A32");
    assert.equal(defaultColorForKind("pencil", "#1A1A1A"), "#C23A32");
    assert.equal(defaultColorForKind("pencil", "#C42B2B"), "#C23A32");
  });
});

describe("스탬프", () => {
  it("has the five grading labels", () => {
    assert.deepEqual(STAMP_LABELS, ["참 잘했어요", "반려", "승인", "진행해", "응아냐"]);
    assert.equal(STAMP_DIAMETER_CSS, 72);
  });
});

describe("toolbar", () => {
  it("has no color chips", () => {
    assert.deepEqual(TOOLBAR_COLOR_CHIPS, []);
    const toolbar = html.slice(html.indexOf('id="toolbar"'), html.indexOf('id="workspace"'));
    assert.doesNotMatch(toolbar, /slot-color|data-color=/);
    assert.match(toolbar, /id="stamp-btn"/);
    assert.match(html, /id="slot-panel"/);
    assert.match(html, /id="slot-palette"/);
    assert.match(html, /data-kind="pen">펜/);
    assert.match(html, /data-kind="highlighter">형광/);
    assert.match(html, /data-kind="pencil">색연필/);
    assert.doesNotMatch(html, /id="slot-kinds"[\s\S]*data-kind="stamp"/);
    assert.doesNotMatch(html, /스포이드|eyedropper/i);
    assert.deepEqual(SLOT_KINDS, ["pen", "highlighter", "pencil"]);
  });
});

describe("slot defaults", () => {
  it("snaps pen and highlighter colors to the locked palettes", () => {
    assert.equal(defaultColorForKind("pen", "#D64545"), "#C42B2B");
    assert.equal(defaultColorForKind("highlighter", "#E6C200"), "#FFE566");
    assert.ok(colorInPalette(defaultColorForKind("pen", "#1E4B8C"), PEN_PALETTE));
    assert.match(slotAriaLabel({ type: "pen", color: "#1A1A1A", width: 2 }), /검정/);
  });
});

describe("#32 stroke scale", () => {
  it("keeps inkCanvasScale and does not size strokes from getBoundingClientRect", () => {
    const scaleFn = main.slice(main.indexOf("function strokeScale"), main.indexOf("function drawStrokesOn"));
    assert.match(scaleFn, /inkCanvasScale/);
    assert.doesNotMatch(scaleFn, /getBoundingClientRect/);
  });
});
