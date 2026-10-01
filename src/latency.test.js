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
    // #460: 손이 종이에 있거나 방금 뗐으면(2초) 쓰지 않는다 — 획 사이에 끼어들던 직렬화를 미룬다.
    assert.match(main, /if \(handIsBusy\(\)\) \{[\s\S]{0,260}window\.setTimeout\(scheduleStrokeSave, INK_REST_MS\);\s*return;/, "never while the hand is on the paper");
    assert.match(main, /return state\.drawing \|\| performance\.now\(\) - lastInkAt < INK_REST_MS;/);
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

describe("#460 펜을 뗄 때 쪽 전체를 복사·재그리기하지 않는다", () => {
  it("더하기 획은 그 획 하나만 기록하고 잉크 캔버스에 덧그린다", () => {
    const end = main.slice(main.indexOf("function endStroke"), main.indexOf("function abortStroke", main.indexOf("function endStroke")) > 0 ? main.indexOf("function abortStroke", main.indexOf("function endStroke")) : main.indexOf("function endStroke") + 6000);
    assert.match(end, /commitAppend\(state\.drawPage, live\);/);
    assert.match(end, /paintItem\(canvas2d\(view\.inkCanvas\), live, strokeScale\(view\), view\.inkCanvas\);/);
    // 지우개는 예전 길(쪽 전체 스냅샷) — 지워진 항목을 되돌려야 하므로.
    assert.match(end, /if \(erasing && view\) \{\s*commitPageChange\(state\.drawPage/);
    // 커밋이 오른 뒤에 라이브 층을 지운다(#279 순서).
    assert.ok(end.indexOf("paintItem(canvas2d(view.inkCanvas)") < end.indexOf("clearLiveLayer(view);"));
  });

  it("빠른 길은 쪽 전체 cloneItems를 부르지 않는다", () => {
    const fast = main.slice(main.indexOf("function commitAppend"), main.indexOf("function commitPageChange"));
    assert.doesNotMatch(fast, /cloneItems\(/);
    assert.match(fast, /recordAppend\(state\.history, \{ page: key, item \}\)/);
    assert.match(fast, /delete next\[gone\]/, "무덤에 있던 것이 살아나면 비석을 치운다");
  });
});
