import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addCapture, findCapture, sanitizeCaptures } from "./captureReg.js";
import { hamming } from "./pageMatch.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rect = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };

describe("#256 캡처 등록부", () => {
  it("keeps the newest first and caps the list", () => {
    let list = [];
    for (let i = 0; i < 20; i += 1) {
      list = addCapture(list, { hash: `h${i}`, rect }, 12, i + 1);
    }
    assert.equal(list.length, 12);
    assert.equal(list[0].hash, "h19", "최근 것이 앞");
  });

  it("replaces an entry with the same fingerprint instead of duplicating", () => {
    let list = addCapture([], { hash: "same", rect });
    list = addCapture(list, { hash: "same", rect: { ...rect, x: 0.5 } });
    assert.equal(list.length, 1);
    assert.equal(list[0].rect.x, 0.5, "자리를 새로 잡으면 갱신");
  });

  it("refuses a broken rect or empty hash", () => {
    assert.deepEqual(addCapture([], { hash: "", rect }), []);
    assert.deepEqual(addCapture([], { hash: "h", rect: { x: 0, y: 0, w: 0, h: 1 } }), []);
  });

  it("finds the nearest fingerprint within the threshold", () => {
    const near = "1".repeat(140) + "0000";
    const far = "0".repeat(144);
    const list = addCapture(addCapture([], { hash: far, rect }), { hash: "1".repeat(144), rect: { ...rect, x: 0.9 } });
    const hit = findCapture(list, near, hamming);
    assert.equal(hit.rect.x, 0.9, "두 비트 차 → 같은 캡처");
  });

  it("returns nothing when no fingerprint is close — a foreign image keeps its own place", () => {
    const list = addCapture([], { hash: "1".repeat(144), rect });
    assert.equal(findCapture(list, "0".repeat(144), hamming), null);
    assert.equal(findCapture(list, "", hamming), null);
  });

  it("drops junk when loading from storage", () => {
    const clean = sanitizeCaptures([{ hash: "h", rect }, { hash: "", rect }, "nope", { hash: "g", rect: { x: 0, y: 0, w: 1 } }]);
    assert.equal(clean.length, 1);
    assert.equal(clean[0].hash, "h");
  });
});

describe("#256 배선", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const main = readFileSync(join(root, "src/main.js"), "utf8");

  it("registers a fingerprint→rect when capturing", () => {
    const cap = main.slice(main.indexOf("async function confirmCapture"), main.indexOf("function leavesNeedRebuild"));
    assert.match(cap, /dHash\(grayGrid\(result\.pixels, result\.width, result\.height\)\)/);
    assert.match(cap, /addCapture\(state\.captures, \{ hash, rect:/);
    assert.match(cap, /saveCaptures\(state\.captures\)/);
  });

  it("looks the fingerprint up on paste and lets it win over a pressed spot", () => {
    const paste = main.slice(main.indexOf("async function pasteImageAt"), main.indexOf("function beginCrop"));
    assert.match(paste, /const pasteHash = hashOfImage\(img\)/);
    assert.match(paste, /findCapture\(state\.captures, pasteHash, hamming\)/);
    assert.match(paste, /const home = known\?\.rect \|\| state\.captureFrom\?\.rect \|\| null/);
  });

  it("persists the registry across sessions", () => {
    assert.match(main, /captures: sanitizeCaptures\(loadCaptures\(\)\)/);
  });
});
