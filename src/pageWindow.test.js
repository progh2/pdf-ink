import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { BAR_TOOLS } from "./toolbar.js";
import {
  PAGE_BITMAP_LIMIT,
  PAGE_STACK_GAP,
  PREVIEW_LIST_GAP,
  PREVIEW_THUMB_WIDTH,
  THUMB_BITMAP_LIMIT,
  createPaintCache,
  markCurrentRows,
  pageAtScrollMid,
  pageBitmapKey,
  pageStackOffset,
  previewListHeight,
  previewPaintsForPlan,
  previewRowStride,
  previewUpdateOnPageChange,
  scrollStackMetrics,
  thumbCacheKey,
  visiblePreviewRows,
  visibleScrollPages,
} from "./pageWindow.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "src/style.css"), "utf8");
const main = readFileSync(join(root, "src/main.js"), "utf8");
const toolbar = html.slice(html.indexOf('id="toolbar"'), html.indexOf('id="workspace"'));

describe("#85 preview / page navigation speed", () => {
  it("does not rebuild the preview list or paint 400 thumbs on goToPage", () => {
    const plan = previewUpdateOnPageChange({ drawerOpen: true, tab: "pages", listBuilt: true });
    assert.equal(plan.rebuildList, false);
    assert.equal(plan.paintAllThumbs, false);
    assert.equal(plan.moveCurrent, true);
    assert.equal(plan.paintVisible, true);

    const paints = previewPaintsForPlan(plan, 400, 640, 0);
    assert.ok(paints > 0);
    assert.ok(paints < 20);
    assert.ok(paints < 400);

    const closed = previewUpdateOnPageChange({ drawerOpen: false, tab: "pages", listBuilt: true });
    assert.equal(closed.rebuildList, false);
    assert.equal(previewPaintsForPlan(closed, 400), 0);

    const rows = markCurrentRows(
      [
        { page: 1, current: true },
        { page: 2, current: false },
      ],
      2,
    );
    assert.deepEqual(
      rows.map((row) => row.current),
      [false, true],
    );

    const goTo = main.slice(main.indexOf("async function goToPage"), main.indexOf("function allowsInkPointer"));
    assert.doesNotMatch(goTo, /renderPreview\s*\(/);
    assert.doesNotMatch(goTo, /renderPreviewList\s*\(/);
    assert.doesNotMatch(goTo, /rebuildPages\s*\(/);
    assert.doesNotMatch(goTo, /replaceChildren\s*\(/);
    assert.doesNotMatch(goTo, /paintPreviewThumb\s*\(/);
    assert.match(goTo, /applyPreviewAfterPageChange\(/);
    assert.match(goTo, /showPageInPlace\(/);
    const after = main.slice(
      main.indexOf("function applyPreviewAfterPageChange"),
      main.indexOf("function updatePager"),
    );
    assert.match(after, /previewUpdateOnPageChange\(/);
    assert.match(after, /syncPreviewCurrent/);
    assert.doesNotMatch(after, /renderPreviewList\s*\(/);
    assert.match(main, /function syncPreviewCurrent/);
    assert.match(main, /function paintVisiblePreviewRows/);
  });

  it("windows the preview list and reuses painted thumbs", () => {
    const nearTop = visiblePreviewRows({ scrollTop: 0, viewportHeight: 640, count: 400 });
    assert.equal(nearTop.from, 0);
    assert.ok(nearTop.count < 20);
    assert.ok(nearTop.to < 20);

    const stride = previewRowStride();
    const deep = visiblePreviewRows({ scrollTop: 200 * stride, viewportHeight: 640, count: 400 });
    assert.ok(deep.from >= 190);
    assert.ok(deep.count < 20);
    assert.ok(deep.to < 220);

    assert.equal(previewListHeight(0), 0);
    assert.ok(previewListHeight(400) > 400 * 100);
    assert.equal(PREVIEW_THUMB_WIDTH, 88);
    assert.equal(PREVIEW_LIST_GAP, 8);

    const cache = createPaintCache(THUMB_BITMAP_LIMIT);
    cache.set("p1:0:pdf", { painted: 1 });
    assert.equal(cache.get("p1:0:pdf").painted, 1);
    for (let i = 0; i < THUMB_BITMAP_LIMIT + 2; i += 1) {
      cache.set(`p${i}`, i);
    }
    assert.equal(cache.has("p0"), false);
    assert.equal(cache.has("p1:0:pdf"), false);
    assert.ok(cache.size <= THUMB_BITMAP_LIMIT);
    assert.equal(thumbCacheKey({ id: "p3", rotate: 90, kind: "pdf" }), "p3:90:pdf");
  });

  it("reuses the page-mode stage and caches recent full-page bitmaps", () => {
    const cache = createPaintCache(PAGE_BITMAP_LIMIT);
    cache.set(pageBitmapKey({ id: "p1", rotate: 0 }, { cssWidth: 400, cssHeight: 600, viewMode: "page" }), {
      ready: true,
    });
    assert.equal(
      cache.get(pageBitmapKey({ id: "p1", rotate: 0 }, { cssWidth: 400, cssHeight: 600, viewMode: "page" })).ready,
      true,
    );
    for (let i = 0; i < PAGE_BITMAP_LIMIT + 1; i += 1) {
      cache.set(`page-${i}`, i);
    }
    assert.ok(cache.size <= PAGE_BITMAP_LIMIT);

    assert.match(main, /createPaintCache\(PAGE_BITMAP_LIMIT\)/);
    assert.match(main, /createPaintCache\(THUMB_BITMAP_LIMIT\)/);
    assert.match(main, /function showPageInPlace/);
    assert.match(main, /function cachePageView/);
    assert.match(main, /function restorePageBitmap/);
    const show = main.slice(main.indexOf("async function showPageInPlace"), main.indexOf("function applyPreviewAfterPageChange"));
    assert.doesNotMatch(show, /rebuildPages\s*\(/);
    assert.match(show, /pageCache\.get/);
    assert.match(show, /restorePageBitmap/);
  });

  it("windows scroll-mode stages instead of creating one per leaf", () => {
    const metrics = scrollStackMetrics(400, 360, 520, 16);
    assert.equal(metrics.count, 400);
    assert.equal(metrics.stride, 536);
    assert.equal(pageStackOffset(1, metrics), 0);
    assert.equal(pageStackOffset(200, metrics), 199 * 536);
    assert.ok(metrics.height > 200000);

    const window = visibleScrollPages({
      scrollTop: 0,
      viewportHeight: 700,
      scale: 1,
      metrics,
      currentPage: 1,
    });
    assert.equal(window.from, 1);
    assert.ok(window.count < 12);
    assert.ok(window.to < 10);

    const mid = visibleScrollPages({
      scrollTop: pageStackOffset(200, metrics),
      viewportHeight: 700,
      scale: 1,
      metrics,
      currentPage: 200,
    });
    assert.ok(mid.from <= 200);
    assert.ok(mid.to >= 200);
    assert.ok(mid.count < 12);
    assert.equal(
      pageAtScrollMid({
        scrollTop: pageStackOffset(40, metrics),
        viewportHeight: 520,
        scale: 1,
        metrics,
      }),
      40,
    );

    const rebuild = main.slice(main.indexOf("async function rebuildPages"), main.indexOf("function scrollPageIntoView"));
    assert.doesNotMatch(rebuild, /for \(let index = 1; index <= state\.leaves\.length/);
    assert.match(rebuild, /syncScrollWindow/);
    assert.match(main, /function syncScrollWindow/);
    assert.match(main, /visibleScrollPages\(/);
    assert.match(main, /from "\.\/pageWindow\.js"/);
  });

  it("does not add a toolbar cell or mix #73/#68/#71/#72", () => {
    assert.equal(BAR_TOOLS.length, 9);
    assert.deepEqual(BAR_TOOLS, [
      "pen",
      "highlighter",
      "pencil",
      "eraser",
      "select",
      "stamp",
      "undo",
      "redo",
      "more",
    ]);
    const cells = toolbar.slice(toolbar.indexOf("toolbar-cells"));
    assert.equal((cells.match(/<button/g) || []).length, 9);
    assert.doesNotMatch(toolbar, /id="preview-btn"|data-tool="preview"/);
    assert.doesNotMatch(html, /id="preview-speed"|id="nav-cache-btn"/);
    assert.match(html, /data-more="preview">미리보기/);
    assert.match(css, /\.preview-drawer \{[\s\S]*width: 120px/);
    assert.match(css, /\.preview-thumb \{[\s\S]*width: 88px/);
    assert.match(css, /\.preview-list \{[\s\S]*gap: 8px/);
    assert.match(css, /\.preview-list-window \{/);
    assert.match(css, /\.page-stack\.is-windowed \{/);
    assert.match(css, /\.select-handle\[data-handle="rotate"\] \{/);
    assert.match(main, /createShapeHold\(/);
    assert.doesNotMatch(main, /holdTriangle|#73|#71|#72/);
  });
});

describe("#94 스크롤 여백 보정", () => {
  const metrics = scrollStackMetrics(20, 360, 520, PAGE_STACK_GAP);

  it("counts the scroll padding out before picking visible pages", () => {
    const padded = visibleScrollPages({ scrollTop: 64, viewportHeight: 600, metrics, offset: 64, overscan: 0 });
    const plain = visibleScrollPages({ scrollTop: 0, viewportHeight: 600, metrics, offset: 0, overscan: 0 });
    assert.deepEqual(padded, plain);
  });

  it("keeps the current page honest at the top of the padded stack", () => {
    assert.equal(pageAtScrollMid({ scrollTop: 64, viewportHeight: 520, metrics, offset: 64 }), 1);
    assert.equal(
      pageAtScrollMid({ scrollTop: 64 + metrics.stride, viewportHeight: 520, metrics, offset: 64 }),
      2,
    );
  });

  it("treats a scroll inside the padding as the first page", () => {
    assert.equal(pageAtScrollMid({ scrollTop: 10, viewportHeight: 520, metrics, offset: 64 }), 1);
    assert.equal(visibleScrollPages({ scrollTop: 10, viewportHeight: 600, metrics, offset: 64 }).from, 1);
  });
});
