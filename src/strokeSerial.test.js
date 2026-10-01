import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createPageJsonCache, pageFingerprint, serializeStrokeRecord } from "./strokeSerial.js";

const stroke = (x, n = 3) => ({ type: "pen", color: "#1A1A1A", width: 2, points: Array.from({ length: n }, (_, i) => ({ x: x + i * 0.01, y: 0.2 + i * 0.01 })) });
const image = { type: "image", id: "img-1", x: 0.1, y: 0.1, w: 0.3, h: 0.2, rotate: 0, locked: true, src: "", crop: { x: 0, y: 0, w: 1, h: 1 } };

function record(pages, extra = {}) {
  return { version: 4, identity: "doc-1", pages, leaves: [{ id: "p1", kind: "pdf", pdfPage: 1 }], leavesVersion: 1, outline: [], gone: { a: 1 }, savedAt: 1700000000000, ...extra };
}

describe("#463 쪽 단위 직렬화 캐시", () => {
  it("JSON.stringify와 한 글자도 다르지 않다 (버전별·빈 쪽·그림·한글 열쇠)", () => {
    const cases = [
      record({ 1: [stroke(0.1), image], "o:imp-1": [], 2: [stroke(0.5, 10)] }),
      { version: 1, identity: "x", pages: { 1: [stroke(0.2)] }, savedAt: 5 },
      { version: 3, identity: "y", pages: {}, leaves: [], leavesVersion: 1, outline: [{ title: "목차", leafId: "p1" }], savedAt: 6 },
      record({ "쪽:한글": [stroke(0.3)], 3: [null, stroke(0.4)] }, { gone: {} }),
    ];
    for (const rec of cases) {
      assert.equal(serializeStrokeRecord(rec, createPageJsonCache()), JSON.stringify(rec));
      assert.equal(serializeStrokeRecord(rec, null), JSON.stringify(rec), "캐시 없이도 같다");
    }
  });

  it("안 바뀐 쪽은 다시 만들지 않고, 바뀐 쪽만 만든다", () => {
    const cache = createPageJsonCache();
    const pages = { 1: [stroke(0.1)], 2: [stroke(0.2)], 3: [stroke(0.3)] };
    serializeStrokeRecord(record(pages), cache);
    assert.deepEqual(cache.stats, { hits: 0, misses: 3 });
    // 2쪽에 획 하나 더하기(제자리 push — commitAppend가 하는 일).
    pages[2].push(stroke(0.9));
    const out = serializeStrokeRecord(record(pages), cache);
    assert.deepEqual(cache.stats, { hits: 2, misses: 4 });
    assert.equal(out, JSON.stringify(record(pages)));
    // 3쪽을 새 배열로 바꾸기(지우개·이동이 하는 일).
    pages[3] = [stroke(0.33)];
    serializeStrokeRecord(record(pages), cache);
    assert.deepEqual(cache.stats, { hits: 4, misses: 5 });
  });

  it("참조·길이가 같아도 제자리에서 고친 흔한 속성은 지문이 잡는다", () => {
    const cache = createPageJsonCache();
    const pages = { 1: [{ ...image }, stroke(0.1)] };
    serializeStrokeRecord(record(pages), cache);
    pages[1][0].locked = false; // 제자리 수정(앱은 안 하지만 방어)
    assert.equal(serializeStrokeRecord(record(pages), cache), JSON.stringify(record(pages)));
    assert.equal(cache.stats.misses, 2);
    pages[1][1].points.push({ x: 0.5, y: 0.5 }); // 점 개수 변화
    assert.equal(serializeStrokeRecord(record(pages), cache), JSON.stringify(record(pages)));
    assert.equal(cache.stats.misses, 3);
    pages[1][0].x = 0.42; // 자리 변화
    assert.equal(serializeStrokeRecord(record(pages), cache), JSON.stringify(record(pages)));
    assert.equal(cache.stats.misses, 4);
  });

  it("지문은 점 하나하나를 보지 않는다 — 긴 획도 값싸다", () => {
    const long = stroke(0.1, 5000);
    const a = pageFingerprint([long]);
    const b = pageFingerprint([{ ...long, points: long.points.map((p, i) => (i === 2500 ? { x: 0.77, y: 0.77 } : p)) }]);
    // 한 점의 좌표만 바뀌면 지문은 같다(의도). 그래서 앱은 점을 제자리에서 고치지 않는다.
    assert.equal(a, b);
    assert.notEqual(a, pageFingerprint([{ ...long, points: long.points.slice(1) }]));
  });

  it("없어진 쪽의 캐시는 버린다 — 열쇠가 다시 쓰여도 옛 글자를 주지 않는다", () => {
    const cache = createPageJsonCache();
    const first = [stroke(0.1)];
    serializeStrokeRecord(record({ 1: first, 2: [stroke(0.2)] }), cache);
    assert.equal(cache.size, 2);
    serializeStrokeRecord(record({ 2: [stroke(0.2)] }), cache);
    assert.equal(cache.size, 1);
    const again = serializeStrokeRecord(record({ 1: first }), cache);
    assert.equal(again, JSON.stringify(record({ 1: first })));
  });

  it("storage.saveStrokes가 이 길을 쓰고, 그림 없는 쪽은 같은 참조로 넘어온다", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const store = readFileSync(join(root, "src/storage.js"), "utf8");
    const strip = readFileSync(join(root, "src/inkImages.js"), "utf8");
    assert.match(store, /serializeStrokeRecord\(/);
    assert.match(store, /createPageJsonCache\(\)/);
    assert.doesNotMatch(store.slice(store.indexOf("export function saveStrokes"), store.indexOf("async function strokeBackup")), /JSON\.stringify\(\{/, "문서 전체 stringify는 없다");
    // stripImages: 그림 없는 쪽은 map으로 새 배열을 만들지 않고 그대로 돌려준다.
    assert.match(strip, /if \(!needs\) \{\s*light\[key\] = items;/);
  });
});
