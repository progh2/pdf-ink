import { MOSAIC_CELL_CSS, mosaicItem } from "./mosaic.js";
import { PASTE_NUDGE, copyItems, deleteSelectedItems, pickItemsInRect } from "./select.js";

export const REGION_HOLD_MS = 400;
export const REGION_HOLD_MOVE_SLOP_PX = 12;
export const REGION_MENU_HEIGHT = 44;
export const REGION_MENU_ACTIONS = ["copy", "duplicate", "delete", "capture", "mosaic"];
export const REGION_MENU_LABELS = {
  copy: "복사",
  duplicate: "복제",
  delete: "삭제",
  capture: "캡처",
  mosaic: "마스킹",
};

export function persistCaptureAfterUp(rectTool, page, rect) {
  if (rectTool !== "capture" || !rect) {
    return { persist: false, pending: null };
  }
  return { persist: true, pending: { page, rect } };
}

export function regionIndices(items, rect, cssWidth, cssHeight) {
  return pickItemsInRect(items, rect, cssWidth, cssHeight);
}

export function copyRegionItems(items, rect, cssWidth, cssHeight) {
  return copyItems(items, regionIndices(items, rect, cssWidth, cssHeight), 0, 0);
}

export function duplicateOffsetForRect(rect) {
  const width = Number(rect?.w);
  return {
    dx: Number.isFinite(width) && width > 0 ? width : PASTE_NUDGE,
    dy: 0,
  };
}

export function duplicateRegionItems(items, rect, cssWidth, cssHeight) {
  const { dx, dy } = duplicateOffsetForRect(rect);
  const copies = copyItems(items, regionIndices(items, rect, cssWidth, cssHeight), dx, dy);
  return (items || []).concat(copies);
}

export function deleteRegionItems(items, rect, cssWidth, cssHeight) {
  return deleteSelectedItems(items, regionIndices(items, rect, cssWidth, cssHeight));
}

export function applyRegionMosaic(items, rect, cell = MOSAIC_CELL_CSS) {
  if (!rect) {
    return items || [];
  }
  return (items || []).concat([mosaicItem(rect, cell)]);
}

export function placeRegionMenuBox({
  clientX = 0,
  clientY = 0,
  menuWidth = 260,
  menuHeight = REGION_MENU_HEIGHT,
  viewportW = 400,
  viewportH = 600,
  gap = 8,
} = {}) {
  const width = Math.max(1, Number(menuWidth) || 1);
  const height = Math.max(1, Number(menuHeight) || REGION_MENU_HEIGHT);
  const viewW = Math.max(1, Number(viewportW) || 1);
  const viewH = Math.max(1, Number(viewportH) || 1);
  let left = clientX - width / 2;
  let top = clientY - height - gap;
  if (top < 8) {
    top = clientY + gap;
  }
  left = Math.min(viewW - width - 8, Math.max(8, left));
  top = Math.min(viewH - height - 8, Math.max(8, top));
  return { left, top, height };
}

export function createRegionHold({
  holdMs = REGION_HOLD_MS,
  moveSlopPx = REGION_HOLD_MOVE_SLOP_PX,
  setTimeoutFn = (fn, ms) => setTimeout(fn, ms),
  clearTimeoutFn = (id) => clearTimeout(id),
} = {}) {
  let timer = 0;
  let start = null;
  let opened = false;
  let onMenu = null;

  const clearTimer = () => {
    if (timer) {
      clearTimeoutFn(timer);
      timer = 0;
    }
  };

  return {
    begin(event, openMenu) {
      this.cancel();
      if (event?.button !== undefined && event.button !== 0) {
        return;
      }
      start = { x: event?.clientX || 0, y: event?.clientY || 0 };
      opened = false;
      onMenu = typeof openMenu === "function" ? openMenu : null;
      timer = setTimeoutFn(() => {
        timer = 0;
        opened = true;
        onMenu?.(start);
      }, holdMs);
    },
    move(event) {
      if (!start || opened || !event) {
        return;
      }
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > moveSlopPx) {
        this.cancel();
      }
    },
    end() {
      const didOpen = opened;
      clearTimer();
      start = null;
      return didOpen;
    },
    cancel() {
      clearTimer();
      start = null;
      opened = false;
      onMenu = null;
    },
    isOpen: () => opened,
  };
}
