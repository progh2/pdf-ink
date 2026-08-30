import { normalizeStamp, stampPaintLayout } from "./tools.js";

/** Pointer ghost while the stamp tool is selected. Locked 40%. */
export const STAMP_GHOST_ALPHA = 0.4;

export function stampGhostVisible(tool, interactMode = "edit") {
  return tool === "stamp" && interactMode !== "view";
}

/** Same oval as the real stamp: 108×64, chosen phrase inside. */
export function stampGhostItem(label, x, y, tilt = 0) {
  const layout = stampPaintLayout(label);
  return {
    type: "stamp",
    stamp: normalizeStamp(label),
    x,
    y,
    tilt,
    ghost: true,
    alpha: STAMP_GHOST_ALPHA,
    w: layout.width,
    h: layout.height,
  };
}

export function followStampGhost(ghost, point, label) {
  if (!point) {
    return ghost || null;
  }
  return stampGhostItem(label ?? ghost?.stamp, point.x, point.y, ghost?.tilt);
}

export function hideStampGhostOnToolChange(tool, ghost) {
  return stampGhostVisible(tool) ? ghost || null : null;
}

export function stampPlaceFromGhost(ghost) {
  if (!ghost) {
    return null;
  }
  return { x: ghost.x, y: ghost.y };
}

export function createStampGhost() {
  let ghost = null;
  return {
    get() {
      return ghost;
    },
    follow({ tool, interactMode = "edit", label, point, tilt }) {
      if (!stampGhostVisible(tool, interactMode) || !point) {
        ghost = null;
        return ghost;
      }
      ghost = stampGhostItem(label, point.x, point.y, tilt);
      return ghost;
    },
    hide() {
      ghost = null;
      return null;
    },
    hideIfToolChanged(tool) {
      ghost = hideStampGhostOnToolChange(tool, ghost);
      return ghost;
    },
    placePoint() {
      return stampPlaceFromGhost(ghost);
    },
  };
}
