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
    assert.equal((main.match(/\.render\(\{ canvasContext/g) || []).length, 1, "직접 호출은 문 안의 한 번뿐");
    assert.ok((main.match(/renderPdfToCanvas\(/g) || []).length >= 8, "8곳 모두 통과");
  });

  it("still discards a stale page render by token", () => {
    assert.match(main, /renderPdfPage\(view, page, ctx, pixel\) === "cancelled" \|\| token !== view\.token/);
  });
});
