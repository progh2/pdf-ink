import { stampPaintLayout } from "./tools.js";

export const PASTE_NUDGE = 0.04;

export function isSelectable(item) {
  if (!item || typeof item !== "object") {
    return false;
  }
  if (item.erase || item.type === "erase") {
    return false;
  }
  return true;
}

function strokeBounds(item) {
  const points = item.points || [];
  if (!points.length) {
    return null;
  }
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { x: minX, y: minY, w: Math.max(0.004, maxX - minX), h: Math.max(0.004, maxY - minY) };
}

export function itemBounds(item, cssWidth = 400, cssHeight = 600) {
  if (!isSelectable(item)) {
    return null;
  }
  if (item.type === "stamp") {
    const layout = stampPaintLayout(item.stamp, 1);
    const rx = layout.radius / Math.max(1, cssWidth);
    const labelW =
      (Math.max(...layout.lines.map((line) => line.length), 1) * layout.fontSize) / Math.max(1, cssWidth) / 2;
    const half = Math.max(rx, labelW);
    return {
      x: item.x - half,
      y: item.y - layout.radius / Math.max(1, cssHeight),
      w: half * 2,
      h: (layout.radius + layout.labelBottom) / Math.max(1, cssHeight),
    };
  }
  if (item.type === "image" || item.type === "mosaic") {
    return { x: item.x, y: item.y, w: item.w, h: item.h };
  }
  return strokeBounds(item);
}

export function boundsUnion(rects) {
  const boxes = (rects || []).filter(Boolean);
  if (!boxes.length) {
    return null;
  }
  let x1 = boxes[0].x;
  let y1 = boxes[0].y;
  let x2 = boxes[0].x + boxes[0].w;
  let y2 = boxes[0].y + boxes[0].h;
  for (const box of boxes) {
    x1 = Math.min(x1, box.x);
    y1 = Math.min(y1, box.y);
    x2 = Math.max(x2, box.x + box.w);
    y2 = Math.max(y2, box.y + box.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function pointInBounds(point, bounds, pad = 0) {
  if (!point || !bounds) {
    return false;
  }
  return (
    point.x >= bounds.x - pad &&
    point.x <= bounds.x + bounds.w + pad &&
    point.y >= bounds.y - pad &&
    point.y <= bounds.y + bounds.h + pad
  );
}

export function boundsIntersect(a, b) {
  if (!a || !b) {
    return false;
  }
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function pickItemsAt(items, point, cssWidth, cssHeight, pad = 0.014) {
  const hits = [];
  (items || []).forEach((item, index) => {
    const bounds = itemBounds(item, cssWidth, cssHeight);
    if (bounds && pointInBounds(point, bounds, pad)) {
      hits.push(index);
    }
  });
  return hits;
}

export function pickItemsInRect(items, rect, cssWidth, cssHeight) {
  const hits = [];
  (items || []).forEach((item, index) => {
    const bounds = itemBounds(item, cssWidth, cssHeight);
    if (bounds && boundsIntersect(bounds, rect)) {
      hits.push(index);
    }
  });
  return hits;
}

export function selectedBounds(items, indices, cssWidth, cssHeight) {
  return boundsUnion((indices || []).map((index) => itemBounds(items[index], cssWidth, cssHeight)));
}

export function translateItem(item, dx, dy) {
  const next = { ...item };
  if (Array.isArray(item.points)) {
    next.points = item.points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
  }
  if (Number.isFinite(item.x)) {
    next.x = item.x + dx;
  }
  if (Number.isFinite(item.y)) {
    next.y = item.y + dy;
  }
  return next;
}

export function translateItems(items, indices, dx, dy) {
  const move = new Set(indices || []);
  return (items || []).map((item, index) => (move.has(index) ? translateItem(item, dx, dy) : item));
}

export function copyItems(items, indices, dx = 0, dy = 0) {
  return (indices || [])
    .map((index) => items[index])
    .filter(isSelectable)
    .map((item) => translateItem(JSON.parse(JSON.stringify(item)), dx, dy));
}

export function offsetItems(items, dx = PASTE_NUDGE, dy = PASTE_NUDGE) {
  return (items || []).map((item) => translateItem(item, dx, dy));
}

export function pasteItems(items, clipboard) {
  return (items || []).concat((clipboard || []).map((item) => JSON.parse(JSON.stringify(item))));
}
