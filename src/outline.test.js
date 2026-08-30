import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  addOutlineEntry,
  deleteOutlineEntry,
  makeOutlineEntry,
  normalizeOutline,
  outlineDestPage,
  outlineTitleForPage,
  PREVIEW_TAB_LABELS,
  PREVIEW_TABS,
  renameOutlineEntry,
  setOutlineTitleText,
} from "./outline.js";
import { BAR_TOOLS } from "./toolbar.js";
import { loadStrokes, saveStrokes } from "./storage.js";
import { insertOutlineAfter, makeOutlineLeaf } from "./preview.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "src/style.css"), "utf8");
const main = readFileSync(join(root, "src/main.js"), "utf8");
const toolbar = html.slice(html.indexOf('id="toolbar"'), html.indexOf('id="workspace"'));
const header = html.slice(html.indexOf('class="write-top"'), html.indexOf('class="write-body"'));
const drawer = html.slice(html.indexOf('id="preview-drawer"'), html.indexOf('id="preview-backdrop"'));
const more = html.slice(html.indexOf('id="more-panel"'), html.indexOf('id="image-input"'));

function withLocalStorage(run) {
  const store = new Map();
  const prev = globalThis.localStorage;
  globalThis.localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
  try {
    return run();
  } finally {
    globalThis.localStorage = prev;
  }
}

describe("#53 개요 추가·수정·삭제", () => {
  it("adds a 페이지 N entry for the current page", () => {
    const next = addOutlineEntry([], 3);
    assert.equal(next.length, 1);
    assert.equal(next[0].title, "페이지 3");
    assert.equal(outlineDestPage(next[0]), 3);
    assert.equal(outlineTitleForPage(2), "페이지 2");
    assert.match(next[0].id, /^t:/);
  });

  it("renames and deletes without touching outline pages", () => {
    let entries = addOutlineEntry([], 1);
    const id = entries[0].id;
    entries = addOutlineEntry(entries, 4);
    entries = renameOutlineEntry(entries, id, "서론");
    assert.equal(entries[0].title, "서론");
    assert.equal(entries[1].title, "페이지 4");
    entries = deleteOutlineEntry(entries, id);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].title, "페이지 4");
    assert.equal(renameOutlineEntry(entries, entries[0].id, "   ")[0].title, "페이지 4");
    const leaf = makeOutlineLeaf("blank");
    const pages = insertOutlineAfter([], 0, "blank");
    assert.equal(leaf.kind, "outline");
    assert.equal(pages[0].kind, "outline");
    assert.notEqual(entries[0].id, pages[0].id);
    assert.notEqual(entries[0].kind, "outline");
  });

  it("persists outline across reload and does not bake into PDF bytes", () => {
    withLocalStorage(() => {
      const outline = addOutlineEntry([], 2);
      saveStrokes("doc::1::1", { 1: [] }, null, outline);
      const loaded = loadStrokes("doc::1::1");
      assert.deepEqual(normalizeOutline(loaded.outline), outline);
      saveStrokes("doc::1::1", { 1: [] }, null, deleteOutlineEntry(outline, outline[0].id));
      assert.deepEqual(normalizeOutline(loadStrokes("doc::1::1").outline), []);
    });
    assert.match(main, /saveStrokes\(state\.identity, state\.pages, state\.leaves, state\.outline\)/);
    assert.match(main, /state\.outline = normalizeOutline\(stored\.outline\)/);
    assert.doesNotMatch(main, /pdf-lib|jsPDF|doc\.outline|setDocOutline/);
    const saveFn = main.slice(main.indexOf("function saveDocumentNow"), main.indexOf("function exportDocumentStub"));
    assert.doesNotMatch(saveFn, /createObjectURL|download|pdf-lib|jsPDF/);
  });

  it("jumps to the destination page and keeps 보기/편집 header", () => {
    const entry = makeOutlineEntry(5, { title: "본문" });
    assert.equal(outlineDestPage(entry), 5);
    assert.match(main, /function addTocEntry/);
    assert.match(main, /goToPage\(dest\)/);
    assert.match(main, /beginTocTitleEdit/);
    assert.match(main, /removeTocEntry/);
    assert.match(main, /keydown/);
    assert.match(main, /blur/);
    assert.doesNotMatch(main, /confirm\(|window\.confirm/);
    assert.match(header, /class="interact-lock-label">편집/);
    assert.match(header, /id="interact-btn"/);
    assert.doesNotMatch(header, /읽기/);
  });

  it("puts 페이지/개요 tabs and +/x in the 120 drawer, not the bar", () => {
    assert.deepEqual(PREVIEW_TABS, ["pages", "toc"]);
    assert.equal(PREVIEW_TAB_LABELS.pages, "페이지");
    assert.equal(PREVIEW_TAB_LABELS.toc, "개요");
    assert.match(drawer, /data-preview-tab="pages">페이지/);
    assert.match(drawer, /data-preview-tab="toc">개요/);
    assert.match(drawer, /id="toc-add"[^>]*>\+/);
    assert.match(drawer, /id="toc-list"/);
    assert.match(main, /preview-toc-delete/);
    assert.match(main, /textContent = "x"/);
    assert.doesNotMatch(main, /long-press delete|tocHold|holdDelete/);
    assert.doesNotMatch(main, /drag.*outline|outline.*draggable|hierarchy|parentId/);
    assert.match(css, /\.preview-drawer \{[\s\S]*width: 120px/);
    assert.match(css, /\.preview-thumb \{[\s\S]*width: 88px/);
    assert.match(css, /\.preview-list \{[\s\S]*gap: 8px/);
    assert.match(css, /\.preview-toc-add \{[\s\S]*height: 32px/);
    assert.match(css, /\.preview-toc-row \{[\s\S]*height: 36px/);
    assert.match(css, /\.preview-toc-list \{[\s\S]*gap: 4px/);
    assert.equal(BAR_TOOLS.length, 9);
    const cells = toolbar.slice(toolbar.indexOf("toolbar-cells"));
    assert.equal((cells.match(/<button/g) || []).length, 9);
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.doesNotMatch(toolbar, /개요|페이지|toc-add|preview-tab/);
    assert.doesNotMatch(more, /data-more="outline"|개요 추가/);
    assert.match(drawer, /개요 페이지 넣기/);
    assert.match(drawer, /data-preview-filter="outline">개요/);
  });

  it("keeps tag-looking title characters as textContent, never innerHTML", () => {
    const tagged = "<b>제목</b>";
    const entry = makeOutlineEntry(1, { title: tagged });
    assert.equal(entry.title, tagged);
    assert.equal(renameOutlineEntry([entry], entry.id, tagged)[0].title, tagged);
    const node = {
      textContent: "",
      set innerHTML(_value) {
        throw new Error("innerHTML");
      },
    };
    setOutlineTitleText(node, tagged);
    assert.equal(node.textContent, tagged);
    const tocUi = main.slice(main.indexOf("function beginTocTitleEdit"), main.indexOf("async function renderPreviewList"));
    assert.match(tocUi, /setOutlineTitleText\(/);
    assert.match(tocUi, /input\.value = entry\.title/);
    assert.doesNotMatch(tocUi, /innerHTML|insertAdjacentHTML|DOMParser|outerHTML/);
    assert.match(main, /from "\.\/outline\.js"/);
    assert.match(main, /setOutlineTitleText/);
  });
});
