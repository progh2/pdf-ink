import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { createImageLoadCache } from "./imageLoad.js";
import { createPaintCache, thumbCacheKey } from "./pageWindow.js";
import { defaultLeaves, normalizeSavedLeaves, inkKey, filterLeaves, leafAt, makeOutlineLeaf } from "./preview.js";
import { insertImportedAfter, importTargetIndex } from "./importPages.js";
import { deletePageLeaves } from "./pageOps.js";
import { buildInkFile, parseInkFile, takeRemoteStructure } from "./inkFile.js";
import { loadStrokes, saveStrokes } from "./storage.js";
import { cloneItems, createHistory, recordChange, undoChange, redoChange } from "./history.js";
import { goneAfterChange } from "./inkMerge.js";
import { makeOutlineEntry, normalizeOutline } from "./outline.js";

const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
function sourceBetween(start, end) {
  return main.slice(main.indexOf(start), main.indexOf(end, main.indexOf(start)));
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("#428 이미지 완료·실패·문서 전환", () => {
  it("썸네일과 본문 어느 쪽이 먼저 요청해도 두 화면에 한 번씩 알린다", async () => {
    for (const order of [["thumb", "body"], ["body", "thumb"]]) {
      const pending = deferred();
      let loads = 0;
      const cache = createImageLoadCache(() => { loads++; return pending.promise; });
      const calls = [];
      const a = cache.get("image", () => calls.push(order[0]));
      const b = cache.get("image", () => calls.push(order[1]));
      pending.resolve({ width: 100 });
      await a.promise;
      assert.equal(a, b);
      assert.equal(loads, 1);
      assert.deepEqual(calls, order);
      assert.equal(a.ready, true);
    }
  });

  it("실패도 대기를 끝내고 문서 전환 후 늦게 온 이미지는 해제한다", async () => {
    const failed = createImageLoadCache(() => Promise.reject(new Error("bad image")));
    let notices = 0;
    const bad = failed.get("bad", () => notices++);
    await bad.promise;
    assert.equal(bad.ready, false);
    assert.equal(bad.settled, true);
    assert.equal(notices, 1);
    const pending = deferred();
    const freed = [];
    const cache = createImageLoadCache(() => pending.promise, img => freed.push(img));
    const old = cache.get("old", () => notices++);
    cache.clear();
    const img = { width: 5 };
    pending.resolve(img);
    await old.promise;
    assert.deepEqual(freed, [img]);
    assert.equal(notices, 1);
    assert.equal(old.ready, false);
    assert.notEqual(cache.get("old"), old);
  });
});

describe("#428 캐시 자원 소유권", () => {
  it("읽기 전용 비트맵은 close, canvas는 크기를 비운다", () => {
    const ctx = createContext({});
    runInContext(sourceBetween("function freeBitmapEntry(", "const pageCache ="), ctx);
    let closed = 0;
    const bitmap = { get width() { return 100; }, close() { closed++; } };
    const cache = createPaintCache(1, ctx.freeBitmapEntry);
    cache.set("a", { bitmap });
    const canvas = { width: 10, height: 20 };
    cache.set("b", { bitmap: canvas });
    assert.equal(closed, 1);
    assert.equal(canvas.width, 10, "아직 캐시에 있는 자원은 유지한다");
    cache.clear();
    assert.equal(canvas.width, 0);
    assert.equal(canvas.height, 0);
    cache.clear();
    assert.equal(closed, 1);
  });

  it("해제 콜백이 실패해도 한도와 clear가 유지된다", () => {
    const cache = createPaintCache(1, () => { throw new Error("already closed"); });
    cache.set("a", {});
    cache.set("b", {});
    assert.equal(cache.size, 1);
    assert.equal(cache.has("a"), false);
    cache.clear();
    assert.equal(cache.size, 0);
  });

  it("다른 문서의 같은 쪽과 늦은 디스크 응답이 현재 캐시에 섞이지 않는다", async () => {
    const key = thumbCacheKey(defaultLeaves(1)[0], 88, "page");
    const pageThumbCache = createPaintCache(5);
    pageThumbCache.set(JSON.stringify(["A", key]), { width: 2, height: 2, bitmap: "A" });
    const calls = [];
    const disk = deferred();
    const ctx = createContext({ state: { identity: "B" }, pageThumbCache,
      loadThumb: (identity) => { calls.push(identity); return disk.promise; },
      createImageBitmap: async () => ({ width: 3, height: 3, close() {} }),
    });
    runInContext(sourceBetween("async function drawStoredPage(", "/** Thumb ink:"), ctx);
    const drawn = [];
    const canvas = { getContext: () => ({ drawImage: img => drawn.push(img) }) };
    let valid = true;
    const request = ctx.drawStoredPage(canvas, key, "B", () => valid);
    assert.deepEqual(calls, ["B"]);
    valid = false;
    disk.resolve({});
    assert.equal(await request, false);
    assert.equal(drawn.length, 0);
    assert.equal(pageThumbCache.size, 1);
  });
});

describe("#428 고정된 가져오기 대상", () => {
  it("서랍 리핏 중에도 행 비율을 유지하고 새 문서는 초기화한다", () => {
    const ctx = createContext({ PREVIEW_THUMB_RATIO: 117 / 88, openGen: 1,
      state: { baseCss: { width: 600, height: 400 } } });
    runInContext(sourceBetween("let previewAspect =", "async function paintVisiblePreviewRows("), ctx);
    assert.equal(ctx.previewRatio(), 2 / 3);
    ctx.state.baseCss = { width: 0, height: 0 };
    assert.equal(ctx.previewRatio(), 2 / 3);
    ctx.openGen++;
    assert.equal(ctx.previewRatio(), 117 / 88);
  });

  it("209쪽 뒤에 여러 쪽을 넣어도 원본 순서·필기 키를 유지한다", () => {
    const leaves = defaultLeaves(212);
    const specs = ["a", "b"].map(id => ({ id: `o:imp-${id}`, title: `${id}.png`, items: [] }));
    const out = insertImportedAfter(leaves, { 210: ["ink"] }, 208, specs);
    assert.equal(out.firstAt + 1, 210);
    assert.equal(out.leaves[211].pdfPage, 210);
    assert.equal(inkKey(out.leaves[211]), "210");
    assert.deepEqual(out.pages[210], ["ink"]);
    assert.equal(filterLeaves(out.leaves, "outline").length, 0);
    assert.equal(makeOutlineLeaf("o:imp-legacy").imported, true);
    assert.equal(filterLeaves([makeOutlineLeaf("blank")], "outline").length, 1);
  });

  it("이동·정렬 후에도 기준 잎을 찾고, 문서 교체·삭제·잠금은 거절한다", () => {
    const target = { identity: "A", gen: 1, leafId: "p1" };
    const current = { identity: "A", gen: 1, interactMode: "edit", leaves: defaultLeaves(3).reverse() };
    assert.equal(importTargetIndex(target, current), 2);
    for (const changes of [{ identity: "B" }, { gen: 2 }, { interactMode: "view" }, { leaves: [] }]) {
      assert.equal(importTargetIndex(target, { ...current, ...changes }), -1);
    }
  });

  it("실제 가져오기 핸들러가 대기 중 이동·중복 실행·문서 교체를 처리한다", async () => {
    for (const change of ["move", "document", "lock", "delete"]) {
      const pending = deferred();
      const state = { identity: "A", page: 1, interactMode: "edit", leaves: defaultLeaves(3), pages: {}, pdf: {} };
      const target = { identity: "A", gen: 1, leafId: "p1", page: 1 };
      let loads = 0, commits = 0;
      const ctx = createContext({ state, pendingImportTarget: target, importingPages: false,
        els: { importPages: { disabled: false } }, currentImportTarget: () => target,
        validImportIndex: t => importTargetIndex(t, { ...state, gen: 1 }),
        classifyImportFile: () => ({ kind: "pdf" }), flashBanner: () => {},
        specsFromPdfFile: () => { loads++; return pending.promise; }, insertImportedAfter,
        commitBulkChange: fn => { commits++; fn(); }, afterPageOp: page => { state.page = page; },
      });
      runInContext(sourceBetween("async function importPagesFromFile(", "function pickImportPages("), ctx);
      const run = ctx.importPagesFromFile({});
      await ctx.importPagesFromFile({});
      assert.equal(loads, 1);
      if (change === "move") state.page = 3;
      if (change === "document") { state.identity = "B"; state.interactMode = "view"; }
      if (change === "lock") state.interactMode = "view";
      if (change === "delete") state.leaves.shift();
      pending.resolve([{ id: "o:imp-new", items: [] }]);
      await run;
      assert.equal(commits, change === "move" ? 1 : 0);
      if (change === "move") assert.equal(state.leaves[1].id, "o:imp-new");
      assert.equal(ctx.els.importPages.disabled, false);
      assert.equal(ctx.importingPages, false);
    }
  });
});

describe("#428 저장 호환과 페이지 이력", () => {
  it("옛 누락 복구는 유지하고 새 삭제 목록은 로컬·사이드카에서 보존한다", () => {
    const deleted = deletePageLeaves(defaultLeaves(3), {}, [1]);
    assert.equal(normalizeSavedLeaves({ leaves: deleted.leaves }, 3).length, 3);
    const remote = parseInkFile(JSON.stringify(buildInkFile({ ...deleted, savedAt: 20 })));
    assert.deepEqual(normalizeSavedLeaves(remote, 3).map(x => x.pdfPage), [1, 3]);
    const previous = globalThis.localStorage;
    const map = new Map();
    globalThis.localStorage = { getItem: key => map.get(key), setItem: (key, value) => map.set(key, value) };
    try {
      saveStrokes("A", {}, deleted.leaves);
      const local = loadStrokes("A");
      assert.equal(local.leavesVersion, 1);
      assert.ok(local.savedAt > 0);
      assert.deepEqual(normalizeSavedLeaves(local, 3).map(x => x.pdfPage), [1, 3]);
    } finally { globalThis.localStorage = previous; }
    assert.equal(takeRemoteStructure({ savedAt: 10, leavesVersion: 1, pages: { 2: ["ink"] } }, remote), true);
    assert.equal(takeRemoteStructure({ savedAt: 30, leavesVersion: 1 }, remote), false);
    assert.equal(takeRemoteStructure({ savedAt: 10, leavesVersion: 1 }, { ...remote, leavesVersion: 0 }), false);
  });

  it("삭제·가져오기 undo/redo가 잎·그림·목차·삭제 표시를 함께 복원한다", () => {
    const state = { leaves: defaultLeaves(3), pages: { 2: [{ id: "ink-2", type: "pen" }] },
      outline: [makeOutlineEntry(2, { leafId: "p2", title: "둘째" })],
      page: 2, history: createHistory(), inkGone: {},
    };
    const persisted = [];
    const ctx = createContext({ state, leafAt, inkKey, cloneItems, recordChange, undoChange, redoChange,
      goneAfterChange, normalizeOutline, syncHistoryButtons: () => {},
      persistStrokes: () => persisted.push(cloneItems({ leaves: state.leaves, pages: state.pages })),
      rebuildPages: () => {}, renderPreview: () => {}, redrawHistoryPage: () => {},
      els: { previewDrawer: { hidden: true } },
    });
    runInContext(sourceBetween("function markStructureChanged(", "/** Ink lives"), ctx);
    runInContext(sourceBetween("function leavesNeedRebuild(", "function redrawHistoryPage("), ctx);
    runInContext(sourceBetween("function undoInk()", "function overflowSide()"), ctx);
    ctx.commitBulkChange(() => {
      const out = deletePageLeaves(state.leaves, state.pages, [1]);
      state.leaves = out.leaves; state.pages = out.pages;
    });
    assert.equal(state.outline.length, 0);
    assert.ok(state.inkGone["ink-2"]);
    ctx.undoInk();
    assert.equal(state.leaves.length, 3);
    assert.equal(state.outline[0].leafId, "p2");
    assert.equal(state.pages[2][0].id, "ink-2");
    assert.equal(state.inkGone["ink-2"], undefined);
    ctx.redoInk();
    assert.equal(state.leaves.length, 2);
    assert.equal(state.outline.length, 0);
    assert.equal(persisted.at(-1).leaves.length, 2);
    ctx.commitBulkChange(() => {
      const out = insertImportedAfter(state.leaves, state.pages, 0, [{ id: "o:imp-x", items: [{ type: "image", id: "img-x", src: "data:image/png;base64,AA" }] }]);
      state.leaves = out.leaves; state.pages = out.pages;
    });
    ctx.undoInk();
    assert.equal(state.pages["o:imp-x"], undefined);
    ctx.redoInk();
    assert.equal(state.pages["o:imp-x"][0].id, "img-x");
    assert.equal(state.inkGone["img-x"], undefined);
  });
});
