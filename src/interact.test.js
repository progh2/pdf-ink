import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canCreateInk, canSelectPointer, rectFromPoints, shouldPanPointer } from "./interact.js";

describe("보기 모드", () => {
  it("does not create strokes in view mode", () => {
    assert.equal(canCreateInk({ interactMode: "view", penOnly: false, pointerType: "pen" }), false);
    assert.equal(canCreateInk({ interactMode: "view", penOnly: false, pointerType: "mouse" }), false);
    assert.equal(canCreateInk({ interactMode: "view", penOnly: false, pointerType: "touch" }), false);
    assert.equal(canCreateInk({ interactMode: "edit", penOnly: false, pointerType: "mouse" }), true);
    assert.equal(canCreateInk({ interactMode: "edit", penOnly: true, pointerType: "touch" }), false);
    assert.equal(canCreateInk({ interactMode: "edit", penOnly: false, pointerType: "pen", rectTool: "mosaic" }), false);
    assert.equal(canCreateInk({ interactMode: "edit", penOnly: false, pointerType: "mouse", rectTool: "capture" }), false);
  });

  it("scrolls and pinches only while viewing", () => {
    assert.equal(shouldPanPointer({ interactMode: "view", pointerType: "pen" }), true);
    assert.equal(shouldPanPointer({ interactMode: "view", pointerType: "touch" }), true);
    assert.equal(shouldPanPointer({ interactMode: "edit", penOnly: false, pointerType: "mouse" }), false);
    assert.equal(shouldPanPointer({ interactMode: "edit", penOnly: true, pointerType: "touch", rectTool: "select" }), true);
    assert.equal(shouldPanPointer({ interactMode: "edit", penOnly: false, pointerType: "mouse", rectTool: "mosaic" }), false);
  });
});

describe("선택 포인터", () => {
  it("does not select in view mode, and pen-only keeps finger on pan", () => {
    assert.equal(canSelectPointer({ interactMode: "view", pointerType: "pen" }), false);
    assert.equal(canSelectPointer({ interactMode: "edit", penOnly: true, pointerType: "touch" }), false);
    assert.equal(canSelectPointer({ interactMode: "edit", penOnly: true, pointerType: "pen" }), true);
    assert.equal(canSelectPointer({ interactMode: "edit", penOnly: false, pointerType: "mouse" }), true);
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
