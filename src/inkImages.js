/**
 * 이미지를 필기에서 떼어 낸다 (#273).
 *
 * 붙여넣은 이미지는 base64 dataURL이라 한 장에 수 MB다. 이걸 필기와 함께
 * localStorage(5~10MB)에 넣으면 금세 넘쳐 「저장하지 못했습니다」가 뜨고
 * 그 뒤로 아무 것도 안 저장된다. 그래서 **가벼운 필기는 localStorage**,
 * **무거운 이미지 원본은 IndexedDB**(용량이 훨씬 크다)로 갈라 둔다.
 */

/**
 * pages에서 이미지 src를 뽑아낸다. localStorage용 pages에는 src를 비우고,
 * id→src 지도는 따로 돌려준다. id 없는 이미지는 그 자리에 임시 id를 박는다.
 */
export function stripImages(pages) {
  const light = {};
  const images = {};
  let n = 0;
  for (const [key, items] of Object.entries(pages || {})) {
    light[key] = (items || []).map((item) => {
      if (item?.type !== "image" || typeof item.src !== "string" || !item.src) {
        return item;
      }
      const id = item.id || `img-strip-${(n += 1)}`;
      images[id] = item.src;
      // dataURL만 뺀다. 자리·크기·회전·자름은 그대로 localStorage에.
      return { ...item, id, src: "" };
    });
  }
  return { light, images };
}

/** 갈라 둔 이미지를 다시 붙인다. 지도에 없으면(딴 브라우저) src는 빈 채로 둔다. */
export function mergeImages(pages, images) {
  const map = images || {};
  const out = {};
  for (const [key, items] of Object.entries(pages || {})) {
    out[key] = (items || []).map((item) => {
      if (item?.type === "image" && !item.src && map[item.id]) {
        return { ...item, src: map[item.id] };
      }
      return item;
    });
  }
  return out;
}

/** 지금 쓰는 이미지 id만 남긴다 — 지운 이미지의 원본이 IndexedDB에 쌓이지 않게. */
export function liveImageIds(pages) {
  const ids = new Set();
  for (const items of Object.values(pages || {})) {
    for (const item of items || []) {
      if (item?.type === "image" && item.id) {
        ids.add(item.id);
      }
    }
  }
  return ids;
}
