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

/** Clockwise 90° in y-down pixel space: (x, y) → (−y, x). */
function rotatePxCw90(x, y) {
  return { x: -y, y: x };
}

export function rotatePointAround(point, delta, center, cssWidth = 1, cssHeight = 1) {
  const turns = quarterTurns(delta);
  const cx = Number(center?.x) || 0;
  const cy = Number(center?.y) || 0;
  const pageW = Math.max(1e-9, Number(cssWidth) || 1);
  const pageH = Math.max(1e-9, Number(cssHeight) || 1);
  let px = ((Number(point?.x) || 0) - cx) * pageW;
  let py = ((Number(point?.y) || 0) - cy) * pageH;
  for (let step = 0; step < turns; step += 1) {
    const next = rotatePxCw90(px, py);
    px = next.x;
    py = next.y;
  }
  return { x: cx + px / pageW, y: cy + py / pageH };
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
  if (item.type === "mosaic" || item.type === "image") {
    const box = rotateRectAround({ x: item.x, y: item.y, w: item.w, h: item.h }, delta, center, cssWidth, cssHeight);
    next.x = box.x;
    next.y = box.y;
    next.w = box.w;
    next.h = box.h;
    if (item.type === "image") {
      next.rotate = addRotation(item.rotate || 0, delta);
    }
  }
  return next;
}

export function rotateSelectedItems(items, indices, delta, center, cssWidth = 1, cssHeight = 1) {
  const chosen = new Set(indices || []);
  return (items || []).map((item, index) =>
    chosen.has(index) ? rotateItemAround(item, delta, center, cssWidth, cssHeight) : item,
  );
}

/** Destination size for an AABB-stored image so a 90/270 turn fills the box. */
export function imagePaintDest(item, canvasWidth, canvasHeight) {
  const rotate = normalizeRotation(item?.rotate);
  const destW = (Number(item?.w) || 0) * canvasWidth;
  const destH = (Number(item?.h) || 0) * canvasHeight;
  if (rotate === 90 || rotate === 270) {
    return { destW: destH, destH: destW, rotate };
  }
  return { destW, destH, rotate };
}
