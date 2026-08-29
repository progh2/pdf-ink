import {
  HIGHLIGHTER_OPACITY_DEFAULT,
  PENCIL_COLOR,
  STAMP_COLOR,
  highlighterStrokeStyle,
  normalizeStamp,
  stampPaintLayout,
} from "./tools.js";

export function distPointToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / len2));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function asSegments(points) {
  if (!points.length) {
    return [];
  }
  if (points.length === 1) {
    return [[points[0], points[0]]];
  }
  const segments = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    segments.push([points[index], points[index + 1]]);
  }
  return segments;
}

function segmentsIntersect(a1, a2, b1, b2) {
  const dax = a2.x - a1.x;
  const day = a2.y - a1.y;
  const dbx = b2.x - b1.x;
  const dby = b2.y - b1.y;
  const den = dax * dby - day * dbx;
  if (Math.abs(den) < 1e-8) {
    return false;
  }
  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / den;
  const u = ((b1.x - a1.x) * day - (b1.y - a1.y) * dax) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export function polylineHitsPolyline(pointsA, pointsB, threshold) {
  if (!pointsA.length || !pointsB.length) {
    return false;
  }
  for (const [a1, a2] of asSegments(pointsA)) {
    for (const [b1, b2] of asSegments(pointsB)) {
      if (segmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
      if (distPointToSegment(a1, b1, b2) <= threshold) {
        return true;
      }
      if (distPointToSegment(a2, b1, b2) <= threshold) {
        return true;
      }
      if (distPointToSegment(b1, a1, a2) <= threshold) {
        return true;
      }
      if (distPointToSegment(b2, a1, a2) <= threshold) {
        return true;
      }
    }
  }
  return false;
}

function toCssPoints(points, cssWidth, cssHeight) {
  return (points || []).map((point) => ({
    x: point.x * cssWidth,
    y: point.y * cssHeight,
  }));
}

function rotateAround(point, origin, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return { x: origin.x + dx * cos - dy * sin, y: origin.y + dx * sin + dy * cos };
}

function pointInRect(point, rect) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function polylineHitsCircle(points, center, radius) {
  for (const [start, end] of asSegments(points)) {
    if (distPointToSegment(center, start, end) <= radius) {
      return true;
    }
  }
  return false;
}

function polylineHitsRect(points, rect, pad) {
  const grown = {
    left: rect.left - pad,
    top: rect.top - pad,
    right: rect.right + pad,
    bottom: rect.bottom + pad,
  };
  const edges = [
    [
      { x: grown.left, y: grown.top },
      { x: grown.right, y: grown.top },
    ],
    [
      { x: grown.right, y: grown.top },
      { x: grown.right, y: grown.bottom },
    ],
    [
      { x: grown.right, y: grown.bottom },
      { x: grown.left, y: grown.bottom },
    ],
    [
      { x: grown.left, y: grown.bottom },
      { x: grown.left, y: grown.top },
    ],
  ];
  for (const [start, end] of asSegments(points)) {
    if (pointInRect(start, grown) || pointInRect(end, grown)) {
      return true;
    }
    for (const [a, b] of edges) {
      if (segmentsIntersect(start, end, a, b)) {
        return true;
      }
    }
  }
  return false;
}

function stampHitsEraser(item, eraserPts, eraserHalf, cssWidth, cssHeight) {
  const center = { x: item.x * cssWidth, y: item.y * cssHeight };
  const tilt = Number.isFinite(item.tilt) ? item.tilt : stampTilt(item.x, item.y);
  const local = eraserPts.map((point) => rotateAround(point, center, -tilt));
  const layout = stampPaintLayout(item.stamp, 1);
  if (polylineHitsCircle(local, center, layout.radius + eraserHalf)) {
    return true;
  }
  const width = Math.max(...layout.lines.map((line) => line.length), 1) * layout.fontSize;
  return polylineHitsRect(
    local,
    {
      left: center.x - width / 2,
      top: center.y + layout.labelTop,
      right: center.x + width / 2,
      bottom: center.y + layout.labelBottom,
    },
    eraserHalf,
  );
}

export function itemHitsEraser(item, eraser, cssWidth, cssHeight) {
  const eraserPts = toCssPoints(eraser.points, cssWidth, cssHeight);
  const eraserHalf = (eraser.width || 2) / 2;
  if (item.type === "stamp") {
    return stampHitsEraser(item, eraserPts, eraserHalf, cssWidth, cssHeight);
  }
  const strokePts = toCssPoints(item.points, cssWidth, cssHeight);
  const threshold = ((item.width || 2) + (eraser.width || 2)) / 2;
  return polylineHitsPolyline(strokePts, eraserPts, threshold);
}

export function removeHitItems(items, eraser, cssWidth, cssHeight) {
  return items.filter((item) => !itemHitsEraser(item, eraser, cssWidth, cssHeight));
}

export function removeHitStamps(items, eraser, cssWidth, cssHeight) {
  return items.filter((item) => item.type !== "stamp" || !itemHitsEraser(item, eraser, cssWidth, cssHeight));
}

export function applyEraserToInk(items, eraser, cssWidth, cssHeight) {
  if (isStrokeErase(eraser)) {
    return removeHitItems(items, eraser, cssWidth, cssHeight);
  }
  if (isPixelErase(eraser)) {
    return removeHitStamps(items, eraser, cssWidth, cssHeight).concat(eraser);
  }
  return items.concat(eraser);
}

export function stampInkItem(label, x, y, tilt = 0) {
  return {
    type: "stamp",
    stamp: normalizeStamp(label),
    x,
    y,
    tilt,
    color: STAMP_COLOR,
  };
}

function hashUnit(x, y, salt) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

export function stampTilt(x, y) {
  return -0.16 + hashUnit(x, y, 3) * 0.12;
}

function tracePath(ctx, points, canvas, scale, jitter = 0, salt = 0) {
  ctx.beginPath();
  points.forEach((point, index) => {
    const jx = jitter ? (hashUnit(point.x, point.y, salt) - 0.5) * jitter * 2 : 0;
    const jy = jitter ? (hashUnit(point.y, point.x, salt + 9) - 0.5) * jitter * 2 : 0;
    const x = point.x * canvas.width + jx;
    const y = point.y * canvas.height + jy;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  if (points.length === 1) {
    const x = points[0].x * canvas.width;
    const y = points[0].y * canvas.height;
    ctx.lineTo(x + 0.15 * scale, y);
  }
  ctx.stroke();
}

export function paintPen(ctx, stroke, scale, canvas) {
  const points = stroke.points || [];
  if (!points.length) {
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = stroke.color || "#1A1A1A";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = (stroke.width || 2) * scale;
  tracePath(ctx, points, canvas, scale);
  ctx.restore();
}

export function paintHighlighter(ctx, stroke, scale, canvas) {
  const points = stroke.points || [];
  if (!points.length) {
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = highlighterStrokeStyle(stroke.color || "#FFE566", stroke.opacity ?? HIGHLIGHTER_OPACITY_DEFAULT);
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";
  ctx.lineWidth = (stroke.width || 2) * scale;
  tracePath(ctx, points, canvas, scale);
  ctx.restore();
}

export function paintPencil(ctx, stroke, scale, canvas) {
  const points = stroke.points || [];
  if (!points.length) {
    return;
  }
  const width = (stroke.width || 2) * scale;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = PENCIL_COLOR;
  ctx.fillStyle = PENCIL_COLOR;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const layers = [
    { alpha: 0.2, width: width * 1.35, salt: 1, jitter: 0.55 * scale },
    { alpha: 0.36, width: width * 0.95, salt: 2, jitter: 0.32 * scale },
    { alpha: 0.52, width: width * 0.62, salt: 3, jitter: 0.18 * scale },
  ];
  for (const layer of layers) {
    ctx.globalAlpha = layer.alpha;
    ctx.lineWidth = layer.width;
    tracePath(ctx, points, canvas, scale, layer.jitter, layer.salt);
  }

  ctx.globalAlpha = 0.26;
  for (const point of points) {
    for (let grain = 0; grain < 3; grain += 1) {
      const ox = (hashUnit(point.x, point.y, 20 + grain) - 0.5) * width * 1.5;
      const oy = (hashUnit(point.y, point.x, 40 + grain) - 0.5) * width * 1.5;
      ctx.beginPath();
      ctx.arc(
        point.x * canvas.width + ox,
        point.y * canvas.height + oy,
        Math.max(0.35 * scale, width * 0.16),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  ctx.restore();
}

export function paintStamp(ctx, item, scale, canvas) {
  const cx = item.x * canvas.width;
  const cy = item.y * canvas.height;
  const tilt = Number.isFinite(item.tilt) ? item.tilt : stampTilt(item.x, item.y);
  const layout = stampPaintLayout(item.stamp, scale);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  ctx.strokeStyle = layout.circleColor;
  ctx.lineWidth = Math.max(1.6 * scale, 2.2 * scale);
  ctx.globalAlpha = 0.88;
  ctx.beginPath();
  ctx.arc(0, 0, layout.radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.fillStyle = layout.labelColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `700 ${Math.max(10 * scale, layout.fontSize)}px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  layout.lines.forEach((line, index) => {
    ctx.fillText(line, 0, layout.labelTop + index * layout.lineHeight);
  });
  ctx.restore();
}

export function paintErase(ctx, stroke, scale, canvas) {
  const points = stroke.points || [];
  if (!points.length) {
    return;
  }
  ctx.save();
  if (stroke.eraseMode === "stroke") {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = "rgba(26, 26, 26, 0.22)";
  } else {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "#000000";
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = (stroke.width || 2) * scale;
  tracePath(ctx, points, canvas, scale);
  ctx.restore();
}

export function paintItem(ctx, item, scale, canvas) {
  if (item.type === "stamp") {
    paintStamp(ctx, item, scale, canvas);
    return;
  }
  if (item.erase || item.type === "erase") {
    paintErase(ctx, item, scale, canvas);
    return;
  }
  if (item.type === "highlighter") {
    paintHighlighter(ctx, item, scale, canvas);
    return;
  }
  if (item.type === "pencil") {
    paintPencil(ctx, item, scale, canvas);
    return;
  }
  paintPen(ctx, item, scale, canvas);
}

export function isPixelErase(item) {
  return Boolean(item?.erase || item?.type === "erase") && item?.eraseMode !== "stroke";
}

export function isStrokeErase(item) {
  return Boolean(item?.erase || item?.type === "erase") && item?.eraseMode === "stroke";
}
