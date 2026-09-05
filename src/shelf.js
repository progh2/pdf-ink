/**
 * 선반 (#267): 문서 사이를 오가는 임시 복사 보관함.
 *
 * 쪽 복사 클립은 「원본 PDF의 몇 쪽」을 가리켜서 다른 문서에 못 붙인다.
 * 선반은 내용을 **그림으로 굳혀** 두므로 어느 문서에서든 꺼내 쓴다.
 * 이 브라우저(IndexedDB)에만 있고 서버로 안 나간다. 7일 지나면 정리한다.
 */

export const SHELF_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SHELF_LIMIT = 60;

let seq = 0;

export function newShelfId(prefix = "s") {
  seq += 1;
  return `${prefix}:${Date.now().toString(36)}-${seq.toString(36)}`;
}

/**
 * 선반 항목 하나. kind는 "page"(쪽 그림+필기) 또는 "image"(그림 한 장).
 * thumb은 목록에 보일 작은 미리보기, src는 실제로 붙일 그림.
 */
export function shelfEntry({ kind, name, src, thumb, items = [], w = 1, h = 1, createdAt = Date.now(), id } = {}) {
  if ((kind !== "page" && kind !== "image") || typeof src !== "string" || !src) {
    return null;
  }
  return {
    id: id || newShelfId(kind === "page" ? "p" : "i"),
    kind,
    name: String(name || (kind === "page" ? "쪽" : "그림")),
    src,
    thumb: typeof thumb === "string" && thumb ? thumb : src,
    // 쪽이면 그때의 필기를 함께 — 붙일 때 새 쪽에 얹는다.
    items: Array.isArray(items) ? items : [],
    w: Number.isFinite(Number(w)) ? Number(w) : 1,
    h: Number.isFinite(Number(h)) ? Number(h) : 1,
    createdAt: Math.round(Number(createdAt) || Date.now()),
  };
}

/** 오래됐거나 넘치는 것을 걷어낸다. 최근 것이 앞. */
export function pruneShelf(list, now = Date.now(), ttl = SHELF_TTL_MS, limit = SHELF_LIMIT) {
  return (Array.isArray(list) ? list : [])
    .filter((one) => one?.id && one?.src && now - (Number(one.createdAt) || 0) < ttl)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit);
}

/** 남은 시간을 사람 말로: 「3일 남음」. 0이면 곧 지워짐. */
export function shelfRemainLabel(entry, now = Date.now(), ttl = SHELF_TTL_MS) {
  const left = ttl - (now - (Number(entry?.createdAt) || 0));
  const days = Math.floor(left / (24 * 60 * 60 * 1000));
  if (days >= 1) {
    return `${days}일 남음`;
  }
  const hours = Math.max(0, Math.floor(left / (60 * 60 * 1000)));
  return hours >= 1 ? `${hours}시간 남음` : "곧 지워짐";
}
