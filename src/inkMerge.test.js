import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GONE_LIMIT,
  countNewFrom,
  goneAfterChange,
  itemKey,
  mergeGone,
  mergePageItems,
  mergePages,
  newItemId,
  sanitizeGone,
} from "./inkMerge.js";

const stroke = (id, x = 0.1) => ({ type: "pen", id, points: [{ x, y: 0.2 }], color: "#111", width: 2 });

describe("#83 필기 합집합", () => {
  it("keeps what both sides wrote, in my order first", () => {
    const merged = mergePageItems([stroke("a")], [stroke("b"), stroke("a")], {});
    assert.deepEqual(merged.map((item) => item.id), ["a", "b"]);
  });

  it("two devices writing on different pages lose nothing", () => {
    const merged = mergePages({ 3: [stroke("a")] }, { 7: [stroke("b")] }, {});
    assert.deepEqual(Object.keys(merged).sort(), ["3", "7"]);
  });

  it("a deleted stroke stays deleted on every device", () => {
    const gone = goneAfterChange([stroke("a"), stroke("b")], [stroke("b")], {});
    assert.ok(gone[itemKey(stroke("a"))], "무덤에 적히고");
    const merged = mergePageItems([stroke("b")], [stroke("a"), stroke("b")], gone);
    assert.deepEqual(merged.map((item) => item.id), ["b"], "다른 기기에서 와도 안 살아난다");
  });

  it("undo lifts the tombstone, so the stroke survives the next merge", () => {
    let gone = goneAfterChange([stroke("a")], [], {});
    gone = goneAfterChange([], [stroke("a")], gone);
    assert.deepEqual(gone, {});
  });

  it("tells old strokes apart by their content when they have no id", () => {
    const legacyA = { type: "pen", points: [{ x: 0.1, y: 0.1 }] };
    const legacyB = { type: "pen", points: [{ x: 0.9, y: 0.9 }] };
    assert.notEqual(itemKey(legacyA), itemKey(legacyB));
    assert.equal(itemKey(legacyA), itemKey({ type: "pen", points: [{ x: 0.1, y: 0.1 }] }), "같은 내용은 같은 지문");
    assert.equal(mergePageItems([legacyA], [legacyA, legacyB], {}).length, 2, "중복은 한 번만");
  });

  it("gives every new stroke its own name", () => {
    assert.notEqual(newItemId(), newItemId());
  });

  it("counts only what a merge would actually add", () => {
    const gone = { [itemKey(stroke("dead"))]: 1 };
    assert.equal(countNewFrom({ 1: [stroke("a"), stroke("dead")] }, { 1: [stroke("a")] }, gone), 0);
    assert.equal(countNewFrom({ 1: [stroke("b")] }, { 1: [stroke("a")] }, {}), 1);
  });

  it("keeps the graveyard bounded, newest first", () => {
    const big = {};
    for (let at = 0; at < GONE_LIMIT + 50; at += 1) {
      big[`k${at}`] = at + 1;
    }
    const merged = mergeGone(big, {});
    assert.equal(Object.keys(merged).length, GONE_LIMIT);
    assert.ok(merged[`k${GONE_LIMIT + 49}`], "최근 것이 남는다");
    assert.equal(merged.k0, undefined, "옛것부터 잊는다");
  });

  it("does not trust a graveyard that came over the wire", () => {
    assert.deepEqual(sanitizeGone({ ok: 5, bad: "x", "": 3, neg: -1 }), { ok: 5 });
  });
});

describe("#83 배선", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const main = readFileSync(join(root, "src/main.js"), "utf8");
  const inkFile = readFileSync(join(root, "src/inkFile.js"), "utf8");

  it("merges the sidecar instead of letting the newer save win", () => {
    assert.match(main, /const takeStructure = pickNewer\(local, remote\) === "remote"/);
    assert.match(main, /state\.pages = mergePages\(state\.pages, remote\.pages, state\.inkGone\)/);
    assert.equal((main.match(/mergePages\(state\.pages, remote\.pages/g) || []).length, 2, "드롭박스·드라이브 둘 다");
  });

  it("records a tombstone whenever an edit removes items, bulk included", () => {
    assert.match(main, /state\.inkGone = goneAfterChange\(before, after, state\.inkGone\)/);
    assert.match(main, /goneAfterChange\(pagesBefore\[pageKey\], state\.pages\[pageKey\], state\.inkGone\)/);
  });

  it("carries the graveyard in the sidecar and in local storage", () => {
    assert.match(inkFile, /gone: gone && typeof gone === "object" \? gone : \{\}/);
    assert.equal((main.match(/gone: state\.inkGone,/g) || []).length, 3, "사이드카를 쓰는 세 곳 전부");
    // #273: 이미지는 IndexedDB로 빠지고 localStorage엔 가벼운 필기(light)만.
    assert.match(main, /saveStrokes\(state\.identity, light, state\.leaves, state\.outline, state\.inkGone\)/);
  });

  it("pulls other devices' ink on the sync beat, quietly unless something arrived", () => {
    assert.match(main, /async function pullRemoteInk/);
    assert.match(main, /if \(pullingInk \|\| state\.drawing \|\| !cloudDocOpen\(\)/, "그리는 중엔 건드리지 않는다");
    assert.match(main, /다른 기기의 필기 \$\{added\}개를 받았습니다/);
    assert.match(main, /checkDriveRemote\(\);\s*pullRemoteInk\(\)/);
  });

  it("names every new stroke at birth", () => {
    assert.match(main, /id: newItemId\(\),\s*points: \[point\]/);
  });
});
