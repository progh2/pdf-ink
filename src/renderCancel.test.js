import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const main = readFileSync(join(root, "src/main.js"), "utf8");

describe("#258 같은 캔버스 중복 렌더 막기", () => {
  const fn = main.slice(main.indexOf("async function renderPdfPage"), main.indexOf("async function renderPageView"));

  it("cancels the render already running on the view before starting another", () => {
    assert.match(fn, /if \(view\.renderTask\) \{[\s\S]*?view\.renderTask\.cancel\(\)/);
    assert.match(fn, /const task = page\.render\(\{ canvasContext: ctx, viewport \}\)/);
    assert.match(fn, /view\.renderTask = task/);
  });

  it("treats a cancellation as normal, not an error", () => {
    assert.match(fn, /error\?\.name === "RenderingCancelledException"/);
    assert.match(fn, /return "cancelled"/);
    assert.match(fn, /throw error/, "다른 오류는 그대로 올린다");
  });

  it("clears the task reference when it finishes", () => {
    assert.match(fn, /if \(view\.renderTask === task\) \{\s*view\.renderTask = null/);
  });

  it("routes the page-view render through it and bails on cancel", () => {
    assert.match(main, /renderPdfPage\(view, page, ctx, pixel\) === "cancelled" \|\| token !== view\.token/);
  });
});
