/**
 * 다른 문서에서 필기 옮기기 (#200).
 *
 * 같은 자료의 다른 판(굿노트로 한 번 거쳐 나온 것 같은)에는 같은 쪽이 다른
 * 자리에 있다. 쪽 번호로는 못 맞추므로 **쪽에 적힌 글자**로 알아본다.
 * 렌더가 필요 없어 수백 쪽도 금방 훑는다.
 */

/** 이보다 짧으면 그 글자로는 쪽을 가릴 수 없다(표지·간지). */
export const MATCH_MIN_CHARS = 8;
/** 지문은 앞부분만 쓴다. 뒤로 갈수록 판마다 달라지기 쉽다. */
export const MATCH_PRINT_CHARS = 400;

export function textFingerprint(text) {
  const clean = String(text ?? "")
    .replace(/\s+/g, "")
    .toLowerCase();
  return clean.length < MATCH_MIN_CHARS ? "" : clean.slice(0, MATCH_PRINT_CHARS);
}

/** 지문 → 그 지문을 가진 쪽들. */
export function fingerprintIndex(prints) {
  const index = new Map();
  for (const [page, print] of Object.entries(prints || {})) {
    if (!print) {
      continue;
    }
    const at = Number(page);
    index.set(print, [...(index.get(print) || []), at]);
  }
  for (const pages of index.values()) {
    pages.sort((a, b) => a - b);
  }
  return index;
}

/**
 * 같은 글자를 가진 쪽이 여럿이면 **자리가 비슷한 쪽**을 고른다. 판이 달라도
 * 앞뒤 순서는 대개 유지되기 때문이다.
 */
export function nearestByPosition(candidates, from, fromCount, toCount) {
  const list = candidates || [];
  if (list.length <= 1) {
    return list[0] ?? 0;
  }
  const ratio = (Number(from) - 1) / Math.max(1, (Number(fromCount) || 1) - 1);
  const want = 1 + ratio * Math.max(0, (Number(toCount) || 1) - 1);
  let best = list[0];
  for (const page of list) {
    if (Math.abs(page - want) < Math.abs(best - want)) {
      best = page;
    }
  }
  return best;
}

/**
 * 옮길 쪽만 맞춘다. `wanted`는 필기가 있는 쪽이라, 300쪽짜리라도 손댄 몇
 * 쪽만 본다.
 */
export function matchPages({ fromPrints, toPrints, wanted, fromCount, toCount } = {}) {
  const index = fingerprintIndex(toPrints);
  const pairs = [];
  const blank = [];
  const missing = [];
  for (const page of wanted || []) {
    const print = (fromPrints || {})[page] || "";
    if (!print) {
      blank.push(page);
      continue;
    }
    const found = index.get(print);
    if (!found?.length) {
      missing.push(page);
      continue;
    }
    pairs.push({
      from: page,
      to: nearestByPosition(found, page, fromCount || 1, toCount || 1),
      sure: found.length === 1,
    });
  }
  return { pairs, blank, missing };
}

export function matchSummary({ pairs = [], blank = [], missing = [] } = {}) {
  const sure = pairs.filter((pair) => pair.sure).length;
  const guessed = pairs.length - sure;
  const lost = blank.length + missing.length;
  const bits = [`${pairs.length}쪽을 찾았습니다`];
  if (guessed) {
    bits.push(`그중 ${guessed}쪽은 비슷한 쪽으로 짐작`);
  }
  if (lost) {
    bits.push(`${lost}쪽은 짝이 없습니다`);
  }
  return bits.join(" · ");
}

/* ---- 쪽 그림으로 견주기 (#202) ---------------------------------------- */

export const HASH_COLS = 9;
export const HASH_ROWS = 9;
/** 144비트 중 이만큼까지 달라도 같은 쪽으로 본다(약 15%). */
export const HASH_NEAR = 22;

/** RGBA 픽셀을 밝기 격자로 줄인다. 크기·해상도가 달라도 같은 격자가 나온다. */
export function grayGrid(data, width, height, cols = HASH_COLS, rows = HASH_ROWS) {
  const w = Math.max(1, Math.trunc(width));
  const h = Math.max(1, Math.trunc(height));
  const grid = new Array(cols * rows).fill(0);
  const counts = new Array(cols * rows).fill(0);
  for (let y = 0; y < h; y += 1) {
    const row = Math.min(rows - 1, Math.floor((y / h) * rows));
    for (let x = 0; x < w; x += 1) {
      const col = Math.min(cols - 1, Math.floor((x / w) * cols));
      const at = (y * w + x) * 4;
      const alpha = data[at + 3] / 255;
      // 투명한 곳은 흰 종이로 친다. 안 그러면 배경이 검게 잡힌다.
      const lum = (0.299 * data[at] + 0.587 * data[at + 1] + 0.114 * data[at + 2]) * alpha + 255 * (1 - alpha);
      grid[row * cols + col] += lum;
      counts[row * cols + col] += 1;
    }
  }
  return grid.map((sum, at) => (counts[at] ? sum / counts[at] : 255));
}

