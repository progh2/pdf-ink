/**
 * 관성(플링) 스크롤 (#296). 손을 뗀 뒤 속도를 마찰로 감쇠시키며 계속 굴린다.
 * 네이티브 스크롤·관성은 touch-action:none 으로 막혀 있어, 스크롤 모드의 빠른
 * 드래그가 손을 떼면 그대로 멈추던 것을 고친다. 순수 함수 — DOM은 main.js만.
 */

/** 이 시간(ms) 안의 표본만으로 속도를 잰다 — 획 초반의 느린 구간은 무시. */
export const MOMENTUM_WINDOW_MS = 90;
/** 속도가 반으로 줄기까지의 시간. 시간 기반이라 프레임률과 무관하다.
 *  #304: 130→300 — 더 오래 굴러가 「퍽퍽」 지나가게(이동거리 ≈ v0×반감기/ln2). */
export const MOMENTUM_HALF_LIFE_MS = 300;
/** 이 속도(px/ms) 아래면 멈춘다 (약 1.2px/프레임). */
export const MOMENTUM_MIN_SPEED = 0.02;
/** 말도 안 되는 플링을 막는 상한(px/ms). #304: 6→12 — 센 플링 허용. */
export const MOMENTUM_MAX_SPEED = 12;

/** 최근 표본(≤window ms)의 위치차 ÷ 시간. {vx, vy} px/ms. */
export function velocityFromSamples(samples, windowMs = MOMENTUM_WINDOW_MS) {
  const list = samples || [];
  if (list.length < 2) {
    return { vx: 0, vy: 0 };
  }
  const last = list[list.length - 1];
  let first = list[0];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (last.t - list[i].t <= windowMs) {
      first = list[i];
    } else {
      break;
    }
  }
  const dt = last.t - first.t;
  if (dt <= 0) {
    return { vx: 0, vy: 0 };
  }
  return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
}

/** 시간 기반 지수 감쇠. */
export function decay(v, dtMs, halfLife = MOMENTUM_HALF_LIFE_MS) {
  return v * Math.pow(0.5, Math.max(0, dtMs) / Math.max(1, halfLife));
}

export function clampSpeed(v, max = MOMENTUM_MAX_SPEED) {
  return Math.max(-max, Math.min(max, Number(v) || 0));
}

export function isMoving(vx, vy, min = MOMENTUM_MIN_SPEED) {
  return Math.hypot(vx, vy) > min;
}
