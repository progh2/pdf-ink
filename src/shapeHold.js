export const SHAPE_HOLD_MS = 400;
export const SHAPE_HOLD_GHOST_ALPHA = 0.4;
export const SHAPE_HOLD_CHIP_HEIGHT = 36;
export const SHAPE_HOLD_CHIP_GAP_PX = 24;
// #210: 16이었는데, 한글 획 하나가 그보다 작아 홀드 뒤 글씨가 먹혔다.
export const SHAPE_HOLD_MOVE_SLOP_PX = 6;
export const SHAPE_HOLD_DISMISS_MS = 8000;
export const SHAPE_HOLD_MIN_SPAN = 0.045;
export const SHAPE_HOLD_CIRCLE_ASPECT = 1.14;
export const SHAPE_HOLD_ELLIPSE_POINTS = 48;
export const SHAPE_HOLD_TOOLS = ["pen", "highlighter", "pencil"];
export const SHAPE_HOLD_CHIPS = ["line", "rect", "circle"];

export function canShapeHold(tool) {
  return SHAPE_HOLD_TOOLS.includes(tool);
}

function dist(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.y || 0) - (b?.y || 0));
}

function pathLength(points) {
  let len = 0;
  for (let index = 1; index < points.length; index += 1) {
    len += dist(points[index - 1], points[index]);
  }
  return len;
}

function boundingBox(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function pointLineDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) {
    return dist(point, start);
  }
  return Math.abs((point.x - start.x) * dy - (point.y - start.y) * dx) / Math.sqrt(len2);
}

function isClosed(points, box, length) {
  const gap = dist(points[0], points[points.length - 1]);
  return gap <= Math.max(0.18 * length, 0.22 * Math.hypot(box.w, box.h));
}

export function pointsForLine(points) {
  return [
    { x: points[0].x, y: points[0].y },
    { x: points[points.length - 1].x, y: points[points.length - 1].y },
  ];
}

export function pointsForRect(box) {
  return [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY },
    { x: box.minX, y: box.maxY },
    { x: box.minX, y: box.minY },
  ];
}

export function pointsForCircle(box) {
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  let rx = Math.max(box.w / 2, 1e-4);
  let ry = Math.max(box.h / 2, 1e-4);
  const aspect = Math.max(rx, ry) / Math.min(rx, ry);
  if (aspect <= SHAPE_HOLD_CIRCLE_ASPECT) {
    const radius = (rx + ry) / 2;
    rx = radius;
    ry = radius;
  }
  const pts = [];
  for (let index = 0; index < SHAPE_HOLD_ELLIPSE_POINTS; index += 1) {
    const t = (index / SHAPE_HOLD_ELLIPSE_POINTS) * Math.PI * 2;
    pts.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
  }
  pts.push({ ...pts[0] });
  return pts;
}

function lineFit(points) {
  const start = points[0];
  const end = points[points.length - 1];
  let maxDev = 0;
  for (const point of points) {
    maxDev = Math.max(maxDev, pointLineDistance(point, start, end));
  }
  return { start, end, maxDev, span: dist(start, end) };
}

function rectMetrics(points, box) {
  if (box.w < SHAPE_HOLD_MIN_SPAN * 0.45 || box.h < SHAPE_HOLD_MIN_SPAN * 0.45) {
    return { ok: false, mean: 1, sides: 0, corners: 0 };
  }
  const aspect = Math.max(box.w, box.h) / Math.min(box.w, box.h);
  if (aspect > 6) {
    return { ok: false, mean: 1, sides: 0, corners: 0 };
  }
  const bandX = Math.max(box.w * 0.18, 1e-4);
  const bandY = Math.max(box.h * 0.18, 1e-4);
  const cornerX = Math.max(box.w * 0.12, 1e-4);
  const cornerY = Math.max(box.h * 0.12, 1e-4);
  let edgeDist = 0;
  let left = 0;
  let right = 0;
  let top = 0;
  let bottom = 0;
  let corners = 0;
  for (const point of points) {
    const dl = point.x - box.minX;
    const dr = box.maxX - point.x;
    const dt = point.y - box.minY;
    const db = box.maxY - point.y;
    edgeDist += Math.min(dl, dr, dt, db);
    if (dl <= bandX) left += 1;
    if (dr <= bandX) right += 1;
    if (dt <= bandY) top += 1;
    if (db <= bandY) bottom += 1;
    if (dl <= cornerX && dt <= cornerY) corners += 1;
    else if (dr <= cornerX && dt <= cornerY) corners += 1;
    else if (dr <= cornerX && db <= cornerY) corners += 1;
    else if (dl <= cornerX && db <= cornerY) corners += 1;
  }
  const n = points.length;
  const minSide = Math.max(1, Math.floor(n * 0.06));
  const sides = [left, right, top, bottom].filter((count) => count >= minSide).length;
  const mean = edgeDist / n / Math.min(box.w, box.h);
  const perimeter = 2 * (box.w + box.h);
  const length = pathLength(points);
  const loop = length / Math.max(perimeter, 1e-6);
  return {
    ok: sides >= 4 && mean < 0.16 && loop >= 0.55 && loop <= 1.7,
    mean,
    sides,
    corners,
    cornerRatio: corners / n,
  };
}

