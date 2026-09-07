import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
  sharpOverlayJobs,
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

describe("#354 선명 오버레이 계획", () => {
  const workRect = { left: 100, top: 50, width: 800, height: 600 };

  it("clips each page to the visible slice, in device pixels and page fractions", () => {
    const plan = sharpOverlayJobs({
      workRect,
      pages: [{ pageNum: 3, rect: { left: 300, top: -350, width: 400, height: 800 } }],
      dpr: 2,
    });
    assert.equal(plan.width, 1600);
    const [job] = plan.jobs;
    assert.equal(job.dx, 400, "(300-100)*2");
    assert.equal(job.dy, 0);
    assert.equal(job.sy, 0.5, "페이지 위 절반은 화면 밖");
    assert.equal(job.sh, 0.5);
    assert.equal(job.pagePxH, 1600);
  });

  it("drops pages fully outside and scales down past the pixel budget", () => {
    const plan = sharpOverlayJobs({
      workRect,
      pages: [{ pageNum: 9, rect: { left: 2000, top: 0, width: 100, height: 100 } }],
      dpr: 4,
      maxPixels: 1_000_000,
    });
    assert.equal(plan.jobs.length, 0);
    assert.ok(plan.width * plan.height <= 1_000_001, "예산을 넘지 않는다");
  });

  it("wires hide-on-touch and draw-on-idle into main", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "main.js"), "utf8");
    assert.match(src, /hideSharpOverlay\(\);\s*\n\s*scheduleSharpOverlay\(400\)/, "스크롤: 숨기고 다시");
    assert.match(src, /cancelMomentum\(\);[\s\S]{0,120}hideSharpOverlay\(\)/, "터치: 즉시 숨김");
    assert.match(src, /some\(\(item\) => item\?\.type === "mosaic"\)/, "모자이크 쪽은 오버레이 금지");
    assert.match(src, /state\.userScale <= state\.renderFactor \+ 0\.01/, "이미 선명하면 안 덮는다");
  });
});

describe("#380 오버레이 배경 폴백", () => {
  it("renders via transform matrix and never leaves the paper blank", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "main.js"), "utf8");
    const fn = src.slice(src.indexOf("async function renderSharpOverlay"), src.indexOf("function scheduleZoomRender"));
    assert.match(fn, /transform: \[1, 0, 0, 1, offX, offY\]/, "공식 뷰어 방식");
    assert.match(fn, /console\.warn\("sharp overlay pdf render"/, "원인을 남긴다");
    assert.match(fn, /if \(!painted && page\.view\?\.pdfCanvas\?\.width\)/, "실패 시 기존 캔버스 확대 복사");
  });
});
