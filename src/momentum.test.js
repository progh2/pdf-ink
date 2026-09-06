import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MOMENTUM_HALF_LIFE_MS,
  MOMENTUM_MAX_SPEED,
  clampSpeed,
  decay,
  isMoving,
  velocityFromSamples,
} from "./momentum.js";

describe("#296 관성 스크롤", () => {
  it("reads velocity from the most recent samples", () => {
    // 마지막 90ms 동안 y가 -18px (위로 훑음) → vy = -0.2 px/ms.
    const samples = [
      { t: 0, x: 0, y: 100 },
      { t: 50, x: 0, y: 91 },
      { t: 100, x: 0, y: 82 },
    ];
    const v = velocityFromSamples(samples);
    assert.equal(v.vx, 0);
    assert.ok(Math.abs(v.vy - -0.18) < 1e-9);
  });

  it("ignores an old slow lead-in outside the window", () => {
    // 첫 표본은 1초 전(창 밖) — 최근 두 표본만 센다.
    const samples = [
      { t: 0, x: 0, y: 0 },
      { t: 1000, x: 0, y: 0 },
      { t: 1050, x: 0, y: -10 },
    ];
    const v = velocityFromSamples(samples);
    assert.ok(Math.abs(v.vy - -0.2) < 1e-9);
  });

  it("returns zero when there is nothing to measure", () => {
    assert.deepEqual(velocityFromSamples([]), { vx: 0, vy: 0 });
    assert.deepEqual(velocityFromSamples([{ t: 5, x: 1, y: 1 }]), { vx: 0, vy: 0 });
  });

  it("halves speed after one half-life", () => {
    assert.ok(Math.abs(decay(1, MOMENTUM_HALF_LIFE_MS) - 0.5) < 1e-9);
    assert.ok(Math.abs(decay(1, MOMENTUM_HALF_LIFE_MS * 2) - 0.25) < 1e-9);
  });

  it("caps an absurd fling", () => {
    assert.equal(clampSpeed(999), MOMENTUM_MAX_SPEED);
    assert.equal(clampSpeed(-999), -MOMENTUM_MAX_SPEED);
    assert.equal(clampSpeed(1.5), 1.5);
  });

  it("stops below the minimum speed", () => {
    assert.equal(isMoving(0.001, 0.001), false);
    assert.equal(isMoving(0.2, 0), true);
  });
});
