/**
 * 바깥에서 복사해 온 것 붙여넣기 (#219).
 *
 * 굿노트 웹은 고른 필기를 **그림으로** 시스템 클립보드에 올린다. 그래서
 * 우리도 클립보드에서 그림을 찾아 이미지 항목으로 놓는다. 읽기는 사용자
 * 동작(홀드로 연 메뉴) 안에서만 하고, 거절당하면 조용히 없는 셈 친다.
 */

/** 바로 그릴 수 있는 그림. */
export const PASTE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
/**
 * 굿노트 웹은 **그림을 복사하면 PNG**를 주지만, **필기를 골라 복사하면
 * 벡터(SVG)나 그 SVG를 담은 HTML 조각**을 준다 (#224). 그래서 이 둘도 받되
 * 문서로 실행하지 않고 `<img>`로만 읽어 캔버스에 굽는다 — 브라우저는 `<img>`
 * 안의 SVG에서 스크립트를 돌리지 않는다. 우리 종이에 남는 것은 PNG뿐이다.
 */
export const PASTE_DRAWABLE_TYPES = [...PASTE_IMAGE_TYPES, "image/svg+xml", "text/html"];

export function pickImageType(types, allowed = PASTE_DRAWABLE_TYPES) {
  return (types || []).find((type) => allowed.includes(String(type).toLowerCase())) || "";
}

/** 클립보드 항목들 중 그릴 수 있는 첫 번째. 바로 그릴 수 있는 것이 먼저다. */
export function findImageEntry(entries) {
  for (const only of [PASTE_IMAGE_TYPES, PASTE_DRAWABLE_TYPES]) {
    for (const entry of entries || []) {
      const type = pickImageType(entry?.types, only);
      if (type) {
        return { entry, type };
      }
    }
  }
  return null;
}

/** HTML 조각에서 그림 주소를 뽑는다. 굿노트가 `<img src="data:...">`로 줄 때. */
export function imageSrcFromHtml(html) {
  const text = String(html || "");
  const tag = text.match(/<img\b[^>]*>/i)?.[0] || "";
  const src = tag.match(/\ssrc\s*=\s*"([^"]+)"/i)?.[1] || tag.match(/\ssrc\s*=\s*'([^']+)'/i)?.[1] || "";
  return /^(data:image\/|blob:|https?:)/i.test(src) ? src : "";
}

