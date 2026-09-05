import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  canRedo,
  canUndo,
  cloneItems,
  createHistory,
  extendChange,
  recordChange,
  redoChange,
  undoChange,
} from "./history.js";

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "history.js"), "utf8");

describe("undo/redo", () => {
  it("restores the stroke list including stamps and eraser entries", () => {
    const pages = { 1: [] };
    const history = createHistory();
    const stroke = { type: "pen", points: [{ x: 0.1, y: 0.2 }], width: 2, color: "#1A1A1A" };
    const stamp = { type: "stamp", stamp: "승인", x: 0.5, y: 0.5 };
    const erase = { type: "erase", erase: true, eraseMode: "pixel", points: [{ x: 0.5, y: 0.5 }], width: 4 };

    let before = cloneItems(pages[1]);
    pages[1].push(stroke);
    recordChange(history, { page: 1, before, after: pages[1] });

    before = cloneItems(pages[1]);
    pages[1].push(stamp);
    recordChange(history, { page: 1, before, after: pages[1] });

    before = cloneItems(pages[1]);
    pages[1] = [stroke, erase];
    recordChange(history, { page: 1, before, after: pages[1] });

    assert.equal(canUndo(history), true);
    undoChange(history, pages);
    assert.equal(pages[1].length, 2);
    assert.equal(pages[1][1].type, "stamp");
    undoChange(history, pages);
    assert.equal(pages[1].length, 1);
    assert.equal(pages[1][0].type, "pen");
    redoChange(history, pages);
    assert.equal(pages[1].length, 2);
    assert.equal(pages[1][1].stamp, "승인");
    redoChange(history, pages);
    assert.equal(pages[1].length, 2);
    assert.equal(pages[1][1].type, "erase");
    assert.equal(canRedo(history), false);
  });

  it("undo removes only the last stroke, redo brings it back", () => {
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

    undoChange(history, pages);
    assert.equal(pages[1].length, 1);
    assert.deepEqual(pages[1][0], first);
    redoChange(history, pages);
    assert.equal(pages[1].length, 2);
    assert.deepEqual(pages[1][1], second);
  });

  it("redo without an undo does not wipe strokes", () => {
    const pages = { 1: [{ type: "pen", points: [{ x: 0.2, y: 0.2 }], width: 2 }] };
    const history = createHistory();
    recordChange(history, { page: 1, before: [], after: pages[1] });
    assert.equal(redoChange(history, pages), null);
    assert.equal(pages[1].length, 1);
    undoChange(history, pages);
    assert.equal(pages[1].length, 0);
    redoChange(history, pages);
    assert.equal(pages[1].length, 1);
  });

  it("keeps the stack in memory only", () => {
    assert.doesNotMatch(src, /localStorage|indexedDB|fetch\(/);
  });
});

describe("#236 이어지는 변화는 한 벌", () => {
  it("edits the last entry instead of stacking another", () => {
    const history = createHistory();
    recordChange(history, { page: "1", before: [{ x: 0 }], after: [{ x: 1 }] });
    assert.equal(extendChange(history, { page: "1", after: [{ x: 2 }] }), true);
    assert.equal(history.undo.length, 1, "한 벌 그대로");
    assert.deepEqual(history.undo[0].after, [{ x: 2 }], "끝만 옮겨간다");
    assert.deepEqual(history.undo[0].before, [{ x: 0 }], "시작은 처음 그 자리");
  });

  it("undoes the whole run in one go", () => {
    const history = createHistory();
    const pages = { 1: [{ x: 5 }] };
    recordChange(history, { page: "1", before: [{ x: 0 }], after: [{ x: 1 }] });
    extendChange(history, { page: "1", after: [{ x: 5 }] });
    undoChange(history, pages);
    assert.deepEqual(pages[1], [{ x: 0 }], "스무 번 눌러도 한 번에 되돌아간다");
  });

  it("refuses to extend a different page, or nothing at all", () => {
    const history = createHistory();
    assert.equal(extendChange(history, { page: "1", after: [] }), false, "적어 둔 것이 없다");
    recordChange(history, { page: "1", before: [], after: [] });
    assert.equal(extendChange(history, { page: "2", after: [] }), false, "다른 쪽은 다른 일");
  });

  it("clears the redo pile, like any other change", () => {
    const history = createHistory();
    const pages = { 1: [] };
    recordChange(history, { page: "1", before: [], after: [{ x: 1 }] });
    undoChange(history, pages);
    recordChange(history, { page: "1", before: [], after: [{ x: 2 }] });
    extendChange(history, { page: "1", after: [{ x: 3 }] });
    assert.equal(history.redo.length, 0);
  });
});
