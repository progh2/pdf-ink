import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_PAGE_PIXELS,
  MAX_SCALE,
  MIN_SCALE,
  PAN_MARGIN_PX,
  clampScale,
  constrainPan,
  defaultToolbarPosition,
  inkCanvasScale,
  renderZoomFactor,
  scaleFromPinch,
  slotLineWidth,
} from "./viewport.js";

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
  it("clamps 0.5–10 in half steps (#206)", () => {
    assert.equal(slotLineWidth(0.5), 0.5);
    assert.equal(slotLineWidth(0), 0.5);
    assert.equal(slotLineWidth(2.4), 2.5);
    assert.equal(slotLineWidth(99), 10);
    assert.equal(slotLineWidth("잘못"), 2);
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

describe("#96 확대 배율과 선명도", () => {
  it("goes up to 8x and down to 70% (#157)", () => {
    assert.equal(MAX_SCALE, 8);
    assert.equal(MIN_SCALE, 0.7, "#157: 30%까지 줄여 본다");
    assert.equal(clampScale(8), 8);
    assert.equal(clampScale(12), 8);
    assert.equal(clampScale(0.2), 0.7);
    assert.equal(clampScale(0.85), 0.85, "줄인 상태도 그대로 유지");
    assert.equal(scaleFromPinch(100, 900, 1), 8);
  });

  it("renders at the biggest step the zoom asks for", () => {
    // 1080x1560 = 1.68M px, so up to 1.8x fits the 6M budget.
    assert.equal(renderZoomFactor(1, 1080, 1560), 1);
    assert.equal(renderZoomFactor(1.4, 1080, 1560), 1);
    assert.equal(renderZoomFactor(1.5, 1080, 1560), 1.5);
    assert.equal(renderZoomFactor(4, 1080, 1560), 1.5);
  });

  it("never renders past the pixel budget on a big page", () => {
    const wide = renderZoomFactor(8, 2400, 3200);
    assert.equal(wide, 1);
    for (const scale of [1, 2, 4, 8]) {
      const factor = renderZoomFactor(scale, 800, 1100);
      assert.ok(800 * 1100 * factor * factor <= MAX_PAGE_PIXELS, `${scale} → ${factor}`);
    }
  });

  it("comes back down when the reader zooms out", () => {
    assert.equal(renderZoomFactor(3, 600, 800), 3);
    assert.equal(renderZoomFactor(1, 600, 800), 1);
  });
});

describe("#157 줄여 보기", () => {
  it("keeps the page reachable when it is smaller than the screen", () => {
    // 0.7 of a 360x520 page inside a 400x600 view: nothing overflows,
    // so only the push margin is left to move.
    const pan = constrainPan(999, 999, 0.7, 360, 520, 400, 600);
    assert.deepEqual(pan, { x: PAN_MARGIN_PX, y: PAN_MARGIN_PX });
  });

  it("pinches down to the floor and back up", () => {
    assert.equal(scaleFromPinch(400, 100, 1), MIN_SCALE, "pinched hard, stops at 0.7");
    assert.equal(scaleFromPinch(100, 90, 1), 0.9);
    assert.equal(scaleFromPinch(100, 200, 1), 2);
  });

  it("does not ask for a sharper render when shrinking", () => {
    assert.equal(renderZoomFactor(0.7, 1080, 1560), 1);
  });
});
