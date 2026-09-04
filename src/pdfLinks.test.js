import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  acceptLinkUrl,
  leafPositionForPdfPage,
  normalizedLinkRect,
  pagePositionForAction,
  pdfLinkCacheKey,
  pdfLinkItem,
  pdfLinkTarget,
} from "./pdfLinks.js";

describe("#178 PDF 안의 링크", () => {
  it("takes a web address the file points at", () => {
    assert.equal(acceptLinkUrl("https://example.com/a?b=1"), "https://example.com/a?b=1");
    assert.equal(acceptLinkUrl("mailto:teacher@school.kr"), "mailto:teacher@school.kr");
  });

  it("refuses schemes a document should not be able to run", () => {
    assert.equal(acceptLinkUrl("javascript:alert(1)"), "");
    assert.equal(acceptLinkUrl("file:///etc/passwd"), "");
    assert.equal(acceptLinkUrl("data:text/html,<script>"), "");
    assert.equal(acceptLinkUrl(""), "");
  });

  it("reads a web link off an annotation", () => {
    assert.deepEqual(pdfLinkTarget({ subtype: "Link", url: "https://a.kr/" }), {
      kind: "url",
      href: "https://a.kr/",
    });
  });

  it("keeps an inside-the-document destination for the caller to resolve", () => {
    assert.deepEqual(pdfLinkTarget({ subtype: "Link", dest: "chapter.3" }), { kind: "dest", dest: "chapter.3" });
    const explicit = [{ num: 9, gen: 0 }, { name: "XYZ" }, 0, 700, null];
    assert.deepEqual(pdfLinkTarget({ subtype: "Link", dest: explicit }), { kind: "dest", dest: explicit });
  });

  it("understands the go-to-page actions", () => {
    assert.deepEqual(pdfLinkTarget({ subtype: "Link", action: "LastPage" }), { kind: "action", action: "LastPage" });
    assert.equal(pdfLinkTarget({ subtype: "Link", action: "Print" }), null, "printing is not a link");
  });

  it("ignores anything that is not a link, and links that point nowhere", () => {
    assert.equal(pdfLinkTarget({ subtype: "Widget", url: "https://a.kr/" }), null);
    assert.equal(pdfLinkTarget({ subtype: "Link" }), null);
    assert.equal(pdfLinkTarget(null), null);
  });

  it("prefers the address pdf.js already vetted over a raw one", () => {
    const target = pdfLinkTarget({ subtype: "Link", url: "https://ok.kr/", unsafeUrl: "javascript:alert(1)" });
    assert.deepEqual(target, { kind: "url", href: "https://ok.kr/" });
    assert.equal(pdfLinkTarget({ subtype: "Link", unsafeUrl: "javascript:alert(1)" }), null);
  });

  describe("상자", () => {
    const near = (actual, expected) => {
      for (const key of ["x", "y", "w", "h"]) {
        assert.ok(Math.abs(actual[key] - expected[key]) < 1e-9, `${key}: ${actual[key]} != ${expected[key]}`);
      }
    };

    it("normalizes a viewport rectangle", () => {
      near(normalizedLinkRect([100, 200, 300, 260], 1000, 2000), { x: 0.1, y: 0.1, w: 0.2, h: 0.03 });
    });

    it("sorts corners that arrive the other way round", () => {
      const a = normalizedLinkRect([300, 260, 100, 200], 1000, 2000);
      assert.deepEqual(a, normalizedLinkRect([100, 200, 300, 260], 1000, 2000));
    });

    it("clips a box that hangs off the paper", () => {
      near(normalizedLinkRect([-50, -50, 500, 500], 1000, 1000), { x: 0, y: 0, w: 0.5, h: 0.5 });
    });

    it("drops empty and broken boxes", () => {
      assert.equal(normalizedLinkRect([10, 10, 10, 10], 1000, 1000), null);
      assert.equal(normalizedLinkRect([0, 0, 100], 1000, 1000), null);
      assert.equal(normalizedLinkRect([0, 0, 100, 100], 0, 1000), null);
      assert.equal(normalizedLinkRect([0, NaN, 100, 100], 1000, 1000), null);
    });
  });

  describe("어디로 보낼 것인가", () => {
    const leaves = [
      { id: "a", kind: "pdf", pdfPage: 1 },
      { id: "b", kind: "outline", title: "2장" },
      { id: "c", kind: "pdf", pdfPage: 5 },
      { id: "d", kind: "pdf", pdfPage: 2 },
    ];

    it("sends a link to where that page sits now, not to its old number", () => {
      assert.equal(leafPositionForPdfPage(leaves, 5), 3, "쪽을 옮겨도 따라간다");
      assert.equal(leafPositionForPdfPage(leaves, 2), 4);
    });

    it("counts an inserted table-of-contents leaf as a page", () => {
      assert.equal(leafPositionForPdfPage(leaves, 1), 1);
    });

    it("says nothing when the page is not in the document any more", () => {
      assert.equal(leafPositionForPdfPage(leaves, 9), 0);
      assert.equal(leafPositionForPdfPage(leaves, 0), 0);
      assert.equal(leafPositionForPdfPage([], 1), 0);
    });

    it("moves by one, and stops at both ends", () => {
      assert.equal(pagePositionForAction("NextPage", 2, 10), 3);
      assert.equal(pagePositionForAction("PrevPage", 1, 10), 1);
      assert.equal(pagePositionForAction("LastPage", 2, 10), 10);
      assert.equal(pagePositionForAction("FirstPage", 7, 10), 1);
      assert.equal(pagePositionForAction("Print", 2, 10), 0);
    });
  });

  it("makes an item only when both halves are there", () => {
    assert.deepEqual(pdfLinkItem({ x: 0, y: 0, w: 1, h: 1 }, { kind: "url", href: "https://a.kr/" }), {
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      link: { kind: "url", href: "https://a.kr/" },
    });
    assert.equal(pdfLinkItem(null, { kind: "url", href: "https://a.kr/" }), null);
    assert.equal(pdfLinkItem({ x: 0, y: 0, w: 1, h: 1 }, null), null);
  });

  it("keys the cache by rotation, so turning a page redraws its boxes", () => {
    assert.notEqual(pdfLinkCacheKey(3, 0), pdfLinkCacheKey(3, 90));
    assert.equal(pdfLinkCacheKey(3, 0), pdfLinkCacheKey("3", null));
  });
});

