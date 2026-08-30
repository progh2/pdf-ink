import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { appendInkPoint, beginInkPoints, finishInkPoints } from "./interact.js";
import { UNDO_HOLD_MS } from "./undoHold.js";
import {
  SHAPE_HOLD_MS,
  SHAPE_HOLD_TOOLS,
  canShapeHold,
  classifyStrokeShape,
  createShapeHold,
  snapStrokePoints,
} from "./shapeHold.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "src/style.css"), "utf8");
const main = readFileSync(join(root, "src/main.js"), "utf8");
const toolbar = html.slice(html.indexOf('id="toolbar"'), html.indexOf('id="workspace"'));
const shapeHoldSrc = readFileSync(join(root, "src/shapeHold.js"), "utf8");

function lineStroke(x0, y0, x1, y1, n = 24, noise = 0) {
  const pts = [];
  for (let index = 0; index < n; index += 1) {
    const t = index / (n - 1);
    const wobble = index === 0 || index === n - 1 ? 0 : noise;
    pts.push({
      x: x0 + (x1 - x0) * t + wobble * Math.sin(index * 3.1),
      y: y0 + (y1 - y0) * t + wobble * Math.cos(index * 2.7),
    });
  }
  return pts;
}

function boxStroke() {
  const edges = [
    [
      [0.2, 0.22],
      [0.74, 0.2],
    ],
    [
      [0.74, 0.2],
      [0.76, 0.7],
    ],
    [
      [0.76, 0.7],
      [0.21, 0.72],
    ],
    [
      [0.21, 0.72],
      [0.2, 0.22],
    ],
  ];
  const pts = [];
  for (const [[x0, y0], [x1, y1]] of edges) {
    for (let index = 0; index < 8; index += 1) {
      const t = index / 8;
      pts.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t });
    }
  }
  pts.push({ x: 0.2, y: 0.22 });
  return pts;
}

function ovalStroke(cx, cy, rx, ry, n = 40) {
  const pts = [];
  for (let index = 0; index <= n; index += 1) {
    const t = (index / n) * Math.PI * 2;
    pts.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
  }
  return pts;
}

function createClock() {
  let now = 0;
  const timers = new Map();
  let nextId = 1;
  return {
    now: () => now,
    setTimeoutFn: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { fn, at: now + ms });
      return id;
    },
    clearTimeoutFn: (id) => {
      timers.delete(id);
    },
    advance(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.fn();
        }
      }
    },
  };
}

describe("#51 shape hold classify", () => {
  it("classifies line vs rect vs ellipse/circle vs no-snap", () => {
    assert.equal(classifyStrokeShape(lineStroke(0.1, 0.4, 0.86, 0.42, 20, 0.004)).kind, "line");
    assert.equal(classifyStrokeShape(boxStroke()).kind, "rect");
    assert.equal(classifyStrokeShape(ovalStroke(0.5, 0.5, 0.22, 0.22)).kind, "circle");
    assert.equal(classifyStrokeShape(ovalStroke(0.5, 0.48, 0.28, 0.14)).kind, "ellipse");
    assert.equal(
      classifyStrokeShape([
        { x: 0.1, y: 0.2 },
        { x: 0.3, y: 0.8 },
        { x: 0.5, y: 0.2 },
        { x: 0.7, y: 0.8 },
        { x: 0.9, y: 0.2 },
      ]).kind,
      null,
    );
    assert.equal(classifyStrokeShape([{ x: 0.5, y: 0.5 }]).kind, null);
    assert.equal(
      classifyStrokeShape([
        { x: 0.5, y: 0.5 },
        { x: 0.508, y: 0.503 },
      ]).kind,
      null,
    );
  });

  it("snaps helpers replace a line-like polyline with two points", () => {
    const dragged = lineStroke(0.12, 0.3, 0.8, 0.33, 18, 0.005);
    const snapped = snapStrokePoints(dragged);
    assert.equal(snapped.length, 2);
    assert.deepEqual(snapped[0], dragged[0]);
    assert.deepEqual(snapped[1], dragged.at(-1));
    const box = snapStrokePoints(boxStroke());
    assert.equal(box.length, 5);
    const mess = [
      { x: 0.1, y: 0.2 },
      { x: 0.3, y: 0.8 },
      { x: 0.5, y: 0.2 },
      { x: 0.7, y: 0.8 },
      { x: 0.9, y: 0.2 },
    ];
    assert.deepEqual(snapStrokePoints(mess), mess);
  });
});

