export const MOSAIC_CELL_CSS = 8;

export function mosaicItem(rect, cell = MOSAIC_CELL_CSS) {
  return {
    type: "mosaic",
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    cell,
  };
}

export function isMosaic(item) {
  return item?.type === "mosaic";
}

function clampBox(box, width, height) {
  const x = Math.max(0, Math.floor(Number(box.x) || 0));
  const y = Math.max(0, Math.floor(Number(box.y) || 0));
  const w = Math.max(0, Math.min(width - x, Math.ceil(Number(box.w) || 0)));
  const h = Math.max(0, Math.min(height - y, Math.ceil(Number(box.h) || 0)));
  return { x, y, w, h };
}

export function applyMosaicToRgba(data, width, height, box, cell = MOSAIC_CELL_CSS) {
  const area = clampBox(box, width, height);
  const size = Math.max(2, Math.round(Number(cell) || MOSAIC_CELL_CSS));
  if (!area.w || !area.h) {
    return data;
  }
  const x1 = area.x + area.w;
  const y1 = area.y + area.h;
  for (let y = area.y; y < y1; y += size) {
    const bh = Math.min(size, y1 - y);
    for (let x = area.x; x < x1; x += size) {
      const bw = Math.min(size, x1 - x);
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let dy = 0; dy < bh; dy += 1) {
        let i = ((y + dy) * width + x) * 4;
        for (let dx = 0; dx < bw; dx += 1) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          a += data[i + 3];
          n += 1;
          i += 4;
        }
      }
      r = Math.round(r / n);
      g = Math.round(g / n);
      b = Math.round(b / n);
      a = Math.round(a / n);
      for (let dy = 0; dy < bh; dy += 1) {
        let i = ((y + dy) * width + x) * 4;
        for (let dx = 0; dx < bw; dx += 1) {
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = a;
          i += 4;
        }
      }
    }
  }
  return data;
}

export function mosaicBoxesPx(items, width, height, cssWidth) {
  const scale = cssWidth > 0 ? width / cssWidth : 1;
  return (items || []).filter(isMosaic).map((item) => ({
    x: item.x * width,
    y: item.y * height,
    w: item.w * width,
    h: item.h * height,
    cell: Math.max(2, Math.round((item.cell || MOSAIC_CELL_CSS) * scale)),
  }));
}
