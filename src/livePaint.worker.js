/**
 * 그리는 중인 획만 칠하는 워커 (#208).
 *
 * 메인 스레드가 다른 일(저장·썸네일·레이아웃)로 잠깐 막혀도, 화면에 보이는
 * 획은 여기서 계속 칠해진다. 캔버스는 transferControlToOffscreen으로 넘겨
 * 받았고, 크기 변경도 여기서만 한다 — 넘긴 캔버스는 메인이 만질 수 없다.
 *
 * ink.js만 들여온다. 그 모듈은 ctx·canvas를 인자로 받는 순수 그리기라
 * DOM이 없는 워커에서도 그대로 돈다.
 */
import { paintItem } from "./ink.js";

const views = new Map();
let pending = false;

const raf =
  typeof requestAnimationFrame === "function"
    ? requestAnimationFrame
    : (fn) => setTimeout(fn, 16);

function paintAll() {
  pending = false;
  for (const entry of views.values()) {
    if (!entry.dirty || !entry.ctx) {
      continue;
    }
    entry.dirty = false;
    entry.ctx.clearRect(0, 0, entry.canvas.width, entry.canvas.height);
    if (entry.item?.points?.length) {
      paintItem(entry.ctx, entry.item, entry.scale, entry.canvas);
    }
  }
}

function schedule() {
  if (!pending) {
    pending = true;
    raf(paintAll);
  }
}

self.onmessage = ({ data }) => {
  if (data.type === "canvas") {
    views.set(data.id, {
      canvas: data.canvas,
      ctx: data.canvas.getContext("2d"),
      item: null,
      scale: 1,
      dirty: false,
    });
    return;
  }
  const entry = views.get(data.id);
  if (!entry) {
    return;
  }
  if (data.type === "size") {
    entry.canvas.width = data.width;
    entry.canvas.height = data.height;
    entry.dirty = true;
    schedule();
  } else if (data.type === "stroke") {
    entry.item = data.item;
    entry.scale = data.scale;
    entry.dirty = true;
    schedule();
  } else if (data.type === "clear") {
    entry.item = null;
    entry.dirty = true;
    schedule();
  } else if (data.type === "drop") {
    views.delete(data.id);
  }
};
