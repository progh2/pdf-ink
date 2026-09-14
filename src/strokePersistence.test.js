import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

let moduleId = 0;
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// 저장 요청 성공 뒤 트랜잭션이 취소되는 경우도 재현한다.
async function storageHarness(t) {
  const original = { localStorage: globalThis.localStorage, indexedDB: globalThis.indexedDB };
  const local = new Map();
  const backup = new Map();
  const flags = { quota: false, abort: false, unreadable: false, delay: 0 };
  let closed = 0;
  globalThis.localStorage = {
    getItem: key => local.get(key) || null,
    setItem(key, value) {
      if (flags.quota) throw new DOMException("full", "QuotaExceededError");
      local.set(key, value);
    },
  };
  globalThis.indexedDB = {
    open() {
      const req = {};
      queueMicrotask(() => {
        req.result = {
          close() { closed++; },
          transaction(_name, mode) {
            const tx = {};
            const store = {
              get(key) {
                const request = {};
                queueMicrotask(() => {
                  if (flags.unreadable) {
                    tx.error = new DOMException("unavailable", "UnknownError");
                    tx.onabort();
                  } else {
                    request.result = backup.get(key);
                    tx.oncomplete();
                  }
                });
                return request;
              },
              put(value, key) {
                assert.equal(mode, "readwrite");
                const request = { result: key };
                const abort = flags.abort;
                setTimeout(() => {
                  if (abort) {
                    tx.error = new DOMException("abort", "AbortError");
                    tx.onabort();
                  } else {
                    backup.set(key, value);
                    tx.oncomplete();
                  }
                }, flags.delay);
                return request;
              },
            };
            tx.objectStore = () => store;
            return tx;
          },
        };
        req.onsuccess();
      });
      return req;
    },
  };
  t.after(() => Object.assign(globalThis, original));
  const api = await import(`./storage.js?storage-test=${++moduleId}`);
  return { api, local, backup, flags, closed: () => closed };
}
const key = identity => `pdf-ink:strokes:${identity}`;
const pages = id => ({ 1: [{ id, type: "pen", points: [{ x: 0.1, y: 0.2 }] }] });

