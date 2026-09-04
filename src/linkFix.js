/**
 * 링크 고치기 (#190).
 *
 * 어떤 PDF는 안쪽 링크의 목적지가 파일 안에서 이미 끊겨 있다(굿노트 export
 * 처럼). 그런 링크는 아무리 잘 읽어도 갈 곳을 알 수 없으므로, 읽는 사람이
 * 직접 「이건 몇 쪽」이라고 정해 준다. 고친 내용은 PDF를 건드리지 않고
 * 필기와 같은 사이드카에 담겨 다른 기기까지 따라간다.
 */

/** 한 링크를 그 자리로 집는 열쇠: 그 쪽의, 그 사각형. */
export function linkSpotKey(pdfPage, rect) {
  const page = Math.trunc(Number(pdfPage)) || 0;
  const box = Array.isArray(rect) ? rect.map((value) => Math.round(Number(value) || 0)) : [];
  return `${page}@${box.join(",")}`;
}

/**
 * 같은 곳을 가리키는 링크끼리 묶는 열쇠. 「일괄 수정」은 이 열쇠가 같은
 * 링크를 전부 함께 고친다 — 문서에서 한 군데를 가리키는 링크는 대개 여러
 * 쪽에 흩어져 있기 때문이다.
 */
export function linkGroupKey(target) {
  if (target?.kind === "url") {
    return `url:${target.href}`;
  }
  if (target?.kind === "action") {
    return `action:${target.action}`;
  }
  if (target?.kind !== "dest") {
    return "";
  }
  let dest;
  try {
    dest = typeof target.dest === "string" ? target.dest : JSON.stringify(target.dest);
  } catch {
    dest = String(target.dest);
  }
  return `dest:${dest}`;
}

export function normalizeLinkFix(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  if (raw.kind === "leaf") {
    const leafId = String(raw.leafId ?? "").trim();
    return leafId ? { kind: "leaf", leafId } : null;
  }
  if (raw.kind === "page") {
    const page = Math.trunc(Number(raw.page));
    return Number.isFinite(page) && page >= 1 ? { kind: "page", page } : null;
  }
  if (raw.kind === "url") {
    const href = String(raw.href ?? "").trim();
    if (!href) {
      return null;
    }
    try {
      const url = new URL(href);
      return ["http:", "https:", "mailto:"].includes(url.protocol) ? { kind: "url", href: url.href } : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** 한 자리만 고친 것이 같은 무리를 통째로 고친 것보다 앞선다. */
export function findLinkFix(fixes, spotKey, groupKey) {
  const map = fixes || {};
  return normalizeLinkFix(map[spotKey]) || normalizeLinkFix(map[groupKey]) || null;
}

export function setLinkFix(fixes, { spotKey, groupKey, bulk = false, fix } = {}) {
  const next = { ...(fixes || {}) };
  const clean = normalizeLinkFix(fix);
  const key = bulk ? groupKey : spotKey;
  if (!key) {
    return next;
  }
  if (!clean) {
    delete next[key];
    return next;
  }
  if (bulk) {
    // 무리째 고치면 그 안에 남아 있던 한 자리짜리 예외는 뜻을 잃는다.
    delete next[spotKey];
  }
  next[key] = clean;
  return next;
}

export function clearLinkFix(fixes, { spotKey, groupKey, bulk = false } = {}) {
  const next = { ...(fixes || {}) };
  delete next[spotKey];
  if (bulk) {
    delete next[groupKey];
  }
  return next;
}

export function countLinkFixes(fixes) {
  return Object.keys(fixes || {}).length;
}

/** 사이드카에서 온 것은 믿지 않고 한 번 훑는다. */
export function sanitizeLinkFixes(raw) {
  const out = {};
  for (const [key, value] of Object.entries(raw || {})) {
    const clean = normalizeLinkFix(value);
    if (key && clean) {
      out[key] = clean;
    }
  }
  return out;
}

/**
 * 「몇 쪽」이 아니라 **그 쪽 자체**를 붙든다 (#194).
 *
 * 자리 번호로 적어 두면 중간에 한 장을 끼우는 순간 그 뒤 링크가 전부 한
 * 칸씩 어긋난다. 목차(#53)가 이미 같은 이유로 잎 아이디를 쓴다. 여기도
 * 같게 맞춘다 — 쪽을 옮기거나 끼워도 링크는 원래 그 종이를 따라간다.
 */
export function linkFixForPage(page, leaves) {
  const at = Math.trunc(Number(page));
  if (!Number.isFinite(at) || at < 1) {
    return null;
  }
  const leaf = (leaves || [])[at - 1];
  return leaf?.id ? { kind: "leaf", leafId: String(leaf.id) } : { kind: "page", page: at };
}

/** 그 잎이 지금 몇 번째 자리에 있나. 지워졌으면 0. */
export function positionOfLeafId(leaves, leafId) {
  const at = (leaves || []).findIndex((leaf) => leaf?.id === leafId);
  return at < 0 ? 0 : at + 1;
}

/** 고친 링크를 따라갈 때 쓸 목표. */
export function linkFixTarget(fix, leaves = null) {
  if (fix?.kind === "leaf") {
    const at = positionOfLeafId(leaves, fix.leafId);
    return at ? { kind: "fixedPage", page: at } : { kind: "goneLeaf" };
  }
  if (fix?.kind === "page") {
    return { kind: "fixedPage", page: fix.page };
  }
  if (fix?.kind === "url") {
    return { kind: "url", href: fix.href };
  }
  return null;
}

/**
 * 예전에 자리 번호로 저장해 둔 것을 그 자리의 잎에 붙여 준다. 문서를 열 때
 * 한 번 돌면 그 뒤로는 쪽을 끼워도 안 흔들린다.
 */
export function anchorLinkFixes(fixes, leaves) {
  const out = {};
  let changed = false;
  for (const [key, value] of Object.entries(fixes || {})) {
    const fix = normalizeLinkFix(value);
    if (!fix) {
      changed = true;
      continue;
    }
    if (fix.kind !== "page") {
      out[key] = fix;
      continue;
    }
    const anchored = linkFixForPage(fix.page, leaves);
    out[key] = anchored || fix;
    if (anchored?.kind === "leaf") {
      changed = true;
    }
  }
  return { fixes: out, changed };
}