describe("#51 400ms hold snaps; lift without hold keeps freehand", () => {
  it("uses a different 400ms switch from undo-hold", () => {
    assert.equal(SHAPE_HOLD_MS, 400);
    assert.equal(UNDO_HOLD_MS, 400);
    assert.deepEqual(SHAPE_HOLD_TOOLS, ["pen", "highlighter", "pencil"]);
    assert.equal(canShapeHold("pen"), true);
    assert.equal(canShapeHold("highlighter"), true);
    assert.equal(canShapeHold("pencil"), true);
    assert.equal(canShapeHold("eraser"), false);
    assert.equal(canShapeHold("stamp"), false);
    assert.equal(canShapeHold("select"), false);
    assert.doesNotMatch(shapeHoldSrc, /undoHold|bindUndoHold|UNDO_HOLD_MS/);
    assert.match(main, /from "\.\/shapeHold\.js"/);
    assert.match(main, /from "\.\/undoHold\.js"/);
    assert.match(main, /createShapeHold\(/);
    assert.match(main, /bindUndoHold\(els\.undoBtn,\s*\{\s*onUndo:\s*undoInk,\s*onRedo:\s*redoInk/);
  });

  it("hold 400ms on a dragged line-like stroke snaps to a line", () => {
    const clock = createClock();
    const hold = createShapeHold({
      holdMs: SHAPE_HOLD_MS,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    const dragged = lineStroke(0.1, 0.4, 0.85, 0.42, 24, 0.004);
    let live = [dragged[0]];
    hold.begin({
      tool: "pen",
      client: { x: 10, y: 40 },
      getPoints: () => live,
      onSnap: (next) => {
        live = next.points;
      },
    });
    for (let index = 1; index < dragged.length; index += 1) {
      live = dragged.slice(0, index + 1);
      hold.noteMove({
        client: { x: 10 + index * 8, y: 40 },
        getPoints: () => live,
        onSnap: (next) => {
          live = next.points;
        },
      });
    }
    clock.advance(399);
    assert.equal(hold.isSnapped(), false);
    assert.deepEqual(live, dragged);
    clock.advance(1);
    assert.equal(hold.isSnapped(), true);
    assert.equal(hold.snappedKind(), "line");
    assert.equal(live.length, 2);
    const done = hold.finish(live);
    assert.equal(done.snapped, true);
    assert.equal(done.kind, "line");
    assert.equal(done.points.length, 2);
  });

  it("lift before 400ms keeps freehand", () => {
    const clock = createClock();
    const hold = createShapeHold({
      holdMs: SHAPE_HOLD_MS,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    const dragged = lineStroke(0.1, 0.5, 0.8, 0.5, 16, 0);
    let live = dragged;
    hold.begin({
      tool: "pen",
      client: { x: 10, y: 20 },
      getPoints: () => live,
    });
    hold.noteMove({
      client: { x: 200, y: 20 },
      getPoints: () => live,
    });
    clock.advance(399);
    const done = hold.finish(live);
    assert.equal(hold.isSnapped(), false);
    assert.equal(done.snapped, false);
    assert.deepEqual(done.points, dragged);
  });

  it("moving before 400ms resets the hold timer", () => {
    const clock = createClock();
    const hold = createShapeHold({
      holdMs: SHAPE_HOLD_MS,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    const dragged = lineStroke(0.1, 0.4, 0.85, 0.4, 12, 0);
    let live = dragged;
    hold.begin({
      tool: "highlighter",
      client: { x: 0, y: 0 },
      getPoints: () => live,
    });
    hold.noteMove({ client: { x: 80, y: 0 }, getPoints: () => live });
    clock.advance(200);
    hold.noteMove({ client: { x: 160, y: 0 }, getPoints: () => live });
    clock.advance(200);
    assert.equal(hold.isSnapped(), false);
    clock.advance(200);
    assert.equal(hold.isSnapped(), true);
  });

  it("does not snap stamps, eraser, or tiny dots", () => {
    const clock = createClock();
    const hold = createShapeHold({
      holdMs: SHAPE_HOLD_MS,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    hold.begin({
      tool: "stamp",
      client: { x: 1, y: 1 },
      getPoints: () => lineStroke(0.1, 0.1, 0.8, 0.1),
    });
    clock.advance(400);
    assert.equal(hold.isSnapped(), false);

    const erase = createShapeHold({
      holdMs: SHAPE_HOLD_MS,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    erase.begin({
      tool: "erase",
      client: { x: 1, y: 1 },
      getPoints: () => lineStroke(0.1, 0.1, 0.8, 0.1),
    });
    clock.advance(400);
    assert.equal(erase.isSnapped(), false);

    const dot = createShapeHold({
      holdMs: SHAPE_HOLD_MS,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    dot.begin({
      tool: "pen",
      client: { x: 8, y: 8 },
      getPoints: () => [{ x: 0.5, y: 0.5 }],
    });
    clock.advance(400);
    assert.equal(dot.isSnapped(), false);
  });
});

describe("#47 leftover taps still are not a line", () => {
  const aClient = { x: 40, y: 80 };
  const bClient = { x: 220, y: 360 };
  const aNorm = { x: 0.12, y: 0.2 };
  const bNorm = { x: 0.7, y: 0.85 };

  it("two taps with last-up reused start still not a line, even after 400ms", () => {
    const first = finishInkPoints(beginInkPoints(aNorm, aClient, null), aNorm, aClient, null);
    assert.deepEqual(first, [aNorm]);

    let second = beginInkPoints(aNorm, aClient, aClient);
    const clock = createClock();
    const hold = createShapeHold({
      holdMs: SHAPE_HOLD_MS,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    hold.begin({
      tool: "pen",
      client: aClient,
      getPoints: () => second,
    });
    clock.advance(400);
    assert.equal(hold.isSnapped(), false);
    second = appendInkPoint(second, bNorm, bClient, aClient);
    second = finishInkPoints(second, bNorm, bClient, aClient);
    const done = hold.finish(second);
    assert.deepEqual(done.points, [bNorm]);
    assert.equal(done.points.length, 1);
    assert.equal(classifyStrokeShape(done.points).kind, null);
    assert.equal(done.snapped, false);
  });
});

describe("#51 chrome lock", () => {
  it("keeps one toolbar and does not add a cell or paper chips", () => {
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.doesNotMatch(html, /id="shape-chips"|data-shape=/);
    assert.doesNotMatch(toolbar, /shape-chips|data-shape=/);
    assert.doesNotMatch(css, /\.shape-chips/);
    assert.match(css, /\.toolbar \{[\s\S]*flex-wrap: nowrap/);
    assert.match(main, /shapeHold\.begin/);
    assert.match(main, /onSnap/);
    assert.match(main, /beginInkPoints\(/);
    assert.match(main, /lastInkUpClient/);
    assert.match(main, /currentStroke\.points = result\.points/);
  });
});
