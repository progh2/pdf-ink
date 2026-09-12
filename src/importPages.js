/**
 * #425: 이미지·PDF를 **지금 보고 있는 쪽 바로 다음**에 쪽으로 끼운다.
 *
 * 문서 모델은 원본 PDF 쪽(`kind: "pdf"`)과 끼워 넣은 빈 쪽(`kind: "outline"`)
 * 두 가지다. 원본 버퍼 한가운데에 페이지를 끼우면 `pdfPage` 번호가 밀려
 * 기존 필기 키가 깨지므로, 가져온 쪽은 선반·필기 옮기기(#204·#267)와 같이
 * outline 잎 + 잠긴 그림으로 남긴다. 잎은 사이드카, 그림은 IndexedDB.
 */
import { acceptImageFile } from "./image.js";
import { inkKey, makeOutlineLeaf } from "./preview.js";
import { MAX_PDF_BYTES } from "./validate.js";

/** 갤러리·파일 앱이 이미지와 PDF를 같이 보여 주게. capture는 안 붙인다 — 붙이면 카메라만 뜬다. */
export const IMPORT_ACCEPT =
  "image/jpeg,image/png,image/webp,image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp";
export const IMPORT_MORE = "importpages";
export const IMPORT_LABEL = "페이지 추가·가져오기";
export const IMPORT_PREVIEW_LABEL = "페이지 가져오기";

let seq = 0;

export function importedLeafId(prefix = "imp") {
  seq += 1;
  return `o:${prefix}-${Date.now().toString(36)}-${seq}`;
}

function looksLikePdf(file) {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return type === "application/pdf" || type === "application/x-pdf" || name.endsWith(".pdf");
}

/**
 * 고른 파일이 이미지인지 PDF인지. 폰 픽커는 type이 비거나 확장자가 없을 수
 * 있어서, PDF는 type·이름 둘 중 하나만 맞아도 인정한다.
 */
export function classifyImportFile(file) {
  if (!file) {
    return { kind: "reject", message: "파일을 선택해 주세요." };
  }
  if (file.size === 0) {
    return { kind: "reject", message: "빈 파일은 열 수 없습니다." };
  }
  if (looksLikePdf(file)) {
    if (file.size > MAX_PDF_BYTES) {
      return { kind: "reject", message: "파일이 너무 큽니다. 20MB 이하만 올릴 수 있습니다." };
    }
    return { kind: "pdf" };
  }
  const image = acceptImageFile(file);
  if (image.ok) {
    return { kind: "image" };
  }
  return { kind: "reject", message: image.message || "이미지 또는 PDF만 넣을 수 있습니다." };
}

/**
 * `index`(0부터, 지금 쪽) 바로 뒤에 spec 순서대로 outline 잎을 끼운다.
 * 기존 잎의 ink 키는 그대로 — 필기가 따라가지 않는다.
 */
export function insertImportedAfter(leaves, pages, index, specs) {
  const list = (leaves || []).slice();
  const nextPages = { ...(pages || {}) };
  const items = (specs || []).filter((spec) => spec && spec.id);
  if (!items.length) {
    return { leaves: list, pages: nextPages, firstAt: -1, count: 0 };
  }
  let at = Math.min(Math.max(0, Number(index) + 1), list.length);
  const firstAt = at;
  for (const spec of items) {
    const leaf = makeOutlineLeaf(spec.id, { title: spec.title || "가져온 쪽" });
    list.splice(at, 0, leaf);
    nextPages[inkKey(leaf)] = Array.isArray(spec.items) ? spec.items.slice() : [];
    at += 1;
  }
  return { leaves: list, pages: nextPages, firstAt, count: items.length };
}
