import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { appendInkPoint, beginInkPoints, finishInkPoints } from "./interact.js";
import { UNDO_HOLD_MS } from "./undoHold.js";
import {
  SHAPE_HOLD_CHIPS,
  SHAPE_HOLD_CHIP_HEIGHT,
  SHAPE_HOLD_DISMISS_MS,
  SHAPE_HOLD_GHOST_ALPHA,
  SHAPE_HOLD_MOVE_SLOP_PX,
  SHAPE_HOLD_MS,
  SHAPE_HOLD_TOOLS,
  applyShapeChip,
  canShapeHold,
  classifyStrokeShape,
  createShapeHold,
  shapeOfferFromStroke,
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
  });

  it("chip pick converts; hold without a pick keeps freehand", () => {
    const dragged = lineStroke(0.12, 0.3, 0.8, 0.33, 18, 0.005);
    const offer = shapeOfferFromStroke(dragged);
    assert.ok(offer);
    assert.deepEqual(SHAPE_HOLD_CHIPS, ["line", "rect", "circle"]);
    assert.equal(offer.chips.line.length, 2);
    assert.equal(offer.chips.rect.length, 5);
    assert.ok(offer.chips.circle.length > 8);
    assert.deepEqual(applyShapeChip("line", dragged), offer.chips.line);
    assert.notDeepEqual(applyShapeChip("rect", dragged), dragged);
    assert.equal(dragged.length > 2, true);
  });
});

