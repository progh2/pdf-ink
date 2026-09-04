import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearLinkFix,
  countLinkFixes,
  findLinkFix,
  linkFixTarget,
  linkGroupKey,
  linkSpotKey,
  normalizeLinkFix,
  sanitizeLinkFixes,
  setLinkFix,
} from "./linkFix.js";

describe("#190 링크 고치기", () => {
  const dest = { kind: "dest", dest: [{ num: 812, gen: 0 }, { name: "XYZ" }] };
  const spot = linkSpotKey(3, [50.4, 640.2, 300.7, 670.1]);
  const group = linkGroupKey(dest);

  it("holds one link by the page and the box it sits in", () => {
    assert.equal(spot, "3@50,640,301,670");
    assert.equal(linkSpotKey(3, [50, 640, 301, 670]), spot, "rounding is stable");
  });

  it("groups links that were pointing at the same place", () => {
    assert.equal(linkGroupKey(dest), linkGroupKey({ kind: "dest", dest: dest.dest }));
    assert.notEqual(linkGroupKey(dest), linkGroupKey({ kind: "dest", dest: "elsewhere" }));
    assert.equal(linkGroupKey({ kind: "url", href: "https://a.kr/" }), "url:https://a.kr/");
  });

  it("takes a page number or a web address, and nothing else", () => {
    assert.deepEqual(normalizeLinkFix({ kind: "page", page: "12" }), { kind: "page", page: 12 });
    assert.deepEqual(normalizeLinkFix({ kind: "url", href: "https://a.kr" }), { kind: "url", href: "https://a.kr/" });
    assert.equal(normalizeLinkFix({ kind: "page", page: 0 }), null);
    assert.equal(normalizeLinkFix({ kind: "url", href: "javascript:alert(1)" }), null);
    assert.equal(normalizeLinkFix({ kind: "doc" }), null);
    assert.equal(normalizeLinkFix(null), null);
  });

  it("fixes just this one when asked for one", () => {
    const fixes = setLinkFix({}, { spotKey: spot, groupKey: group, fix: { kind: "page", page: 5 } });
    assert.deepEqual(findLinkFix(fixes, spot, group), { kind: "page", page: 5 });
    assert.equal(findLinkFix(fixes, linkSpotKey(9, [0, 0, 1, 1]), group), null, "another copy is untouched");
  });

  it("fixes every link that pointed at the same place when asked for all", () => {
    const fixes = setLinkFix({}, { spotKey: spot, groupKey: group, bulk: true, fix: { kind: "page", page: 5 } });
    const elsewhere = linkSpotKey(11, [10, 20, 30, 40]);
    assert.deepEqual(findLinkFix(fixes, elsewhere, group), { kind: "page", page: 5 }, "other pages follow");
    assert.equal(findLinkFix(fixes, elsewhere, "dest:other"), null, "a different destination does not");
  });

  it("lets one link differ from the group it belongs to", () => {
    let fixes = setLinkFix({}, { spotKey: spot, groupKey: group, bulk: true, fix: { kind: "page", page: 5 } });
    fixes = setLinkFix(fixes, { spotKey: spot, groupKey: group, fix: { kind: "page", page: 9 } });
    assert.deepEqual(findLinkFix(fixes, spot, group), { kind: "page", page: 9 }, "this one");
    assert.deepEqual(findLinkFix(fixes, "7@1,2,3,4", group), { kind: "page", page: 5 }, "the rest");
  });

  it("drops the one-off exception when the whole group is set again", () => {
    let fixes = setLinkFix({}, { spotKey: spot, groupKey: group, fix: { kind: "page", page: 9 } });
    fixes = setLinkFix(fixes, { spotKey: spot, groupKey: group, bulk: true, fix: { kind: "page", page: 5 } });
    assert.deepEqual(findLinkFix(fixes, spot, group), { kind: "page", page: 5 });
    assert.equal(countLinkFixes(fixes), 1);
  });

  it("puts a link back the way the file had it", () => {
    let fixes = setLinkFix({}, { spotKey: spot, groupKey: group, bulk: true, fix: { kind: "page", page: 5 } });
    fixes = clearLinkFix(fixes, { spotKey: spot, groupKey: group, bulk: true });
    assert.equal(countLinkFixes(fixes), 0);
  });

  it("keeps the group when only this one is put back", () => {
    let fixes = setLinkFix({}, { spotKey: spot, groupKey: group, bulk: true, fix: { kind: "page", page: 5 } });
    fixes = setLinkFix(fixes, { spotKey: spot, groupKey: group, fix: { kind: "page", page: 9 } });
    fixes = clearLinkFix(fixes, { spotKey: spot, groupKey: group });
    assert.deepEqual(findLinkFix(fixes, spot, group), { kind: "page", page: 5 });
  });

  it("does not trust what came back from another machine", () => {
    const clean = sanitizeLinkFixes({
      good: { kind: "page", page: 3 },
      bad: { kind: "url", href: "javascript:alert(1)" },
      junk: 7,
      "": { kind: "page", page: 1 },
    });
    assert.deepEqual(clean, { good: { kind: "page", page: 3 } });
  });

  it("turns a fix into something the follower understands", () => {
    assert.deepEqual(linkFixTarget({ kind: "page", page: 4 }), { kind: "fixedPage", page: 4 });
    assert.deepEqual(linkFixTarget({ kind: "url", href: "https://a.kr/" }), { kind: "url", href: "https://a.kr/" });
    assert.equal(linkFixTarget(null), null);
  });
});