/** SVG 원문을 `<img>`가 읽을 수 있는 데이터 URL로. 실행이 아니라 그리기다. */
export function svgDataUrl(svgText) {
  const text = String(svgText || "");
  if (!/<svg[\s>]/i.test(text)) {
    return "";
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
}

/** 무엇이 들어 있었는지 사람에게 보여 줄 한 줄 — 안 될 때 원인을 알려면 필요하다. */
export function describeClipboard(entries) {
  const types = [...new Set((entries || []).flatMap((entry) => entry?.types || []))];
  return types.length ? types.join(", ") : "빈 클립보드";
}

/**
 * 붙여넣을 것이 있나. 내 것(앱 안에서 복사한 항목)이 먼저고, 없으면 시스템
 * 클립보드에 그림이 있는지 본다. 못 읽으면 `false` — 있다고 속이지 않는다.
 */
export async function pasteAvailability(inkClipboard, clipboard) {
  if ((inkClipboard || []).length) {
    return { ready: true, source: "ink" };
  }
  if (!clipboard || typeof clipboard.read !== "function") {
    return { ready: false, source: "" };
  }
  try {
    const found = findImageEntry(await clipboard.read());
    return found ? { ready: true, source: found.type } : { ready: false, source: "" };
  } catch {
    // 권한 거절·미지원: 모르는 것은 없는 것으로 둔다.
    return { ready: false, source: "" };
  }
}

/**
 * 클립보드에서 그릴 것을 꺼낸다. PNG면 그대로, SVG·HTML이면 `<img>`가 읽을
 * 수 있는 주소로 바꿔서. 못 찾으면 **무엇이 들어 있었는지** 함께 돌려준다.
 */
export async function readClipboardImage(clipboard, toDataUrl, toText = null) {
  if (!clipboard || typeof clipboard.read !== "function") {
    return { src: "", saw: "" };
  }
  let entries = [];
  try {
    entries = await clipboard.read();
  } catch {
    return { src: "", saw: "" };
  }
  const saw = describeClipboard(entries);
  const found = findImageEntry(entries);
  if (!found) {
    return { src: "", saw };
  }
  try {
    const blob = await found.entry.getType(found.type);
    if (found.type === "text/html" || found.type === "image/svg+xml") {
      const text = toText ? await toText(blob) : "";
      const src = found.type === "text/html" ? imageSrcFromHtml(text) : svgDataUrl(text);
      // HTML 안에 든 것이 또 SVG 원문일 수도 있다.
      return { src: src || svgDataUrl(text), saw };
    }
    return { src: await toDataUrl(blob), saw };
  } catch {
    return { src: "", saw };
  }
}

/** 붙여넣은 그림이 놓일 자리: 누른 곳이 가운데, 종이 밖으로는 안 나가게. */
export function pastePlacement(at, size) {
  const w = Math.min(1, Math.max(0.04, Number(size?.w) || 0.4));
  const h = Math.min(1, Math.max(0.04, Number(size?.h) || 0.3));
  const x = Number.isFinite(Number(at?.x)) ? Number(at.x) - w / 2 : 0.25;
  const y = Number.isFinite(Number(at?.y)) ? Number(at.y) - h / 2 : 0.22;
  return {
    x: Math.min(1 - w, Math.max(0, x)),
    y: Math.min(1 - h, Math.max(0, y)),
    w,
    h,
  };
}


/* ---- 네이티브 paste 이벤트 (#226) -------------------------------------- */

/**
 * `navigator.clipboard.read()`는 크롬에서 **몇 가지 형식만** 내준다
 * (text/plain·text/html·image/png 정도). 그래서 굿노트가 필기를 벡터나 제
 * 형식으로 올려도 우리 눈에는 `text/plain`만 보였다.
 *
 * 진짜 `paste` 이벤트의 `clipboardData`는 원본 앱이 넣은 것을 **그대로**
 * 들고 있다. 붙여넣기의 본길은 이쪽이고, 메뉴에서 부르는 비동기 읽기는
 * 그럴 수 없을 때의 뒷길이다.
 */
export function pasteTypesOf(dataTransfer) {
  const types = [...(dataTransfer?.types || [])];
  for (const item of dataTransfer?.items || []) {
    if (item?.type && !types.includes(item.type)) {
      types.push(item.type);
    }
  }
  for (const file of dataTransfer?.files || []) {
    if (file?.type && !types.includes(file.type)) {
      types.push(file.type);
    }
  }
  return types;
}

/** 붙일 그림을 든 파일. 굿노트가 파일로 줄 때도 있다. */
export function imageFileOf(dataTransfer) {
  for (const file of dataTransfer?.files || []) {
    if (PASTE_IMAGE_TYPES.includes(String(file?.type || "").toLowerCase())) {
      return file;
    }
  }
  for (const item of dataTransfer?.items || []) {
    if (item?.kind === "file" && PASTE_DRAWABLE_TYPES.includes(String(item.type || "").toLowerCase())) {
      const file = typeof item.getAsFile === "function" ? item.getAsFile() : null;
      if (file) {
        return file;
      }
    }
  }
  return null;
}

/**
 * 이벤트 하나에서 그릴 것을 찾는다. 파일 → 그림 형식 → HTML 조각 → 벡터 순.
 * 못 찾으면 무엇이 있었는지 함께 돌려준다.
 */
export function readPasteEvent(dataTransfer) {
  const saw = pasteTypesOf(dataTransfer).join(", ") || "빈 클립보드";
  const file = imageFileOf(dataTransfer);
  if (file) {
    return { file, src: "", saw };
  }
  const get = (type) => (typeof dataTransfer?.getData === "function" ? dataTransfer.getData(type) || "" : "");
  const html = get("text/html");
  const fromHtml = html ? imageSrcFromHtml(html) || svgDataUrl(html) : "";
  if (fromHtml) {
    return { file: null, src: fromHtml, saw };
  }
  const svg = get("image/svg+xml") || get("text/plain");
  const fromSvg = svgDataUrl(svg);
  if (fromSvg) {
    return { file: null, src: fromSvg, saw };
  }
  return { file: null, src: "", saw, text: get("text/plain").slice(0, 80) };
}
