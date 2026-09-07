/**
 * 여러 기기의 필기 합치기 (#83 1단계).
 *
 * 사이드카는 지금까지 「더 최근 저장」이 통째로 이겼다(pickNewer). 두 기기가
 * 서로 다른 쪽에 필기하면 한쪽이 날아간다. 이제 필기는 **항목 단위로
 * 합집합**이고, 지운 것만 무덤(tombstone)으로 남겨 부활을 막는다.
 * 서버는 여전히 없다 — 합치는 곳은 각자의 브라우저다.
 */

let seq = 0;

/** 새 항목의 이름표. 같은 획을 두 번 그려도 서로 다른 항목이도록. */
export function newItemId(prefix = "s") {
  seq += 1;
  return `${prefix}:${Date.now().toString(36)}-${seq.toString(36)}-${Math.trunc(Math.random() * 1296).toString(36)}`;
}

/** 이름표가 없는 옛 항목은 내용 지문으로 대신한다. 양쪽 다 같은 코드로 만든 JSON이라 지문도 같다. */
export function itemKey(item) {
  if (item?.id) {
    return String(item.id);
  }
  let text;
  try {
    text = JSON.stringify(item);
  } catch {
    text = String(item);
  }
  let hash = 0x811c9dc5;
  for (let at = 0; at < text.length; at += 1) {
    hash ^= text.charCodeAt(at);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `h:${hash.toString(36)}:${text.length}`;
}

/**
 * 한 번의 편집이 지운 항목을 무덤에 적는다. 같은 항목이 되살아나면(되돌리기)
 * 무덤에서 지운다 — 안 그러면 다음 병합이 그 항목을 도로 죽인다.
 */
export function goneAfterChange(before, after, gone = {}, at = Date.now()) {
  const kept = new Set((after || []).map(itemKey));
  const next = { ...gone };
  for (const item of before || []) {
    const key = itemKey(item);
    if (!kept.has(key)) {
      next[key] = at;
    }
  }
  for (const key of kept) {
    delete next[key];
  }
  return next;
}

/** 무덤은 양쪽 합집합, 최근 것 위주로 자른다. */
export const GONE_LIMIT = 600;

export function mergeGone(local = {}, remote = {}, limit = GONE_LIMIT) {
  const merged = { ...remote, ...local };
  for (const [key, at] of Object.entries(remote || {})) {
    if (merged[key] < at) {
      merged[key] = at;
    }
  }
  const entries = Object.entries(merged).sort((a, b) => b[1] - a[1]).slice(0, limit);
  return Object.fromEntries(entries);
}

export function sanitizeGone(raw) {
  const out = {};
  for (const [key, at] of Object.entries(raw || {})) {
    const time = Math.round(Number(at));
    if (key && Number.isFinite(time) && time > 0) {
      out[key] = time;
    }
  }
  return out;
}

/** 한 쪽의 항목 합집합: 내 순서 그대로, 남의 것만 뒤에 — 무덤에 든 것은 어느 쪽이든 뺀다. */
export function mergePageItems(local = [], remote = [], gone = {}) {
  const out = [];
  const seen = new Set();
  for (const item of local) {
    const key = itemKey(item);
    if (gone[key] || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  for (const item of remote) {
    const key = itemKey(item);
    if (gone[key] || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function mergePages(localPages = {}, remotePages = {}, gone = {}) {
  const out = {};
  for (const key of new Set([...Object.keys(localPages), ...Object.keys(remotePages)])) {
    const merged = mergePageItems(localPages[key], remotePages[key], gone);
    if (merged.length) {
      out[key] = merged;
    }
  }
  return out;
}

/** 병합이 실제로 더할 항목 수 — 0이면 다시 그릴 일도, 알릴 일도 없다. */
export function countNewFrom(remotePages = {}, localPages = {}, gone = {}) {
  let added = 0;
  for (const [page, items] of Object.entries(remotePages)) {
    const mine = new Set((localPages[page] || []).map(itemKey));
    for (const item of items || []) {
      const key = itemKey(item);
      if (!mine.has(key) && !gone[key]) {
        added += 1;
      }
    }
  }
  return added;
}
