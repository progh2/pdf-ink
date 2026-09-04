/**
 * PDF 안에 원래 들어 있는 링크 (#178).
 *
 * 사용자가 그린 영역 연결(areaLink.js)과 다른 것이다. 이쪽은 파일이 들고
 * 온 것이라 고치거나 지울 수 없고, 목차·각주처럼 **문서 안 다른 쪽**을
 * 가리키는 경우가 대부분이다.
 */

/** 열어 줄 주소 종류. javascript: 같은 것은 PDF가 시켜도 따르지 않는다. */
export const LINK_SCHEMES = ["http:", "https:", "mailto:"];

/** 이 아래로 작은 상자는 무시한다(도장 자국 같은 빈 링크). */
export const LINK_MIN_NORM = 0.002;

export function acceptLinkUrl(raw) {
  const text = String(raw ?? "").trim();
  if (!text) {
    return "";
  }
  try {
    const url = new URL(text);
    return LINK_SCHEMES.includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

/**
 * 주석 하나가 무엇을 가리키는지. 쪽 번호는 여기서 못 정한다 —
 * 이름 붙은 목적지는 문서에 물어봐야 알 수 있어서 `dest`로 넘긴다.
 */
export function pdfLinkTarget(annotation) {
  if (!annotation || annotation.subtype !== "Link") {
    return null;
  }
  const href = acceptLinkUrl(annotation.url);
  if (href) {
    return { kind: "url", href };
  }
  if (annotation.dest !== null && annotation.dest !== undefined && annotation.dest !== "") {
    return { kind: "dest", dest: annotation.dest };
  }
  const action = String(annotation.action || "");
  if (["NextPage", "PrevPage", "FirstPage", "LastPage"].includes(action)) {
    return { kind: "action", action };
  }
  return null;
}

/** 뷰포트 좌표 상자를 0~1로. 뒤집혀 오는 경우가 있어 정렬한다. */
export function normalizedLinkRect(rect, width, height) {
  const list = Array.isArray(rect) ? rect.map(Number) : [];
  const w = Number(width);
  const h = Number(height);
  if (list.length < 4 || !list.every(Number.isFinite) || !(w > 0) || !(h > 0)) {
    return null;
  }
  const left = Math.min(list[0], list[2]) / w;
  const right = Math.max(list[0], list[2]) / w;
  const top = Math.min(list[1], list[3]) / h;
  const bottom = Math.max(list[1], list[3]) / h;
  const x = Math.min(1, Math.max(0, left));
  const y = Math.min(1, Math.max(0, top));
  const box = {
    x,
    y,
    w: Math.min(1, Math.max(0, right)) - x,
    h: Math.min(1, Math.max(0, bottom)) - y,
  };
  if (box.w < LINK_MIN_NORM || box.h < LINK_MIN_NORM) {
    return null;
  }
  return box;
}

/**
 * 같은 PDF 쪽이 문서에 여러 번 있을 수 있고(복제), 순서도 바뀐다.
 * 링크는 **지금 문서에서 그 쪽이 놓인 자리**로 보내야 한다.
 */
export function leafPositionForPdfPage(leaves, pdfPage) {
  const target = Math.trunc(Number(pdfPage));
  if (!Number.isFinite(target) || target < 1) {
    return 0;
  }
  const at = (leaves || []).findIndex((leaf) => leaf?.kind !== "outline" && Number(leaf?.pdfPage) === target);
  return at < 0 ? 0 : at + 1;
}

/** 문서 앞뒤로 움직이는 링크가 갈 자리. */
export function pagePositionForAction(action, page, pageCount) {
  const now = Math.trunc(Number(page)) || 1;
  const count = Math.max(1, Math.trunc(Number(pageCount)) || 1);
  const clamp = (value) => Math.min(count, Math.max(1, value));
  if (action === "NextPage") {
    return clamp(now + 1);
  }
  if (action === "PrevPage") {
    return clamp(now - 1);
  }
  if (action === "FirstPage") {
    return 1;
  }
  if (action === "LastPage") {
    return count;
  }
  return 0;
}

export function pdfLinkItem(box, target) {
  if (!box || !target) {
    return null;
  }
  return { x: box.x, y: box.y, w: box.w, h: box.h, link: target };
}

/** 캐시 키: 우리가 쪽을 돌리면 상자도 돌아간다. */
export function pdfLinkCacheKey(pdfPage, rotate) {
  return `${Math.trunc(Number(pdfPage)) || 0}:${Math.trunc(Number(rotate)) || 0}`;
}

/**
 * What a destination's first entry points at (#186).
 *
 * Normally it is an indirect reference to a page object, and pdf.js turns that
 * into a page number for us. But the format also allows a **plain page index**,
 * and some writers use it — `pdf.getPageIndex()` refuses those ("Invalid
 * pageIndex request"), which is how a whole document's inside links went dead
 * while its web links were fine.
 */
export function destTarget(explicit) {
  const first = Array.isArray(explicit) ? explicit[0] : null;
  if (Number.isInteger(first)) {
    // Zero-based in the file, one-based everywhere in this app.
    return { kind: "index", page: first + 1 };
  }
  if (first && typeof first === "object") {
    return { kind: "ref", ref: first };
  }
  return null;
}

/**
 * How a destination wants the page shown (`/XYZ x y zoom`, `/Fit`, …).
 * Kept so a rewritten link lands on the same spot, not just the same page.
 */
export function destView(explicit) {
  const rest = Array.isArray(explicit) ? explicit.slice(1) : [];
  const first = rest[0];
  const name = typeof first === "string" ? first : first?.name;
  if (typeof name !== "string" || !name) {
    return ["Fit"];
  }
  return [name, ...rest.slice(1).map((value) => (Number.isFinite(Number(value)) && value !== null ? Number(value) : null))];
}

/** A rectangle in the page's own coordinates, as the file wrote it. */
export function pdfSpaceRect(rect) {
  const list = Array.isArray(rect) ? rect.map(Number) : [];
  if (list.length < 4 || !list.every(Number.isFinite)) {
    return null;
  }
  const box = [Math.min(list[0], list[2]), Math.min(list[1], list[3]), Math.max(list[0], list[2]), Math.max(list[1], list[3])];
  return box[2] - box[0] > 0 && box[3] - box[1] > 0 ? box : null;
}
