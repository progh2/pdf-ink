import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DOUBLE_TAP_MS,
  INTERACT_LOCKED_LABEL,
  INTERACT_UNLOCKED_LABEL,
  PEN_ACTIONS,
  PEN_BUTTON_DEFAULTS,
  VIEW_NOTICE_TEXT,
  allowsInkButton,
  appendInkPoint,
  appendInkPoints,
  beginInkPoints,
  canCreateInk,
  cursorForTool,
  describePenEvent,
  finishInkPoints,
  hoverShapeForTool,
  interactModeLabel,
  isDoubleTap,
  isReusedInkStart,
  isStrokePointer,
  normFromRect,
  normalizePenButtons,
  penButtonAction,
  rectFromPoints,
  shortcutAllowed,
  shortcutFor,
  shouldNoticeViewMode,
  shouldPanPointer,
  shouldShowHover,
} from "./interact.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src/style.css"), "utf8");
const main = readFileSync(join(root, "src/main.js"), "utf8");
const html = readFileSync(join(root, "index.html"), "utf8");
const interactSrc = readFileSync(join(root, "src/interact.js"), "utf8");
const toolbar = html.slice(html.indexOf('id="toolbar"'), html.indexOf('id="workspace"'));

describe("#52 헤더 자물쇠에 보기/편집", () => {
  const header = html.slice(html.indexOf('class="write-top"'), html.indexOf('class="write-body"'));
  const lock = header.slice(header.indexOf('id="interact-btn"'), header.indexOf('class="page-pager"'));

  it("locks to 보기 and unlocks to 편집, never 읽기", () => {
    assert.equal(INTERACT_LOCKED_LABEL, "보기");
    assert.equal(INTERACT_UNLOCKED_LABEL, "편집");
    assert.equal(interactModeLabel("view"), "보기");
    assert.equal(interactModeLabel("edit"), "편집");
    assert.match(lock, /class="interact-lock-label">편집/);
    assert.match(lock, /aria-label="편집"/);
    assert.match(lock, /id="interact-btn"/);
    assert.match(main, /setAttribute\("aria-label", label\)/);
    assert.match(main, /interactModeLabel\(state\.interactMode\)/);
    assert.match(main, /\.interact-lock-label/);
    assert.match(interactSrc, /INTERACT_LOCKED_LABEL = "보기"/);
    assert.match(interactSrc, /INTERACT_UNLOCKED_LABEL = "편집"/);
    assert.doesNotMatch(lock, /읽기/);
    assert.doesNotMatch(header, /읽기/);
    assert.doesNotMatch(main, /읽기/);
    assert.doesNotMatch(interactSrc, /읽기/);
  });

  it("keeps 32 lock, 6px gap, 13 type, and one toolbar", () => {
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.doesNotMatch(toolbar, /id="interact-btn"/);
    assert.doesNotMatch(toolbar, /interact-lock-label|>보기<|>편집</);
    assert.doesNotMatch(html, /class="m4-bar"|id="m4-bar"|class="touch-pill"/);
    assert.match(css, /\.interact-lock-icon \{[\s\S]*width: 32px;[\s\S]*height: 32px/);
    assert.match(css, /\.interact-lock \{[\s\S]*color: #8a8478/);
    assert.match(css, /\.interact-lock \{[\s\S]*gap: 6px/);
    assert.match(css, /\.interact-lock-label \{[\s\S]*font-size: 13px;[\s\S]*color: #5c574e/);
    assert.match(css, /\.interact-lock\.is-on \.interact-lock-label \{[\s\S]*color: #8a8478/);
  });

  it("view still blocks ink; default stays edit unless stored as view", () => {
    assert.equal(canCreateInk({ interactMode: "view", penOnly: false, pointerType: "mouse" }), false);
    assert.equal(canCreateInk({ interactMode: "edit", penOnly: false, pointerType: "mouse" }), true);
    assert.match(main, /interactMode: loadInteractMode\(\)/);
    assert.doesNotMatch(main, /interactMode:\s*"view"/);
  });
});

describe("보기 모드", () => {
  it("does not create strokes in view mode", () => {
    assert.equal(canCreateInk({ interactMode: "view", penOnly: false, pointerType: "pen" }), false);
    assert.equal(canCreateInk({ interactMode: "view", penOnly: false, pointerType: "mouse" }), false);
    assert.equal(canCreateInk({ interactMode: "view", penOnly: false, pointerType: "touch" }), false);
    assert.equal(canCreateInk({ interactMode: "edit", penOnly: false, pointerType: "mouse" }), true);
    assert.equal(canCreateInk({ interactMode: "edit", penOnly: true, pointerType: "touch" }), false);
    assert.equal(canCreateInk({ interactMode: "edit", penOnly: false, pointerType: "pen", rectTool: "mosaic" }), false);
    assert.equal(canCreateInk({ interactMode: "edit", penOnly: false, pointerType: "mouse", rectTool: "capture" }), false);
    assert.equal(canCreateInk({ interactMode: "edit", penOnly: false, pointerType: "mouse", tool: "select" }), false);
  });

  it("scrolls and pinches only while viewing", () => {
    assert.equal(shouldPanPointer({ interactMode: "view", pointerType: "pen" }), true);
    assert.equal(shouldPanPointer({ interactMode: "view", pointerType: "touch" }), true);
    assert.equal(shouldPanPointer({ interactMode: "edit", penOnly: false, pointerType: "mouse" }), false);
    assert.equal(shouldPanPointer({ interactMode: "edit", penOnly: false, pointerType: "mouse", tool: "select" }), false);
  });
});

describe("#11 모바일 터치 필기", () => {
  it("touch + 펜만 off creates ink and does not pan", () => {
    const opts = { interactMode: "edit", penOnly: false, pointerType: "touch" };
    assert.equal(canCreateInk(opts), true);
    assert.equal(shouldPanPointer(opts), false);
  });

  it("touch + 펜만 on cannot create ink and should pan", () => {
    const opts = { interactMode: "edit", penOnly: true, pointerType: "touch" };
    assert.equal(canCreateInk(opts), false);
    assert.equal(shouldPanPointer(opts), true);
  });

  it("pen + 펜만 on creates ink and does not pan", () => {
    const opts = { interactMode: "edit", penOnly: true, pointerType: "pen" };
    assert.equal(canCreateInk(opts), true);
    assert.equal(shouldPanPointer(opts), false);
  });

  it("view mode blocks ink and pans", () => {
    for (const pointerType of ["touch", "pen", "mouse"]) {
      const opts = { interactMode: "view", penOnly: false, pointerType };
      assert.equal(canCreateInk(opts), false);
      assert.equal(shouldPanPointer(opts), true);
    }
  });

  it("select and rect tools do not create ink", () => {
    assert.equal(canCreateInk({ interactMode: "edit", penOnly: false, pointerType: "touch", tool: "select" }), false);
    assert.equal(shouldPanPointer({ interactMode: "edit", penOnly: false, pointerType: "touch", tool: "select" }), false);
    assert.equal(canCreateInk({ interactMode: "edit", penOnly: false, pointerType: "touch", rectTool: "mosaic" }), false);
    assert.equal(canCreateInk({ interactMode: "edit", penOnly: false, pointerType: "touch", rectTool: "capture" }), false);
    assert.equal(shouldPanPointer({ interactMode: "edit", penOnly: false, pointerType: "touch", rectTool: "mosaic" }), false);
  });

  it("does not add a toolbar slot or paper pill for touch writing", () => {
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.doesNotMatch(toolbar, /터치 필기|touch-write|id="touch-btn"/);
    assert.doesNotMatch(html, /id="touch-btn"|class="touch-pill"/);
  });

  it("paper keeps touch-action none so a finger stroke does not scroll", () => {
    assert.match(css, /\.workspace \{[\s\S]*touch-action: none/);
    assert.match(css, /\.workspace \{[\s\S]*overscroll-behavior: none/);
    assert.match(css, /\.page-stage \{[\s\S]*touch-action: none/);
    assert.match(css, /\.ink-canvas \{[\s\S]*touch-action: none/);
    const scrollRule = css.slice(
      css.indexOf('.write-screen[data-view="scroll"] .workspace'),
      css.indexOf("}", css.indexOf('.write-screen[data-view="scroll"] .workspace')) + 1,
    );
    assert.match(scrollRule, /overflow:\s*auto/);
    assert.match(scrollRule, /touch-action:\s*none/);
    assert.match(scrollRule, /overscroll-behavior:\s*none/);
    assert.doesNotMatch(scrollRule, /touch-action:\s*(auto|manipulation|pan-)/);
    assert.doesNotMatch(css, /\.sheet-card[\s\S]{0,120}touch-action:\s*none/);
    assert.doesNotMatch(css, /\.preview-drawer[\s\S]{0,160}touch-action:\s*none/);
  });

  it("consumes paper touchstart and freezes scroll while inking", () => {
    assert.match(main, /addEventListener\(\s*"touchstart"/);
    assert.match(main, /passive:\s*false/);
    assert.match(main, /function holdPaperScroll/);
    assert.match(main, /function releasePaperScroll/);
    assert.match(main, /paperScrollHold/);
    assert.match(main, /shouldPan\(event\)/);
  });
});

describe("rectFromPoints", () => {
  it("normalizes a dragged box", () => {
    assert.deepEqual(rectFromPoints({ x: 1, y: 0.75 }, { x: 0, y: 0.25 }), {
      x: 0,
      y: 0.25,
      w: 1,
      h: 0.5,
    });
  });
});

describe("#47 두 탭이 직선이 되면 안 됨", () => {
  const aClient = { x: 40, y: 80 };
  const bClient = { x: 220, y: 360 };
  const aNorm = { x: 0.12, y: 0.2 };
  const bNorm = { x: 0.7, y: 0.85 };

  it("treats a pointerdown at the last pointerup as leftover, not a new start", () => {
    assert.equal(isReusedInkStart(aClient, aClient), true);
    assert.equal(isReusedInkStart(aClient, bClient), false);
    assert.equal(isReusedInkStart(null, aClient), false);
    assert.deepEqual(beginInkPoints(aNorm, aClient, aClient), []);
    assert.deepEqual(beginInkPoints(bNorm, bClient, aClient), [bNorm]);
  });

  it("two sequential taps stay separate dots, not one A–B line", () => {
    const first = finishInkPoints(beginInkPoints(aNorm, aClient, null), aNorm, aClient, null);
    assert.deepEqual(first, [aNorm]);

    let second = beginInkPoints(aNorm, aClient, aClient);
    second = appendInkPoint(second, bNorm, bClient, aClient);
    second = finishInkPoints(second, bNorm, bClient, aClient);
    assert.deepEqual(second, [bNorm]);
    assert.equal(second.length, 1);
  });

  it("a leftover-only second tap is ignored (no line, no ghost stroke)", () => {
    const leftover = finishInkPoints(beginInkPoints(aNorm, aClient, aClient), aNorm, aClient, aClient);
    assert.deepEqual(leftover, []);
  });

  it("a real drag still becomes one stroke", () => {
    let pts = beginInkPoints(aNorm, aClient, null);
    pts = appendInkPoint(pts, bNorm, bClient, null);
    pts = finishInkPoints(pts, bNorm, bClient, null);
    assert.deepEqual(pts, [aNorm, bNorm]);
  });

  it("wires the leftover-point helpers into stroke start/move/end", () => {
    assert.match(main, /beginInkPoints\(/);
    assert.match(main, /appendInkPoints\(/);
    assert.match(main, /finishInkPoints\(/);
    assert.match(main, /lastInkUpClient/);
    assert.match(main, /createShapeHold\(/);
    assert.match(main, /from "\.\/shapeHold\.js"/);
    assert.match(html, /id="shape-chips"/);
    assert.doesNotMatch(toolbar, /shape-chips|data-shape=/);
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.doesNotMatch(toolbar, /data-slot=/);
    assert.match(main, /bindUndoHold\(els\.undoBtn,\s*\{\s*onUndo:\s*undoInk,\s*onRedo:\s*redoInk/);
  });
});

describe("보기 중 안내 (#86)", () => {
  it("says it once when a locked page is drawn on", () => {
    assert.equal(shouldNoticeViewMode({ interactMode: "view", tool: "pen", now: 0, lastAt: null }), true);
    assert.equal(shouldNoticeViewMode({ interactMode: "view", tool: "pen", now: 500, lastAt: 0 }), false);
    assert.equal(shouldNoticeViewMode({ interactMode: "view", tool: "pen", now: 2000, lastAt: 0 }), true);
  });

  it("stays quiet while editing or when not a drawing tool", () => {
    assert.equal(shouldNoticeViewMode({ interactMode: "edit", tool: "pen", now: 0, lastAt: null }), false);
    assert.equal(shouldNoticeViewMode({ interactMode: "view", tool: "select", now: 0, lastAt: null }), false);
    assert.equal(shouldNoticeViewMode({ interactMode: "view", tool: "pen", rectTool: "capture", now: 0, lastAt: null }), false);
  });

  it("covers the drawing tools that leave no ink while locked", () => {
    for (const tool of ["pen", "highlighter", "pencil", "eraser", "stamp"]) {
      assert.equal(shouldNoticeViewMode({ interactMode: "view", tool, now: 0, lastAt: null }), true, tool);
    }
    assert.equal(VIEW_NOTICE_TEXT, "보기 중");
  });
});

describe("#137·#139 펜 버튼", () => {
  const erase = (extra) => penButtonAction({ pointerType: "pen", ...extra });

  it("erases with the barrel and the eraser end by default", () => {
    assert.equal(erase({ buttons: 3 }), "eraser", "tip + barrel");
    assert.equal(erase({ buttons: 32 }), "eraser", "eraser end");
    assert.equal(erase({ button: 5 }), "eraser");
    assert.equal(erase({ buttons: 1 }), null, "plain tip draws");
  });

  it("tells the second button apart and follows the setting", () => {
    assert.equal(erase({ buttons: 5 }), "select", "tip + second button, default 선택");
    assert.equal(erase({ buttons: 5, buttonMap: { second: "eraser" } }), "eraser");
    assert.equal(erase({ buttons: 3, buttonMap: { barrel: "select" } }), "select");
    assert.equal(erase({ buttons: 3, buttonMap: { barrel: "none" } }), null, "없음 draws normally");
  });

  it("keeps the eraser end an eraser, whatever the buttons are set to", () => {
    assert.equal(erase({ buttons: 32, buttonMap: { barrel: "none", second: "none" } }), "eraser");
  });

  it("never lets a mouse right-click draw or erase", () => {
    assert.equal(penButtonAction({ pointerType: "mouse", buttons: 2, button: 2 }), null);
    assert.equal(penButtonAction({ pointerType: "touch", buttons: 2 }), null);
    assert.equal(allowsInkButton({ pointerType: "mouse", button: 2 }), false);
    assert.equal(allowsInkButton({ pointerType: "mouse", button: 0 }), true);
    assert.equal(allowsInkButton({ pointerType: "touch" }), true);
  });

  it("can be switched off entirely", () => {
    assert.equal(erase({ buttons: 32, enabled: false }), null);
  });

  it("lets a pen start a stroke on any of its buttons", () => {
    for (const button of [1, 2, 5]) {
      assert.equal(allowsInkButton({ pointerType: "pen", button }), true, `button ${button}`);
    }
    assert.equal(allowsInkButton({ pointerType: "pen", button: 3 }), false);
  });

  it("normalizes a stored map, falling back to the defaults", () => {
    assert.deepEqual(normalizePenButtons(null), PEN_BUTTON_DEFAULTS);
    assert.deepEqual(normalizePenButtons({ barrel: "nonsense", second: "none" }), {
      barrel: "eraser",
      second: "none",
    });
    assert.deepEqual(PEN_ACTIONS, ["eraser", "select", "none"]);
  });
});

describe("#137·#139 배선", () => {
  it("lets the pen button start a stroke and erase just that stroke", () => {
    assert.match(main, /allowsInkButton\(\{ pointerType: event\.pointerType, button: event\.button \}\)/);
    assert.match(main, /penAction = penButtonAction\(\{/);
    assert.match(main, /newStroke\(point, penAction === "eraser"\)/);
    assert.match(main, /buttonMap: state\.penButtons/);
    // The tool itself is untouched by the eraser action.
    const start = main.slice(main.indexOf("function startStroke"), main.indexOf("function moveStroke"));
    assert.doesNotMatch(start, /state\.tool = "eraser"/);
  });

  it("turns the select tool on for the select action, so handles appear", () => {
    assert.match(main, /if \(penAction === "select"\) \{[\s\S]*selectSelectTool\(\);[\s\S]*startSelect\(event, stage\)/);
  });

  it("keeps the switch and the two mappings in settings", () => {
    assert.match(main, /penButtons: loadPenButtons\(\)/);
    assert.match(main, /savePenButtons\(state\.penButtons\)/);
    assert.match(html, /id="pen-button-btn"/);
    assert.match(html, /data-pen-barrel="eraser"/);
    assert.match(html, /data-pen-second="select"/);
    assert.match(html, /data-pen-barrel="none"/);
    // No new bar cell for any of it.
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
  });

  it("swallows the context menu on the paper", () => {
    assert.match(main, /addEventListener\("contextmenu", \(event\) => \{\s*if \(event\.target\.closest\("\.page-stage"\)\)/);
  });
});

describe("#155 더블탭", () => {
  it("needs two taps close in time and place", () => {
    assert.equal(isDoubleTap(1000, 900, 4), true);
    assert.equal(isDoubleTap(1000, 500, 4), false, "too slow");
    assert.equal(isDoubleTap(1000, 900, 60), false, "too far");
    assert.equal(isDoubleTap(1000, 0, 0), false, "there was no first tap");
    assert.equal(DOUBLE_TAP_MS, 320);
  });
});

describe("#171 한 획은 한 포인터", () => {
  it("takes the pointer that started the stroke", () => {
    assert.equal(isStrokePointer(3, 3), true);
  });

  it("refuses a second pointer — the palm that made the triangle", () => {
    assert.equal(isStrokePointer(3, 7), false);
  });

  it("stays open when either side has no id (synthetic pointers)", () => {
    assert.equal(isStrokePointer(null, 7), true);
    assert.equal(isStrokePointer(3, undefined), true);
  });

  it("does not confuse id 0 with no id", () => {
    assert.equal(isStrokePointer(0, 1), false);
    assert.equal(isStrokePointer(0, 0), true);
  });
});

describe("#172 표본을 묶어서 붙이기", () => {
  const rect = { left: 20, top: 50, width: 200, height: 400 };

  it("reads the same position as a fresh measurement would", () => {
    assert.deepEqual(normFromRect(rect, { x: 120, y: 250 }), { x: 0.5, y: 0.5 });
  });

  it("survives a zero-size rect instead of dividing by zero", () => {
    const point = normFromRect({ left: 0, top: 0, width: 0, height: 0 }, { x: 3, y: 4 });
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
  });

  it("appends every sample, in order", () => {
    const samples = [
      { norm: { x: 0.1, y: 0.1 }, client: { x: 1, y: 1 } },
      { norm: { x: 0.2, y: 0.2 }, client: { x: 2, y: 2 } },
    ];
    assert.deepEqual(appendInkPoints([{ x: 0, y: 0 }], samples), [
      { x: 0, y: 0 },
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.2 },
    ]);
  });

  it("matches one-at-a-time appending, including the reused-start guard", () => {
    const prevUp = { x: 100, y: 100 };
    const samples = [
      { norm: { x: 0.1, y: 0.1 }, client: { x: 100, y: 100 } },
      { norm: { x: 0.4, y: 0.4 }, client: { x: 180, y: 240 } },
    ];
    let one = [];
    for (const sample of samples) {
      one = appendInkPoint(one, sample.norm, sample.client, prevUp);
    }
    assert.deepEqual(appendInkPoints([], samples, prevUp), one);
    assert.deepEqual(one, [{ x: 0.4, y: 0.4 }]);
  });

  it("leaves the array it was given alone", () => {
    const before = [{ x: 0, y: 0 }];
    appendInkPoints(before, [{ norm: { x: 1, y: 1 }, client: { x: 1, y: 1 } }]);
    assert.equal(before.length, 1);
  });
});

describe("#171·#172 배선", () => {
  const main = readFileSync(join(root, "src/main.js"), "utf8");

  it("remembers which pointer owns the stroke and lets go at the end", () => {
    assert.match(main, /strokePointerId = event\.pointerId \?\? null/);
    assert.match(main, /if \(!isStrokePointer\(strokePointerId, event\.pointerId\)\) \{\s*return;/);
    assert.equal((main.match(/isStrokePointer\(strokePointerId/g) || []).length, 2, "move and end both check");
    assert.ok(main.split("function endStroke")[1].includes("strokePointerId = null"), "the id is dropped when the stroke ends");
  });

  it("measures the page once per event and appends the samples in one go", () => {
    const move = main.slice(main.indexOf("function moveStroke"), main.indexOf("function endStroke"));
    assert.equal((move.match(/getBoundingClientRect\(\)/g) || []).length, 1);
    assert.match(move, /appendInkPoints\(state\.currentStroke\.points, batch, lastInkUpClient\)/);
    assert.doesNotMatch(move, /eventToNorm\(sample/, "no per-sample measuring");
  });

  it("keeps the live layer off the CPU path", () => {
    assert.match(main, /function liveCanvas2d\(canvas\) \{\s*return canvas\.getContext\("2d"\);/);
    const live = main.slice(main.indexOf("function clearLiveLayer"), main.indexOf("function drawStrokesOn"));
    assert.doesNotMatch(live, /canvas2d\(/, "the live layer never takes the willReadFrequently context");
  });

  it("does not ask for a low-latency surface over the page (#192)", () => {
    assert.doesNotMatch(main, /desynchronized: true/, "on some Android GPUs it comes up opaque and blacks the page");
    assert.match(main, /canvas\.style\.height = `\$\{cssHeight\}px`;\s*\}\s*\/\/ #192[\s\S]{0,120}clearLiveLayer\(view\);/, "a resized layer starts empty");
  });
});

describe("#174 소스 링크 (AGPL 13조)", () => {
  it("offers the source where someone using the app can find it", () => {
    assert.equal((html.match(/class="source-note"/g) || []).length, 2, "upload screen and settings");
    assert.match(html, /id="source-link"[^>]*href="https:\/\/github\.com\/progh2\/pdf-ink"/);
    assert.match(html, /AGPL-3\.0/);
  });
});

describe("#225 키보드 단축키", () => {
  const press = (key, extra = {}) => ({ key, ctrlKey: true, ...extra });

  it("reads the three the master asked for", () => {
    assert.equal(shortcutFor(press("c")), "copy");
    assert.equal(shortcutFor(press("v")), "paste");
    assert.equal(shortcutFor(press("z")), "undo");
  });

  it("takes Cmd on a Mac just the same", () => {
    assert.equal(shortcutFor({ key: "v", metaKey: true }), "paste");
  });

  it("knows both ways of saying redo", () => {
    assert.equal(shortcutFor(press("z", { shiftKey: true })), "redo");
    assert.equal(shortcutFor(press("y")), "redo");
  });

  it("cuts too, since copy and delete were already there", () => {
    assert.equal(shortcutFor(press("x")), "cut");
  });

  it("is not fooled by a bare key or by Alt", () => {
    assert.equal(shortcutFor({ key: "c" }), "", "그냥 c는 글자다");
    assert.equal(shortcutFor(press("c", { altKey: true })), "");
    assert.equal(shortcutFor(press("q")), "");
    assert.equal(shortcutFor(null), "");
  });

  it("leaves the keys alone while someone is typing in a box", () => {
    assert.equal(shortcutAllowed({ typing: true, action: "copy" }), false);
    assert.equal(shortcutAllowed({ typing: false, action: "copy" }), true);
  });

  it("stays out of the way when a sheet is open", () => {
    assert.equal(shortcutAllowed({ overlay: true, action: "undo" }), false);
    assert.equal(shortcutAllowed({ action: "" }), false);
  });
});

describe("#225 배선", () => {
  it("wires copy, paste, cut and undo to what the buttons already do", () => {
    const keys = main.slice(main.indexOf("const shortcut = shortcutFor(event)"), main.indexOf("Escape") );
    assert.match(keys, /shortcut === "undo"[\s\S]{0,80}undoInk\(\)/);
    assert.match(keys, /shortcut === "redo"[\s\S]{0,80}redoInk\(\)/);
    assert.match(keys, /copySelection\(\)/);
    assert.match(keys, /shortcut === "cut"[\s\S]{0,80}deleteSelection\(\)/);
    // #226: Ctrl+V는 가로채지 않는다 — 진짜 paste 이벤트가 클립보드를 더 많이 본다.
    assert.match(keys, /shortcut === "paste"\)\s*\{\s*\/\/ #226/);
    assert.match(main, /document\.addEventListener\("paste", onNativePaste\)/);
  });

  it("does nothing without a document, and no editing while locked", () => {
    const keys = main.slice(main.indexOf("const shortcut = shortcutFor(event)"), main.indexOf("Escape"));
    assert.match(keys, /!state\.pdf \|\| els\.writeScreen\.hidden/);
    assert.match(keys, /state\.interactMode === "view"[\s\S]{0,40}return;/, "보기 중엔 붙이지도 지우지도 않는다");
    assert.ok(keys.indexOf("undoInk()") < keys.indexOf('state.interactMode === "view"'), "되돌리기는 보기 중에도 된다");
  });
});

describe("#234 도구에 따른 커서", () => {
  it("says grab while the page is locked, whatever the tool", () => {
    assert.equal(cursorForTool({ interactMode: "view", tool: "pen" }), "grab");
  });

  it("draws with a crosshair and picks with an arrow", () => {
    assert.equal(cursorForTool({ interactMode: "edit", tool: "pen" }), "crosshair");
    assert.equal(cursorForTool({ interactMode: "edit", tool: "highlighter" }), "crosshair");
    assert.equal(cursorForTool({ interactMode: "edit", tool: "select" }), "default");
  });

  it("hides the cursor for the eraser, which draws its own circle", () => {
    assert.equal(cursorForTool({ interactMode: "edit", tool: "eraser" }), "none");
  });

  it("shows the eyedropper is armed, above everything else", () => {
    assert.equal(cursorForTool({ interactMode: "view", tool: "pen", eyedrop: true }), "copy");
  });

  it("keeps the area tool on a crosshair", () => {
    assert.equal(cursorForTool({ interactMode: "edit", tool: "select", rectTool: "capture" }), "crosshair");
  });
});

describe("#234 호버 표시", () => {
  it("shows only for a pen that is hovering, on the paper, while editing", () => {
    const base = { pointerType: "pen", buttons: 0, interactMode: "edit", onPaper: true };
    assert.equal(shouldShowHover(base), true);
    assert.equal(shouldShowHover({ ...base, buttons: 1 }), false, "닿아 있으면 획이 보인다");
    assert.equal(shouldShowHover({ ...base, pointerType: "touch" }), false, "손가락은 호버가 없다");
    assert.equal(shouldShowHover({ ...base, interactMode: "view" }), false);
    assert.equal(shouldShowHover({ ...base, onPaper: false }), false);
    assert.equal(shouldShowHover({ ...base, overlay: true }), false);
  });

  it("gives each tool its own mark", () => {
    assert.equal(hoverShapeForTool("eraser"), "eraser");
    assert.equal(hoverShapeForTool("highlighter"), "highlighter");
    assert.equal(hoverShapeForTool("select"), "point");
    assert.equal(hoverShapeForTool("pen"), "nib");
  });
});

describe("#234 펜 버튼 시험", () => {
  it("reads the raw report back in words", () => {
    const line = describePenEvent({ pointerType: "pen", buttons: 3, button: 0 }, { barrel: "eraser", second: "select" });
    assert.match(line, /buttons 3/);
    assert.match(line, /촉\+배럴/);
    assert.match(line, /→ eraser/, "무엇으로 읽혔는지까지");
  });

  it("says plainly when a press carried no button at all", () => {
    const line = describePenEvent({ pointerType: "pen", buttons: 1, button: 0 }, { barrel: "eraser" });
    assert.match(line, /→ 없음/, "기기가 버튼을 안 보낸 것이 보인다");
  });

  it("survives being handed nothing", () => {
    assert.equal(describePenEvent(null), "");
  });
});
