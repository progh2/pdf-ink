import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  appendInkPoint,
  beginInkPoints,
  canCreateInk,
  finishInkPoints,
  isReusedInkStart,
  rectFromPoints,
  shouldPanPointer,
} from "./interact.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src/style.css"), "utf8");
const main = readFileSync(join(root, "src/main.js"), "utf8");
const html = readFileSync(join(root, "index.html"), "utf8");
const toolbar = html.slice(html.indexOf('id="toolbar"'), html.indexOf('id="workspace"'));

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
    assert.match(main, /appendInkPoint\(/);
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
