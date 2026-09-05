/**
 * 캡처 등록부 (#256).
 *
 * 캡처한 그림을 붙일 때 원래 자리·크기로 되돌리려면 위치를 어딘가 기억해야
 * 한다. PNG 안에 심는 방법(#253)은 브라우저가 클립보드에 올릴 때 그림을
 * **다시 인코딩하며 지워** 살아남지 못했다. 그래서 위치는 이 브라우저에
 * 두고(localStorage), 붙일 때 **그림 지문**으로 짝을 찾는다 — 재인코딩돼도
 * 픽셀은 그대로라 지문(dHash)은 견딘다.
 */

export const CAPTURE_REG_LIMIT = 12;
/** 144비트 중 이만큼까지 달라도 같은 캡처로 본다. 재인코딩 잡음 여유. */
export const CAPTURE_MATCH_NEAR = 10;

export function addCapture(list, entry, limit = CAPTURE_REG_LIMIT, now = Date.now()) {
  const clean = normalizeCapture(entry, now);
  if (!clean) {
    return list || [];
  }
  // 같은 지문이 이미 있으면 새 것으로 갈아끼운다(자리를 새로 잡았을 수 있다).
  const rest = (list || []).filter((one) => one.hash !== clean.hash);
  return [clean, ...rest].slice(0, limit);
}

export function normalizeCapture(entry, now = Date.now()) {
  const hash = String(entry?.hash || "");
  const rect = entry?.rect;
  if (!hash || !rect) {
    return null;
  }
  const nums = [rect.x, rect.y, rect.w, rect.h].map(Number);
  if (!nums.every(Number.isFinite) || !(nums[2] > 0) || !(nums[3] > 0)) {
    return null;
  }
  return { hash, rect: { x: nums[0], y: nums[1], w: nums[2], h: nums[3] }, at: Math.round(Number(entry?.at) || now) };
}

export function sanitizeCaptures(raw) {
  return (Array.isArray(raw) ? raw : []).map((one) => normalizeCapture(one)).filter(Boolean).slice(0, CAPTURE_REG_LIMIT);
}

/**
 * 붙이는 그림의 지문에 가장 가까운 등록 캡처. 문턱을 넘으면 null —
 * 남의 그림을 우리 자리에 억지로 앉히지 않는다. 같은 거리면 최근 것.
 */
export function findCapture(list, hash, hammingFn, near = CAPTURE_MATCH_NEAR) {
  if (!hash) {
    return null;
  }
  let best = null;
  let bestFar = Infinity;
  for (const one of list || []) {
    const far = hammingFn(hash, one.hash);
    if (far < bestFar || (far === bestFar && best && one.at > best.at)) {
      best = one;
      bestFar = far;
    }
  }
  return best && bestFar <= near ? best : null;
}
