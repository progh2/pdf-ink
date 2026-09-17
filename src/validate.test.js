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

describe("#437 세션에는 본문을 두 벌 두지 않는다", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const store = readFileSync(join(here, "storage.js"), "utf8");

  it("session 저장소에는 가리키는 값만 넣는다", () => {
    // 예전엔 같은 entry(=PDF 본문)를 files와 session 두 곳에 넣어 할당량을
    // 두 배로 먹었다. 200MB 상한(#418)에서는 그대로 두면 저장이 실패한다.
    assert.match(store, /function toPlace\(entry\)/);
    assert.match(store, /tx\.objectStore\(SESSION_STORE\)\.put\(toPlace\(entry\), "last"\)/);
    assert.match(store, /tx\.objectStore\(SESSION_STORE\)\.put\(toPlace\(next\), "last"\)/);
    const place = store.slice(store.indexOf("function toPlace"), store.indexOf("export async function saveDocument"));
    assert.doesNotMatch(place, /buffer/, "자리에는 본문이 없다");
  });

  it("옛 기록(본문이 든 session)도 그대로 읽힌다", () => {
    const load = store.slice(
      store.indexOf("export async function loadLastSession"),
      store.indexOf("export async function saveDocumentPlace"),
    );
    assert.match(load, /if \(session\?\.identity && !session\.buffer\)/);
    assert.match(load, /loadDocument\(session\.identity\)/);
  });

  it("할당량 초과는 이름이 달라도 알아본다", async () => {
    const { isQuotaError } = await import("./storage.js");
    assert.equal(isQuotaError({ name: "QuotaExceededError" }), true);
    assert.equal(isQuotaError({ name: "NS_ERROR_DOM_QUOTA_REACHED" }), true);
    assert.equal(isQuotaError({ errors: [{ name: "AbortError" }, { name: "QuotaExceededError" }] }), true);
    assert.equal(isQuotaError({ name: "AbortError" }), false);
    assert.equal(isQuotaError(null), false);
  });
});

describe("문서는 실제 상한과 같은 숫자를 말한다", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const prd = readFileSync(join(root, "docs/PRD.md"), "utf8");

  it("README·PRD의 용량 문구가 maxPdfBytes와 어긋나지 않는다", () => {
    // 한 번 어긋난 적이 있다(20MB 시절 문구가 #418 뒤에도 남아 있었다).
    const tiers = [maxPdfBytes(2), maxPdfBytes(4), maxPdfBytes(16)].map((bytes) =>
      sizeLimitLabel(bytes).replace("MB", ""),
    );
    // "80 · 120 · 200MB"처럼 한 줄에 세 단계가 순서대로 나와야 한다.
    const said = new RegExp(`${tiers.join("\\s*·\\s*")}\\s*MB`);
    for (const doc of [readme, prd]) {
      assert.match(doc, said);
      assert.doesNotMatch(doc, /20MB (이하|를 넘는)/, "옛 상한 문구가 남아 있다");
    }
  });
});
