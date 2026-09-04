import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  HIGHLIGHTER_OPACITY_DEFAULT,
  HIGHLIGHTER_PALETTE,
  PENCIL_COLOR,
  PEN_PALETTE,
  RECENT_COLOR_LIMIT,
  SLOT_KINDS,
  STAMP_ASPECT,
  STAMP_COLOR,
  STAMP_HANDLE_CSS,
  STAMP_HEIGHT_CSS,
  STAMP_LABELS,
  STAMP_WIDTH_CSS,
  TOOLBAR_COLOR_CHIPS,
  TOOLBAR_STAMP_CIRCLE,
  addRecentColor,
  colorInPalette,
  defaultColorForKind,
  hexToHsv,
  highlighterAlpha,
  highlighterStrokeStyle,
  hsvToHex,
  isLightHex,
  paletteHexes,
  resizeStamp,
  slotAriaLabel,
  stampPaintLayout,
  wheelPick,
  wheelSpot,
  widthLabel,
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
      "#FFFFFF",
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
  it("has the five grading labels and a horizontal oval with text inside", () => {
    assert.deepEqual(STAMP_LABELS, ["참 잘했어요", "반려", "승인", "진행해", "응아냐"]);
    assert.equal(STAMP_WIDTH_CSS, 108);
    assert.equal(STAMP_HEIGHT_CSS, 64);
    assert.ok(STAMP_WIDTH_CSS > STAMP_HEIGHT_CSS);
    assert.equal(STAMP_COLOR, "#C42B2B");
    assert.equal(STAMP_HANDLE_CSS, 8);
    const layout = stampPaintLayout("참 잘했어요");
    assert.equal("labelTop" in layout, false);
    assert.equal("labelBottom" in layout, false);
    assert.equal("gap" in layout, false);
    assert.equal("labelColor" in layout, false);
    assert.ok(layout.rx > layout.ry);
    assert.equal(layout.inkColor, STAMP_COLOR);
    const half = layout.lineHeight / 2;
    layout.textYs.forEach((y, index) => {
      assert.ok(Math.abs(y) + half <= layout.innerRy + 1e-6, `line ${index} y=${y} is outside the oval`);
    });
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
  });

  it("keeps aspect when resized from a corner", () => {
    const item = { type: "stamp", stamp: "승인", x: 0.5, y: 0.5, w: STAMP_WIDTH_CSS, h: STAMP_HEIGHT_CSS };
    const grown = resizeStamp(item, "se", { x: 0.82, y: 0.72 }, 400, 600);
    assert.ok(Math.abs(grown.w / grown.h - STAMP_ASPECT) < 1e-6);
    assert.ok(grown.w > item.w);
    const shrunk = resizeStamp(item, "nw", { x: 0.42, y: 0.46 }, 400, 600);
    assert.ok(Math.abs(shrunk.w / shrunk.h - STAMP_ASPECT) < 1e-6);
    assert.ok(shrunk.w < item.w);
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
    // #206부터 스포이드가 있다 — 단, 바가 아니라 팔레트 패널 안에.
    assert.doesNotMatch(toolbar, /eyedrop/);
    assert.match(html, /id="eyedrop-btn"/);
    assert.deepEqual(SLOT_KINDS, ["pen", "highlighter", "pencil", "stamp"]);
    assert.match(toolbar, /id="undo-btn"/);
    assert.match(toolbar, /id="more-btn"/);
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.doesNotMatch(html, /id="m4-bar"|id="m4-rail"/);
    assert.doesNotMatch(more, /마스킹\(모자이크\)|data-more="mosaic"/);
    assert.doesNotMatch(more, /영역캡처/, "#110: 선택 칸이 겸한다");
    assert.match(more, /전체화면/);
    assert.doesNotMatch(more, /data-more="select"/);
    assert.match(more, /이미지/);
    assert.match(more, /왼쪽/);
    assert.match(more, /오른쪽/);
    assert.doesNotMatch(more, /미리보기/);
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

describe("#158 직접 고른 색", () => {
  it("keeps the newest pick first, without duplicates", () => {
    let list = addRecentColor([], "#123456");
    list = addRecentColor(list, "#abcdef");
    list = addRecentColor(list, "#123456");
    assert.deepEqual(list, ["#123456", "#ABCDEF"]);
  });

  it("remembers only the last five", () => {
    let list = [];
    for (const hex of ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666"]) {
      list = addRecentColor(list, hex);
    }
    assert.equal(list.length, RECENT_COLOR_LIMIT);
    assert.equal(list[0], "#666666");
    assert.equal(list.includes("#111111"), false);
  });

  it("ignores junk", () => {
    assert.deepEqual(addRecentColor([], "nope"), []);
    assert.deepEqual(addRecentColor(["#111111"], ""), ["#111111"]);
  });

  it("knows a swatch that needs an edge", () => {
    assert.equal(isLightHex("#FFFFFF"), true);
    assert.equal(isLightHex("#FFE566"), true, "the highlighter yellow");
    assert.equal(isLightHex("#1A1A1A"), false);
    assert.equal(isLightHex("#C42B2B"), false);
  });
});

describe("#158·#161 배선", () => {
  const root2 = join(dirname(fileURLToPath(import.meta.url)), "..");
  const mainSrc = readFileSync(join(root2, "src/main.js"), "utf8");
  const htmlSrc = readFileSync(join(root2, "index.html"), "utf8");
  const cssSrc = readFileSync(join(root2, "src/style.css"), "utf8");

  it("opens the picker on a hold, and the tap still takes the swatch", () => {
    assert.match(htmlSrc, /id="color-pick"/);
    assert.match(mainSrc, /function bindColorHold[\s\S]*PAGE_HOLD_MS/);
    assert.match(mainSrc, /openColorPicker\(hex\)/);
    assert.match(mainSrc, /if \(fired\) \{\s*event\.preventDefault\(\)/, "a hold must not also pick the swatch");
  });

  it("remembers the mixed colour in the palette", () => {
    assert.match(mainSrc, /function applyPickedColor[\s\S]*addRecentColor\(state\.recentColors, value\)/);
    assert.match(mainSrc, /saveRecentColors\(state\.recentColors\)/);
    assert.match(mainSrc, /function paletteWithRecents[\s\S]*state\.recentColors/);
  });

  it("gives a white swatch an edge", () => {
    assert.match(cssSrc, /\.slot-color\[data-light="1"\][\s\S]*box-shadow: inset 0 0 0 1px/);
    assert.match(mainSrc, /if \(isLightHex\(item\.hex\)\)/);
  });
});

describe("#206 색상환", () => {
  it("goes hex → wheel → hex and comes back the same", () => {
    for (const hex of ["#C42B2B", "#1E4B8C", "#FFE566", "#1A1A1A", "#FFFFFF"]) {
      const { h, s, v } = hexToHsv(hex);
      assert.equal(hsvToHex(h, s, v), hex.toUpperCase(), hex);
    }
  });

  it("puts the primaries where a colour wheel puts them", () => {
    assert.equal(hsvToHex(0, 1, 1), "#FF0000");
    assert.equal(hsvToHex(120, 1, 1), "#00FF00");
    assert.equal(hsvToHex(240, 1, 1), "#0000FF");
    assert.equal(hsvToHex(0, 0, 1), "#FFFFFF", "채도 0은 흰색");
    assert.equal(hsvToHex(0, 0, 0), "#000000", "밝기 0은 검정");
  });

  it("reads a tap on the disc as hue and saturation", () => {
    const right = wheelPick(200, 100, 100, 100, 100);
    assert.equal(Math.round(right.h), 0, "3시 방향이 0도");
    assert.equal(right.s, 1, "가장자리는 채도 1");
    const center = wheelPick(100, 100, 100, 100, 100);
    assert.equal(center.s, 0, "중심은 무채색");
  });

  it("clamps a tap outside the disc to its edge", () => {
    assert.equal(wheelPick(300, 100, 100, 100, 100).s, 1);
  });

  it("puts the dot back where the colour lives", () => {
    const { h, s } = hexToHsv("#C42B2B");
    const spot = wheelSpot(h, s, 100, 100, 100);
    const back = wheelPick(spot.x, spot.y, 100, 100, 100);
    assert.ok(Math.abs(back.h - h) < 0.01 && Math.abs(back.s - s) < 0.01);
  });

  it("shows a width with at most one decimal", () => {
    assert.equal(widthLabel(0.5), "0.5");
    assert.equal(widthLabel(3), "3");
    assert.equal(widthLabel(2.0000001), "2");
  });
});

describe("#206 배선", () => {
  const root3 = join(dirname(fileURLToPath(import.meta.url)), "..");
  const mainSrc2 = readFileSync(join(root3, "src/main.js"), "utf8");
  const htmlSrc2 = readFileSync(join(root3, "index.html"), "utf8");

  it("goes down to a 0.5 nib and says which size it is", () => {
    assert.match(htmlSrc2, /id="slot-width" type="range" min="0.5" max="10" step="0.5"/);
    assert.match(htmlSrc2, /id="slot-width-value"/);
    assert.match(mainSrc2, /els\.slotWidthValue\.textContent = widthLabel\(slot\.width\)/);
    assert.match(mainSrc2, /els\.slotWidthValue\.textContent = widthLabel\(els\.slotWidth\.value\)/);
  });

  it("keeps a half-step width instead of rounding it away", async () => {
    const { slotLineWidth } = await import("./viewport.js");
    assert.equal(slotLineWidth(0.5), 0.5);
    assert.equal(slotLineWidth(0.3), 0.5, "그보다 가늘게는 안 내려간다");
    assert.equal(slotLineWidth(2.4), 2.5);
    assert.equal(slotLineWidth("잘못"), 2);
  });

  it("holds the eyedropper next to the width, and reads what the eye sees", () => {
    assert.match(htmlSrc2, /id="slot-width-value"[\s\S]{0,400}id="eyedrop-btn"/);
    const sample = mainSrc2.slice(mainSrc2.indexOf("function samplePaperColor"), mainSrc2.indexOf("function pickPaperColor"));
    assert.match(sample, /view\.pdfCanvas, view\.underCanvas, view\.inkCanvas, view\.overCanvas, view\.maskCanvas/, "layers in paint order");
    assert.match(sample, /fillStyle = "#FFFFFF"/, "paper first");
    assert.match(mainSrc2, /if \(state\.eyedropKind\) \{/, "the next tap picks, nothing else");
    assert.match(mainSrc2, /addRecentColor\(state\.recentColors, hex\)/, "and the pick is remembered");
  });

  it("opens the wheel where the native input used to be", () => {
    const open = mainSrc2.slice(mainSrc2.indexOf("function openColorPicker"), mainSrc2.indexOf("function wheelPointFrom"));
    assert.match(open, /wheelHsv = hexToHsv\(normalizeHex\(startHex, "#1A1A1A"\)\)/, "starts from the colour being edited");
    assert.match(open, /drawWheelDisc\(\)/);
    assert.match(htmlSrc2, /id="wheel-disc"/);
    assert.match(htmlSrc2, /id="wheel-value"/, "brightness slider");
  });

  it("applies on release through the same path as #158", () => {
    assert.match(mainSrc2, /applyPickedColor\(syncWheelReadout\(\)\)/);
    assert.match(mainSrc2, /\.shape-chips, \.wheel-panel"\)/, "a tap outside closes it without drawing");
    assert.match(mainSrc2, /!els\.wheelPanel\.hidden\s*\)/, "and it counts as an open overlay");
  });
});
