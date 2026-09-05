import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  dHash,
  fingerprintIndex,
  grayGrid,
  hamming,
  hashIsFlat,
  HASH_NEAR,
  matchByHash,
  nearLimit,
  mergeMatches,
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
    const move = main.slice(main.indexOf("async function moveInkFrom"), main.indexOf("async function renderOldMoveThumb"));
    assert.match(move, /fingerprintsOf\(row\.buffer, inked,/, "the old document: only the inked pages");
    assert.match(move, /fingerprintsOf\(state\.buffer, null,/, "the new one: every page, to look them up in");
  });

  it("adds to what is on the page unless asked to replace it", () => {
    const apply = main.slice(main.indexOf("async function applyInkMove"), main.indexOf("/* ---- 링크 고치기"));
    assert.match(apply, /const replace = els\.inkMoveReplace\?\.checked/);
    assert.match(apply, /replace \? items : \[\.\.\.\(state\.pages\[key\] \|\| \[\]\), \.\.\.items\]/);
    assert.match(apply, /commitBulkChange\(/, "and it all undoes in one go");
  });

  it("says what it moved and what it could not", () => {
    assert.match(main, /summary: matchSummary\(plan\)/);
    assert.match(main, /왼쪽에서 쪽을 고르고 오른쪽에서 갈 곳을 탭하세요/);
  });

  it("reads ink off the old document by the page it was on", () => {
    const items = main.slice(main.indexOf("function inkItemsForPage"), main.indexOf("function closeInkMove"));
    assert.match(items, /leaf\?\.kind !== "outline" && at === pdfPage/);
    assert.match(items, /cloneItems\(items\)/, "a copy, so the old document keeps its own");
  });
});

describe("#202 쪽 그림으로 견주기", () => {
  const pixels = (draw, width = 36, height = 36) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const at = (y * width + x) * 4;
        const value = draw(x / width, y / height);
        data[at] = value;
        data[at + 1] = value;
        data[at + 2] = value;
        data[at + 3] = 255;
      }
    }
    return { data, width, height };
  };
  const hashOf = (shot) => dHash(grayGrid(shot.data, shot.width, shot.height));

  it("reads the same page the same however bright the scan was", () => {
    const shape = (x, y) => (x > 0.55 ? 30 : 200) - (y > 0.7 ? 20 : 0);
    const dark = hashOf(pixels(shape));
    const pale = hashOf(pixels((x, y) => Math.min(255, shape(x, y) + 40)));
    assert.equal(hamming(dark, pale), 0, "밝기가 달라도 같은 지문");
  });

  it("treats transparent as paper, not as ink", () => {
    const clear = new Uint8ClampedArray(9 * 9 * 4);
    const grid = grayGrid(clear, 9, 9);
    assert.ok(grid.every((value) => value === 255), "빈 캔버스는 흰 종이다");
  });

  it("tells two different pages apart", () => {
    // 세로줄만 있는 쪽과 가로줄만 있는 쪽: 가로 변화만 보면 못 가린다.
    const left = hashOf(pixels((x) => (x > 0.55 ? 20 : 240)));
    const right = hashOf(pixels((x, y) => (y > 0.55 ? 20 : 240)));
    assert.ok(hamming(left, right) > nearLimit(left, right), `달라야 하는데 ${hamming(left, right)}`);
  });

  it("does not trust a page that is all one shade", () => {
    assert.equal(hashIsFlat(hashOf(pixels(() => 255))), true, "백지는 아무 백지와도 닮았다");
    assert.equal(hashIsFlat(hashOf(pixels((x) => (x > 0.5 ? 20 : 240)))), false);
  });

  it("pairs a page with the one it looks like", () => {
    const a = hashOf(pixels((x) => (x > 0.55 ? 20 : 240)));
    const b = hashOf(pixels((x, y) => (y > 0.55 ? 20 : 240)));
    const out = matchByHash({
      fromHashes: { 12: a },
      toHashes: { 3: b, 8: a },
      wanted: [12],
      fromCount: 341,
      toCount: 277,
    });
    assert.equal(out.pairs[0].to, 8);
    assert.equal(out.pairs[0].sure, true);
  });

  it("says nothing rather than guessing when nothing is close", () => {
    const a = hashOf(pixels((x) => (x > 0.55 ? 20 : 240)));
    const b = hashOf(pixels((x, y) => (y > 0.55 ? 20 : 240)));
    const out = matchByHash({ fromHashes: { 12: a }, toHashes: { 3: b }, wanted: [12], near: 4 });
    assert.deepEqual(out.pairs, []);
    assert.deepEqual(out.missing, [12]);
  });

  it("keeps what the letters found and only fills the gaps with pictures", () => {
    const merged = mergeMatches(
      { pairs: [{ from: 1, to: 5, sure: true }], blank: [2], missing: [3] },
      { pairs: [{ from: 2, to: 9, sure: false }, { from: 1, to: 99, sure: true }], blank: [], missing: [] },
    );
    assert.deepEqual(merged.pairs, [
      { from: 1, to: 5, sure: true },
      { from: 2, to: 9, sure: false },
    ], "글자로 찾은 1쪽은 그림이 뒤집지 못한다");
    assert.deepEqual(merged.missing, [3]);
  });
});

