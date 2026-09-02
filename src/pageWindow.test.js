import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { BAR_TOOLS } from "./toolbar.js";
import {
  PAGE_BITMAP_LIMIT,
  PAGE_STACK_GAP,
  PREVIEW_WIDTH_DEFAULT,
  PREVIEW_WIDTH_MAX,
  PREVIEW_WIDTH_MIN,
  clampPreviewWidth,
  PREVIEW_LIST_GAP,
  PREVIEW_THUMB_WIDTH,
  THUMB_BITMAP_LIMIT,
  createPaintCache,
  inkSignature,
  markCurrentRows,
  pageAtScrollMid,
  pageBitmapKey,
  pageStackOffset,
  previewListHeight,
  previewPaintsForPlan,
  previewRowStride,
  previewThumbSize,
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
    assert.equal(thumbCacheKey({ id: "p3", rotate: 90, kind: "pdf" }), "p3:90:pdf:88:0");
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

  it("keeps the bar at nine cells (#119) and does not mix #73/#68/#71/#72", () => {
    assert.equal(BAR_TOOLS.length, 9, '#119: 미리보기는 헤더로 갔다');
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
    assert.doesNotMatch(toolbar, /id="preview-btn"/, "#119: 미리보기는 헤더 아이콘");
    assert.match(html.slice(html.indexOf('class="write-top"')), /id="preview-btn"/);
    assert.doesNotMatch(html, /id="preview-speed"|id="nav-cache-btn"/);
    assert.doesNotMatch(html, /data-more="preview"/, "#106: ⋯에서는 빠졌다");
    assert.match(css, /\.preview-drawer \{[\s\S]*width: var\(--preview-w, 120px\)/);
    assert.match(css, /\.preview-thumb \{[\s\S]*width: var\(--thumb-w, 88px\)/);
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

describe("#96 확대 렌더 캐시", () => {
  const leaf = { id: "p3", kind: "pdf", pdfPage: 3, rotate: 0 };

  it("keys the page bitmap by the zoom step, so a blurry one is not reused", () => {
    const one = pageBitmapKey(leaf, { cssWidth: 360, cssHeight: 520, viewMode: "page", factor: 1 });
    const two = pageBitmapKey(leaf, { cssWidth: 360, cssHeight: 520, viewMode: "page", factor: 2 });
    assert.notEqual(one, two);
    assert.equal(one, pageBitmapKey(leaf, { cssWidth: 360, cssHeight: 520, viewMode: "page", factor: 1 }));
    // A missing factor still reads as the base step.
    assert.equal(one, pageBitmapKey(leaf, { cssWidth: 360, cssHeight: 520, viewMode: "page" }));
  });

  it("renders the page at the step and drops stale bitmaps", () => {
    assert.match(main, /scale: scale \* dpr \* state\.renderFactor/);
    assert.match(main, /function scheduleZoomRender\(\)[\s\S]*pageCache\.clear\(\)/);
    assert.match(main, /function scheduleZoomRender\(\)[\s\S]*view\.rendered = false/);
    // Ink thickness stays css-based (#32), so a sharper render keeps the width.
    assert.match(main, /inkCanvasScale\(canvas\.width, cssWidth\)/);
  });
});

describe("#106 서랍 폭", () => {
  it("clamps the width the reader drags to", () => {
    assert.equal(clampPreviewWidth(120), 120);
    assert.equal(clampPreviewWidth(10), PREVIEW_WIDTH_MIN);
    assert.equal(clampPreviewWidth(9000), PREVIEW_WIDTH_MAX);
    assert.equal(clampPreviewWidth("nonsense"), PREVIEW_WIDTH_DEFAULT);
  });

  it("grows the thumb and the row with the drawer", () => {
    const narrow = previewThumbSize(120);
    const wide = previewThumbSize(240);
    assert.equal(narrow.width, 88, "the old 120 drawer keeps its 88 thumb");
    assert.equal(narrow.height, 117);
    assert.ok(wide.width > narrow.width && wide.height > narrow.height);
    assert.ok(previewRowStride(240) > previewRowStride(120));
    assert.ok(previewListHeight(10, 240) > previewListHeight(10, 120));
    // Shape is kept, so a thumb never squashes.
    assert.ok(Math.abs(wide.height / wide.width - narrow.height / narrow.width) < 0.01);
  });

  it("keys a thumb by size and ink, so a wider drawer or a new stroke repaints", () => {
    const leaf = { id: "p1", rotate: 0, kind: "pdf" };
    assert.notEqual(thumbCacheKey(leaf, 88, 0), thumbCacheKey(leaf, 176, 0));
    assert.notEqual(thumbCacheKey(leaf, 88, 0), thumbCacheKey(leaf, 88, 3));
    assert.equal(thumbCacheKey(leaf, 88, 0), thumbCacheKey(leaf, 88, 0));
  });
});

describe("#106 열린 채로 쓰기", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const main = readFileSync(join(here, "main.js"), "utf8");
  const html = readFileSync(join(here, "..", "index.html"), "utf8");
  const css = readFileSync(join(here, "style.css"), "utf8");

  it("does not block ink or close on a paper tap", () => {
    // The drawer is no longer an overlay that swallows the pointer.
    const overlay = main.slice(main.indexOf("function overlayOpen"), main.indexOf("function hideShapeChips"));
    assert.doesNotMatch(overlay, /previewDrawer/);
    assert.doesNotMatch(html, /preview-backdrop/, "the dimmer is gone");
    assert.doesNotMatch(main, /previewBackdrop/);
    const closeAll = main.slice(main.indexOf("function closeAllPanels"), main.indexOf("function placePanel"));
    assert.doesNotMatch(closeAll, /closePreview/);
  });

  it("toggles from the bar cell", () => {
    assert.match(html, /id="preview-btn"/);
    assert.match(main, /function togglePreview[\s\S]*closePreview\(\)/);
    assert.match(main, /els\.previewBtn\?\.addEventListener/);
  });

  it("repaints only the edited page's thumb, after the hand settles", () => {
    assert.match(main, /function refreshPageThumb[\s\S]*THUMB_REFRESH_MS/);
    assert.match(main, /refreshPageThumb\(pageNum\)/);
    // It bails out when the drawer is closed or on the 목차 tab.
    assert.match(main, /function refreshPageThumb[\s\S]*previewDrawer\?\.hidden \|\| state\.previewTab === "toc"/);
    // And it repaints one row, not the whole list.
    const fn = main.slice(main.indexOf("function refreshPageThumb"), main.indexOf("function openPreview"));
    assert.doesNotMatch(fn, /renderPreviewList|renderPreview\(\)/);
  });

  it("resizes by the grip and remembers the width", () => {
    assert.match(css, /\.preview-grip \{[\s\S]*cursor: col-resize/);
    assert.match(main, /savePreviewWidth\(state\.previewWidth\)/);
    assert.match(main, /previewWidth: loadPreviewWidth\(\)/);
    assert.match(main, /clampPreviewWidth\(event\.clientX - box\.left\)/);
  });

  it("deletes a page from the hold menu but never the last one", () => {
    assert.match(html, /data-page-menu="delete">삭제/);
    assert.match(main, /마지막 한 장은 지울 수 없습니다/);
    assert.match(main, /state\.leaves\.filter\(\(_, at\) => at !== index\)/);
  });
});

describe("#122 회전한 쪽의 썸", () => {
  const here2 = dirname(fileURLToPath(import.meta.url));
  const mainSrc = readFileSync(join(here2, "main.js"), "utf8");
  const cssSrc = readFileSync(join(here2, "style.css"), "utf8");

  it("bounds the thumb instead of forcing its size", () => {
    assert.match(cssSrc, /\.preview-thumb \{[\s\S]*max-width: var\(--thumb-w, 88px\)/);
    assert.match(cssSrc, /\.preview-thumb \{[\s\S]*max-height: var\(--thumb-h, 117px\)/);
    assert.doesNotMatch(
      cssSrc.slice(cssSrc.indexOf(".preview-thumb {"), cssSrc.indexOf(".preview-row.is-current")),
      /aspect-ratio/,
      "a turned page is not 3/4",
    );
  });

  it("sizes the element from the bitmap it just painted", () => {
    assert.match(mainSrc, /function fitThumbElement[\s\S]*Math\.min\(size\.width \/ w, size\.height \/ h\)/);
    // Every paint path letterboxes: cache hit, blank page and pdf page.
    assert.equal((mainSrc.match(/^\s+fitThumbElement\(canvas, size\);$/gm) || []).length, 2, "cache hit and fresh paint");
  });
});

describe("#141 넓힌 서랍의 창 계산", () => {
  it("uses the same row height as the spacer and the translate", () => {
    const wide = 300;
    const stride = previewRowStride(wide);
    const range = visiblePreviewRows({ scrollTop: stride * 4, viewportHeight: 600, count: 40, drawerWidth: wide, overscan: 0 });
    // The fifth row starts exactly at the scroll position.
    assert.equal(range.from, 4);
    assert.ok(range.to >= 4);
    // The window is placed at from * stride, so the first visible row lands right.
    assert.equal(range.from * stride, stride * 4);
  });

  it("would have gone wrong with the default width (the bug)", () => {
    const wide = 300;
    const narrow = visiblePreviewRows({ scrollTop: previewRowStride(wide) * 4, viewportHeight: 600, count: 40, overscan: 0 });
    const right = visiblePreviewRows({ scrollTop: previewRowStride(wide) * 4, viewportHeight: 600, count: 40, drawerWidth: wide, overscan: 0 });
    assert.notEqual(narrow.from, right.from, "this mismatch is what emptied the list");
  });

  it("still matches the list height it scrolls through", () => {
    const wide = 300;
    const count = 40;
    const total = previewListHeight(count, wide);
    const last = visiblePreviewRows({ scrollTop: total, viewportHeight: 600, count, drawerWidth: wide, overscan: 0 });
    assert.equal(last.to, count - 1, "the end of the list is reachable");
  });
});

describe("#141 썸 저장과 미리 그리기", () => {
  const here3 = dirname(fileURLToPath(import.meta.url));
  const mainSrc2 = readFileSync(join(here3, "main.js"), "utf8");
  const storage = readFileSync(join(here3, "storage.js"), "utf8");

  it("keeps a rendered thumb for the next time the document opens", () => {
    assert.match(storage, /const THUMB_STORE = "thumbs"/);
    assert.match(storage, /export async function loadThumb/);
    assert.match(storage, /export async function saveThumb/);
    assert.match(storage, /thumbStoreKey\(identity, key\)/, "one document's thumbs never answer for another");
    assert.match(mainSrc2, /storeThumb\(canvas, pageKey\)/);
    assert.match(mainSrc2, /await drawStoredPage\(canvas, pageKey\)/);
    // Only the page picture is stored, so edits do not pile up entries (#143).
    assert.match(mainSrc2, /function pageThumbKey[\s\S]*thumbCacheKey\(leaf, width, "page"\)/);
  });

  it("draws the rest while the reader is busy, and stops when the document changes", () => {
    assert.match(mainSrc2, /function warmThumbs/);
    assert.match(mainSrc2, /requestIdleCallback/);
    assert.match(mainSrc2, /if \(token !== warmToken \|\| identity !== state\.identity\)/);
    assert.match(mainSrc2, /if \(state\.drawing\) \{\s*idle\(step\);/, "never fights the pen");
    assert.match(mainSrc2, /stopThumbWarming\(\)/);
  });

  it("does not put anything of ours inside the pdf", () => {
    // The cache lives beside the document, never in the file (#141 lock).
    const warm = mainSrc2.slice(mainSrc2.indexOf("function warmThumbs"), mainSrc2.indexOf("/* ---- PWA"));
    assert.doesNotMatch(warm, /pdf-lib|PDFDocument|buildAnnotatedPdf/);
  });
});

describe("#143 썸의 필기 서명", () => {
  const stroke = (points) => ({ type: "pen", width: 2, points });

  it("changes when a stroke is added, moved or erased", () => {
    const a = [stroke([{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }])];
    const added = [...a, stroke([{ x: 0.5, y: 0.6 }])];
    const moved = [stroke([{ x: 0.7, y: 0.2 }, { x: 0.9, y: 0.4 }])];
    assert.notEqual(inkSignature(a), inkSignature(added));
    assert.notEqual(inkSignature(a), inkSignature(moved), "a moved stroke is a different picture");
    assert.notEqual(inkSignature(a), inkSignature([]));
  });

  it("is the same across a reload, unlike a session counter", () => {
    const items = [stroke([{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }])];
    const copy = JSON.parse(JSON.stringify(items));
    assert.equal(inkSignature(items), inkSignature(copy));
    assert.equal(inkSignature([]), inkSignature(null));
  });

  it("keys the thumb, so ink and width both force a repaint", () => {
    const leaf = { id: "p1", rotate: 0, kind: "pdf" };
    const empty = inkSignature([]);
    const drawn = inkSignature([stroke([{ x: 0.2, y: 0.2 }])]);
    assert.notEqual(thumbCacheKey(leaf, 88, empty), thumbCacheKey(leaf, 88, drawn));
    assert.notEqual(thumbCacheKey(leaf, 88, drawn), thumbCacheKey(leaf, 176, drawn));
  });
});

describe("#143 썸에 필기", () => {
  const here4 = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here4, "main.js"), "utf8");

  it("draws the ink layers over the page picture", () => {
    assert.match(src, /async function paintThumbInk[\s\S]*exportInkCanvas\(items/);
    assert.match(src, /await paintThumbInk\(canvas, leaf\)/);
    // Blank pages get their ink too, through the same path.
    const paint = src.slice(src.indexOf("async function paintPreviewThumb"), src.indexOf("function insertOutlinePage"));
    assert.match(paint, /renderThumbPage\(canvas, leaf, size\)/);
    assert.match(paint, /await paintThumbInk\(canvas, leaf\)/);
  });

  it("keys the finished thumb by the ink, and stores only the page", () => {
    assert.match(src, /thumbCacheKey\(leaf, size\.width, inkSignature\(items\)\)/);
    assert.match(src, /storeThumb\(canvas, pageKey\)/);
    assert.doesNotMatch(src, /storeThumb\(canvas, key\);/, "an edit must not add a stored entry");
    assert.doesNotMatch(src, /inkStamp/, "the session counter is gone");
  });

  it("still repaints just that page after a stroke", () => {
    assert.match(src, /function refreshPageThumb[\s\S]*paintPreviewThumb\(row, leaf\)/);
    assert.match(src, /refreshPageThumb\(pageNum\)/);
  });
});
