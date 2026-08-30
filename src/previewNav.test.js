import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { BAR_TOOLS } from "./toolbar.js";
import {
  PAGE_BITMAP_LIMIT,
  PREVIEW_LIST_GAP,
  PREVIEW_OVERSCAN,
  SCROLL_STAGE_GAP,
  SCROLL_STAGE_OVERSCAN,
  THUMB_CACHE_LIMIT,
  leafCacheKey,
  lruMapGet,
  lruMapSet,
  pageFromScrollMid,
  pageOffsetTop,
  previewRowStride,
  scrollStackHeight,
  visibleIndexWindow,
  visiblePageWindow,
} from "./previewNav.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "src/style.css"), "utf8");
const main = readFileSync(join(root, "src/main.js"), "utf8");
const toolbar = html.slice(html.indexOf('id="toolbar"'), html.indexOf('id="workspace"'));

const goTo = main.slice(main.indexOf("async function goToPage"), main.indexOf("function allowsInkPointer"));
const rebuild = main.slice(main.indexOf("async function rebuildPages"), main.indexOf("function scrollPageIntoView"));
const listFn = main.slice(main.indexOf("async function renderPreviewList"), main.indexOf("async function paintPreviewThumb"));
const paintFn = main.slice(main.indexOf("async function paintPreviewThumb"), main.indexOf("function insertOutlinePage"));

describe("#85 미리보기 이동이 400장에서 느림", () => {
  it("windows only a slice of 400 preview rows", () => {
    const stride = previewRowStride();
    const win = visibleIndexWindow({
      scrollTop: 0,
      clientHeight: 500,
      itemStride: stride,
      count: 400,
      overscan: PREVIEW_OVERSCAN,
    });
    assert.ok(stride > 150);
    assert.equal(PREVIEW_LIST_GAP, 8);
    assert.equal(win.from, 0);
    assert.ok(win.to - win.from + 1 < 20);
    assert.ok(win.to < 30);
    const mid = visibleIndexWindow({
      scrollTop: stride * 200,
      clientHeight: 500,
      itemStride: stride,
      count: 400,
      overscan: PREVIEW_OVERSCAN,
    });
    assert.ok(mid.from > 180);
    assert.ok(mid.to < 220);
  });

  it("does not ask scroll mode for 400 stages at once", () => {
    const win = visiblePageWindow({
      scrollTop: 0,
      clientHeight: 800,
      pageHeight: 600,
      gap: SCROLL_STAGE_GAP,
      count: 400,
      scale: 1,
      overscan: SCROLL_STAGE_OVERSCAN,
    });
    assert.equal(win.from, 1);
    assert.ok(win.to - win.from + 1 <= 8);
    assert.equal(scrollStackHeight(400, 600, 16), 400 * 600 + 399 * 16);
    assert.equal(pageOffsetTop(3, 600, 16), 1232);
    assert.equal(pageFromScrollMid(0, 800, 600, 16, 400, 1), 1);
  });

  it("lru keeps recent page bitmaps and evicts the rest", () => {
    const map = new Map();
    lruMapSet(map, "a", 1, 2);
    lruMapSet(map, "b", 2, 2);
    lruMapSet(map, "c", 3, 2);
    assert.equal(map.has("a"), false);
    assert.equal(map.get("b"), 2);
    assert.equal(map.get("c"), 3);
    lruMapSet(map, "b", 22, 2);
    lruMapSet(map, "d", 4, 2);
    assert.equal(map.has("c"), false);
    assert.equal(lruMapGet(map, "b"), 22);
    assert.equal(map.get("b"), 22);
    assert.equal(PAGE_BITMAP_LIMIT, 8);
    assert.ok(THUMB_CACHE_LIMIT >= 32);
    assert.equal(leafCacheKey({ id: "p2", kind: "pdf", rotate: 90, pdfPage: 2 }), "p2:pdf:90:2");
  });

  it("goToPage does not rebuild the preview list or paint every thumb", () => {
    assert.match(goTo, /showPageInPlace/);
    assert.match(goTo, /markPreviewCurrent/);
    assert.doesNotMatch(goTo, /rebuildPages\(/);
    assert.doesNotMatch(goTo, /renderPreview\(/);
    assert.doesNotMatch(goTo, /renderPreviewList\(/);
    assert.doesNotMatch(goTo, /paintPreviewThumb\(/);
    assert.doesNotMatch(goTo, /replaceChildren/);
    assert.match(listFn, /syncPreviewWindow/);
    assert.match(listFn, /paintVisiblePreviewThumbs/);
    assert.doesNotMatch(listFn, /for \(const leaf of shown\)[\s\S]*paintPreviewThumb/);
    assert.match(paintFn, /thumbCache/);
    assert.match(paintFn, /leafCacheKey/);
  });

  it("page mode reuses the stage and caches visited bitmaps", () => {
    assert.match(main, /pageBitmapCache/);
    assert.match(main, /function showPageInPlace/);
    assert.match(main, /function applyCachedPage/);
    assert.match(main, /function rememberPageBitmap/);
    assert.match(main, /PAGE_BITMAP_LIMIT/);
    const show = main.slice(main.indexOf("async function showPageInPlace"), main.indexOf("function allowsInkPointer"));
    assert.doesNotMatch(show, /rebuildPages\(/);
    assert.doesNotMatch(show, /replaceChildren/);
    assert.doesNotMatch(show, /makeStage\([\s\S]*els\.pageStack\.replaceChildren/);
    assert.match(show, /pageBitmapCache\.get|applyCachedPage/);
    assert.match(rebuild, /syncScrollStages/);
    assert.doesNotMatch(rebuild, /for \(let index = 1; index <= state\.leaves\.length/);
    assert.match(main, /function syncScrollStages/);
    assert.match(main, /visiblePageWindow/);
  });

  it("adds no toolbar cell and keeps the 120 drawer", () => {
    assert.equal(BAR_TOOLS.length, 9);
    const cells = toolbar.slice(toolbar.indexOf("toolbar-cells"));
    assert.equal((cells.match(/<button/g) || []).length, 9);
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.doesNotMatch(toolbar, /미리보기 캐시|가상 목록|thumb-cache/);
    assert.match(css, /\.preview-drawer \{[\s\S]*width: 120px/);
    assert.match(css, /\.preview-thumb \{[\s\S]*width: 88px/);
    assert.match(css, /\.preview-list \{[\s\S]*gap: 8px/);
    assert.match(css, /\.preview-virtual \{/);
    assert.match(main, /from "\.\/previewNav\.js"/);
    assert.doesNotMatch(main, /hold-tail|holdTail/);
  });
});
