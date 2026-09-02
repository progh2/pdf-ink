import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  THUMB_PACK_STALE_RATIO,
  buildThumbPack,
  packTooBig,
  parseThumbPack,
  shouldDownloadPack,
  shouldUploadPack,
  staleRatio,
  thumbPackPath,
} from "./thumbPack.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("#153 썸네일 묶음", () => {
  it("sits beside the document", () => {
    assert.equal(thumbPackPath("/수학/노트.pdf"), "/수학/노트.pdf.thumbs");
  });

  it("round-trips, and refuses anything that is not ours", () => {
    const pack = buildThumbPack({ "p1:0:pdf:88": "AAA" }, 7);
    const back = parseThumbPack(JSON.stringify(pack));
    assert.deepEqual(back.thumbs, { "p1:0:pdf:88": "AAA" });
    assert.equal(back.savedAt, 7);
    assert.equal(parseThumbPack("{"), null);
    assert.equal(parseThumbPack(JSON.stringify({ app: "other", thumbs: {} })), null);
  });

  it("measures how far the pack has drifted", () => {
    const wanted = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
    assert.equal(staleRatio(wanted, wanted), 0);
    assert.equal(staleRatio(wanted.slice(0, 9), wanted), 0.1);
    assert.equal(staleRatio([], wanted), 1);
    assert.equal(staleRatio([], []), 0, "nothing wanted is not stale");
  });

  it("uploads a first pack, but not for one rotated page", () => {
    assert.equal(shouldUploadPack({ hasPack: false, ratio: 0, ready: true }), true);
    // One page in four hundred: leave it alone.
    assert.equal(shouldUploadPack({ hasPack: true, ratio: 1 / 400, ready: true }), false);
    assert.equal(shouldUploadPack({ hasPack: true, ratio: 0.2, ready: true }), true);
    assert.equal(THUMB_PACK_STALE_RATIO, 0.1);
  });

  it("never uploads a half-drawn document", () => {
    assert.equal(shouldUploadPack({ hasPack: false, ratio: 1, ready: false }), false);
    assert.equal(shouldUploadPack({ hasPack: true, ratio: 0.9, ready: false }), false);
  });

  it("downloads only when this machine is really missing them", () => {
    assert.equal(shouldDownloadPack(0), false, "already has them all");
    assert.equal(shouldDownloadPack(0.05), false, "a few pages are quicker to draw");
    assert.equal(shouldDownloadPack(0.8), true);
  });

  it("refuses a pack that would be the problem", () => {
    assert.equal(packTooBig("x".repeat(10), 5), true);
    assert.equal(packTooBig("x".repeat(3), 5), false);
  });
});

describe("#153 배선", () => {
  const main = readFileSync(join(root, "src/main.js"), "utf8");
  const html = readFileSync(join(root, "index.html"), "utf8");
  const inkFile = readFileSync(join(root, "src/inkFile.js"), "utf8");

  it("is off by default and set per document", () => {
    assert.match(html, /id="share-thumbs-btn"/);
    assert.match(main, /shareThumbs: false/);
    assert.match(inkFile, /shareThumbs = false/, "the sidecar defaults to off");
    assert.match(inkFile, /shareThumbs: Boolean\(shareThumbs\)/);
    assert.match(main, /state\.shareThumbs = Boolean\(remote\.shareThumbs\)/, "the other machine honours it");
  });

  it("uploads only a finished set, and not for a small change", () => {
    const up = main.slice(main.indexOf("async function uploadThumbPack"), main.indexOf("async function downloadThumbPack"));
    assert.match(up, /const ready = wanted\.every\(\(key\) => done\.has\(key\)\)/);
    assert.match(up, /shouldUploadPack\(\{ hasPack: Boolean\(remote\), ratio: staleRatio/);
    assert.match(up, /if \(packTooBig\(text\)\)/);
    assert.match(main, /if \(!next\) \{\s*uploadThumbPack\(\);/, "only when the drawing queue is empty");
  });

  it("downloads once, only when this machine is missing most of them", () => {
    const down = main.slice(main.indexOf("async function downloadThumbPack"), main.indexOf("/* ---- 필기 사이드카"));
    assert.match(down, /shouldDownloadPack\(missing \/ wanted\.length\)/);
    assert.match(down, /if \(!reply\.ok\) \{\s*return;/, "no pack is normal");
    assert.match(down, /saveThumb\(state\.identity, key, base64ToBlob\(base64\)\)/);
  });

  it("never lets a missing pack block the document", () => {
    const down = main.slice(main.indexOf("async function downloadThumbPack"), main.indexOf("/* ---- 필기 사이드카"));
    assert.match(down, /catch \{/);
    assert.match(main, /await downloadThumbPack\(doc\)/);
  });
});
