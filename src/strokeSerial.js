/**
 * #463: 필기 저장 기록을 쪽 단위로 캐시해 직렬화한다.
 *
 * 저장할 때마다 문서의 모든 쪽을 JSON.stringify하면 잉크가 쌓일수록 한 번의
 * 저장이 수백 ms가 된다(#460 측정: 300획 한 쪽만으로 20획당 181ms). 획 하나를
 * 더했는데 안 바뀐 쪽 수십 장을 다시 글자로 만드는 일이다. 여기서는 쪽마다
 * 만든 문자열을 두고, 같은 배열(참조)·같은 길이·같은 지문이면 그대로 쓴다.
 *
 * 결과는 `JSON.stringify(record)`와 **한 글자도 다르지 않다** — 읽는 쪽은
 * 그대로다. 열쇠 순서도 같다: version, identity, pages, leaves, leavesVersion,
 * outline, gone, savedAt.
 */

/**
 * 값싼 지문. 점 하나하나는 보지 않고 항목 수·종류·점 개수·자리·크기·회전·잠금만
 * 본다. 앱의 모든 변경은 배열을 새로 만들지만(참조가 바뀐다), 혹시 제자리에서
 * 고친 것이 있어도 흔한 속성은 여기서 걸린다.
 */
export function pageFingerprint(items) {
  let hash = 0x811c9dc5;
  const mix = (value) => {
    const n = typeof value === "number" ? Math.round(value * 1e6) : typeof value === "string" ? value.length * 31 + value.charCodeAt(0) : value ? 1 : 0;
    hash ^= n & 0xffffffff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  };
  for (const item of items || []) {
    if (!item) {
      mix(0);
      continue;
    }
    mix(item.type || "");
    mix(item.points ? item.points.length : -1);
    mix(item.x || 0);
    mix(item.y || 0);
    mix(item.w || 0);
    mix(item.h || 0);
    mix(item.rotate || 0);
    mix(item.width || 0);
    mix(item.color || "");
    mix(Boolean(item.locked));
    mix(item.id || "");
    if (item.crop) {
      mix(item.crop.x || 0);
      mix(item.crop.y || 0);
      mix(item.crop.w || 0);
      mix(item.crop.h || 0);
    }
  }
  return hash;
}

export function createPageJsonCache() {
  const entries = new Map();
  const stats = { hits: 0, misses: 0 };
  return {
    stats,
    pageJson(key, items) {
      const list = Array.isArray(items) ? items : [];
      const fp = pageFingerprint(list);
      const had = entries.get(key);
      if (had && had.ref === items && had.len === list.length && had.fp === fp) {
        stats.hits += 1;
        return had.json;
      }
      stats.misses += 1;
      const json = JSON.stringify(list);
      entries.set(key, { ref: items, len: list.length, fp, json });
      return json;
    },
    /** 쪽이 없어졌으면 그 캐시도 버린다 — 열쇠가 다시 쓰일 때 옛 글자를 주지 않게. */
    keep(keys) {
      for (const key of [...entries.keys()]) {
        if (!keys.has(key)) {
          entries.delete(key);
        }
      }
    },
    clear() {
      entries.clear();
    },
    get size() {
      return entries.size;
    },
  };
}

/**
 * `JSON.stringify(record)`와 같은 문자열을 쪽 캐시를 써서 만든다.
 * record.pages의 값이 배열이 아니면 JSON.stringify가 하듯 그대로 글자로 만든다.
 */
export function serializeStrokeRecord(record, cache) {
  const parts = [];
  const put = (key, value) => {
    if (value === undefined) {
      return;
    }
    parts.push(`${JSON.stringify(key)}:${value}`);
  };
  put("version", JSON.stringify(record.version));
  put("identity", JSON.stringify(record.identity));
  const pages = record.pages && typeof record.pages === "object" ? record.pages : {};
  const pageParts = [];
  const seen = new Set();
  for (const [key, items] of Object.entries(pages)) {
    if (items === undefined) {
      continue;
    }
    seen.add(key);
    const json = cache && Array.isArray(items) ? cache.pageJson(key, items) : JSON.stringify(items);
    pageParts.push(`${JSON.stringify(key)}:${json}`);
  }
  cache?.keep(seen);
  put("pages", `{${pageParts.join(",")}}`);
  if (record.leaves !== undefined) {
    put("leaves", JSON.stringify(record.leaves));
  }
  if (record.leavesVersion !== undefined) {
    put("leavesVersion", JSON.stringify(record.leavesVersion));
  }
  if (record.outline !== undefined) {
    put("outline", JSON.stringify(record.outline));
  }
  if (record.gone !== undefined) {
    put("gone", JSON.stringify(record.gone));
  }
  put("savedAt", JSON.stringify(record.savedAt));
  return `{${parts.join(",")}}`;
}