describe("#202 무늬가 적은 쪽은 더 깐깐하게", () => {
  it("narrows the bar when there is little to compare", () => {
    const sparse = "1".repeat(5) + "0".repeat(139);
    assert.ok(nearLimit(sparse, sparse) < HASH_NEAR, "획 몇 개짜리끼리는 좁게");
  });

  it("uses the full bar when both pages are busy", () => {
    const busy = "10".repeat(72);
    assert.equal(nearLimit(busy, busy), HASH_NEAR);
  });

  it("never gets so tight that the same page fails to match itself", () => {
    assert.ok(nearLimit("0".repeat(144), "0".repeat(144)) >= 4);
  });
});

describe("#202 배선", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const main = readFileSync(join(root, "src/main.js"), "utf8");
  const html = readFileSync(join(root, "index.html"), "utf8");
  const css = readFileSync(join(root, "src/style.css"), "utf8");

  it("falls back to the picture when the letters found nothing", () => {
    const move = main.slice(main.indexOf("async function moveInkFrom"), main.indexOf("async function renderOldMoveThumb"));
    assert.match(move, /const stillOpen = \[\.\.\.byText\.blank, \.\.\.byText\.missing\]/);
    assert.match(move, /matchByHash\(\{[\s\S]*?wanted: stillOpen/);
    assert.match(move, /mergeMatches\(byText, byImage\)/);
  });

  it("renders each page small and lets the screen breathe", () => {
    const print = main.slice(main.indexOf("async function fingerprintsOf"), main.indexOf("function inkedPagesOf"));
    assert.match(print, /MATCH_SHOT_PX \/ Math\.max\(1, base\.width\)/);
    assert.match(print, /ctx\.fillStyle = "#FFFFFF"/, "paper under a page that draws none");
    assert.match(print, /onStep\?\.\(done, list\.length\)/, "and says how far it got");
    assert.match(print, /await new Promise\(\(resolve\) => window\.setTimeout\(resolve, 0\)\)/);
  });

  it("lists the pages it could not place, so they can be set by hand", () => {
    assert.match(main, /plan\.missing\.map\(\(page\) => \(\{ from: page, to: 0, mode: "skip", sure: false \}\)\)/);
  });

  it("marks a guess so it gets looked at", () => {
    assert.match(main, /card\.classList\.toggle\("is-guess", row\.sure === false/);
    assert.match(css, /\.ink-move-card\.is-guess \{/);
  });

  it("offers replace as a choice, never as the default", () => {
    assert.match(html, /id="ink-move-replace"/);
    assert.doesNotMatch(html, /id="ink-move-replace"[^>]*checked/);
    assert.match(html, /기본은 더하기/);
  });
});

describe("#204 양쪽 창", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const main = readFileSync(join(root, "src/main.js"), "utf8");
  const html = readFileSync(join(root, "index.html"), "utf8");
  const css = readFileSync(join(root, "src/style.css"), "utf8");

  it("puts the two documents side by side, each with its own scroll", () => {
    assert.match(html, /id="ink-move-left"/);
    assert.match(html, /id="ink-move-right"/);
    assert.match(css, /\.ink-move-panes \{[\s\S]*?grid-template-columns: 1fr 1fr/);
    assert.match(css, /\.ink-move-pane \{[\s\S]*?overflow-y: auto/);
  });

  it("draws the ink on both sides, or a blank note page is unrecognisable", () => {
    const old = main.slice(main.indexOf("async function renderOldMoveThumb"), main.indexOf("async function renderNewMoveThumb"));
    assert.match(old, /exportInkCanvas\(items, \{ width: canvas\.width, height: canvas\.height \}, base\.width\)/);
    const now = main.slice(main.indexOf("async function renderNewMoveThumb"), main.indexOf("function watchMoveThumbs"));
    assert.match(now, /paintThumbInk\(canvas, leaf\)/);
  });

  it("renders only what is on screen, and stops watching when the sheet closes", () => {
    assert.match(main, /new IntersectionObserver/);
    assert.match(main, /rootMargin: "160px"/);
    assert.match(main, /watcher\.disconnect\(\)/);
    assert.match(main, /inkMovePlan\.oldPdf\.destroy\(\)/, "the old document is let go too");
  });

  it("assigns by tapping: pick left, tap right, move on to the next unpaired", () => {
    const assign = main.slice(main.indexOf("function assignMoveTarget"), main.indexOf("let inkMoveAssignMode"));
    assert.match(assign, /row\.to = position/);
    assert.match(assign, /row\.mode = inkMoveAssignMode/);
    assert.match(assign, /inkMovePlan\.rows\.find\(\(one\) => one\.mode === "skip" \|\| !one\.to\)/);
    assert.match(main, /먼저 왼쪽에서 옮길 쪽을 고르세요/);
  });

  it("scrolls the right pane to where the pick probably goes", () => {
    const select = main.slice(main.indexOf("function selectMoveRow"), main.indexOf("function assignMoveTarget"));
    assert.match(select, /row\.to \|\| row\.from/, "no proposal falls back to the same number");
    assert.match(select, /scrollIntoView\(\{ block: "center" \}\)/);
  });

  it("can bring a page the old document added, picture and ink together", () => {
    assert.match(html, /id="ink-move-mode-insert">탭한 쪽 뒤에 새 쪽/);
    const payload = main.slice(main.indexOf("async function insertPayloadFor"), main.indexOf("async function applyInkMove"));
    assert.match(payload, /locked: true/, "the page picture cannot be dragged off by accident");
    const apply = main.slice(main.indexOf("async function applyInkMove"), main.indexOf("/* ---- 링크 고치기"));
    assert.match(apply, /payloads\.sort\(\(a, b\) => b\.row\.to - a\.row\.to\)/, "back to front, so positions hold");
    assert.match(apply, /insertOutlineAfter\(state\.leaves, payload\.row\.to - 1, id\)/);
    assert.match(apply, /state\.pages\[id\] = \[payload\.image, \.\.\.payload\.items\]/);
  });
});

describe("#264 ⋯에서 페이지 복사·붙여넣기", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const main = readFileSync(join(root, "src/main.js"), "utf8");
  const html = readFileSync(join(root, "index.html"), "utf8");

  it("offers both on the overflow menu", () => {
    assert.match(html, /data-more="pagecopy">이 쪽 복사/);
    assert.match(html, /data-more="pagepaste"/);
    assert.match(main, /action === "pagecopy"[\s\S]{0,80}copyCurrentPage\(\)/);
    assert.match(main, /action === "pagepaste"[\s\S]{0,80}pasteCurrentPage\(\)/);
  });

  it("copies the current page into the same clip the preview menu uses", () => {
    const copy = main.slice(main.indexOf("function copyCurrentPage"), main.indexOf("function pasteCurrentPage"));
    assert.match(copy, /copyPageLeaf\(state\.leaves, state\.pages, index\)/);
    assert.match(copy, /state\.pageClip = clip/);
  });

  it("pastes after the current page, and says so when the clip is empty", () => {
    const paste = main.slice(main.indexOf("function pasteCurrentPage"), main.indexOf("function movePageByDrag"));
    assert.match(paste, /if \(!canPastePage\(state\.pageClip\)\)/);
    assert.match(paste, /pastePageLeaf\(state\.leaves, state\.pages, index, state\.pageClip\)/);
    assert.match(paste, /commitLeafChange/, "되돌리기 한 벌");
  });
});
