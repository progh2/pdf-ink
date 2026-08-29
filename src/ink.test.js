import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HIGHLIGHTER_OPACITY_DEFAULT,
  PENCIL_COLOR,
  STAMP_DIAMETER_CSS,
  STAMP_LABELS,
  highlighterAlpha,
  highlighterStrokeStyle,
} from "./tools.js";
import { itemHitsEraser, removeHitItems, stampTilt } from "./ink.js";

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
});
