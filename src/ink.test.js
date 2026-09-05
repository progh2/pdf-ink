import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  HIGHLIGHTER_OPACITY_DEFAULT,
  PENCIL_COLOR,
  STAMP_COLOR,
  STAMP_HEIGHT_CSS,
  STAMP_LABELS,
  STAMP_WIDTH_CSS,
  highlighterAlpha,
  highlighterStrokeStyle,
  stampItemSize,
  stampPaintLayout,
} from "./tools.js";
import { STROKE_WIDTH_REF_CSS, applyEraserToInk, catmullRomControls, itemHitsEraser, paintPen, removeHitItems, removeHitStamps, stampInkItem, stampTilt, strokeLineWidth } from "./ink.js";

const inkSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "ink.js"), "utf8");
const paintStampSrc = inkSrc.slice(inkSrc.indexOf("export function paintStamp"), inkSrc.indexOf("export function paintErase"));

describe("highlighter alpha in ink", () => {
  it("keeps highlighter style translucent", () => {
    const style = highlighterStrokeStyle("#B8E05A");
    assert.match(style, /0\.4\)$/);
    assert.equal(HIGHLIGHTER_OPACITY_DEFAULT, 40);
    assert.ok(highlighterAlpha() < 1);
  });
});

describe("pencil color in ink", () => {
  it("uses only the grading red", () => {
    assert.equal(PENCIL_COLOR, "#C23A32");
  });
});

describe("stamp geometry", () => {
  it("uses a horizontal oval and the five labels", () => {
    assert.equal(STAMP_WIDTH_CSS, 108);
    assert.equal(STAMP_HEIGHT_CSS, 64);
    assert.ok(STAMP_WIDTH_CSS > STAMP_HEIGHT_CSS);
    assert.equal(STAMP_LABELS.length, 5);
    assert.ok(Math.abs(stampTilt(0.2, 0.3)) < 0.3);
  });

  it("paints the phrase inside the oval, not below it", () => {
    const layout = stampPaintLayout("참 잘했어요", 1);
    assert.equal(layout.width, STAMP_WIDTH_CSS);
    assert.equal(layout.height, STAMP_HEIGHT_CSS);
    assert.equal(layout.inkColor, STAMP_COLOR);
    assert.equal(layout.inkColor, "#C42B2B");
    assert.equal("labelTop" in layout, false);
    assert.equal("gap" in layout, false);
    assert.equal("labelBottom" in layout, false);
    const half = layout.lineHeight / 2;
    layout.textYs.forEach((y, index) => {
      assert.ok(Math.abs(y) + half <= layout.innerRy + 1e-6, `line ${index} y=${y} is outside the oval`);
    });
    assert.match(paintStampSrc, /stampPaintLayout/);
    assert.match(paintStampSrc, /textBaseline = "middle"/);
    assert.match(paintStampSrc, /ellipse\(/);
    assert.ok((paintStampSrc.match(/ellipse\(/g) || []).length >= 2);
    assert.doesNotMatch(paintStampSrc, /textBaseline = "top"/);
    assert.doesNotMatch(paintStampSrc, /labelTop|labelColor|labelBottom/);
    assert.doesNotMatch(paintStampSrc, /ctx\.arc\(/);
  });
});

describe("획 지우개", () => {
  it("removes a stroke the eraser path crosses", () => {
    const stroke = {
      type: "pen",
      width: 2,
      points: [
        { x: 0.1, y: 0.5 },
        { x: 0.9, y: 0.5 },
      ],
    };
    const eraser = {
      type: "erase",
      eraseMode: "stroke",
      width: 4,
      points: [
        { x: 0.5, y: 0.1 },
        { x: 0.5, y: 0.9 },
      ],
    };
    assert.equal(itemHitsEraser(stroke, eraser, 400, 600), true);
    assert.deepEqual(removeHitItems([stroke], eraser, 400, 600), []);
  });

  it("leaves a far-away stroke", () => {
    const stroke = {
      type: "pen",
      width: 2,
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.2, y: 0.1 },
      ],
    };
    const eraser = {
      width: 2,
      points: [
        { x: 0.9, y: 0.9 },
        { x: 0.95, y: 0.95 },
      ],
    };
    assert.equal(itemHitsEraser(stroke, eraser, 400, 600), false);
  });

  it("can erase a stamp by touching its oval, not the old below-label band", () => {
    const stamp = { type: "stamp", stamp: "승인", x: 0.5, y: 0.5 };
    const hit = {
      width: 2,
      points: [{ x: 0.5, y: 0.5 }],
    };
    const miss = {
      width: 2,
      points: [{ x: 0.05, y: 0.05 }],
    };
    const size = stampItemSize(stamp);
    const below = {
      width: 2,
      points: [{ x: 0.5, y: 0.5 + (size.h / 2 + 12) / 600 }],
    };
    assert.equal(itemHitsEraser(stamp, hit, 400, 600), true);
    assert.equal(itemHitsEraser(stamp, miss, 400, 600), false);
    assert.equal(itemHitsEraser(stamp, below, 400, 600), false);
  });

  it("lets the pixel eraser remove a stamp from the ink list", () => {
    const stamp = stampInkItem("승인", 0.5, 0.5);
    const pen = {
      type: "pen",
      width: 2,
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.2, y: 0.1 },
      ],
    };
    const eraser = {
      type: "erase",
      erase: true,
      eraseMode: "pixel",
      width: 4,
      points: [{ x: 0.5, y: 0.5 }],
    };
    assert.deepEqual(removeHitStamps([stamp, pen], eraser, 400, 600), [pen]);
    assert.equal(stamp.type, "stamp");
    assert.equal(stamp.stamp, "승인");
    assert.equal(stamp.w, STAMP_WIDTH_CSS);
    assert.equal(stamp.h, STAMP_HEIGHT_CSS);
  });

  it("pixel-erasing over a stamp removes it from the ink layer", () => {
    const stamp = stampInkItem("참 잘했어요", 0.5, 0.5);
    const pen = {
      type: "pen",
      width: 2,
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.2, y: 0.1 },
      ],
    };
    const eraser = {
      type: "erase",
      erase: true,
      eraseMode: "pixel",
      width: 4,
      points: [
        { x: 0.4, y: 0.5 },
        { x: 0.6, y: 0.5 },
      ],
    };
    const next = applyEraserToInk([stamp, pen], eraser, 400, 600);
    assert.equal(
      next.some((item) => item.type === "stamp"),
      false,
    );
    assert.deepEqual(
      next.filter((item) => item.type === "pen"),
      [pen],
    );
    assert.equal(next.at(-1), eraser);
  });

  it("removes a stamp when the stroke eraser hits it", () => {
    const stamp = stampInkItem("승인", 0.5, 0.5);
    const eraser = {
      type: "erase",
      erase: true,
      eraseMode: "stroke",
      width: 4,
      points: [
        { x: 0.5, y: 0.4 },
        { x: 0.5, y: 0.6 },
      ],
    };
    assert.deepEqual(applyEraserToInk([stamp], eraser, 400, 600), []);
  });
});

