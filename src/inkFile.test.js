import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  INK_FILE_VERSION,
  buildInkFile,
  inkFileIsEmpty,
  parseInkFile,
  pickNewer,
  serializeInkFile,
  sidecarName,
  sidecarPath,
} from "./inkFile.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stroke = { type: "pen", width: 2, points: [{ x: 0.1, y: 0.2 }] };

describe("#147 사이드카 파일", () => {
  it("sits beside the pdf, name and all", () => {
    assert.equal(sidecarPath("/수학/노트.pdf"), "/수학/노트.pdf.ink");
    assert.equal(sidecarName("노트.pdf"), "노트.pdf.ink");
  });

  it("carries what the pdf cannot", () => {
    const data = buildInkFile({
      pages: { 1: [stroke] },
      leaves: [{ id: "p1", kind: "pdf", pdfPage: 1 }],
      outline: [{ id: "t:1", title: "표지", page: 1 }],
      savedAt: 1000,
    });
    assert.equal(data.version, INK_FILE_VERSION);
    assert.equal(data.app, "pdf-ink");
    assert.equal(data.savedAt, 1000);
    assert.deepEqual(data.pages, { 1: [stroke] });
    assert.equal(data.leaves.length, 1);
    assert.equal(data.outline.length, 1);
  });

  it("round-trips, and refuses anything that is not ours", () => {
    const text = serializeInkFile({ pages: { 2: [stroke] }, savedAt: 5 });
    const back = parseInkFile(text);
    assert.deepEqual(back.pages, { 2: [stroke] });
    assert.equal(back.savedAt, 5);
    assert.equal(parseInkFile("not json"), null);
    assert.equal(parseInkFile(JSON.stringify({ app: "someone-else", pages: {} })), null);
    assert.equal(parseInkFile(JSON.stringify({ app: "pdf-ink" })), null);
  });

  it("stays small: a stroke is coordinates, not pixels", () => {
    const pages = {};
    for (let page = 1; page <= 100; page += 1) {
      pages[page] = [{ type: "pen", width: 2, points: Array.from({ length: 200 }, (_, i) => ({ x: i / 200, y: 0.5 })) }];
    }
    const text = serializeInkFile({ pages });
    // 100 pages of dense writing is still well under a megabyte.
    assert.ok(text.length < 1_000_000, `${text.length} bytes`);
  });

  it("keeps the later save, and never drops ink for an empty file", () => {
    const local = { savedAt: 100, pages: { 1: [stroke] } };
    const remote = { savedAt: 200, pages: { 1: [stroke, stroke] } };
    assert.equal(pickNewer(local, remote), "remote");
    assert.equal(pickNewer(remote, local), "local", "the newer side is already here");
    assert.equal(pickNewer(local, null), "local", "no sidecar at all");
    assert.equal(pickNewer(null, remote), "remote", "nothing here yet");
    // An empty sidecar must not wipe local work, even if it is newer.
    assert.equal(pickNewer(local, { savedAt: 900, pages: {} }), "local");
    assert.equal(inkFileIsEmpty({ pages: { 1: [] } }), true);
    assert.equal(inkFileIsEmpty({ pages: { 1: [stroke] } }), false);
  });
});

describe("#147 배선", () => {
  const main = readFileSync(join(root, "src/main.js"), "utf8");
  const html = readFileSync(join(root, "index.html"), "utf8");

  it("saves the ink beside the document, not by rewriting the pdf", () => {
    const save = main.slice(main.indexOf("async function saveDocumentNow"), main.indexOf("async function bakeIntoPdf"));
    assert.match(save, /await saveInkSidecar\(\)/);
    assert.doesNotMatch(save, /withAnnotatedPdf|buildAnnotatedPdf/, "저장 must stay cheap");
    assert.match(main, /uploadArg\(sidecarPath\(doc\.path\), ""\)/);
  });

  it("keeps baking as its own action, where the ink hardens", () => {
    assert.match(html, /data-more="save">저장/);
    assert.match(html, /data-more="bake">PDF에 굽기/);
    assert.match(main, /if \(action === "bake"\)[\s\S]{0,120}bakeIntoPdf\(\)/);
    const bake = main.slice(main.indexOf("async function bakeIntoPdf"), main.indexOf("async function exportDocument("));
    assert.match(bake, /flattenAfterWriteBack/, "baking still hardens the ink (#126)");
  });

  it("reads the sidecar on open and takes the newer save", () => {
    assert.match(main, /await loadInkSidecar\(doc\)/);
    const load = main.slice(main.indexOf("async function loadInkSidecar"), main.indexOf("/* ---- 다른 기기의 변경"));
    assert.match(load, /pickNewer\(local, remote\) !== "remote"/);
    assert.match(load, /state\.pages = remote\.pages/);
    assert.match(load, /normalizeLeaves\(remote\.leaves/);
    assert.match(load, /normalizeOutline\(remote\.outline/);
  });

  it("still works for a document with no sidecar", () => {
    const load = main.slice(main.indexOf("async function loadInkSidecar"), main.indexOf("/* ---- 다른 기기의 변경"));
    assert.match(load, /if \(!reply\.ok\) \{\s*return;/, "a missing sidecar is normal, not an error");
    assert.match(load, /if \(!remote\) \{\s*return;/);
  });
});
