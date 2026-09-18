export function normalizeRotation(value) {
  const n = Math.round(Number(value) / 90) * 90;
  if (!Number.isFinite(n)) {
    return 0;
  }
  return ((n % 360) + 360) % 360;
}

export function addRotation(current, delta) {
  return normalizeRotation(normalizeRotation(current) + Number(delta || 0));
}

export function rotatePointCw90(point) {
  return { x: 1 - point.y, y: point.x };
}

export function rotatePoint(point, delta) {
  const turns = ((Math.round(Number(delta) / 90) % 4) + 4) % 4;
  let next = { x: Number(point?.x) || 0, y: Number(point?.y) || 0 };
  for (let step = 0; step < turns; step += 1) {
    next = rotatePointCw90(next);
  }
  return next;
}

export function rotateRect(rect, delta) {
  const x = Number(rect?.x) || 0;
  const y = Number(rect?.y) || 0;
  const w = Number(rect?.w) || 0;
  const h = Number(rect?.h) || 0;
  const corners = [
    rotatePoint({ x, y }, delta),
    rotatePoint({ x: x + w, y }, delta),
    rotatePoint({ x, y: y + h }, delta),
    rotatePoint({ x: x + w, y: y + h }, delta),
  ];
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { x: left, y: top, w: Math.max(...xs) - left, h: Math.max(...ys) - top };
}

/**
 * #452: 쪽을 돌리면 그림도 같이 돌아야 한다.
 *
 * 그리는 규약은 "저장된 상자 크기로 그린 뒤 중심에서 `rotate`만큼 돌린다"이다
 * (선택 회전 `rotateItemAround`가 그렇게 쓴다). 예전 쪽 회전은 상자만 돌리고
 * `rotate`를 그대로 뒀다 — 그림은 안 돌고 상자 모양만 바뀌어 찌그러졌다.
 *
 * 그래서 이미지는 (1) 중심을 돌리고 (2) `rotate += delta`를 더하고 (3) 상자는
 * **그리기 전 픽셀 크기를 지키도록** 새 쪽 비율로 다시 정규화한다. 쪽이 W×H에서
 * H×W가 되므로 90°에서는 `w' = w·(W/H)`, `h' = h·(H/W)`이다. `pageAspect`는
 * 돌리기 **전** 쪽의 W/H.
 */
export function rotateItem(item, delta, pageAspect = 1) {
  if (!item || !delta) {
    return item;
  }
  const next = { ...item };
  if (Array.isArray(item.points)) {
    next.points = item.points.map((point) => rotatePoint(point, delta));
  }
  if (item.type === "stamp") {
    const point = rotatePoint({ x: item.x, y: item.y }, delta);
    next.x = point.x;
    next.y = point.y;
    next.tilt = (Number.isFinite(item.tilt) ? item.tilt : 0) + (delta * Math.PI) / 180;
  } else if (item.type === "image") {
    const w = Number(item.w) || 0;
    const h = Number(item.h) || 0;
    const mid = rotatePoint({ x: (Number(item.x) || 0) + w / 2, y: (Number(item.y) || 0) + h / 2 }, delta);
    const quarter = normalizeRotation(delta) % 180 === 90;
    const aspect = Number(pageAspect) > 0 ? Number(pageAspect) : 1;
    const nextW = quarter ? w * aspect : w;
    const nextH = quarter ? h / aspect : h;
    next.w = nextW;
    next.h = nextH;
    next.x = mid.x - nextW / 2;
    next.y = mid.y - nextH / 2;
    next.rotate = wrapRotation((Number(item.rotate) || 0) + delta);
  } else if (item.type === "mosaic") {
    // 가림 상자는 내용에 방향이 없다 — 상자만 돌린다.
    const box = rotateRect({ x: item.x, y: item.y, w: item.w, h: item.h }, delta);
    next.x = box.x;
    next.y = box.y;
    next.w = box.w;
    next.h = box.h;
  }
  return next;
}

export function rotateItems(items, delta, pageAspect = 1) {
  return (items || []).map((item) => rotateItem(item, delta, pageAspect));
}

/** Free angle in [0, 360). Page rotate still uses normalizeRotation (90° snap). */
export function wrapRotation(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return ((n % 360) + 360) % 360;
}

