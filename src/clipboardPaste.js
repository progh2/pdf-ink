/**
 * 바깥에서 복사해 온 것 붙여넣기 (#219).
 *
 * 굿노트 웹은 고른 필기를 **그림으로** 시스템 클립보드에 올린다. 그래서
 * 우리도 클립보드에서 그림을 찾아 이미지 항목으로 놓는다. 읽기는 사용자
 * 동작(홀드로 연 메뉴) 안에서만 하고, 거절당하면 조용히 없는 셈 친다.
 */

/** 우리가 받아들이는 그림 종류. SVG는 코드가 실릴 수 있어 뺀다(#25와 같은 이유). */
export const PASTE_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function pickImageType(types) {
  return (types || []).find((type) => PASTE_IMAGE_TYPES.includes(String(type).toLowerCase())) || "";
}

/** 클립보드 항목들 중 그림을 든 첫 번째. 없으면 null. */
export function findImageEntry(entries) {
  for (const entry of entries || []) {
    const type = pickImageType(entry?.types);
    if (type) {
      return { entry, type };
    }
  }
  return null;
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
    return found ? { ready: true, source: "image" } : { ready: false, source: "" };
  } catch {
    // 권한 거절·미지원: 모르는 것은 없는 것으로 둔다.
    return { ready: false, source: "" };
  }
}

/** 클립보드의 그림을 데이터 URL로. 없으면 빈 문자열. */
export async function readClipboardImage(clipboard, toDataUrl) {
  if (!clipboard || typeof clipboard.read !== "function") {
    return "";
  }
  try {
    const found = findImageEntry(await clipboard.read());
    if (!found) {
      return "";
    }
    return await toDataUrl(await found.entry.getType(found.type));
  } catch {
    return "";
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
