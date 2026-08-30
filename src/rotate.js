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

export function boundsCenter(bounds) {
  if (!bounds) {
    return null;
  }
  return {
    x: (Number(bounds.x) || 0) + (Number(bounds.w) || 0) / 2,
    y: (Number(bounds.y) || 0) + (Number(bounds.h) || 0) / 2,
  };
}

export function rotatePointAround(point, center, delta) {
  const turns = ((Math.round(Number(delta) / 90) % 4) + 4) % 4;
  const cx = Number(center?.x) || 0;
  const cy = Number(center?.y) || 0;
  let next = { x: Number(point?.x) || 0, y: Number(point?.y) || 0 };
  for (let step = 0; step < turns; step += 1) {
    const dx = next.x - cx;
    const dy = next.y - cy;
    next = { x: cx - dy, y: cy + dx };
  }
  return next;
}

export function rotateRectAround(rect, center, delta) {
  const x = Number(rect?.x) || 0;
  const y = Number(rect?.y) || 0;
  const w = Number(rect?.w) || 0;
  const h = Number(rect?.h) || 0;
  const corners = [
    rotatePointAround({ x, y }, center, delta),
    rotatePointAround({ x: x + w, y }, center, delta),
    rotatePointAround({ x, y: y + h }, center, delta),
    rotatePointAround({ x: x + w, y: y + h }, center, delta),
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

export function rotateItemAround(item, center, delta) {
  if (!item || !delta || isLockedImage(item)) {
    return item;
  }
  const next = { ...item };
  if (Array.isArray(item.points)) {
    next.points = item.points.map((point) => rotatePointAround(point, center, delta));
  }
  if (item.type === "stamp") {
    const point = rotatePointAround({ x: item.x, y: item.y }, center, delta);
    next.x = point.x;
    next.y = point.y;
    next.tilt = (Number.isFinite(item.tilt) ? item.tilt : 0) + (delta * Math.PI) / 180;
  } else if (item.type === "mosaic" || item.type === "image") {
    const box = rotateRectAround({ x: item.x, y: item.y, w: item.w, h: item.h }, center, delta);
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

export function rotateItemsAround(items, indices, center, delta) {
  const rotate = new Set(indices || []);
  return (items || []).map((item, index) => (rotate.has(index) ? rotateItemAround(item, center, delta) : item));
}
