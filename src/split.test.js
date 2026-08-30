import assert from "node:assert/strict";
import test from "node:test";
import {
  activateSplitTab,
  closeSplitTab,
  emptySplit,
  openSplitTab,
  splitAxis,
  splitTabFromLink,
} from "./split.js";

test("#72 노트 화면이 세로로 길면 위아래, 가로로 길면 좌우로 가른다", () => {
  assert.equal(splitAxis(400, 800), "tb");
  assert.equal(splitAxis(800, 400), "lr");
  assert.equal(splitAxis(500, 500), "lr");
});

test("#72 연 대상은 탭이고 x로 닫으며 마지막이면 분할이 끝난다", () => {
  const a = splitTabFromLink({ kind: "page", page: 2 }, "t1");
  const b = splitTabFromLink({ kind: "url", href: "https://ex.com" }, "t2");
  let state = emptySplit();
  state = openSplitTab(state, a, "tb");
  assert.equal(state.axis, "tb");
  assert.equal(state.tabs.length, 1);
  assert.equal(state.active, "t1");
  state = openSplitTab(state, b, "tb");
  assert.equal(state.tabs.length, 2);
  state = activateSplitTab(state, "t1");
  assert.equal(state.active, "t1");
  state = closeSplitTab(state, "t1");
  assert.equal(state.tabs.length, 1);
  assert.equal(state.active, "t2");
  state = closeSplitTab(state, "t2");
  assert.deepEqual(state, emptySplit());
});
