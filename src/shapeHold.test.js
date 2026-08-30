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
  isShapeHoldJitter,
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

describe("#70 hold-end jitter must not turn ink into a triangle", () => {
  function fanTriangleTail(stroke) {
    const last = stroke[stroke.length - 1];
    return [
      { x: last.x + 0.08, y: last.y - 0.22 },
      { x: last.x - 0.18, y: last.y + 0.2 },
      { x: last.x + 0.02, y: last.y + 0.04 },
    ];
  }

  function recordHoldMove(hold, live, client, norm, onOffer) {
    const append = hold.noteMove({
      client,
      getPoints: () => live,
      onOffer,
    });
    if (append) {
      return appendInkPoint(live, norm, client, null);
    }
    return live;
  }

  it("treats SHAPE_HOLD_MOVE_SLOP as freeze, not a new point", () => {
    assert.equal(SHAPE_HOLD_MOVE_SLOP_PX, 16);
    assert.equal(isShapeHoldJitter({ x: 200, y: 40 }, { x: 200, y: 40 }), true);
    assert.equal(isShapeHoldJitter({ x: 208, y: 45 }, { x: 200, y: 40 }), true);
    assert.equal(isShapeHoldJitter({ x: 220, y: 40 }, { x: 200, y: 40 }), false);
    assert.equal(isShapeHoldJitter({ x: 200, y: 40 }, null), false);
  });

  it("does not append jitter while the 400ms end-hold is running", () => {
    const clock = createClock();
    const hold = createShapeHold({
      holdMs: SHAPE_HOLD_MS,
      now: clock.now,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    const dragged = lineStroke(0.08, 0.42, 0.88, 0.4, 28, 0.003);
    const startClient = { x: 20, y: 80 };
    let live = [dragged[0]];
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
    for (let index = 1; index < dragged.length; index += 1) {
      live = recordHoldMove(hold, live, { x: startClient.x + index * 20, y: 80 }, dragged[index], onOffer);
    }
    const endClient = { x: startClient.x + (dragged.length - 1) * 20, y: 80 };
    assert.deepEqual(live, dragged);
    const heldCount = live.length;
    const fan = fanTriangleTail(dragged);
    for (let index = 0; index < 10; index += 1) {
      clock.advance(40);
      const jitterClient = {
        x: endClient.x + (index % 2 ? 8 : -7),
        y: endClient.y + (index % 2 ? 6 : -5),
      };
      live = recordHoldMove(hold, live, jitterClient, fan[index % fan.length], onOffer);
      assert.equal(hold.noteMove({ client: jitterClient, getPoints: () => live, onOffer }), false);
    }
    clock.advance(400);
    assert.equal(live.length, heldCount);
    assert.deepEqual(live, dragged);
    assert.equal(hold.isOffering(), true);
    assert.ok(offered);
    assert.deepEqual(offered.ghostPoints, offered.chips[offered.kind] || offered.chips.line);
    assert.ok(SHAPE_HOLD_CHIPS.includes(offered.kind));
    assert.notEqual(offered.ghostPoints.length, 3);
    assert.notEqual(offered.ghostPoints.length, 4);
    const done = hold.finish([...live, ...fan]);
    assert.equal(done.snapped, false);
    assert.deepEqual(done.points, dragged);
    assert.notEqual(done.points.length, 3);
    assert.ok(done.offer);
    assert.deepEqual(SHAPE_HOLD_CHIPS, ["line", "rect", "circle"]);
    assert.ok(done.offer.chips.line);
    assert.ok(done.offer.chips.rect);
    assert.ok(done.offer.chips.circle);
  });

  it("keeps freehand (not a leftover triangle) when no chip is picked", () => {
    const clock = createClock();
    const hold = createShapeHold({
      holdMs: SHAPE_HOLD_MS,
      now: clock.now,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    const dragged = lineStroke(0.1, 0.3, 0.86, 0.32, 22, 0.004);
    hold.begin({
      tool: "highlighter",
      client: { x: 12, y: 30 },
      getPoints: () => dragged,
    });
    hold.noteMove({ client: { x: 190, y: 30 }, getPoints: () => dragged });
    clock.advance(200);
    assert.equal(
      hold.noteMove({
        client: { x: 198, y: 36 },
        getPoints: () => dragged,
      }),
      false,
    );
    clock.advance(200);
    const done = hold.finish([...dragged, { x: 0.7, y: 0.08 }, { x: 0.4, y: 0.7 }]);
    assert.equal(done.snapped, false);
    assert.deepEqual(done.points, dragged);
    assert.ok(done.offer);
    assert.deepEqual(done.offer.ghostPoints, done.offer.chips.line);
    assert.notEqual(done.points.length, 3);
  });

  it("long freehand plus hold does not grow a tail even on a large pointer jump", () => {
    const clock = createClock();
    const hold = createShapeHold({
      holdMs: SHAPE_HOLD_MS,
      now: clock.now,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    const dragged = lineStroke(0.06, 0.28, 0.9, 0.3, 32, 0.003);
    const startClient = { x: 24, y: 60 };
    let live = [dragged[0]];
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
    for (let index = 1; index < dragged.length; index += 1) {
      live = recordHoldMove(hold, live, { x: startClient.x + index * 22, y: 60 }, dragged[index], onOffer);
    }
    const endClient = { x: startClient.x + (dragged.length - 1) * 22, y: 60 };
    const last = dragged[dragged.length - 1];
    assert.deepEqual(live, dragged);
    const heldCount = live.length;
    clock.advance(80);
    const tailClient = { x: endClient.x, y: endClient.y + 145 };
    const tailNorm = { x: last.x, y: last.y + 0.22 };
    live = recordHoldMove(hold, live, tailClient, tailNorm, onOffer);
    assert.equal(live.length, heldCount);
    assert.deepEqual(live, dragged);
    assert.notEqual(live.at(-1)?.y, tailNorm.y);
    clock.advance(400);
    assert.equal(hold.isOffering(), true);
    assert.ok(offered);
    assert.ok(offered.chips.line);
    assert.ok(offered.chips.rect);
    assert.ok(offered.chips.circle);
    const done = hold.finish([...live, tailNorm]);
    assert.equal(done.snapped, false);
    assert.deepEqual(done.points, dragged);
  });

  it("a 145px downward client jump during an active hold/offer does not grow the stroke if chips remain", () => {
    const clock = createClock();
    const hold = createShapeHold({
      holdMs: SHAPE_HOLD_MS,
      now: clock.now,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
    });
    const dragged = lineStroke(0.1, 0.36, 0.84, 0.38, 20, 0.003);
    const startClient = { x: 16, y: 60 };
    let live = [dragged[0]];
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
    for (let index = 1; index < dragged.length; index += 1) {
      live = recordHoldMove(hold, live, { x: startClient.x + index * 20, y: 60 }, dragged[index], onOffer);
    }
    const endClient = { x: startClient.x + (dragged.length - 1) * 20, y: 60 };
    clock.advance(400);
    assert.equal(hold.isOffering(), true);
    assert.ok(offered);
    assert.ok(SHAPE_HOLD_CHIPS.includes(offered.kind));
    assert.deepEqual(offered.ghostPoints, offered.chips[offered.kind] || offered.chips.line);
    const before = live.slice();
    const last = live[live.length - 1];
    const jumpClient = { x: endClient.x, y: endClient.y + 145 };
    const jumpNorm = { x: last.x, y: last.y + 0.28 };
    const accept = hold.noteMove({
      client: jumpClient,
      getPoints: () => live,
      onOffer,
    });
    if (accept) {
      live = appendInkPoint(live, jumpNorm, jumpClient, null);
    }
    if (hold.isOffering() || hold.isHoldLocked()) {
      assert.equal(accept, false);
      assert.equal(live.length, before.length);
      assert.deepEqual(live, before);
    }
    assert.equal(live.length, before.length);
    assert.deepEqual(live, before);
    assert.notEqual(live.at(-1)?.y, jumpNorm.y);
    assert.ok(offered == null || offered.chips.line);
    assert.deepEqual(SHAPE_HOLD_CHIPS, ["line", "rect", "circle"]);
  });

  it("wires freeze before append and does not add a toolbar cell or triangle chip", () => {
    assert.match(main, /let append = true/);
    assert.match(main, /append = shapeHold\.noteMove/);
    assert.match(main, /if \(shapeHold\.isOffering\(\) \|\| shapeHold\.isHoldLocked\(\)\)/);
    assert.match(main, /if \(append\) \{\s*state\.currentStroke\.points = appendInkPoint/);
    assert.match(shapeHoldSrc, /isShapeHoldJitter/);
    assert.match(shapeHoldSrc, /frozen/);
    assert.match(shapeHoldSrc, /isHoldLocked/);
    assert.match(shapeHoldSrc, /frozen \|\| offer \|\| still/);
    assert.doesNotMatch(shapeHoldSrc, /triangle|삼각/);
    assert.doesNotMatch(main, /triangle|삼각/);
    assert.deepEqual(SHAPE_HOLD_CHIPS, ["line", "rect", "circle"]);
    assert.equal((html.match(/data-shape="/g) || []).length, 3);
    assert.doesNotMatch(html, /data-shape="triangle"/);
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.doesNotMatch(toolbar, /shape-chips|data-shape=/);
    assert.match(html, /id="shape-chips"/);
    assert.match(html, />직선</);
    assert.match(html, />사각</);
    assert.match(html, />원</);
    assert.match(main, /beginInkPoints\(/);
    assert.match(main, /lastInkUpClient/);
    assert.doesNotMatch(main, /currentStroke\.points = (?:next|result|snapped)/);
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
