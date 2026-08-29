export const UNDO_HOLD_MS = 400;
export const UNDO_HOLD_SUPPRESS_MS = 400;

function defaultNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function defaultRoot() {
  return typeof window !== "undefined" ? window : undefined;
}

export function bindUndoHold(btn, {
  onUndo,
  onRedo,
  longPressMs = UNDO_HOLD_MS,
  suppressMs = UNDO_HOLD_SUPPRESS_MS,
  setTimeoutFn = (fn, ms) => window.setTimeout(fn, ms),
  clearTimeoutFn = (id) => window.clearTimeout(id),
  requestFrameFn = typeof requestAnimationFrame === "function"
    ? (fn) => requestAnimationFrame(fn)
    : (fn) => window.setTimeout(fn, 16),
  cancelFrameFn = typeof cancelAnimationFrame === "function"
    ? (id) => cancelAnimationFrame(id)
    : (id) => window.clearTimeout(id),
  now = defaultNow,
  root = defaultRoot(),
} = {}) {
  let pointerId = null;
  let startedAt = 0;
  let didLong = false;
  let timer = 0;
  let frame = 0;
  let suppressUndoUntil = 0;

  const clearTimer = () => {
    clearTimeoutFn(timer);
    timer = 0;
  };

  const clearFrame = () => {
    if (frame) {
      cancelFrameFn(frame);
      frame = 0;
    }
  };

  const samePointer = (event) =>
    event.pointerId == null || pointerId == null || event.pointerId === pointerId;

  const detachLift = () => {
    if (!root) {
      return;
    }
    root.removeEventListener("pointerup", onLift, true);
    root.removeEventListener("pointercancel", onPointerCancel, true);
    root.removeEventListener("pointermove", onMove, true);
    root.removeEventListener("touchend", onLift, true);
  };

  const endPress = () => {
    clearTimer();
    clearFrame();
    pointerId = null;
    detachLift();
  };

  const armSuppress = () => {
    suppressUndoUntil = now() + suppressMs;
  };

  const fireRedo = () => {
    if (didLong) {
      return;
    }
    didLong = true;
    armSuppress();
    onRedo();
  };

  const maybeRedoFromHold = () => {
    if (pointerId == null || didLong) {
      return;
    }
    if (now() - startedAt >= longPressMs) {
      fireRedo();
    }
  };

  const tick = () => {
    frame = 0;
    if (pointerId == null) {
      return;
    }
    maybeRedoFromHold();
    if (pointerId != null && !didLong) {
      frame = requestFrameFn(tick);
    }
  };

  const onMove = (event) => {
    if (pointerId == null || !samePointer(event)) {
      return;
    }
    maybeRedoFromHold();
  };

  const onLift = (event) => {
    if (pointerId == null || !samePointer(event)) {
      return;
    }
    maybeRedoFromHold();
    const wasLong = didLong;
    endPress();
    if (wasLong) {
      armSuppress();
      return;
    }
    if (now() < suppressUndoUntil) {
      return;
    }
    onUndo();
  };

  const onPointerCancel = (event) => {
    if (pointerId == null || !samePointer(event)) {
      return;
    }
    maybeRedoFromHold();
    // Browser often cancels a touch pointer for the context menu while the
    // finger is still down. Keep the long-press timer in that case.
    if (event.buttons > 0 || event.pointerType !== "mouse") {
      return;
    }
    endPress();
  };

  btn.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (pointerId != null) {
      return;
    }
    if (now() < suppressUndoUntil) {
      return;
    }
    pointerId = event.pointerId ?? 1;
    startedAt = now();
    didLong = false;
    clearTimer();
    clearFrame();
    detachLift();
    if (root) {
      root.addEventListener("pointerup", onLift, true);
      root.addEventListener("pointercancel", onPointerCancel, true);
      root.addEventListener("pointermove", onMove, true);
      root.addEventListener("touchend", onLift, true);
    }
    try {
      btn.setPointerCapture?.(event.pointerId);
    } catch {
      // Capture is optional; some synthetic pointers reject it.
    }
    timer = setTimeoutFn(() => {
      maybeRedoFromHold();
    }, longPressMs);
    frame = requestFrameFn(tick);
  });

  btn.addEventListener("pointermove", onMove);
  btn.addEventListener("pointerup", onLift);
  btn.addEventListener("pointercancel", onPointerCancel);
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  btn.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
}
