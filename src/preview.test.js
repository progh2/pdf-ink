import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultLeaves,
  filterLeaves,
  inkKey,
  insertOutlineAfter,
  makeOutlineLeaf,
  makePdfLeaf,
  nearestPdfLeaf,
  normalizeLeaves,
  outlineViewport,
  pageOfInkKey,
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
    assert.equal(next[1].title, "빈 쪽", "#107: 빈 쪽은 목차가 아니다");
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

describe("#118 빈 쪽 크기", () => {
  const leaves = [
    makePdfLeaf(1),
    makeOutlineLeaf("a"),
    makePdfLeaf(2),
    makeOutlineLeaf("b"),
  ];

  it("borrows the size from the page before it", () => {
    assert.equal(nearestPdfLeaf(leaves, 1)?.pdfPage, 1);
    assert.equal(nearestPdfLeaf(leaves, 3)?.pdfPage, 2);
  });

  it("looks forward when the blank page leads", () => {
    const leading = [makeOutlineLeaf("a"), makePdfLeaf(7)];
    assert.equal(nearestPdfLeaf(leading, 0)?.pdfPage, 7);
  });

  it("gives up quietly when there is no pdf page at all", () => {
    assert.equal(nearestPdfLeaf([makeOutlineLeaf("a")], 0), null);
    assert.equal(nearestPdfLeaf([], 0), null);
  });
});
