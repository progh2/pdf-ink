import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const main = readFileSync(join(root, "src/main.js"), "utf8");

describe("#392 캔버스별 렌더 직렬화 (#258 후속)", () => {
  const fn = main.slice(main.indexOf("function renderPdfToCanvas"), main.indexOf("async function renderPageView"));

  it("queues per canvas instead of cancelling — cancel killed the shared page render (#388)", () => {
    assert.match(fn, /canvasRenderQueue\.get\(canvas\) \|\| Promise\.resolve\(\)/, "앞 렌더 뒤에 줄을 선다");
    assert.match(fn, /canvasRenderQueue\.set\(canvas, next\)/);
    assert.doesNotMatch(fn, /\.cancel\(\)/, "취소하지 않는다");
  });

  it("sends every pdf render through the one door", () => {
    // #397: 문 안에서 재시도를 하므로 두 번 — 다만 둘 다 문 안이어야 한다.
    const all = (main.match(/\.render\(\{ canvasContext/g) || []).length;
    const inDoor = (fn.match(/\.render\(\{ canvasContext/g) || []).length;
    assert.equal(all, 2, "직접 호출은 문 안의 둘뿐");
    assert.equal(inDoor, 2, "둘 다 문 안에 있다");
    assert.match(fn, /includes\("same canvas"\)/, "그 오류만 한 번 더 시도한다");
    assert.ok((main.match(/renderPdfToCanvas\(/g) || []).length >= 8, "8곳 모두 통과");
  });

  it("still discards a stale page render by token", () => {
    assert.match(main, /renderPdfPage\(view, page, ctx, pixel\) === "cancelled" \|\| token !== view\.token/);
  });
});

describe("#456 늦게 끝난 PDF 렌더가 재사용 캔버스에 떨어지지 않는다", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const main = readFileSync(join(root, "src/main.js"), "utf8");

  it("캔버스별로 도는 렌더 수를 센다", () => {
    const queue = main.slice(main.indexOf("const canvasRenderBusy"), main.indexOf("async function renderPdfPage"));
    assert.match(queue, /canvasRenderBusy\.set\(canvas, \(canvasRenderBusy\.get\(canvas\) \|\| 0\) \+ 1\)/);
    assert.match(queue, /\.finally\(\(\) => \{\s*canvasRenderBusy\.set\(canvas, Math\.max\(0/);
    assert.match(queue, /function canvasRenderIdle\(canvas\)/);
  });

  it("빈 쪽·가져온 쪽은 줄이 빈 뒤에 칠하고, 기다린 뒤 token을 다시 본다", () => {
    const outline = main.slice(main.indexOf("async function renderPageView"), main.indexOf("// A blank page is paper"));
    assert.match(outline, /await canvasRenderIdle\(view\.pdfCanvas\);\s*if \(token !== view\.token\) \{\s*return;/);
  });

  it("도는 렌더가 있는 캔버스에는 캐시를 복원하지 않는다", () => {
    const restore = main.slice(main.indexOf("function restorePageBitmap"), main.indexOf("function acquireStage"));
    assert.match(restore, /if \(canvasRenderPending\(view\.pdfCanvas\)\) \{\s*return false;/);
  });
});
