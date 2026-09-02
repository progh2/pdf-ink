import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  BOOKMARK_GROUP_TITLE,
  applyBookmarkPages,
  bookmarkPagesFromItems,
  bookmarkPagesFromLeaves,
  bookmarkTitle,
  flattenOutlineItems,
  hasOutlineContent,
  isBookmarkGroup,
  pageFromBookmarkTitle,
} from "./pdfOutline.js";

describe("#145 PDF 목차 읽기", () => {
  const items = [
    { title: "표지", dest: "d1" },
    {
      title: "1장",
      dest: "d2",
      items: [
        { title: "1.1", dest: "d3" },
        { title: "1.2", dest: "d4" },
      ],
    },
    { title: BOOKMARK_GROUP_TITLE, items: [{ title: "5쪽" }, { title: "12쪽" }] },
  ];

  it("flattens a nested outline in reading order", () => {
    const flat = flattenOutlineItems(items);
    assert.deepEqual(flat.map((entry) => entry.title), ["표지", "1장", "1.1", "1.2"]);
    assert.deepEqual(flat.map((entry) => entry.depth), [0, 0, 1, 1]);
  });

  it("keeps the bookmark group out of the table of contents", () => {
    assert.equal(flattenOutlineItems(items).some((entry) => entry.title === BOOKMARK_GROUP_TITLE), false);
    assert.equal(isBookmarkGroup({ title: " 책갈피 " }), true);
    assert.equal(isBookmarkGroup({ title: "책갈피 모음" }), false);
  });

  it("reads the bookmarked pages back out of the group", () => {
    assert.deepEqual(bookmarkPagesFromItems(items), [5, 12]);
    assert.deepEqual(bookmarkPagesFromItems([{ title: "1장" }]), []);
    assert.equal(bookmarkTitle(5), "5쪽");
    assert.equal(pageFromBookmarkTitle("12쪽"), 12);
    assert.equal(pageFromBookmarkTitle("표지"), 0);
  });

  it("turns leaf stars into pages and back", () => {
    const leaves = [{ id: "p1" }, { id: "p2", bookmark: true }, { id: "p3" }];
    assert.deepEqual(bookmarkPagesFromLeaves(leaves), [2]);
    const applied = applyBookmarkPages(leaves, [1, 3]);
    assert.deepEqual(applied.map((leaf) => leaf.bookmark), [true, false, true]);
    assert.deepEqual(applyBookmarkPages(leaves, []).map((leaf) => leaf.bookmark), [false, false, false]);
  });

  it("writes no outline when there is nothing to say", () => {
    assert.equal(hasOutlineContent([], []), false);
    assert.equal(hasOutlineContent([{ title: "a" }], []), true);
    assert.equal(hasOutlineContent([], [3]), true);
  });

  it("ignores empty titles and junk entries", () => {
    assert.deepEqual(flattenOutlineItems([{ title: "  " }, null, { title: "본문" }]).map((e) => e.title), ["본문"]);
    assert.deepEqual(flattenOutlineItems(null), []);
  });
});

describe("#145 배선", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const main = readFileSync(join(root, "src/main.js"), "utf8");

  it("reads the file's outline when opening", () => {
    assert.match(main, /await importPdfOutline\(pdf\)/);
    assert.match(main, /pdf\.getOutline\(\)/);
    assert.match(main, /await pdf\.getPageIndex\(ref\)/);
    assert.match(main, /getDestination\(dest\)/);
  });

  it("lets what the reader edited here win", () => {
    const fn = main.slice(main.indexOf("async function importPdfOutline"), main.indexOf("async function openPdfBuffer"));
    assert.match(fn, /if \(!state\.outline\.length\)/, "only fills an empty table of contents");
    assert.match(fn, /!state\.leaves\.some\(\(leaf\) => leaf\.bookmark\)/, "only fills empty stars");
  });

  it("sends the stars along when saving", () => {
    assert.match(main, /bookmarkPages: bookmarkPagesFromLeaves\(state\.leaves\)/);
  });
});