function ellipseMetrics(points, box) {
  const rx = box.w / 2;
  const ry = box.h / 2;
  if (rx < SHAPE_HOLD_MIN_SPAN * 0.3 || ry < SHAPE_HOLD_MIN_SPAN * 0.3) {
    return { ok: false, mean: 1 };
  }
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  let err = 0;
  for (const point of points) {
    err += Math.abs(Math.hypot((point.x - cx) / rx, (point.y - cy) / ry) - 1);
  }
  const mean = err / points.length;
  const perim = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  const loop = pathLength(points) / Math.max(perim, 1e-6);
  return { ok: mean < 0.22 && loop >= 0.55 && loop <= 1.7, mean };
}

function circleKind(box) {
  const aspect = Math.max(box.w, box.h) / Math.max(1e-6, Math.min(box.w, box.h));
  return aspect <= SHAPE_HOLD_CIRCLE_ASPECT ? "circle" : "ellipse";
}

export function classifyStrokeShape(points) {
  const list = Array.isArray(points) ? points.filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y)) : [];
  if (list.length < 2) {
    return { kind: null, points: list };
  }
  const box = boundingBox(list);
  const diag = Math.hypot(box.w, box.h);
  const length = pathLength(list);
  if (diag < SHAPE_HOLD_MIN_SPAN || length < SHAPE_HOLD_MIN_SPAN) {
    return { kind: null, points: list };
  }

  const fit = lineFit(list);
  if (fit.span >= SHAPE_HOLD_MIN_SPAN && fit.maxDev / fit.span <= 0.12 && length / fit.span <= 1.4) {
    return { kind: "line", points: pointsForLine(list) };
  }

  if (!isClosed(list, box, length) || list.length < 6) {
    return { kind: null, points: list };
  }

  const rect = rectMetrics(list, box);
  const oval = ellipseMetrics(list, box);
  if (rect.ok && oval.ok) {
    if (oval.mean + 0.03 < rect.mean && rect.cornerRatio < 0.12) {
      const kind = circleKind(box);
      return { kind, points: pointsForCircle(box) };
    }
    if (rect.sides >= 4 && rect.cornerRatio >= 0.06) {
      return { kind: "rect", points: pointsForRect(box) };
    }
  }
  if (rect.ok && (!oval.ok || rect.mean <= oval.mean)) {
    return { kind: "rect", points: pointsForRect(box) };
  }
  if (oval.ok) {
    const kind = circleKind(box);
    return { kind, points: pointsForCircle(box) };
  }
  return { kind: null, points: list };
}

export function snapStrokePoints(points) {
  const classified = classifyStrokeShape(points);
  return classified.kind ? classified.points : points;
}

export function shapeOfferFromStroke(points) {
  const classified = classifyStrokeShape(points);
  const usable = Array.isArray(points)
    ? points.filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y))
    : [];
  if (usable.length < 2) {
    return null;
  }
  const box = boundingBox(usable);
  if (Math.hypot(box.w, box.h) < SHAPE_HOLD_MIN_SPAN) {
    return null;
  }
  const chips = {
    line: pointsForLine(usable),
    rect: pointsForRect(box),
    circle: pointsForCircle(box),
  };
  const chipKind = classified.kind === "ellipse" ? "circle" : classified.kind || "line";
  return {
    kind: chipKind,
    ghostPoints: chips[chipKind] || chips.line,
    chips,
    box,
  };
}

export function applyShapeChip(chip, points) {
  const offer = shapeOfferFromStroke(points);
  if (!offer || !SHAPE_HOLD_CHIPS.includes(chip)) {
    return points;
  }
  return offer.chips[chip] || points;
}

