/**
 * 스티커를 기기 사이로 (#395).
 *
 * 스티커는 문서가 아니라 **사람**에 딸린 것이라 사이드카(문서 옆)로는 못 나른다.
 * 계정 단위 묶음 파일 하나를 클라우드에 두고, 합치기는 필기와 같은 규칙을 쓴다:
 * id 합집합 + 무덤(#83·#290). 두 기기가 각자 더해도 지워지지 않고, 지운 것은
 * 되살아나지 않는다. 서버는 여전히 없다 — 합치는 곳은 각자의 브라우저다.
 */
import { mergeGone, sanitizeGone } from "./inkMerge.js";

export const STICKER_PACK_NAME = "pdf-ink-stickers.json";
export const STICKER_PACK_APP = "pdf-ink-stickers";
export const STICKER_PACK_VERSION = 1;
/** 그림 묶음이라 무거워질 수 있다 — 올리기 전에 자른다. */
export const STICKER_PACK_MAX_BYTES = 8 * 1024 * 1024;
export const STICKER_CLOUDS = ["none", "dropbox", "drive"];

export function normalizeStickerCloud(value) {
  return STICKER_CLOUDS.includes(String(value)) ? String(value) : "none";
}

export function serializeStickerPack({ stickers = [], folders = [], gone = {}, savedAt = Date.now() } = {}) {
  return JSON.stringify({
    app: STICKER_PACK_APP,
    version: STICKER_PACK_VERSION,
    savedAt: Math.round(Number(savedAt) || 0),
    folders,
    stickers,
    gone: sanitizeGone(gone),
  });
}

/** 남의 파일·깨진 파일은 조용히 거절한다. `isSafeSrc`로 그림 주소도 거른다(#372). */
export function parseStickerPack(text, isSafeSrc = () => true) {
  try {
    const data = JSON.parse(text);
    if (!data || data.app !== STICKER_PACK_APP || !Array.isArray(data.stickers)) {
      return null;
    }
    return {
      version: Number(data.version) || 1,
      savedAt: Math.round(Number(data.savedAt) || 0),
      folders: (Array.isArray(data.folders) ? data.folders : []).filter((folder) => folder?.id),
      stickers: data.stickers.filter(
        (sticker) => sticker?.id && typeof sticker.src === "string" && isSafeSrc(sticker.src),
      ),
      gone: sanitizeGone(data.gone),
    };
  } catch {
    return null;
  }
}

/** 내 것 먼저, 남의 새것을 뒤에. 무덤에 든 것은 어느 쪽이든 뺀다. */
export function mergeStickerPacks(local = {}, remote = {}) {
  const gone = mergeGone(local.gone || {}, remote.gone || {});
  const union = (mine = [], theirs = []) => {
    const out = [];
    const seen = new Set();
    for (const item of [...(mine || []), ...(theirs || [])]) {
      const id = item?.id;
      if (!id || gone[id] || seen.has(id)) {
        continue;
      }
      seen.add(id);
      out.push(item);
    }
    return out;
  };
  const stickers = union(local.stickers, remote.stickers);
  const folders = union(local.folders, remote.folders);
  const mineIds = new Set((local.stickers || []).map((sticker) => sticker.id));
  return {
    stickers,
    folders,
    gone,
    added: stickers.filter((sticker) => !mineIds.has(sticker.id)).length,
  };
}

/**
 * 지운 것을 무덤에 적는다. 저장 한 곳에서만 부르므로(퍼시스트), 삭제 경로마다
 * 손댈 필요가 없다 — 알던 id 중 사라진 것이 삭제다.
 */
export function stickerRemovals(knownIds, liveIds, gone = {}, at = Date.now()) {
  const next = { ...gone };
  for (const id of knownIds || []) {
    if (!(liveIds || new Set()).has(id)) {
      next[id] = at;
    }
  }
  for (const id of liveIds || []) {
    delete next[id];
  }
  return next;
}
