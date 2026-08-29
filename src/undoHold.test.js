import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cloneItems, createHistory, recordChange, redoChange, undoChange } from "./history.js";
import { bindUndoHold, UNDO_HOLD_MS } from "./undoHold.js";

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

function createBtn() {
  const btn = new EventTarget();
  btn.setPointerCapture = () => {};
  return btn;
}

function fire(target, type, props = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, {
    pointerId: 1,
    button: 0,
    buttons: type === "pointerdown" ? 1 : 0,
    pointerType: "touch",
    ...props,
  });
  target.dispatchEvent(event);
  return event;
}

function bindWithHistory() {
  const pages = { 1: [] };
  const history = createHistory();
  const first = { type: "pen", points: [{ x: 0.2, y: 0.2 }], width: 2 };
  const second = { type: "pen", points: [{ x: 0.8, y: 0.8 }], width: 2 };
  let before = cloneItems(pages[1]);
  pages[1].push(first);
  recordChange(history, { page: 1, before, after: pages[1] });
  before = cloneItems(pages[1]);
  pages[1].push(second);
  recordChange(history, { page: 1, before, after: pages[1] });

  const calls = [];
  const clock = createClock();
  const btn = createBtn();
  const root = new EventTarget();
  bindUndoHold(btn, {
    onUndo: () => {
      calls.push("undo");
      undoChange(history, pages);
    },
    onRedo: () => {
      calls.push("redo");
      redoChange(history, pages);
    },
    longPressMs: UNDO_HOLD_MS,
    now: clock.now,
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
    root,
  });

  return { pages, calls, clock, btn, root };
}

describe("undo hold #43", () => {
  it("uses a 400ms hold", () => {
    assert.equal(UNDO_HOLD_MS, 400);
  });

  it("release at 399ms undoes once and does not redo", () => {
    const { pages, calls, clock, btn, root } = bindWithHistory();

    fire(btn, "pointerdown");
    clock.advance(399);
    fire(root, "pointerup");
    fire(btn, "click");

    assert.deepEqual(calls, ["undo"]);
    assert.equal(calls.filter((name) => name === "undo").length, 1);
    assert.equal(calls.filter((name) => name === "redo").length, 0);
    assert.equal(pages[1].length, 1);
  });

  it("at 400ms redos once and later pointerup/cancel/click do not undo", () => {
    const { pages, calls, clock, btn, root } = bindWithHistory();

    fire(btn, "pointerdown");
    clock.advance(400);
    assert.deepEqual(calls, ["redo"]);
    assert.equal(calls.filter((name) => name === "undo").length, 0);

    fire(btn, "pointercancel", { buttons: 1 });
    fire(root, "pointercancel", { buttons: 1 });
    fire(btn, "click");
    fire(root, "pointerup");

    assert.deepEqual(calls, ["redo"]);
    assert.equal(calls.filter((name) => name === "undo").length, 0);
    assert.equal(pages[1].length, 2);
  });

  it("long-press after undo calls redo, not a second undo", () => {
    const { pages, calls, clock, btn, root } = bindWithHistory();
    assert.equal(pages[1].length, 2);

    fire(btn, "pointerdown");
    clock.advance(399);
    fire(root, "pointerup");
    assert.deepEqual(calls, ["undo"]);
    assert.equal(pages[1].length, 1);

    fire(btn, "pointerdown", { pointerId: 2 });
    clock.advance(400);
    fire(root, "pointerup", { pointerId: 2 });
    fire(btn, "click", { pointerId: 2 });

    assert.deepEqual(calls, ["undo", "redo"]);
    assert.equal(calls.filter((name) => name === "undo").length, 1);
    assert.equal(pages[1].length, 2);
  });

  it("pointercancel with buttons>0 does not undo", () => {
    const { pages, calls, clock, btn, root } = bindWithHistory();

    fire(btn, "pointerdown");
    clock.advance(399);
    fire(root, "pointerup");
    assert.deepEqual(calls, ["undo"]);

    fire(btn, "pointerdown", { pointerId: 2, pointerType: "touch", buttons: 1 });
    fire(btn, "pointercancel", { pointerId: 2, pointerType: "touch", buttons: 1 });
    fire(root, "pointercancel", { pointerId: 2, pointerType: "touch", buttons: 1 });

    assert.deepEqual(calls, ["undo"]);
    assert.equal(pages[1].length, 1);

    clock.advance(400);
    fire(root, "pointerup", { pointerId: 2 });
    fire(btn, "click", { pointerId: 2 });

    assert.deepEqual(calls, ["undo", "redo"]);
    assert.equal(pages[1].length, 2);
  });
});
