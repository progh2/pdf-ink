import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultToolbarPosition, inkCanvasScale, slotLineWidth } from "./viewport.js";

describe("inkCanvasScale", () => {
  it("uses layout CSS width, so zoomed visual width cannot change lineWidth", () => {
    const dpr = 3.75;
    const cssWidth = 400;
    const pixelWidth = cssWidth * dpr;
    const zoom = 2;
    const visualWidth = cssWidth * zoom;

    const live = 2 * inkCanvasScale(pixelWidth, cssWidth);
    const afterLift = 2 * inkCanvasScale(pixelWidth, cssWidth);
    const zoomedRectScale = pixelWidth / visualWidth;

    assert.equal(live, afterLift);
    assert.equal(live, 7.5);
    assert.equal(inkCanvasScale(pixelWidth, cssWidth), dpr);
    assert.notEqual(inkCanvasScale(pixelWidth, cssWidth), zoomedRectScale);
  });

  it("keeps the same scale when CSS size is unchanged after commit", () => {
    const scale = inkCanvasScale(1170, 312);
    assert.equal(2 * scale, 2 * inkCanvasScale(1170, 312));
  });

  it("falls back to 1 when sizes are missing", () => {
    assert.equal(inkCanvasScale(0, 400), 1);
    assert.equal(inkCanvasScale(1200, 0), 1);
    assert.equal(inkCanvasScale(undefined, 400), 1);
  });
});

describe("slotLineWidth", () => {
  it("clamps 1–10", () => {
    assert.equal(slotLineWidth(0), 1);
    assert.equal(slotLineWidth(11), 10);
    assert.equal(slotLineWidth(2.4), 2);
  });
});

describe("defaultToolbarPosition", () => {
  it("uses top on a narrow portrait phone", () => {
    assert.equal(defaultToolbarPosition(412, 915), "top");
  });
});
