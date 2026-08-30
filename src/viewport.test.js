import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PAN_MARGIN_PX, constrainPan, defaultToolbarPosition, inkCanvasScale, slotLineWidth } from "./viewport.js";

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

describe("#94 종이 여백만큼 밀기", () => {
  it("pans by the bar thickness even at fit scale", () => {
    // 배율 1: 예전에는 무조건 {0,0}이라 툴바 밑 종이를 못 봤다.
    assert.deepEqual(constrainPan(0, -64, 1, 360, 520, 400, 600), { x: 0, y: -64 });
    assert.deepEqual(constrainPan(0, -200, 1, 360, 520, 400, 600), { x: 0, y: -PAN_MARGIN_PX });
    assert.deepEqual(constrainPan(999, 0, 1, 360, 520, 400, 600), { x: PAN_MARGIN_PX, y: 0 });
    assert.equal(PAN_MARGIN_PX, 64);
  });

  it("adds the margin on top of the zoomed overflow", () => {
    // 720 = 360*2, 화면 400 → 한쪽 160 넘침 + 여백 64.
    assert.deepEqual(constrainPan(999, 0, 2, 360, 520, 400, 600), { x: 160 + PAN_MARGIN_PX, y: 0 });
    assert.deepEqual(constrainPan(-999, 0, 2, 360, 520, 400, 600), { x: -160 - PAN_MARGIN_PX, y: 0 });
  });

  it("keeps a small pan inside the margin untouched", () => {
    assert.deepEqual(constrainPan(12, -8, 1, 360, 520, 400, 600), { x: 12, y: -8 });
  });
});