describe("#190 사이드카가 고친 링크를 나른다", () => {
  it("writes them out and reads them back", async () => {
    const { serializeInkFile, parseInkFile } = await import("./inkFile.js");
    const linkFixes = { "3@1,2,3,4": { kind: "page", page: 12 } };
    const back = parseInkFile(serializeInkFile({ pages: {}, leaves: [], outline: [], linkFixes }));
    assert.deepEqual(back.linkFixes, linkFixes);
  });

  it("survives a sidecar written before this existed", async () => {
    const { parseInkFile } = await import("./inkFile.js");
    const old = JSON.stringify({ app: "pdf-ink", version: 1, pages: {}, leaves: [], outline: [] });
    assert.deepEqual(parseInkFile(old).linkFixes, {});
  });

  it("drops a fix that came back broken", async () => {
    const { parseInkFile } = await import("./inkFile.js");
    const text = JSON.stringify({
      app: "pdf-ink",
      version: 1,
      pages: {},
      linkFixes: { a: { kind: "url", href: "javascript:alert(1)" } },
    });
    assert.deepEqual(parseInkFile(text).linkFixes, {});
  });
});

describe("#190 배선", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const main = readFileSync(join(root, "src/main.js"), "utf8");
  const html = readFileSync(join(root, "index.html"), "utf8");
  const css = readFileSync(join(root, "src/style.css"), "utf8");

  it("opens the editor by holding a link, and that hold is not also a tap", () => {
    const pan = main.slice(main.indexOf("function startPan(event)"), main.indexOf("function movePan"));
    assert.match(pan, /state\.interactMode === "view"/, "only where links are live");
    assert.match(pan, /openLinkFixPanel\(spot, hit, items\.indexOf\(hit\)\)/);
    assert.match(pan, /gesture\.held = true/);
    assert.match(main, /PAGE_HOLD_MS\)/);
  });

  it("gives up the hold as soon as the finger travels", () => {
    const move = main.slice(main.indexOf("function movePan"), main.indexOf("function endPan") + 1 || undefined);
    assert.match(move, /gesture\.moved > PAGE_DRAG_SLOP_PX\)\s*\{\s*cancelLinkFixHold\(\)/);
  });

  it("lets a correction win over what the file says", () => {
    const act = main.slice(main.indexOf("function actOnPdfLink"), main.indexOf("function followPdfLinkAtClient"));
    assert.match(act, /const fixed = linkFixTarget\(fixFor\(spot\.leaf, hit\)\)/);
    assert.match(act, /followPdfLink\(fixed \|\| hit\.link, spot\.pageNum\)/);
  });

  it("offers both a page and an address, and a box to do the lot", () => {
    assert.match(html, /id="link-fix-page"/);
    assert.match(html, /id="link-fix-url"/);
    assert.match(html, /id="link-fix-bulk"/);
    assert.match(html, /같은 곳을 가리키던 링크 전부/);
    assert.match(main, /const bulk = Boolean\(els\.linkFixBulk\?\.checked\)/);
  });

  it("keeps the corrections with the document, not with this browser only", () => {
    assert.match(main, /saveLinkFixes\(state\.identity, state\.linkFixes\)/);
    assert.match(main, /state\.linkFixes = sanitizeLinkFixes\(loadLinkFixes\(identity\)\)/);
    assert.equal((main.match(/linkFixes: state\.linkFixes/g) || []).length, 3, "every sidecar we write");
    assert.match(main, /if \(remote\.linkFixes && Object\.keys\(remote\.linkFixes\)\.length\)/);
    assert.match(main, /scheduleInkAutosave\(\)/);
  });

  it("shows which links were corrected", () => {
    assert.match(main, /fixFor\(leaf, item\) \? "pdf-link-hint is-fixed" : "pdf-link-hint"/);
    assert.match(css, /\.pdf-link-hint\.is-fixed \{/);
    assert.match(main, /refreshPdfLinkHints\(true\)/, "and repaints them at once");
  });

  it("never writes the correction into the PDF itself", () => {
    const apply = main.slice(main.indexOf("function applyLinkFix"), main.indexOf("function undoLinkFix"));
    assert.doesNotMatch(apply, /annotatedPdfBlob|buildAnnotatedPdf/);
  });
});

describe("#190 고친 링크가 파일에도 들어간다", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const main = readFileSync(join(root, "src/main.js"), "utf8");

  it("bakes the correction, not the destination the file had", () => {
    const build = main.slice(main.indexOf("async function exportLinksForLeaf"), main.indexOf("async function exportLinkMap"));
    assert.match(build, /const fix = fixFor\(leaf, \{ rect, link: target \}\)/);
    assert.match(build, /fix\?\.kind === "url"/);
    assert.match(build, /fix\?\.kind === "page"/);
    assert.ok(build.indexOf("const fix =") < build.indexOf('target.kind === "url"'), "the correction is consulted first");
  });

  it("keeps the source rectangle on every link, or one fix would hit them all", () => {
    assert.match(main, /pdfLinkItem\(box, target, annotation\.rect\)/);
    assert.match(main, /spotKey: linkSpotKey\(leaf\?\.pdfPage, item\?\.rect\)/);
  });
});
