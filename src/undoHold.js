export const UNDO_HOLD_MS = 400;

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
  setTimeoutFn = (fn, ms) => window.setTimeout(fn, ms),
  clearTimeoutFn = (id) => window.clearTimeout(id),
  now = defaultNow,
  root = defaultRoot(),
} = {}) {
  let pointerId = null;
  let startedAt = 0;
  let didLong = false;
  let timer = 0;

  const clearTimer = () => {
    clearTimeoutFn(timer);
    timer = 0;
  };

  const samePointer = (event) =>
    event.pointerId == null || pointerId == null || event.pointerId === pointerId;

  const detachLift = () => {
    if (!root) {
      return;
    }
    root.removeEventListener("pointerup", onLift, true);
    root.removeEventListener("pointercancel", onPointerCancel, true);
    root.removeEventListener("touchend", onLift, true);
  };

  const endPress = () => {
    clearTimer();
    pointerId = null;
    detachLift();
  };

  const onLift = (event) => {
    if (pointerId == null || !samePointer(event)) {
      return;
    }
    const held = now() - startedAt;
    const wasLong = didLong || held >= longPressMs;
    endPress();
    if (wasLong) {
      if (!didLong) {
        didLong = true;
        onRedo();
      }
      return;
    }
    onUndo();
  };

  const onPointerCancel = (event) => {
    if (pointerId == null || !samePointer(event)) {
      return;
    }
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
    if (pointerId != null) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    pointerId = event.pointerId ?? 1;
    startedAt = now();
    didLong = false;
    clearTimer();
    detachLift();
    if (root) {
      root.addEventListener("pointerup", onLift, true);
      root.addEventListener("pointercancel", onPointerCancel, true);
      root.addEventListener("touchend", onLift, true);
    }
    try {
      btn.setPointerCapture?.(event.pointerId);
    } catch {
      // Capture is optional; some synthetic pointers reject it.
    }
    timer = setTimeoutFn(() => {
      if (pointerId == null || didLong) {
        return;
      }
      didLong = true;
      onRedo();
    }, longPressMs);
  });

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