describe("#430 Safari 필기 대체 저장", () => {
  it("기존 localStorage 기록을 그대로 읽고 작은 필기는 동기적으로 쓴다", async t => {
    const { api, local, backup } = await storageHarness(t);
    local.set(key("old"), JSON.stringify({ pages: pages("legacy"), savedAt: 1 }));
    assert.deepEqual((await api.loadSavedStrokes("old")).pages, pages("legacy"));
    const pending = api.saveStrokes("old", pages("new"));
    assert.deepEqual(JSON.parse(local.get(key("old"))).pages, pages("new"));
    await pending;
    assert.equal(backup.size, 0);
  });

  it("한도에 걸리면 획·쪽 구성·목차·삭제 기록을 함께 대체 저장한다", async t => {
    const { api, local, backup, flags } = await storageHarness(t);
    await api.saveStrokes("A", pages("old"));
    const old = local.get(key("A"));
    flags.quota = true;
    const leaves = [{ id: "p2", pdfPage: 2 }];
    const outline = [{ id: "o1", title: "목차", leafId: "p2" }];
    await api.saveStrokes("A", pages("new"), leaves, outline, { deleted: 12 });
    assert.equal(local.get(key("A")), old, "기존 기록을 지우지 않는다");
    assert.equal(backup.size, 1);
    const recovered = await api.loadSavedStrokes("A");
    assert.deepEqual(recovered.pages, pages("new"));
    assert.deepEqual(recovered.leaves, leaves);
    assert.deepEqual(recovered.outline, outline);
    assert.deepEqual(recovered.gone, { deleted: 12 });
    assert.equal(recovered.leavesVersion, 1);
    assert.equal(recovered.unsaved, false);
  });

  it("앱 재시작 뒤에도 최신 대체 기록을 읽고 더 새로운 localStorage 저장을 우선한다", async t => {
    const { api, backup, flags } = await storageHarness(t);
    flags.quota = true;
    await api.saveStrokes("A", pages("backup"));
    const reopened = await import(`./storage.js?restart=${++moduleId}`);
    assert.deepEqual((await reopened.loadSavedStrokes("A")).pages, pages("backup"));
    flags.quota = false;
    await reopened.saveStrokes("A", pages("latest"));
    assert.deepEqual((await reopened.loadSavedStrokes("A")).pages, pages("latest"));
    assert.equal(backup.size, 1, "오래된 대체 기록이 최신 저장을 가리지 않는다");
  });

  it("동일 밀리초의 연속 저장도 순서를 지키고 늦은 스냅샷을 덮지 않는다", async t => {
    const { api, flags, backup } = await storageHarness(t);
    flags.quota = true;
    flags.delay = 10;
    const firstPages = pages("first");
    const first = api.saveStrokes("A", firstPages);
    firstPages[1][0].id = "mutated";
    const second = api.saveStrokes("A", pages("second"));
    const loaded = api.loadSavedStrokes("A");
    await Promise.all([first, second]);
    assert.deepEqual((await loaded).pages, pages("second"));
    assert.deepEqual(JSON.parse(backup.get(key("A"))).pages, pages("second"));
  });

  it("늦게 끝난 대체 저장보다 새로운 동기 저장을 우선한다", async t => {
    const { api, flags } = await storageHarness(t);
    flags.quota = true;
    flags.delay = 20;
    const older = api.saveStrokes("A", pages("older backup"));
    flags.quota = false;
    await api.saveStrokes("A", pages("new local"));
    await older;
    const loaded = await api.loadSavedStrokes("A");
    assert.deepEqual(loaded.pages, pages("new local"));
    assert.equal(loaded.unsaved, false);
  });

  it("두 저장소가 실패해도 스냅샷을 보존하고 다음 성공으로 재시도한다", async t => {
    const { api, flags, closed } = await storageHarness(t);
    flags.quota = true;
    flags.abort = true;
    await assert.rejects(api.saveStrokes("A", pages("unsaved")), error => {
      assert.equal(error.errors[0].name, "QuotaExceededError");
      assert.equal(error.errors[1].name, "AbortError");
      return true;
    });
    flags.unreadable = true;
    const record = await api.loadSavedStrokes("A");
    flags.unreadable = false;
    assert.deepEqual(record.pages, pages("unsaved"));
    assert.equal(record.unsaved, true);
    assert.ok(closed() >= 2, "실패한 트랜잭션의 연결도 닫는다");
    flags.abort = false;
    await api.saveStrokes("A", record.pages);
    assert.equal((await api.loadSavedStrokes("A")).unsaved, false);
  });

  it("다른 문서 저장과 PDF에 굽기 후 빈 기록을 분리해 복원한다", async t => {
    const { api, flags } = await storageHarness(t);
    flags.quota = true;
    await Promise.all([api.saveStrokes("A", pages("A")), api.saveStrokes("B", pages("B"))]);
    await api.saveStrokes("A", {}, null, [{ title: "baked" }]);
    assert.deepEqual((await api.loadSavedStrokes("A")).pages, {});
    assert.deepEqual((await api.loadSavedStrokes("B")).pages, pages("B"));
  });

  it("대체 기록을 읽을 수 없을 때 오래된 기록을 조용히 반환하지 않는다", async t => {
    const { api, flags } = await storageHarness(t);
    await api.saveStrokes("A", pages("old"));
    flags.quota = true;
    await api.saveStrokes("A", pages("new"));
    flags.unreadable = true;
    await assert.rejects(api.loadSavedStrokes("A"), { name: "UnknownError" });
  });
});

const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
function writer(save, images = () => Promise.resolve()) {
  const context = createContext({
    state: { identity: "A", pages: pages("A"), leaves: [], outline: [], inkGone: {} },
    els: { banner: { textContent: "" } },
    saveStrokes: save, saveInkImages: images,
    stripImages: value => ({ light: value, images: {} }), liveImageIds: () => new Set(),
    console: { warn() {} }, flashBanner() {},
  });
  const fn = main.slice(main.indexOf("const STROKE_SAVE_FAILURE"), main.indexOf("function scheduleStrokeSave"));
  runInContext(`let strokesDirty = true, strokeSaveAttempt = 0, inkImageWarned = false;
    function showBanner(text) { els.banner.textContent = text; }
    ${fn}
    globalThis.write = writeStrokesNow;
    globalThis.dirty = () => strokesDirty;
    globalThis.markDirty = () => { strokesDirty = true; };`, context);
  return context;
}
const tick = () => new Promise(resolve => setImmediate(resolve));

