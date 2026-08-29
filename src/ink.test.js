import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  HIGHLIGHTER_OPACITY_DEFAULT,
  PENCIL_COLOR,
  STAMP_COLOR,
  STAMP_DIAMETER_CSS,
  STAMP_LABEL_COLOR,
  STAMP_LABEL_GAP_CSS,
  STAMP_LABELS,
  highlighterAlpha,
  highlighterStrokeStyle,
  stampPaintLayout,
} from "./tools.js";
import { applyEraserToInk, itemHitsEraser, removeHitItems, removeHitStamps, stampInkItem, stampTilt } from "./ink.js";

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
  it("uses a 72 CSS px circle and the five labels", () => {
    assert.equal(STAMP_DIAMETER_CSS, 72);
    assert.equal(STAMP_LABELS.length, 5);
    assert.ok(Math.abs(stampTilt(0.2, 0.3)) < 0.3);
  });

  it("places the canvas stamp label below the circle, not inside it", () => {
    const layout = stampPaintLayout("참 잘했어요", 1);
    assert.equal(layout.radius * 2, 72);
    assert.equal(layout.gap, STAMP_LABEL_GAP_CSS);
    assert.equal(layout.gap, 8);
    assert.equal(layout.circleColor, STAMP_COLOR);
    assert.equal(layout.circleColor, "#C42B2B");
    assert.equal(layout.labelColor, STAMP_LABEL_COLOR);
    assert.equal(layout.labelColor, "#5C574E");
    assert.ok(layout.labelTop >= layout.radius + layout.gap);
    layout.lines.forEach((_, index) => {
      const y = layout.labelTop + index * layout.lineHeight;
      assert.ok(y >= layout.radius, `line ${index} y=${y} is inside the circle`);
    });
    assert.ok(layout.labelBottom > layout.labelTop);
    assert.match(paintStampSrc, /stampPaintLayout/);
    assert.match(paintStampSrc, /textBaseline = "top"/);
    assert.match(paintStampSrc, /labelColor/);
    assert.doesNotMatch(paintStampSrc, /textBaseline = "middle"/);
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

  it("can erase a stamp by touching its circle", () => {
    const stamp = { type: "stamp", stamp: "승인", x: 0.5, y: 0.5 };
    const hit = {
      width: 2,
      points: [{ x: 0.5, y: 0.5 }],
    };
    const miss = {
      width: 2,
      points: [{ x: 0.05, y: 0.05 }],
    };
    assert.equal(itemHitsEraser(stamp, hit, 400, 600), true);
    assert.equal(itemHitsEraser(stamp, miss, 400, 600), false);
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
