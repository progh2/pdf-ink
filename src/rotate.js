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

export function rotateItem(item, delta) {
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
  } else if (item.type === "mosaic" || item.type === "image") {
    const box = rotateRect({ x: item.x, y: item.y, w: item.w, h: item.h }, delta);
    next.x = box.x;
    next.y = box.y;
    next.w = box.w;
    next.h = box.h;
  }
  return next;
}

export function rotateItems(items, delta) {
  return (items || []).map((item) => rotateItem(item, delta));
}

function quarterTurns(delta) {
  return ((Math.round(Number(delta) / 90) % 4) + 4) % 4;
}

function isExactQuarter(delta) {
  const n = Number(delta);
  if (!Number.isFinite(n)) {
    return false;
  }
  return Math.abs(n / 90 - Math.round(n / 90)) < 1e-9;
}

/** Clockwise 90° in y-down pixel space: (x, y) → (−y, x). */
function rotatePxCw90(x, y) {
  return { x: -y, y: x };
}

export function pointerAngleDeg(point, center, cssWidth = 1, cssHeight = 1) {
  const pageW = Math.max(1e-9, Number(cssWidth) || 1);
  const pageH = Math.max(1e-9, Number(cssHeight) || 1);
  const dx = ((Number(point?.x) || 0) - (Number(center?.x) || 0)) * pageW;
  const dy = ((Number(point?.y) || 0) - (Number(center?.y) || 0)) * pageH;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export function rotateDragDelta(startPoint, nowPoint, center, cssWidth = 1, cssHeight = 1) {
  return pointerAngleDeg(nowPoint, center, cssWidth, cssHeight) - pointerAngleDeg(startPoint, center, cssWidth, cssHeight);
}

export function rotatePointAround(point, delta, center, cssWidth = 1, cssHeight = 1) {
  const deg = Number(delta) || 0;
  const cx = Number(center?.x) || 0;
  const cy = Number(center?.y) || 0;
  const pageW = Math.max(1e-9, Number(cssWidth) || 1);
  const pageH = Math.max(1e-9, Number(cssHeight) || 1);
  let px = ((Number(point?.x) || 0) - cx) * pageW;
  let py = ((Number(point?.y) || 0) - cy) * pageH;
  if (!deg) {
    return { x: cx + px / pageW, y: cy + py / pageH };
  }
  if (isExactQuarter(deg)) {
    const turns = quarterTurns(deg);
    for (let step = 0; step < turns; step += 1) {
      const next = rotatePxCw90(px, py);
      px = next.x;
      py = next.y;
    }
    return { x: cx + px / pageW, y: cy + py / pageH };
  }
  const rad = (deg * Math.PI) / 180;
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

function rotateImageAround(item, delta, center, cssWidth, cssHeight) {
  const pageW = Math.max(1e-9, Number(cssWidth) || 1);
  const pageH = Math.max(1e-9, Number(cssHeight) || 1);
  const dest = imagePaintDest(item, pageW, pageH);
  const oldCenter = { x: (Number(item.x) || 0) + (Number(item.w) || 0) / 2, y: (Number(item.y) || 0) + (Number(item.h) || 0) / 2 };
  const newCenter = rotatePointAround(oldCenter, delta, center, pageW, pageH);
  const nextRotate = (Number(item.rotate) || 0) + Number(delta);
  const rw = dest.destW / pageW;
  const rh = dest.destH / pageH;
  const hw = dest.destW / 2;
  const hh = dest.destH / 2;
  const rad = (nextRotate * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = newCenter.x * pageW;
  const cy = newCenter.y * pageH;
  const xs = [];
  const ys = [];
  for (const corner of [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: -hw, y: hh },
    { x: hw, y: hh },
  ]) {
    xs.push(cx + corner.x * cos - corner.y * sin);
    ys.push(cy + corner.x * sin + corner.y * cos);
  }
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return {
    ...item,
    x: left / pageW,
    y: top / pageH,
    w: (Math.max(...xs) - left) / pageW,
    h: (Math.max(...ys) - top) / pageH,
    rotate: nextRotate,
    rw,
    rh,
  };
}

export function rotateItemAround(item, delta, center, cssWidth = 1, cssHeight = 1) {
  if (!item || !delta || isLockedImage(item)) {
    return item;
  }
  if (item.type === "image") {
    return rotateImageAround(item, delta, center, cssWidth, cssHeight);
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

/** Destination size for the unrotated image. AABB + snapped 90/270 still swap. */
export function imagePaintDest(item, canvasWidth, canvasHeight) {
  const rotate = Number(item?.rotate) || 0;
  if (Number.isFinite(Number(item?.rw)) && Number.isFinite(Number(item?.rh))) {
    return {
      destW: Number(item.rw) * canvasWidth,
      destH: Number(item.rh) * canvasHeight,
      rotate,
    };
  }
  const destW = (Number(item?.w) || 0) * canvasWidth;
  const destH = (Number(item?.h) || 0) * canvasHeight;
  const snapped = normalizeRotation(rotate);
  if (Math.abs(rotate - snapped) < 1e-6 && (snapped === 90 || snapped === 270)) {
    return { destW: destH, destH: destW, rotate };
  }
  return { destW, destH, rotate };
}