describe("#430 저장 실패 UI와 문서 전환", () => {
  it("대체 저장까지 실패하면 dirty를 복원하고 재시도 성공 뒤 경고를 지운다", async () => {
    let fail = true;
    const ctx = writer(() => fail ? Promise.reject(new Error("full")) : Promise.resolve());
    ctx.write(); await tick();
    assert.equal(ctx.dirty(), true);
    assert.match(ctx.els.banner.textContent, /내보내기/);
    fail = false;
    ctx.write(); await tick();
    assert.equal(ctx.dirty(), false);
    assert.equal(ctx.els.banner.textContent, "");
  });

  it("이전 문서의 늦은 필기·이미지 저장 실패가 새 문서를 더럽히지 않는다", async () => {
    const ink = deferred(), image = deferred();
    const ctx = writer(() => ink.promise, () => image.promise);
    ctx.write();
    ctx.state.identity = "B"; ctx.state.pages = pages("B");
    ink.reject(new Error("A full")); image.reject(new Error("A image full"));
    await tick();
    assert.equal(ctx.dirty(), false);
    assert.equal(ctx.els.banner.textContent, "");
  });

  it("오래된 성공이 더 최근 저장 실패 경고를 숨기지 않는다", async () => {
    const first = deferred();
    let count = 0;
    const ctx = writer(() => ++count === 1 ? first.promise : Promise.reject(new Error("new failure")));
    ctx.write(); ctx.markDirty(); ctx.write(); await tick();
    first.resolve(); await tick();
    assert.equal(ctx.dirty(), true);
    assert.match(ctx.els.banner.textContent, /내보내기/);
  });
});

describe("#430 저장소 읽기 실패로 클라우드 문서가 뒤섞이지 않는다", () => {
  it("PDF를 파괴하거나 정체를 바꾸기 전에 읽기 실패를 반환한다", async () => {
    const state = { identity: "dbx::/A.pdf", pages: pages("A"), pdf: { destroy() { throw new Error("destroyed A"); } } };
    const context = createContext({ state, writeStrokesNow() {}, loadSavedStrokes: () => Promise.reject(new Error("db failed")), showBanner() {}, STROKE_READ_FAILURE: "read failed" });
    const fn = main.slice(main.indexOf("async function openPdfBuffer"), main.indexOf("async function openSelectedFile"));
    runInContext(`let openGen = 0; ${fn}; globalThis.open = openPdfBuffer;`, context);
    await assert.rejects(context.open(new ArrayBuffer(0), { identity: "dbx::/B.pdf", name: "B.pdf" }), { name: "InkStorageReadError" });
    assert.equal(state.identity, "dbx::/A.pdf");
    assert.deepEqual(state.pages, pages("A"));
  });

  it("드롭박스 B 열기 실패 후 A의 필기 저장 대상이 B로 바뀌지 않는다", async () => {
    const original = { path: "/A.pdf", name: "A.pdf", rev: "A-rev" };
    const state = { identity: "dbx::/A.pdf", dropboxDoc: original };
    const context = createContext({
      state, Blob, STROKE_READ_FAILURE: "read failed", DOWNLOAD_URL: "test",
      docFromEntry: entry => entry, dropboxIdentity: doc => `dbx::${doc.path}`,
      showBanner() {}, flashBanner() {}, closeDropboxSheet() {},
      dropboxToken: async () => "", asciiHeader: () => "", downloadArg: () => ({}),
      fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) }),
      pdfTooBigBanner: () => false, validatePdfContents: async () => ({ ok: true }),
      openPdfBuffer: async () => { const error = new Error("read failed"); error.name = "InkStorageReadError"; throw error; },
      loadInkSidecar() { throw new Error("must not load sidecar B"); },
    });
    const fn = main.slice(main.indexOf("async function openDropboxFile"), main.indexOf("async function saveToDropbox"));
    runInContext(`${fn}; globalThis.open = openDropboxFile;`, context);
    await context.open({ path: "/B.pdf", name: "B.pdf", rev: "B-rev" });
    assert.equal(state.dropboxDoc, original);
    assert.equal(state.identity, "dbx::/A.pdf");
  });
});
