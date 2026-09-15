import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { maxPdfBytes, sizeLimitLabel, validatePdfFile } from "./validate.js";

describe("#418 큰 PDF", () => {
  it("gives a big machine room and a small one caution", () => {
    assert.equal(maxPdfBytes(16), 200 * 1024 * 1024);
    assert.equal(maxPdfBytes(8), 200 * 1024 * 1024);
    assert.equal(maxPdfBytes(4), 120 * 1024 * 1024);
    assert.equal(maxPdfBytes(2), 80 * 1024 * 1024);
    assert.equal(maxPdfBytes(undefined), 80 * 1024 * 1024, "모르는 기기는 조심스럽게");
    assert.equal(sizeLimitLabel(80 * 1024 * 1024), "80MB");
  });

  it("says the real limit in the refusal, not a stale number", () => {
    const big = { size: 500 * 1024 * 1024, name: "big.pdf", type: "application/pdf" };
    const said = validatePdfFile(big);
    assert.equal(said.ok, false);
    assert.match(said.message, /(80|120|200)MB 이하만/);
  });

  it("stops rewriting the whole book when only the page changed", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "main.js"), "utf8");
    const store = readFileSync(join(here, "storage.js"), "utf8");
    assert.match(src, /saveDocumentPlace\(state\.identity, state\.page\)/);
    assert.match(store, /export async function saveDocumentPlace/);
    // 최근 목록은 본문을 읽지 않는다 — getAll은 모든 PDF를 메모리로 올렸다.
    const list = store.slice(store.indexOf("export async function listDocuments"), store.indexOf("export async function migrateLastIntoFiles"));
    assert.match(list, /openCursor\(\)/);
    assert.doesNotMatch(list, /getAll\(\)/);
    // pdf.js 사본은 없애면 안 된다(워커가 버퍼를 가져간다).
    assert.match(src, /getDocument\(\{ data: buffer\.slice\(0\) \}\)/);
  });
});
