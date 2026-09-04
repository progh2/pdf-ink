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
