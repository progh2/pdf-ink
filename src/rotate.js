export function normalizeTurn(value) {
  const n = Number(value) || 0;
  return ((n % 360) + 360) % 360;
}

export function nextRotation(current, dir) {
  const step = dir === "left" ? -90 : 90;
  return normalizeTurn((Number(current) || 0) + step);
}

export function rotatePoint90(point, dir) {
  const x = Number(point?.x) || 0;
  const y = Number(point?.y) || 0;
  if (dir === "left") {
    return { x: y, y: 1 - x };
  }
  return { x: 1 - y, y: x };
}

export function rotateRect90(rect, dir) {
  const x = Number(rect?.x) || 0;
  const y = Number(rect?.y) || 0;
  const w = Number(rect?.w) || 0;
  const h = Number(rect?.h) || 0;
  if (dir === "left") {
    return { x: y, y: 1 - x - w, w: h, h: w };
  }
  return { x: 1 - y - h, y: x, w: h, h: w };
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value));
}

export function rotateItem90(item, dir) {
  const next = clonePlain(item);
  if (Array.isArray(next.points)) {
    next.points = next.points.map((point) => rotatePoint90(point, dir));
  }
  if (next.type === "stamp") {
    const moved = rotatePoint90({ x: next.x, y: next.y }, dir);
    next.x = moved.x;
    next.y = moved.y;
    const delta = dir === "left" ? -Math.PI / 2 : Math.PI / 2;
    next.tilt = (Number.isFinite(next.tilt) ? next.tilt : 0) + delta;
    return next;
  }
  if (next.type === "mosaic" || next.type === "image") {
    const box = rotateRect90({ x: next.x, y: next.y, w: next.w, h: next.h }, dir);
    next.x = box.x;
    next.y = box.y;
    next.w = box.w;
    next.h = box.h;
    if (next.type === "image") {
      next.turn = nextRotation(next.turn, dir);
    }
    return next;
  }
  return next;
}

export function rotateItems90(items, dir) {
  return (items || []).map((item) => rotateItem90(item, dir));
}