describe("#135 부드럽고 빠른 펜", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const main = readFileSync(join(here, "main.js"), "utf8");
  const css = readFileSync(join(here, "style.css"), "utf8");
  const src = readFileSync(join(here, "ink.js"), "utf8");

  it("joins samples with curves, not straight bits", () => {
    // #286: a centripetal Catmull-Rom spline through every point.
    assert.match(src, /bezierCurveTo/);
    assert.match(src, /catmullRomControls/);
    // Two points is still a straight line, one point is still a dot.
    assert.match(src, /if \(points\.length === 2\)[\s\S]*lineTo/);
    assert.match(src, /if \(points\.length === 1\)[\s\S]*0\.15 \* scale/);
  });

  it("draws the stroke in progress on its own layer", () => {
    assert.match(main, /liveCanvas\.className = "live-canvas"/);
    // The live layer sits above the ink and below the pinned images (#180 added
    // the link hints on top; the canvas order below it must not move).
    assert.match(main, /stage\.append\(pdfCanvas, underCanvas, inkCanvas, liveCanvas, overCanvas, maskCanvas(, linkLayer)?\)/);
    assert.match(main, /function drawLiveLayer[\s\S]*paintItem\(ctx, shown, strokeScale\(view\), canvas\)/);
    // A full repaint always wipes the live layer, so nothing is drawn twice.
    // #279: clearLiveLayer는 이제 맨 앞이 아니라 잉크 칠한 뒤(끝)에 온다 —
    // 뗄 때 반짝임을 없애려고.
    assert.match(main, /paintMosaicOverlay\(view\);\s*\/\/ #279[\s\S]{0,120}clearLiveLayer\(view\);\s*\}/);
    assert.match(css, /\.live-canvas,?\n?[\s\S]{0,40}\.over-canvas \{|\.live-canvas/);
  });

  it("keeps the whole-page repaint where the result depends on it", () => {
    const live = main.slice(main.indexOf("function drawLive()"), main.indexOf("function fitScale"));
    assert.match(live, /isPixelErase\(stroke\)/);
    assert.match(live, /isStrokeErase\(stroke\)/);
    assert.match(live, /!state\.shapeOffer/);
    assert.match(live, /!state\.stampGhost/);
    assert.match(live, /drawStrokesOn\(view, stroke\)/);
  });

  it("paints once per frame and takes every pen sample", () => {
    assert.match(main, /livePaintPending/);
    assert.match(main, /window\.requestAnimationFrame\(\(\) => \{[\s\S]*drawLiveLayer/);
    assert.match(main, /getCoalescedEvents/);
    assert.match(main, /for \(const sample of samples\.length > 1 \? samples\.slice\(0, -1\) : \[\]\)/);
  });
});

describe("#286 빠른 획 스플라인", () => {
  const on = (t, p1, c1, c2, p2) => ({
    x: (1 - t) ** 3 * p1.x + 3 * (1 - t) ** 2 * t * c1.x + 3 * (1 - t) * t * t * c2.x + t ** 3 * p2.x,
    y: (1 - t) ** 3 * p1.y + 3 * (1 - t) ** 2 * t * c1.y + 3 * (1 - t) * t * t * c2.y + t ** 3 * p2.y,
  });

  it("keeps finite control points for a normal segment", () => {
    const { c1, c2 } = catmullRomControls({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 1 }, { x: 3, y: 1 });
    for (const c of [c1, c2]) {
      assert.ok(Number.isFinite(c.x) && Number.isFinite(c.y), "no NaN");
    }
    // The Bézier endpoints are the segment's own points, so the curve passes
    // through every captured sample.
    const start = on(0, { x: 1, y: 0 }, c1, c2, { x: 2, y: 1 });
    const end = on(1, { x: 1, y: 0 }, c1, c2, { x: 2, y: 1 });
    assert.deepEqual(start, { x: 1, y: 0 });
    assert.deepEqual(end, { x: 2, y: 1 });
  });

  it("falls back to a uniform cubic when a neighbour coincides", () => {
    // p0 === p1 (a fast start with a doubled sample) must not divide by zero.
    const { c1, c2 } = catmullRomControls({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 9, y: 5 }, { x: 9, y: 5 });
    assert.deepEqual(c1, { x: 5 + 4 / 3, y: 5 });
    assert.deepEqual(c2, { x: 9 - 4 / 3, y: 5 });
  });
});

describe("#288 문서 기준 획 두께", () => {
  it("scales the line to the page, not the CSS display size", () => {
    const stroke = { width: 2 };
    // Same pen, same page fraction: a wider bitmap (bigger displayed page) gives
    // a thicker line, so a big-screen PC no longer draws thinner than a phone.
    const narrow = strokeLineWidth(stroke, { width: STROKE_WIDTH_REF_CSS });
    const wide = strokeLineWidth(stroke, { width: STROKE_WIDTH_REF_CSS * 2 });
    assert.equal(narrow, 2);
    assert.equal(wide, 4);
  });

  it("falls back to the raw width when the canvas has no size", () => {
    assert.equal(strokeLineWidth({ width: 3 }, { width: 0 }), 3);
    assert.equal(strokeLineWidth({}, null), 2);
  });
});

describe("#294 증분 펜 렌더", () => {
  function mockCtx() {
    const calls = { moveTo: [], bezierCurveTo: 0, clearRect: 0 };
    return {
      calls,
      save() {},
      restore() {},
      beginPath() {},
      moveTo(x, y) {
        calls.moveTo.push([x, y]);
      },
      lineTo() {},
      bezierCurveTo() {
        calls.bezierCurveTo += 1;
      },
      stroke() {},
    };
  }
  const canvas = { width: 1000, height: 1000 };
  const stroke = {
    type: "pen",
    width: 2,
    points: [
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.2 },
      { x: 0.3, y: 0.1 },
      { x: 0.4, y: 0.3 },
      { x: 0.5, y: 0.1 },
    ],
  };

  it("draws every segment from the start", () => {
    const ctx = mockCtx();
    paintPen(ctx, stroke, 1, canvas);
    assert.equal(ctx.calls.bezierCurveTo, stroke.points.length - 1);
  });

  it("draws only the tail when given a start index", () => {
    const ctx = mockCtx();
    paintPen(ctx, stroke, 1, canvas, 3);
    // From index 3: one segment (3→4), and the path begins at point 3.
    assert.equal(ctx.calls.bezierCurveTo, 1);
    assert.deepEqual(ctx.calls.moveTo[0], [0.4 * 1000, 0.3 * 1000]);
  });
});
