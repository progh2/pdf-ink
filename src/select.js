import { distPointToSegment } from "./ink.js";

export const SELECT_HANDLE_PX = 8;
export const PASTE_OFFSET = 0.04;

export function isSelectable(item) {
  if (!item || item.erase || item.type === "erase" || item.type === "mosaic") {
    return false;
  }
  if (item.type === "image") {
    return !item.fixed;
  }
  if (item.type === "stamp") {
    return true;
  }
  return Array.isArray(item.points) && item.points.length > 0;
}

export function strokeBounds(item) {
  const points = item?.points || [];
  if (!points.length) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { x: minX, y: minY, w: Math.max(0, maxX - minX), h: Math.max(0, maxY - minY) };
}

export function itemBoundsNorm(item, cssWidth = 1, cssHeight = 1) {
  if (item?.type === "image" || item?.type === "mosaic") {
    return { x: item.x, y: item.y, w: item.w, h: item.h };
  }
  if (item?.type === "stamp") {
    const rx = 36 / Math.max(cssWidth, 1);
    const ry = 36 / Math.max(cssHeight, 1);
    const label = 36 / Math.max(cssHeight, 1);
    return { x: item.x - rx, y: item.y - ry, w: rx * 2, h: ry + label };
  }
  return strokeBounds(item);
}

export function boundsUnion(rects) {
  const list = (rects || []).filter((rect) => rect && (rect.w > 0 || rect.h > 0 || rect.x || rect.y));
  if (!list.length) {
    return null;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rect of list) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.w);
    maxY = Math.max(maxY, rect.y + rect.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function pointInBounds(point, rect, pad = 0) {
  if (!rect) {
    return false;
  }
  return (
    point.x >= rect.x - pad &&
    point.x <= rect.x + rect.w + pad &&
    point.y >= rect.y - pad &&
    point.y <= rect.y + rect.h + pad
  );
}

function polylineHitsPoint(points, point, threshold) {
  if (!points.length) {
    return false;
  }
  if (points.length === 1) {
    return Math.hypot(points[0].x - point.x, points[0].y - point.y) <= threshold;
  }
  for (let index = 0; index < points.length - 1; index += 1) {
    if (distPointToSegment(point, points[index], points[index + 1]) <= threshold) {
      return true;
    }
  }
  return false;
}

export function itemHitsPoint(item, point, cssWidth, cssHeight) {
  if (!isSelectable(item)) {
    return false;
  }
  if (item.type === "image" || item.type === "stamp") {
    return pointInBounds(point, itemBoundsNorm(item, cssWidth, cssHeight), 0.004);
  }
  const pad = ((item.width || 2) + 12) / 2 / Math.max(cssWidth, 1);
  return polylineHitsPoint(item.points || [], point, pad);
}

export function itemHitsRect(item, rect, cssWidth, cssHeight) {
  if (!isSelectable(item) || !rect) {
    return false;
  }
  const box = itemBoundsNorm(item, cssWidth, cssHeight);
  return !(box.x + box.w < rect.x || rect.x + rect.w < box.x || box.y + box.h < rect.y || rect.y + rect.h < box.y);
}

export function indexesInRect(items, rect, cssWidth, cssHeight) {
  const indexes = [];
  (items || []).forEach((item, index) => {
    if (itemHitsRect(item, rect, cssWidth, cssHeight)) {
      indexes.push(index);
    }
  });
  return indexes;
}

export function indexAtPoint(items, point, cssWidth, cssHeight) {
  const list = items || [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (itemHitsPoint(list[index], point, cssWidth, cssHeight)) {
      return index;
    }
  }
  return -1;
}

export function translateItem(item, dx, dy) {
  const next = { ...item };
  if (Array.isArray(item.points)) {
    next.points = item.points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
  }
  if (item.type === "stamp" || item.type === "image" || item.type === "mosaic") {
    next.x = (Number(item.x) || 0) + dx;
    next.y = (Number(item.y) || 0) + dy;
  }
  return next;
}

export function cloneItemsWithOffset(items, dx = PASTE_OFFSET, dy = PASTE_OFFSET) {
  return (items || []).map((item) => translateItem(JSON.parse(JSON.stringify(item)), dx, dy));
}

export function handleAtPoint(bounds, point, cssWidth, cssHeight) {
  if (!bounds) {
    return null;
  }
  const hx = SELECT_HANDLE_PX / Math.max(cssWidth, 1);
  const hy = SELECT_HANDLE_PX / Math.max(cssHeight, 1);
  const hitX = hx * 2;
  const hitY = hy * 2;
  const handles = {
    nw: { x: bounds.x, y: bounds.y },
    ne: { x: bounds.x + bounds.w, y: bounds.y },
    sw: { x: bounds.x, y: bounds.y + bounds.h },
    se: { x: bounds.x + bounds.w, y: bounds.y + bounds.h },
  };
  for (const [name, corner] of Object.entries(handles)) {
    if (Math.abs(point.x - corner.x) <= hitX && Math.abs(point.y - corner.y) <= hitY) {
      return name;
    }
  }
  return null;
}

export function resizeRectFromCorner(rect, corner, point) {
  let { x, y, w, h } = rect;
  const right = x + w;
  const bottom = y + h;
  if (corner === "nw") {
    x = Math.min(point.x, right - 0.02);
    y = Math.min(point.y, bottom - 0.02);
    w = right - x;
    h = bottom - y;
  } else if (corner === "ne") {
    y = Math.min(point.y, bottom - 0.02);
    w = Math.max(0.02, point.x - x);
    h = bottom - y;
  } else if (corner === "sw") {
    x = Math.min(point.x, right - 0.02);
    w = right - x;
    h = Math.max(0.02, point.y - y);
  } else {
    w = Math.max(0.02, point.x - x);
    h = Math.max(0.02, point.y - y);
  }
  return { x, y, w, h };
}

export function applyRectToImage(item, rect) {
  return { ...item, x: rect.x, y: rect.y, w: rect.w, h: rect.h };
}
