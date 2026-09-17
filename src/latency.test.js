import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const main = readFileSync(join(root, "src/main.js"), "utf8");

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
  it("no longer predicts — the tail caused corner spurs on ㄴ/L (#279)", () => {
    // #279: 예측 꼬리를 뺐다. 모서리에서 옛 방향으로 튀었다 되돌아가는
    // 아티팩트가 있었고, 워커로 지연은 이미 낮다.
    assert.match(main, /\/\/ #279[\s\S]{0,120}predictedTail = \[\]/);
    assert.doesNotMatch(main, /predictedTail = ahead\.slice/, "예측 채우던 것 제거");
  });
});


describe("#282·#448 라이브 층은 메인 스레드에서만 칠한다", () => {
  it("워커 배선이 남아 있지 않다", () => {
    // #208에서 워커로 넘겼다가 #282에서 되돌렸고, #448에서 꺼진 배선을
    // 통째로 지웠다. 되살리려면 #282의 순서 문제부터 풀어야 한다.
    assert.doesNotMatch(main, /liveWorker|adoptLiveCanvas|transferControlToOffscreen/);
    assert.equal(existsSync(join(root, "src/livePaint.worker.js")), false, "파일도 없다");
  });

  it("직접 칠하는 길은 그대로다", () => {
    const draw = main.slice(main.indexOf("function drawLiveLayer"), main.indexOf("function drawStrokesOn"));
    assert.match(draw, /liveCanvas2d\(canvas\)/);
  });
});
