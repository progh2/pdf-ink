import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fingerprintIndex,
  matchPages,
  matchSummary,
  nearestByPosition,
  textFingerprint,
} from "./pageMatch.js";

describe("#200 쪽을 글자로 알아보기", () => {
  it("ignores how the text was laid out", () => {
    assert.equal(textFingerprint(" 1 January  2026 "), textFingerprint("1January2026"));
  });

  it("refuses to identify a page by too few letters", () => {
    assert.equal(textFingerprint("2026"), "", "표지 한 줄로는 쪽을 못 가린다");
    assert.equal(textFingerprint(""), "");
  });

  it("groups the pages that read the same", () => {
    const index = fingerprintIndex({ 1: "aaaaaaaaaa", 2: "bbbbbbbbbb", 5: "aaaaaaaaaa" });
    assert.deepEqual(index.get("aaaaaaaaaa"), [1, 5]);
  });

  describe("같은 글자가 여러 쪽일 때", () => {
    it("takes the page sitting in a similar place", () => {
      assert.equal(nearestByPosition([3, 200], 5, 341, 277), 3);
      assert.equal(nearestByPosition([3, 200], 240, 341, 277), 200);
    });

    it("has nothing to weigh when there is only one", () => {
      assert.equal(nearestByPosition([7], 300, 341, 277), 7);
      assert.equal(nearestByPosition([], 1, 1, 1), 0);
    });
  });

  describe("옮길 쪽 맞추기", () => {
    const fromPrints = { 10: "januaryweek1", 11: "januaryweek2", 12: "", 13: "gone-from-the-new-one" };
    const toPrints = { 4: "januaryweek1", 5: "januaryweek2", 6: "somethingelse" };

    it("pairs the pages it recognises", () => {
      const out = matchPages({ fromPrints, toPrints, wanted: [10, 11], fromCount: 341, toCount: 277 });
      assert.deepEqual(out.pairs, [
        { from: 10, to: 4, sure: true },
        { from: 11, to: 5, sure: true },
      ]);
    });

    it("keeps the pages it could not read apart from the ones it could not find", () => {
      const out = matchPages({ fromPrints, toPrints, wanted: [10, 12, 13], fromCount: 341, toCount: 277 });
      assert.deepEqual(out.blank, [12], "글자가 없어 못 알아본 쪽");
      assert.deepEqual(out.missing, [13], "새 문서에 없는 쪽");
    });

    it("marks a pairing it had to guess", () => {
      const twice = { 4: "januaryweek1", 40: "januaryweek1" };
      const out = matchPages({ fromPrints, toPrints: twice, wanted: [10], fromCount: 341, toCount: 277 });
      assert.equal(out.pairs[0].sure, false);
    });

    it("only looks at the pages that were asked for", () => {
      const out = matchPages({ fromPrints, toPrints, wanted: [], fromCount: 341, toCount: 277 });
      assert.deepEqual(out, { pairs: [], blank: [], missing: [] });
    });
  });

  it("says what happened in one line", () => {
    const out = matchPages({
      fromPrints: { 1: "aaaaaaaaaaaa", 2: "", 3: "bbbbbbbbbbbb" },
      toPrints: { 9: "aaaaaaaaaaaa" },
      wanted: [1, 2, 3],
      fromCount: 3,
      toCount: 9,
    });
    assert.equal(matchSummary(out), "1쪽을 찾았습니다 · 2쪽은 짝이 없습니다");
  });
});

describe("#200 배선", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const main = readFileSync(join(root, "src/main.js"), "utf8");
  const html = readFileSync(join(root, "index.html"), "utf8");

  it("offers it on ⋯ and lists what this browser already holds", () => {
    assert.match(html, /data-more="inkmove">필기 옮기기/);
    assert.match(main, /action === "inkmove"/);
    const open = main.slice(main.indexOf("async function openInkMove"), main.indexOf("async function moveInkFrom"));
    assert.match(open, /await listDocuments\(\)/);
    assert.match(open, /row\.identity !== state\.identity/, "not the document already open");
    assert.match(open, /button\.disabled = !inked\.length/, "nothing to move, nothing to press");
  });

  it("only fingerprints the pages that carry ink", () => {
    const move = main.slice(main.indexOf("async function moveInkFrom"), main.indexOf("/* ---- 링크 고치기"));
    assert.match(move, /fingerprintsOf\(row\.buffer, inked\)/, "the old document: only the inked pages");
    assert.match(move, /fingerprintsOf\(state\.buffer\)/, "the new one: every page, to look them up in");
  });

  it("adds to what is on the page instead of replacing it", () => {
    const move = main.slice(main.indexOf("async function moveInkFrom"), main.indexOf("/* ---- 링크 고치기"));
    assert.match(move, /state\.pages\[key\] = \[\.\.\.\(state\.pages\[key\] \|\| \[\]\), \.\.\.items\]/);
    assert.match(move, /commitBulkChange\(/, "and it all undoes in one go");
  });

  it("says what it moved and what it could not", () => {
    const move = main.slice(main.indexOf("async function moveInkFrom"), main.indexOf("/* ---- 링크 고치기"));
    assert.match(move, /matchSummary\(plan\)/);
    assert.match(move, /같은 쪽을 하나도 찾지 못했습니다/);
  });

  it("reads ink off the old document by the page it was on", () => {
    const items = main.slice(main.indexOf("function inkItemsForPage"), main.indexOf("function closeInkMove"));
    assert.match(items, /leaf\?\.kind !== "outline" && at === pdfPage/);
    assert.match(items, /cloneItems\(items\)/, "a copy, so the old document keeps its own");
  });
});
