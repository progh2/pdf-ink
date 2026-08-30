import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  addOutlineItem,
  defaultLeaves,
  deleteOutlineItem,
  filterLeaves,
  inkKey,
  insertOutlineAfter,
  normalizeLeaves,
  normalizeOutline,
  outlineTitleForPage,
  outlineViewport,
  pageOfInkKey,
  renameOutlineItem,
  toggleBookmark,
} from "./preview.js";
import { setLeafRotate } from "./preview.js";

describe("미리보기 책갈피 개요", () => {
  it("builds pdf leaves and inserts a GoodNotes-style outline page", () => {
    const leaves = defaultLeaves(2);
    assert.equal(leaves.length, 2);
    assert.equal(inkKey(leaves[0]), "1");
    const next = insertOutlineAfter(leaves, 0, "alpha");
    assert.equal(next.length, 3);
    assert.equal(next[1].kind, "outline");
    assert.equal(next[1].title, "개요");
    assert.equal(inkKey(next[1]), "o:alpha");
    assert.equal(pageOfInkKey(next, "o:alpha"), 2);
  });

  it("filters bookmarks-only and outline-only", () => {
    let leaves = defaultLeaves(3);
    leaves = insertOutlineAfter(leaves, 1, "div");
    leaves = toggleBookmark(leaves, 0);
    leaves = toggleBookmark(leaves, 2);
    assert.deepEqual(
      filterLeaves(leaves, "bookmarks").map((leaf) => leaf.id),
      ["p1", "o:div"],
    );
    assert.deepEqual(
      filterLeaves(leaves, "outline").map((leaf) => leaf.kind),
      ["outline"],
    );
    assert.equal(filterLeaves(leaves, "all").length, 4);
  });

  it("restores missing pdf pages and swaps outline size when rotated", () => {
    const leaves = normalizeLeaves([{ kind: "outline", id: "o:x", title: "개요" }], 2);
    assert.equal(leaves.filter((leaf) => leaf.kind === "pdf").length, 2);
    assert.ok(leaves.some((leaf) => leaf.id === "o:x"));
    const turned = setLeafRotate(leaves, 0, 90);
    assert.equal(turned[0].rotate, 90);
    assert.deepEqual(outlineViewport(200, 300, 90), { width: 300, height: 200 });
  });
});

describe("#53 개요 항목", () => {
  it("adds a current-page item titled 페이지 N", () => {
    assert.equal(outlineTitleForPage(3), "페이지 3");
    const items = addOutlineItem([], 2, "alpha");
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "ol:alpha");
    assert.equal(items[0].title, "페이지 2");
    assert.equal(items[0].page, 2);
  });

  it("renames on save and deletes without leftovers", () => {
    let items = addOutlineItem([], 1, "a");
    items = addOutlineItem(items, 4, "b");
    items = renameOutlineItem(items, "ol:a", "서론");
    assert.equal(items[0].title, "서론");
    items = renameOutlineItem(items, "ol:a", "   ");
    assert.equal(items[0].title, "페이지 1");
    items = deleteOutlineItem(items, "ol:a");
    assert.deepEqual(
      items.map((item) => item.id),
      ["ol:b"],
    );
  });

  it("keeps valid dest pages and drops junk on restore", () => {
    const restored = normalizeOutline(
      [
        { id: "ol:keep", title: "서론", page: 2 },
        { id: "ol:keep", title: "dup", page: 1 },
        { kind: "nope" },
        { title: "끝", page: 9 },
        null,
      ],
      3,
    );
    assert.deepEqual(restored, [{ id: "ol:keep", title: "서론", page: 2 }]);
    assert.deepEqual(normalizeOutline([{ title: "페이지 1", page: 1 }], 0), []);
  });
});

describe("#53 개요 서랍 크롬", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const html = readFileSync(join(root, "index.html"), "utf8");
  const main = readFileSync(join(root, "src/main.js"), "utf8");
  const toolbar = html.slice(html.indexOf('id="toolbar"'), html.indexOf('id="workspace"'));
  const drawer = html.slice(html.indexOf('id="preview-drawer"'), html.indexOf('id="preview-backdrop"'));

  it("puts + / inline title / x in the drawer, not a toolbar cell", () => {
    assert.match(drawer, /data-preview-filter="outline">개요/);
    assert.match(drawer, /id="outline-add"/);
    assert.match(drawer, />\+<\/button>/);
    assert.doesNotMatch(toolbar, /outline-add|개요 추가|preview-outline/);
    assert.match(main, /addCurrentOutlineItem/);
    assert.match(main, /beginOutlineRename/);
    assert.match(main, /deleteOutlineItem/);
    assert.match(main, /saveStrokes\(state\.identity, state\.pages, state\.leaves, state\.outline\)/);
    assert.match(main, /goToPage\(item\.page\)/);
    assert.doesNotMatch(main, /confirm\(/);
    assert.doesNotMatch(main, /outlineToPdf|writeOutline|setOutline/);
  });
});