describe("#178 배선", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const main = readFileSync(join(root, "src/main.js"), "utf8");

  it("reads a page's links once, and again when that page is turned", () => {
    const load = main.slice(main.indexOf("async function loadPdfLinks"), main.indexOf("function pdfLinkAt"));
    assert.match(load, /const cached = state\.pdfLinks\.get\(key\);\s*if \(cached\) \{\s*return cached;/);
    assert.match(load, /pdfLinkCacheKey\(leaf\.pdfPage, leaf\.rotate\)/);
    assert.match(load, /getAnnotations\(\{ intent: "display" \}\)/);
    assert.match(load, /\(\(page\.rotate \|\| 0\) \+ \(leaf\.rotate \|\| 0\)\) % 360/, "our rotation on top of the file's");
  });

  it("follows a tap only while the page is locked, so writing is never a click", () => {
    const follow = main.slice(main.indexOf("async function followPdfLinkAtClient"), main.indexOf("function updateAreaHits"));
    assert.match(follow, /state\.interactMode !== "view"/);
    assert.match(main, /const tapped = \(gesture\.moved \|\| 0\) <= PAN_TAP_SLOP_PX/, "a drag is not a tap");
  });

  it("opens an outside address in its own tab, never in ours", () => {
    assert.match(main, /window\.open\(link\.href, "_blank", "noopener,noreferrer"\)/);
  });

  it("sends an inside link to where that page sits now", () => {
    assert.match(main, /const pdfPage = await pdfPageOfDest\(link\.dest\)/);
    assert.match(main, /leafPositionForPdfPage\(state\.leaves, pdfPage\)/);
    assert.match(main, /가리키는 쪽이 문서에 없습니다/, "a link to a deleted page says so");
  });

  it("forgets one file's links when another opens", () => {
    assert.match(main, /pdfLinks: new Map\(\)/, "the document starts with none");
    assert.equal((main.match(/state\.pdfLinks = new Map\(\)/g) || []).length, 2, "both paths that swap the file");
  });
});

describe("#180 링크 자리 표시", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const main = readFileSync(join(root, "src/main.js"), "utf8");
  const css = readFileSync(join(root, "src/style.css"), "utf8");

  it("shows them only while the page is locked, where a tap follows them", () => {
    assert.match(css, /\.pdf-link-layer \{[\s\S]*?display: none;[\s\S]*?\}/);
    assert.match(css, /\.write-screen\[data-interact="view"\] \.pdf-link-layer \{\s*display: block;/);
  });

  it("is a pale blue that never eats a touch", () => {
    assert.match(css, /\.pdf-link-hint \{[\s\S]*?background: rgba\(93, 173, 226, 0\.18\)/);
    assert.match(css, /\.pdf-link-layer \{[\s\S]*?pointer-events: none;/);
  });

  it("places the boxes in percent, so zoom does not repaint them", () => {
    const paint = main.slice(main.indexOf("async function paintPdfLinkHints"), main.indexOf("function clearPdfLinkHints"));
    assert.match(paint, /box\.style\.left = `\$\{item\.x \* 100\}%`/);
    assert.match(paint, /box\.style\.height = `\$\{item\.h \* 100\}%`/);
    assert.doesNotMatch(paint, /getBoundingClientRect/);
  });

  it("repaints only when the page or its rotation changed", () => {
    const paint = main.slice(main.indexOf("async function paintPdfLinkHints"), main.indexOf("function clearPdfLinkHints"));
    assert.match(paint, /if \(layer\.dataset\.key === key\) \{\s*return;/);
    assert.match(paint, /pdfLinkCacheKey\(stillHere\.pdfPage, stillHere\.rotate\) !== key/, "the view may hold another page by now");
  });

  it("never leaves the last page's boxes on a reused stage", () => {
    assert.match(main, /pooled\.token \+= 1;\s*clearPdfLinkHints\(pooled\)/);
    assert.match(main, /view\.rendered = false;\s*clearPdfLinkHints\(view\)/);
  });
});
