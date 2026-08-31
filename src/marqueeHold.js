export const MARQUEE_HOLD_MS = 400;
export const MARQUEE_MENU_HEIGHT = 44;
export const MARQUEE_HOLD_SLOP_PX = 16;
export const MARQUEE_MENU_ACTIONS = ["copy", "duplicate", "delete", "capture", "mosaic"];
export const MARQUEE_MENU_LABELS = {
  copy: "복사",
  duplicate: "복제",
  delete: "삭제",
  capture: "캡처",
  mosaic: "마스킹",
};

export function placeMarqueeMenu(box, paper, menuWidth, gap = 8) {
  const height = MARQUEE_MENU_HEIGHT;
  const paperLeft = Number(paper?.left) || 0;
  const paperTop = Number(paper?.top) || 0;
  const paperRight = paperLeft + Math.max(0, Number(paper?.width) || 0);
  const paperBottom = paperTop + Math.max(0, Number(paper?.height) || 0);
  const width = Math.max(1, Number(menuWidth) || 1);
  const boxLeft = Number(box?.left) || 0;
  const boxTop = Number(box?.top) || 0;
  const boxHeight = Math.max(0, Number(box?.height) || 0);
  let left = boxLeft;
  if (paperRight > paperLeft) {
    left = Math.min(Math.max(left, paperLeft), Math.max(paperLeft, paperRight - width));
  }
  let top = boxTop + boxHeight + gap;
  if (top + height > paperBottom) {
    top = boxTop - gap - height;
  }
  if (top < paperTop) {
    top = Math.min(paperBottom - height, Math.max(paperTop, boxTop + boxHeight + gap));
  }
  return { left, top };
}

export function bindMarqueeHold(el, {
  onHold,
  onTap,
  holdMs = MARQUEE_HOLD_MS,
  slopPx = MARQUEE_HOLD_SLOP_PX,
  setTimeoutFn = (fn, ms) => window.setTimeout(fn, ms),
  clearTimeoutFn = (id) => window.clearTimeout(id),
} = {}) {
  let timer = 0;
  let start = null;
  let pointerId = null;
  let fired = false;
  let moved = false;

  const clearTimer = () => {
    clearTimeoutFn(timer);
    timer = 0;
  };

  const fire = () => {
    if (fired) {
      return;
    }
    fired = true;
    clearTimer();
    onHold?.();
  };

  el.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    pointerId = event.pointerId ?? 1;
    start = { x: event.clientX, y: event.clientY };
    fired = false;
    moved = false;
    clearTimer();
    timer = setTimeoutFn(() => {
      fire();
    }, holdMs);
    // No pointer capture (#121): with it the release over the menu is retargeted
    // to a common ancestor, so the menu item never hears the click.
  });

  el.addEventListener("pointermove", (event) => {
    if (pointerId == null || !start) {
      return;
    }
    if (event.pointerId != null && event.pointerId !== pointerId) {
      return;
    }
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > slopPx) {
      moved = true;
      clearTimer();
    }
  });

  const onLift = (event) => {
    if (pointerId == null) {
      return;
    }
    if (event.pointerId != null && event.pointerId !== pointerId) {
      return;
    }
    const wasTap = !fired && !moved;
    if (!fired) {
      clearTimer();
    }
    pointerId = null;
    start = null;
    if (wasTap && event.type === "pointerup") {
      onTap?.(event);
    }
  };

  el.addEventListener("pointerup", onLift);
  el.addEventListener("pointercancel", (event) => {
    if (event.buttons > 0 || event.pointerType !== "mouse") {
      return;
    }
    onLift(event);
  });

  el.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    fire();
  });
}