/**
 * 옆칸보다 밝은가 어두운가만 남긴다 — 전체 밝기가 달라도 흔들리지 않는다.
 * 가로만 보면 가로줄만 있는 쪽이 죄다 같은 지문이 되므로 세로도 함께 본다.
 */
export function dHash(grid, cols = HASH_COLS, rows = HASH_ROWS) {
  let bits = "";
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols - 1; col += 1) {
      bits += grid[row * cols + col] > grid[row * cols + col + 1] ? "1" : "0";
    }
  }
  for (let col = 0; col < cols; col += 1) {
    for (let row = 0; row < rows - 1; row += 1) {
      bits += grid[row * cols + col] > grid[(row + 1) * cols + col] ? "1" : "0";
    }
  }
  return bits;
}

export function bitsSet(bits) {
  let ones = 0;
  for (const bit of String(bits || "")) {
    if (bit === "1") {
      ones += 1;
    }
  }
  return ones;
}

/**
 * 얼마나 달라야 다른 쪽인가. 무늬가 적은 쪽(획이 몇 개뿐인 백지 같은)은
 * 지문에 1이 몇 개 없어서, 고정된 잣대로 재면 서로 남남인 쪽도 가깝게
 * 나온다. 그래서 **가진 무늬에 비례해** 좁힌다.
 */
export function nearLimit(a, b, near = HASH_NEAR) {
  const ones = bitsSet(a) + bitsSet(b);
  return Math.min(near, Math.max(4, Math.round(ones * 0.4)));
}

export function hamming(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (!left || !right || left.length !== right.length) {
    return Infinity;
  }
  let far = 0;
  for (let at = 0; at < left.length; at += 1) {
    if (left[at] !== right[at]) {
      far += 1;
    }
  }
  return far;
}

/** 지문이 텅 빈(온통 같은 밝기) 쪽은 아무 백지와도 닮았으므로 믿지 않는다. */
export function hashIsFlat(bits) {
  const ones = String(bits || "").split("").filter((bit) => bit === "1").length;
  const size = String(bits || "").length;
  return !size || ones < size * 0.06 || ones > size * 0.94;
}

/**
 * 가장 닮은 쪽을 고른다. 둘째로 닮은 쪽과 차이가 없으면 (반복되는 서식처럼)
 * **자리가 비슷한 쪽**으로 가른다.
 */
export function matchByHash({ fromHashes, toHashes, wanted, fromCount, toCount, near = HASH_NEAR } = {}) {
  const pairs = [];
  const missing = [];
  // 온통 같은 밝기인 쪽은 아무 백지와도 닮으므로 후보에서도 뺀다.
  const targets = Object.entries(toHashes || {})
    .map(([page, bits]) => ({ page: Number(page), bits }))
    .filter((target) => target.bits && !hashIsFlat(target.bits));
  for (const page of wanted || []) {
    const bits = (fromHashes || {})[page];
    if (!bits || hashIsFlat(bits)) {
      missing.push(page);
      continue;
    }
    let best = Infinity;
    let hits = [];
    for (const target of targets) {
      const far = hamming(bits, target.bits);
      if (far < best) {
        best = far;
        hits = [target.page];
      } else if (far === best) {
        hits.push(target.page);
      }
    }
    const to = hits.length ? nearestByPosition(hits, page, fromCount || 1, toCount || 1) : 0;
    const limit = to ? nearLimit(bits, (toHashes || {})[to], near) : 0;
    if (!to || best > limit) {
      missing.push(page);
      continue;
    }
    pairs.push({
      from: page,
      to,
      sure: hits.length === 1 && best <= limit / 3,
      far: best,
    });
  }
  return { pairs, blank: [], missing };
}

/** 글자로 찾은 것이 우선, 못 찾은 쪽만 그림으로 다시 본다. */
export function mergeMatches(byText, byImage) {
  const taken = new Set((byText?.pairs || []).map((pair) => pair.from));
  const extra = (byImage?.pairs || []).filter((pair) => !taken.has(pair.from));
  const found = new Set([...taken, ...extra.map((pair) => pair.from)]);
  const leftovers = [...(byText?.blank || []), ...(byText?.missing || [])].filter((page) => !found.has(page));
  return {
    pairs: [...(byText?.pairs || []), ...extra].sort((a, b) => a.from - b.from),
    blank: [],
    missing: [...new Set(leftovers)].sort((a, b) => a - b),
  };
}