export function angleDegFromCenter(center, point, cssWidth = 1, cssHeight = 1) {
  const pageW = Math.max(1e-9, Number(cssWidth) || 1);
  const pageH = Math.max(1e-9, Number(cssHeight) || 1);
  const dx = ((Number(point?.x) || 0) - (Number(center?.x) || 0)) * pageW;
  const dy = ((Number(point?.y) || 0) - (Number(center?.y) || 0)) * pageH;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/** Clockwise in y-down CSS pixels around a page-normalized center. */
export function rotatePointAround(point, delta, center, cssWidth = 1, cssHeight = 1) {
  const angle = Number(delta) || 0;
  const cx = Number(center?.x) || 0;
  const cy = Number(center?.y) || 0;
  const pageW = Math.max(1e-9, Number(cssWidth) || 1);
  const pageH = Math.max(1e-9, Number(cssHeight) || 1);
  const px = ((Number(point?.x) || 0) - cx) * pageW;
  const py = ((Number(point?.y) || 0) - cy) * pageH;
  if (!angle) {
    return { x: cx + px / pageW, y: cy + py / pageH };
  }
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: cx + (px * cos - py * sin) / pageW, y: cy + (px * sin + py * cos) / pageH };
}

export function rotateRectAround(rect, delta, center, cssWidth = 1, cssHeight = 1) {
  const x = Number(rect?.x) || 0;
  const y = Number(rect?.y) || 0;
  const w = Number(rect?.w) || 0;
  const h = Number(rect?.h) || 0;
  const corners = [
    rotatePointAround({ x, y }, delta, center, cssWidth, cssHeight),
    rotatePointAround({ x: x + w, y }, delta, center, cssWidth, cssHeight),
    rotatePointAround({ x, y: y + h }, delta, center, cssWidth, cssHeight),
    rotatePointAround({ x: x + w, y: y + h }, delta, center, cssWidth, cssHeight),
  ];
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return { x: left, y: top, w: Math.max(...xs) - left, h: Math.max(...ys) - top };
}

export function isLockedImage(item) {
  return item?.type === "image" && Boolean(item.locked);
}

export function rotateItemAround(item, delta, center, cssWidth = 1, cssHeight = 1) {
  if (!item || !delta || isLockedImage(item)) {
    return item;
  }
  const next = { ...item };
  if (Array.isArray(item.points)) {
    next.points = item.points.map((point) => rotatePointAround(point, delta, center, cssWidth, cssHeight));
  }
  if (item.type === "stamp") {
    const point = rotatePointAround({ x: item.x, y: item.y }, delta, center, cssWidth, cssHeight);
    next.x = point.x;
    next.y = point.y;
    next.tilt = (Number.isFinite(item.tilt) ? item.tilt : 0) + (delta * Math.PI) / 180;
    return next;
  }
  if (item.type === "image") {
    const mid = { x: item.x + item.w / 2, y: item.y + item.h / 2 };
    const nextMid = rotatePointAround(mid, delta, center, cssWidth, cssHeight);
    next.x = nextMid.x - item.w / 2;
    next.y = nextMid.y - item.h / 2;
    next.rotate = wrapRotation((Number(item.rotate) || 0) + delta);
    return next;
  }
  if (item.type === "mosaic") {
    const box = rotateRectAround({ x: item.x, y: item.y, w: item.w, h: item.h }, delta, center, cssWidth, cssHeight);
    next.x = box.x;
    next.y = box.y;
    next.w = box.w;
    next.h = box.h;
  }
  return next;
}

export function rotateSelectedItems(items, indices, delta, center, cssWidth = 1, cssHeight = 1) {
  const chosen = new Set(indices || []);
  return (items || []).map((item, index) =>
    chosen.has(index) ? rotateItemAround(item, delta, center, cssWidth, cssHeight) : item,
  );
}

/** Draw the stored (unrotated) box, then rotate around its center. */
export function imagePaintDest(item, canvasWidth, canvasHeight) {
  return {
    destW: (Number(item?.w) || 0) * canvasWidth,
    destH: (Number(item?.h) || 0) * canvasHeight,
    rotate: wrapRotation(item?.rotate),
  };
}
