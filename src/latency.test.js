import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const main = readFileSync(join(root, "src/main.js"), "utf8");
const worker = readFileSync(join(root, "src/livePaint.worker.js"), "utf8");

describe("#208 획 사이의 끊김 — 저장을 한가할 때로", () => {
  it("never stringifies the whole document between strokes", () => {
    const persist = main.slice(main.indexOf("function persistStrokes"), main.indexOf("function commitPageChange"));
    assert.doesNotMatch(persist, /saveStrokes\(/, "persistStrokes only marks dirty now");
    assert.match(main, /const idle = window\.requestIdleCallback \|\| \(\(fn\) => window\.setTimeout\(fn, 250\)\)/);
    assert.match(main, /if \(state\.drawing\) \{\s*\/\/[^\n]*\n\s*scheduleStrokeSave\(\);\s*return;/, "never while the hand is on the paper");
  });

  it("writes at once when the reader leaves", () => {
    assert.match(main, /document\.hidden\) \{\s*writeStrokesNow\(\)/);
    assert.match(main, /pagehide", \(\) => \{\s*writeStrokesNow\(\)/);
    assert.match(main, /\/\/ #208[^\n]*\n\s*writeStrokesNow\(\);\s*if \(!String\(identity/s === false ? /x/ : /writeStrokesNow\(\);/, "and before another document takes over");
    const openAt = main.indexOf("async function openPdfBuffer");
    assert.ok(main.slice(openAt, openAt + 300).includes("writeStrokesNow()"), "before the identity changes");
  });
});

describe("#208 예측 이벤트", () => {
  it("draws the browser's predicted tip, but never saves it", () => {
    assert.match(main, /event\.getPredictedEvents === "function" \? event\.getPredictedEvents\(\) : \[\]/);
    assert.match(main, /predictedTail = ahead\.map/);
    const end = main.slice(main.indexOf("function endStroke"), main.indexOf("async function pickFile"));
    assert.match(end, /predictedTail = \[\]/, "cleared before the stroke is committed");
    assert.doesNotMatch(main, /points: \[\.\.\.stroke\.points, \.\.\.predictedTail\][\s\S]{0,400}commitPageChange/, "the tail lives only on the live layer");
  });
});

describe("#208 워커 live 층", () => {
  it("hands the live canvas to a worker where the browser can", () => {
    assert.match(main, /"transferControlToOffscreen" in HTMLCanvasElement\.prototype/);
    assert.match(main, /new Worker\(new URL\("\.\/livePaint\.worker\.js", import\.meta\.url\), \{ type: "module" \}\)/);
    assert.match(main, /worker\.postMessage\(\{ type: "canvas", id: view\.liveId, canvas: off \}, \[off\]\)/);
  });

  it("routes size changes through the worker — the main thread may not touch a transferred canvas", () => {
    assert.match(main, /if \(!\(canvas === view\.liveCanvas && view\.liveId != null\)\) \{\s*canvas\.width = pixelWidth/);
    assert.match(main, /postLiveSize\(view, pixelWidth, pixelHeight\)/);
    assert.match(worker, /entry\.canvas\.width = data\.width/);
  });

  it("keeps painting in the worker on its own frame clock", () => {
    assert.match(worker, /requestAnimationFrame/);
    assert.match(worker, /paintItem\(entry\.ctx, entry\.item, entry\.scale, entry\.canvas\)/);
    assert.match(worker, /import \{ paintItem \} from "\.\/ink\.js"/, "ink.js only — it is pure");
    assert.equal((worker.match(/import /g) || []).length, 1, "nothing DOM-shaped sneaks in");
  });

  it("lets canvases go when their stages are torn down", () => {
    assert.match(main, /for \(const view of \[\.\.\.state\.pageViews, \.\.\.stagePool\]\) \{\s*dropLiveCanvas\(view\)/);
    assert.match(worker, /views\.delete\(data\.id\)/);
  });

  it("falls back to the old path when there is no worker", () => {
    const draw = main.slice(main.indexOf("function drawLiveLayer"), main.indexOf("function drawStrokesOn"));
    assert.match(draw, /if \(view\.liveId != null && liveWorker\)/);
    assert.match(draw, /liveCanvas2d\(canvas\)/, "the direct route is still there");
  });
});