function copyPoints(points) {
  if (!Array.isArray(points)) {
    return [];
  }
  return points
    .filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({ x: point.x, y: point.y }));
}

export function isShapeHoldJitter(client, lastClient, slopPx = SHAPE_HOLD_MOVE_SLOP_PX) {
  if (!client || !lastClient) {
    return false;
  }
  const dx = Number(client.x) - Number(lastClient.x);
  const dy = Number(client.y) - Number(lastClient.y);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
    return false;
  }
  return Math.hypot(dx, dy) <= slopPx;
}

function menuContainsPoint(left, top, width, height, x, y, pad = 0) {
  return x >= left - pad && x <= left + width + pad && y >= top - pad && y <= top + height + pad;
}

function menuEdgeDistance(left, top, width, height, x, y) {
  const nearestX = Math.max(left, Math.min(x, left + width));
  const nearestY = Math.max(top, Math.min(y, top + height));
  return Math.hypot(x - nearestX, y - nearestY);
}

export function clientHitsShapeChipMenu(client, menu, pad = 8) {
  if (!client || !menu) {
    return false;
  }
  const x = Number(client.x);
  const y = Number(client.y);
  const left = Number(menu.left);
  const top = Number(menu.top);
  const width = Number(menu.width);
  const height = Number(menu.height);
  if (![x, y, left, top, width, height].every(Number.isFinite)) {
    return false;
  }
  return menuContainsPoint(left, top, width, height, x, y, pad);
}

export function placeShapeChipMenu({
  tip,
  menuWidth = 200,
  menuHeight = SHAPE_HOLD_CHIP_HEIGHT + 8,
  viewport = { width: 390, height: 844 },
  gap = SHAPE_HOLD_CHIP_GAP_PX,
  margin = 8,
} = {}) {
  const tx = Number(tip?.x);
  const ty = Number(tip?.y);
  const width = Number(menuWidth) || 200;
  const height = Number(menuHeight) || SHAPE_HOLD_CHIP_HEIGHT + 8;
  const vw = Number(viewport?.width) || width + margin * 2;
  const vh = Number(viewport?.height) || height + margin * 2;
  const candidates = [
    { left: tx - width / 2, top: ty + gap },
    { left: tx - width / 2, top: ty - gap - height },
    { left: tx + gap, top: ty - height / 2 },
    { left: tx - gap - width, top: ty - height / 2 },
    { left: tx + gap, top: ty + gap },
    { left: tx - gap - width, top: ty + gap },
    { left: tx + gap, top: ty - gap - height },
    { left: tx - gap - width, top: ty - gap - height },
  ];
  const fits = (pos) => {
    if (!Number.isFinite(pos.left) || !Number.isFinite(pos.top)) {
      return false;
    }
    if (pos.left < margin || pos.top < margin) {
      return false;
    }
    if (pos.left + width > vw - margin || pos.top + height > vh - margin) {
      return false;
    }
    if (menuContainsPoint(pos.left, pos.top, width, height, tx, ty)) {
      return false;
    }
    return menuEdgeDistance(pos.left, pos.top, width, height, tx, ty) >= gap - 0.01;
  };
  for (const pos of candidates) {
    if (fits(pos)) {
      return { left: pos.left, top: pos.top, width, height };
    }
  }
  let left = Math.min(vw - width - margin, Math.max(margin, tx + gap));
  let top = Math.min(vh - height - margin, Math.max(margin, ty + gap));
  if (menuContainsPoint(left, top, width, height, tx, ty)) {
    top = Math.min(vh - height - margin, Math.max(margin, ty - gap - height));
  }
  if (menuContainsPoint(left, top, width, height, tx, ty)) {
    left = Math.min(vw - width - margin, Math.max(margin, tx - gap - width));
  }
  return { left, top, width, height };
}