describe("#51 400ms hold offers chips, does not auto-convert", () => {
  it("uses a different 400ms switch from undo-hold", () => {
    assert.equal(SHAPE_HOLD_MS, 400);
    assert.equal(UNDO_HOLD_MS, 400);
    assert.equal(SHAPE_HOLD_GHOST_ALPHA, 0.4);
    assert.equal(SHAPE_HOLD_CHIP_HEIGHT, 36);
    assert.equal(SHAPE_HOLD_MOVE_SLOP_PX, 16);
    assert.equal(SHAPE_HOLD_DISMISS_MS, 8000);
    assert.deepEqual(SHAPE_HOLD_TOOLS, ["pen", "highlighter", "pencil"]);
    assert.equal(canShapeHold("pen"), true);
    assert.equal(canShapeHold("highlighter"), true);
    assert.equal(canShapeHold("pencil"), true);
    assert.equal(canShapeHold("eraser"), false);
    assert.equal(canShapeHold("stamp"), false);
    assert.doesNotMatch(shapeHoldSrc, /undoHold|bindUndoHold|UNDO_HOLD_MS/);
    assert.match(main, /from "\.\/shapeHold\.js"/);
    assert.match(main, /from "\.\/undoHold\.js"/);
    assert.match(main, /createShapeHold\(/);
    assert.doesNotMatch(main, /currentStroke\.points = result\.points/);
  });

  it("hold 400ms on a dragged line-like stroke keeps freehand and offers chips", () => {
    const clock = createClock();
    const hold = createShapeHold({
      holdMs: SHAPE_HOLD_MS,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    const dragged = lineStroke(0.1, 0.4, 0.85, 0.42, 24, 0.004);
    let live = [dragged[0]];
    let offered = null;
    hold.begin({
      tool: "pen",
      client: { x: 10, y: 40 },
      getPoints: () => live,
      onOffer: (next) => {
        offered = next;
      },
    });
    for (let index = 1; index < dragged.length; index += 1) {
      live = dragged.slice(0, index + 1);
      hold.noteMove({
        client: { x: 10 + index * 8, y: 40 },
        getPoints: () => live,
        onOffer: (next) => {
          offered = next;
        },
      });
    }
    clock.advance(399);
    assert.equal(hold.isOffering(), false);
    assert.equal(offered, null);
    assert.deepEqual(live, dragged);
    clock.advance(1);
    assert.equal(hold.isOffering(), true);
    assert.ok(offered);
    assert.ok(offered.chips.line);
    assert.ok(offered.chips.rect);
    assert.ok(offered.chips.circle);
    assert.deepEqual(live, dragged);
    const done = hold.finish(live);
    assert.equal(done.snapped, false);
    assert.deepEqual(done.points, dragged);
    assert.equal(done.offer.chips.line.length, 2);
  });

  it("lift before 400ms keeps freehand with no chips and no ghost", () => {
    const clock = createClock();
    const hold = createShapeHold({
      holdMs: SHAPE_HOLD_MS,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    const dragged = lineStroke(0.1, 0.5, 0.8, 0.5, 16, 0);
    hold.begin({
      tool: "pen",
      client: { x: 10, y: 20 },
      getPoints: () => dragged,
    });
    hold.noteMove({
      client: { x: 200, y: 20 },
      getPoints: () => dragged,
    });
    clock.advance(399);
    const done = hold.finish(dragged);
    assert.equal(hold.isOffering(), false);
    assert.equal(done.offer, null);
    assert.deepEqual(done.points, dragged);
    assert.equal(done.snapped, false);
  });

  it("small jitter does not reset the 400ms end hold", () => {
    const clock = createClock();
    const hold = createShapeHold({
      holdMs: SHAPE_HOLD_MS,
      now: clock.now,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    const dragged = lineStroke(0.1, 0.4, 0.85, 0.42, 20, 0.004);
    let offered = null;
    hold.begin({
      tool: "pen",
      client: { x: 10, y: 40 },
      getPoints: () => dragged,
      onOffer: (next) => {
        offered = next;
      },
    });
    hold.noteMove({
      client: { x: 200, y: 40 },
      getPoints: () => dragged,
      onOffer: (next) => {
        offered = next;
      },
    });
    for (let index = 0; index < 8; index += 1) {
      clock.advance(50);
      hold.noteMove({
        client: {
          x: 200 + (index % 2 ? 8 : -8),
          y: 40 + (index % 2 ? 5 : -5),
        },
        getPoints: () => dragged,
        onOffer: (next) => {
          offered = next;
        },
      });
    }
    assert.equal(hold.isOffering(), true);
    assert.ok(offered);
    assert.ok(offered.chips.line);
    const done = hold.finish(dragged);
    assert.equal(done.snapped, false);
    assert.deepEqual(done.points, dragged);
    assert.ok(done.offer);
    assert.ok(done.offer.ghostPoints.length);
  });

  it("lift after 400ms stillness still offers even if the timer never ran", () => {
    const clock = createClock();
    const hold = createShapeHold({
      holdMs: SHAPE_HOLD_MS,
      now: clock.now,
      setTimeoutFn: () => 0,
      clearTimeoutFn: () => {},
    });
    const dragged = lineStroke(0.12, 0.3, 0.82, 0.32, 16, 0);
    hold.begin({
      tool: "pen",
      client: { x: 0, y: 0 },
      getPoints: () => dragged,
    });
    hold.noteMove({
      client: { x: 180, y: 0 },
      getPoints: () => dragged,
    });
    clock.advance(400);
    const done = hold.finish(dragged);
    assert.ok(done.offer);
    assert.equal(done.snapped, false);
    assert.deepEqual(done.points, dragged);
    assert.notEqual(done.points.length, 2);
    assert.ok(done.offer.chips.line);
    assert.ok(done.offer.chips.rect);
    assert.ok(done.offer.chips.circle);
  });

  it("offer survives finish so a chip can be tapped after lift", () => {
    const clock = createClock();
    const hold = createShapeHold({
      holdMs: SHAPE_HOLD_MS,
      now: clock.now,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    const dragged = lineStroke(0.1, 0.4, 0.85, 0.4, 12, 0);
    hold.begin({
      tool: "pen",
      client: { x: 0, y: 0 },
      getPoints: () => dragged,
    });
    hold.noteMove({ client: { x: 160, y: 0 }, getPoints: () => dragged });
    clock.advance(400);
    const done = hold.finish(dragged);
    assert.ok(done.offer);
    assert.equal(hold.isOffering(), true);
    assert.equal(done.snapped, false);
    assert.deepEqual(done.points, dragged);
    assert.deepEqual(applyShapeChip("line", dragged), done.offer.chips.line);
  });

  it("auto convert without a chip pick is not allowed", () => {
    const clock = createClock();
    const hold = createShapeHold({
      holdMs: SHAPE_HOLD_MS,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    const dragged = lineStroke(0.1, 0.4, 0.85, 0.4, 12, 0);
    hold.begin({
      tool: "pen",
      client: { x: 0, y: 0 },
      getPoints: () => dragged,
    });
    hold.noteMove({ client: { x: 160, y: 0 }, getPoints: () => dragged });
    clock.advance(400);
    const done = hold.finish(dragged);
    assert.equal(done.snapped, false);
    assert.deepEqual(done.points, dragged);
    assert.notEqual(done.points.length, 2);
  });
});

function feedStroke(hold, points, startClient, stepPx = 20) {
  let live = beginInkPoints(points[0], startClient, null);
  let offered = null;
  const onOffer = (next) => {
    offered = next;
  };
  hold.begin({
    tool: "pen",
    client: startClient,
    getPoints: () => live,
    onOffer,
  });
  for (let index = 1; index < points.length; index += 1) {
    const client = { x: startClient.x + index * stepPx, y: startClient.y };
    const accept = hold.noteMove({
      client,
      getPoints: () => live,
      onOffer,
    });
    if (accept) {
      live = appendInkPoint(live, points[index], client, null);
    }
  }
  return {
    live,
    offered: () => offered,
    move(norm, client) {
      const accept = hold.noteMove({
        client,
        getPoints: () => live,
        onOffer,
      });
      if (accept) {
        live = appendInkPoint(live, norm, client, null);
      }
      return accept;
    },
    points: () => live,
  };
}

describe("#70 hold at end of a long stroke does not leak a triangle", () => {
  it("does not append jitter points during the 400ms end hold", () => {
    const clock = createClock();
    const hold = createShapeHold({
      holdMs: SHAPE_HOLD_MS,
      now: clock.now,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    const dragged = lineStroke(0.1, 0.4, 0.85, 0.42, 24, 0.004);
    const stroke = feedStroke(hold, dragged, { x: 10, y: 40 }, 20);
    const beforeHold = stroke.points().slice();
    assert.ok(beforeHold.length > 3);
    const endClient = { x: 10 + (dragged.length - 1) * 20, y: 40 };
    for (let index = 0; index < 10; index += 1) {
      clock.advance(35);
      const accept = stroke.move(
        {
          x: 0.85 + (index % 2 ? 0.02 : -0.015),
          y: 0.55 + (index % 2 ? 0.08 : -0.04),
        },
        {
          x: endClient.x + (index % 2 ? 8 : -7),
          y: endClient.y + (index % 2 ? 6 : -5),
        },
      );
      assert.equal(accept, false);
    }
    assert.deepEqual(stroke.points(), beforeHold);
    assert.notEqual(stroke.points().length, 3);
    clock.advance(50);
    assert.equal(hold.isOffering(), true);
    assert.ok(stroke.offered());
    assert.ok(stroke.offered().chips.line);
    assert.ok(stroke.offered().chips.rect);
    assert.ok(stroke.offered().chips.circle);
    assert.notEqual(stroke.offered().ghostPoints.length, 3);
    assert.ok(stroke.offered().ghostPoints.length === 2 || stroke.offered().ghostPoints.length > 4);
  });

  it("pointerup after a hold keeps freehand, not a leftover triangle", () => {
    const clock = createClock();
    const hold = createShapeHold({
      holdMs: SHAPE_HOLD_MS,
      now: clock.now,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    const dragged = lineStroke(0.12, 0.3, 0.82, 0.33, 20, 0.003);
    const stroke = feedStroke(hold, dragged, { x: 8, y: 24 }, 22);
    const freehand = stroke.points().slice();
    const endClient = { x: 8 + (dragged.length - 1) * 22, y: 24 };
    clock.advance(200);
    stroke.move({ x: 0.45, y: 0.7 }, { x: endClient.x + 10, y: endClient.y + 8 });
    clock.advance(200);
    assert.deepEqual(stroke.points(), freehand);
    const done = hold.finish(stroke.points());
    assert.equal(hold.isOffering(), true);
    assert.ok(done.offer);
    assert.ok(done.offer.chips.line);
    assert.ok(done.offer.chips.rect);
    assert.ok(done.offer.chips.circle);
    assert.equal(done.snapped, false);
    assert.deepEqual(done.points, freehand);
    assert.notEqual(done.points.length, 3);
    assert.ok(done.points.length > 3);
    assert.notEqual(done.offer.ghostPoints.length, 3);
  });

  it("dismissing chips keeps the long freehand stroke", () => {
    const clock = createClock();
    const hold = createShapeHold({
      holdMs: SHAPE_HOLD_MS,
      now: clock.now,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    const dragged = lineStroke(0.1, 0.5, 0.84, 0.52, 18, 0);
    const stroke = feedStroke(hold, dragged, { x: 12, y: 30 }, 24);
    const freehand = stroke.points().slice();
    clock.advance(400);
    const done = hold.finish(stroke.points());
    assert.ok(done.offer);
    assert.deepEqual(done.points, freehand);
    assert.equal(applyShapeChip("line", done.points).length, 2);
    assert.deepEqual(done.points, freehand);
    assert.notEqual(done.points.length, 3);
  });

  it("still records a short drag that never leaves the slop bubble", () => {
    const hold = createShapeHold();
    const start = { x: 40, y: 40 };
    const mid = { x: 48, y: 43 };
    let live = beginInkPoints({ x: 0.2, y: 0.2 }, start, null);
    hold.begin({
      tool: "pen",
      client: start,
      getPoints: () => live,
    });
    const accept = hold.noteMove({
      client: mid,
      getPoints: () => live,
    });
    assert.equal(accept, true);
    live = appendInkPoint(live, { x: 0.22, y: 0.21 }, mid, null);
    assert.equal(live.length, 2);
    const done = hold.finish(live);
    assert.deepEqual(done.points, live);
  });

  it("wires moveStroke to skip appendInkPoint while the end hold is still", () => {
    assert.match(main, /const holdMove = canShapeHold/);
    assert.match(main, /if \(holdMove\) \{\s*state\.currentStroke\.points = appendInkPoint/);
    assert.match(main, /shapeHold\.noteMove/);
    assert.match(main, /shapeHold\.finish\(freehand\)/);
    assert.match(main, /beginInkPoints\(/);
    assert.match(main, /lastInkUpClient/);
  });

  it("does not add a toolbar cell or drop the three paper chips", () => {
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.deepEqual(SHAPE_HOLD_CHIPS, ["line", "rect", "circle"]);
    assert.match(html, /id="shape-chips"/);
    assert.match(html, /data-shape="line"/);
    assert.match(html, /data-shape="rect"/);
    assert.match(html, /data-shape="circle"/);
    assert.doesNotMatch(html, /data-shape="triangle"/);
    assert.doesNotMatch(toolbar, /shape-chips|data-shape=/);
    assert.doesNotMatch(main, /data-shape="triangle"/);
    assert.match(css, /\.shape-chips button \{[\s\S]*height: 36px/);
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
    assert.equal(hold.isOffering(), false);
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
  it("puts three 36px chips on the paper, not on the one toolbar", () => {
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.match(html, /id="shape-chips"/);
    assert.match(html, /data-shape="line"/);
    assert.match(html, /data-shape="rect"/);
    assert.match(html, /data-shape="circle"/);
    assert.match(html, />직선</);
    assert.match(html, />사각</);
    assert.match(html, />원</);
    assert.doesNotMatch(toolbar, /shape-chips|data-shape=/);
    assert.match(css, /\.shape-chips button \{[\s\S]*height: 36px/);
    assert.match(css, /\.toolbar \{[\s\S]*flex-wrap: nowrap/);
    assert.match(main, /shapeHold\.begin/);
    assert.match(main, /onOffer/);
    assert.match(main, /beginInkPoints\(/);
    assert.match(main, /lastInkUpClient/);
    assert.match(main, /SHAPE_HOLD_GHOST_ALPHA/);
    assert.match(main, /SHAPE_HOLD_DISMISS_MS/);
    assert.match(main, /armShapeOfferDismiss/);
    assert.match(main, /event\.type === "pointercancel" && state\.drawing && event\.buttons > 0/);
    assert.match(main, /Number\.isInteger\(state\.shapeOffer\.index\)/);
    assert.doesNotMatch(main, /currentStroke\.points = (?:next|result|snapped)/);
  });
});
