/** 영역 연결 (#72). #71 유지 영역에 붙는 링크만 다룬다. */

export function acceptAreaUrl(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.href;
  } catch {
    return "";
  }
}

export function clampPageTarget(page, pageCount) {
  const n = Math.trunc(Number(page));
  const max = Math.max(1, Math.trunc(Number(pageCount)) || 1);
  if (!Number.isFinite(n)) return 1;
  return Math.min(max, Math.max(1, n));
}

export function normalizeAreaLink(raw) {
  if (!raw || typeof raw !== "object") return null;
  const kind = String(raw.kind ?? "");
  if (kind === "page") {
    const page = Math.trunc(Number(raw.page));
    if (!Number.isFinite(page) || page < 1) return null;
    // #194: 자리 번호는 중간에 한 장만 끼워도 어긋난다. 잎을 함께 적어 두고,
    // 열 때 그 잎이 지금 있는 자리를 쓴다. 옛 항목은 번호만 있어도 그대로 돈다.
    const leafId = String(raw.leafId ?? "").trim();
    return leafId ? { kind: "page", page, leafId } : { kind: "page", page };
  }
  if (kind === "doc") {
    const name = String(raw.name ?? "").trim();
    if (!name) return null;
    const identity = raw.identity != null && raw.identity !== "" ? raw.identity : undefined;
    return identity ? { kind: "doc", name, identity } : { kind: "doc", name };
  }
  if (kind === "url") {
    const href = acceptAreaUrl(raw.href);
    if (!href) return null;
    return { kind: "url", href };
  }
  return null;
}

export function areaItem(rect, link) {
  const x = Number(rect?.x);
  const y = Number(rect?.y);
  const w = Number(rect?.w);
  const h = Number(rect?.h);
  const normalized = normalizeAreaLink(link);
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0 || !normalized) return null;
  return { type: "area", x, y, w, h, link: normalized };
}

export function areaLinkOf(item) {
  return item?.type === "area" ? normalizeAreaLink(item.link) : normalizeAreaLink(item?.link);
}

export function hasAreaLink(item) {
  return !!areaLinkOf(item);
}

export function pickAreaAt(items, x, y) {
  const px = Number(x);
  const py = Number(y);
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
  const list = (items ?? []).filter((it) => it?.type === "area" && hasAreaLink(it));
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const it = list[i];
    if (px >= it.x && px <= it.x + it.w && py >= it.y && py <= it.h + it.y) return it;
  }
  return null;
}

export function recentDocsForLink(list, currentName, limit = 8) {
  const seen = new Set();
  const cur = String(currentName ?? "").trim();
  const out = [];
  for (const row of list ?? []) {
    const name = String(row?.name ?? "").trim();
    if (!name || name === cur || seen.has(name)) continue;
    seen.add(name);
    const identity = row.identity != null && row.identity !== "" ? row.identity : undefined;
    out.push(identity ? { name, at: Number(row.at) || 0, identity } : { name, at: Number(row.at) || 0 });
    if (out.length >= limit) break;
  }
  return out;
}

/** 영역 연결이 가리키는 쪽. 잎을 적어 두었으면 그 잎이 지금 있는 자리 (#194). */
export function areaLinkPage(link, leaves) {
  if (link?.kind !== "page") {
    return 0;
  }
  if (link.leafId) {
    const at = (leaves || []).findIndex((leaf) => leaf?.id === link.leafId);
    if (at >= 0) {
      return at + 1;
    }
  }
  return Math.max(0, Math.trunc(Number(link.page)) || 0);
}