export function createShapeHold({
  holdMs = SHAPE_HOLD_MS,
  moveSlopPx = SHAPE_HOLD_MOVE_SLOP_PX,
  now = () => Date.now(),
  setTimeoutFn = (fn, ms) => setTimeout(fn, ms),
  clearTimeoutFn = (id) => clearTimeout(id),
} = {}) {
  let timer = 0;
  let lastClient = null;
  let tool = "pen";
  let offer = null;
  let armed = false;
  let lastSignificantAt = 0;
  let frozen = null;
  let lastGood = null;
  let drawn = false;

  const clearTimer = () => {
    if (timer) {
      clearTimeoutFn(timer);
      timer = 0;
    }
  };

  const pointsForOffer = (getPoints) => {
    if (lastGood?.length) {
      return lastGood;
    }
    if (frozen?.length) {
      return frozen;
    }
    return typeof getPoints === "function" ? getPoints() : [];
  };

  const freezeFrom = (points) => {
    frozen = copyPoints(points);
    return frozen;
  };

  const fire = (getPoints, onOffer) => {
    timer = 0;
    if (offer || !armed || !canShapeHold(tool)) {
      return;
    }
    const source = pointsForOffer(getPoints);
    freezeFrom(source);
    const next = shapeOfferFromStroke(frozen);
    if (!next) {
      // 도형이 될 수 없는 획(짧은 글씨 획)을 얼려 두면, 이어지는 작은
      // 움직임이 전부 버려져 글씨가 끊긴다 (#210). 지킬 것이 없으면 놓는다.
      frozen = null;
      return;
    }
    offer = next;
    onOffer?.(next);
  };

  return {
    reset() {
      clearTimer();
      lastClient = null;
      tool = "pen";
      offer = null;
      armed = false;
      lastSignificantAt = 0;
      frozen = null;
      lastGood = null;
      drawn = false;
    },
    begin({ tool: nextTool, client, getPoints, onOffer } = {}) {
      this.reset();
      tool = nextTool || "pen";
      lastClient = client || null;
      if (!canShapeHold(tool)) {
        return;
      }
      armed = true;
      lastSignificantAt = now();
      timer = setTimeoutFn(() => fire(getPoints, onOffer), holdMs);
    },
    /**
     * Called on every move, so it keeps the reference instead of cloning the
     * whole stroke each time (#172). Callers replace the array rather than
     * mutating it, and freezing copies, so a snapshot still cannot be moved
     * under our feet.
     */
    rememberPoints(points) {
      lastGood = Array.isArray(points) ? points : [];
    },
    frozenPoints() {
      if (frozen?.length) {
        return copyPoints(frozen);
      }
      if (lastGood?.length) {
        return copyPoints(lastGood);
      }
      return null;
    },
    noteMove({ client, getPoints, onOffer, fromChips = false } = {}) {
      if (!armed || !canShapeHold(tool) || !client) {
        return true;
      }
      if (fromChips) {
        if (!frozen?.length) {
          freezeFrom(lastGood || (typeof getPoints === "function" ? getPoints() : []));
        }
        return false;
      }
      if (offer) {
        if (isShapeHoldJitter(client, lastClient, moveSlopPx)) {
          return false;
        }
        offer = null;
        frozen = null;
        lastClient = client;
        lastSignificantAt = now();
        drawn = true;
        clearTimer();
        timer = setTimeoutFn(() => fire(getPoints, onOffer), holdMs);
        onOffer?.(null);
        return false;
      }
      if (isShapeHoldJitter(client, lastClient, moveSlopPx)) {
        // Tremor inside the slop adds nothing, but it only freezes once the
        // hold really completed. A mouse pauses mid-stroke all the time (#116).
        if (drawn && now() - lastSignificantAt >= holdMs) {
          freezeFrom(lastGood || (typeof getPoints === "function" ? getPoints() : []));
          if (!offer) {
            fire(getPoints, onOffer);
          }
        }
        return !drawn;
      }
      lastClient = client;
      lastSignificantAt = now();
      // The hand moved on: thaw and keep drawing the same stroke (#116).
      frozen = null;
      drawn = true;
      clearTimer();
      timer = setTimeoutFn(() => fire(getPoints, onOffer), holdMs);
      return true;
    },
    finish(freehandPoints) {
      clearTimer();
      const keptPoints = frozen?.length ? frozen : lastGood?.length ? lastGood : freehandPoints;
      if (armed && !offer && now() - lastSignificantAt >= holdMs) {
        offer = shapeOfferFromStroke(keptPoints);
      }
      const kept = offer;
      lastClient = null;
      armed = false;
      frozen = null;
      lastGood = null;
      drawn = false;
      return {
        points: keptPoints,
        offer: kept,
        snapped: false,
      };
    },
    isOffering: () => Boolean(offer),
    currentOffer: () => offer,
    isFrozen: () => Boolean(frozen),
    // Locked only once the hold really completed, never after a 50ms gap (#116).
    isHoldLocked: () => Boolean(frozen || offer || (drawn && now() - lastSignificantAt >= holdMs)),
  };
}
