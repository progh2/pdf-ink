// #428: 문서별 비동기 작업·확정 목록·고정 삽입 위치에 맞춰 배선 핀을 갱신했다. 동작은 previewLifecycle.test.js에서 검증한다.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LEAF_RATIO_MAX,
  LEAF_RATIO_MIN,
  defaultLeaves,
  filterLeaves,
  inkKey,
  leafPaperBox,
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

describe("#338 유령 리프 차단 배선", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, "main.js"), "utf8");

  it("merges remote leaves against the real PDF page count, not the leaf count", () => {
    const uses = src.match(/normalizeSavedLeaves\(remote, state\.pdf\?\.numPages \|\| state\.pageCount \|\| remote\.leaves\.length\)/g) || [];
    assert.equal(uses.length, 2, "채택부 두 곳 모두");
  });

  it("renders a ghost leaf as blank paper instead of erroring forever", () => {
    assert.match(src, /page = await state\.pdf\.getPage\(leaf\.pdfPage\);\s*\} catch/);
  });
});

describe("#454 가져온 쪽은 제 모양을 가진다", () => {
  it("비율은 저장본을 오가도 살아남는다", () => {
    const leaf = makeOutlineLeaf("imp-1", { imported: true, ratio: 16 / 9 });
    assert.ok(Math.abs(leaf.ratio - 16 / 9) < 1e-9);
    const back = normalizeLeaves([leaf], 1, { complete: true });
    assert.ok(Math.abs(back[0].ratio - 16 / 9) < 1e-9, "사이드카를 오가도 남는다");
    // 빈 쪽(#118)은 여전히 비율이 없다 — 이웃 쪽 크기를 빌린다.
    assert.equal(makeOutlineLeaf("blank-1", {}).ratio, undefined);
  });

  it("말도 안 되는 값은 받지 않는다", () => {
    assert.equal(makeOutlineLeaf("a", { ratio: 0 }).ratio, undefined);
    assert.equal(makeOutlineLeaf("b", { ratio: -3 }).ratio, undefined);
    assert.equal(makeOutlineLeaf("c", { ratio: "크다" }).ratio, undefined);
    assert.equal(makeOutlineLeaf("d", { ratio: 500 }).ratio, LEAF_RATIO_MAX);
    assert.equal(makeOutlineLeaf("e", { ratio: 0.0001 }).ratio, LEAF_RATIO_MIN);
  });

  it("종이는 칸을 넘지 않는다 — 넘치면 다음 쪽과 겹친다", () => {
    for (const ratio of [0.2, 0.5, 1, 1.78, 3, 9]) {
      const box = leafPaperBox(400, 600, ratio);
      assert.ok(box.width <= 400 + 1e-9 && box.height <= 600 + 1e-9, `${ratio}가 칸을 넘었다`);
      assert.ok(Math.abs(box.height / box.width - ratio) < 1e-9, "제 비율을 지킨다");
    }
  });

  it("세로로 긴 그림은 좁고 긴 종이가 된다", () => {
    const box = leafPaperBox(400, 600, 16 / 9);
    assert.ok(Math.abs(box.height - 600) < 1e-9, "칸 높이를 꽉 채운다");
    assert.ok(box.width < 400, "좌우로는 남는다 — 그 자리는 흰 종이가 아니라 바탕");
  });

  it("돌린 쪽은 비율도 뒤집혀 눕는다", () => {
    const box = leafPaperBox(400, 600, 16 / 9, 90);
    assert.ok(Math.abs(box.width / box.height - 16 / 9) < 1e-9);
    assert.ok(box.width <= 400 + 1e-9 && box.height <= 600 + 1e-9);
  });

  it("비율이 없으면 칸을 그대로 쓴다 (옛 가져온 쪽·빈 쪽)", () => {
    assert.deepEqual(leafPaperBox(400, 600, 0), { width: 400, height: 600 });
    assert.deepEqual(leafPaperBox(400, 600, undefined), { width: 400, height: 600 });
  });
});
