const STROKE_PREFIX = "pdf-ink:strokes:";
const PEN_ONLY_KEY = "pdf-ink:pen-only";
const DB_NAME = "pdf-ink";
const DB_VERSION = 6;
const SESSION_STORE = "session";
const FILES_STORE = "files";
/** Stickers live in this browser only, never on a server (#79). */
const STICKER_STORE = "stickers";
const STICKER_FOLDER_STORE = "sticker-folders";
/** Rendered page thumbs, so a reopened document shows its list at once (#141). */
const THUMB_STORE = "thumbs";
/** 선반: 문서 사이를 오가는 임시 복사 보관함 (#267). */
const SHELF_STORE = "shelf";
/** 붙여넣은 이미지 원본(dataURL). localStorage 대신 여기 — 용량이 크다 (#273). */
const INK_IMAGE_STORE = "inkimages";

export function fileIdentity(file) {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

export function emptyStrokeRecord() {
  return { pages: {}, leaves: null, outline: [], gone: {} };
}

export function loadStrokes(identity) {
  try {
    const raw = localStorage.getItem(STROKE_PREFIX + identity);
    if (!raw) {
      return emptyStrokeRecord();
    }
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || !data.pages || typeof data.pages !== "object") {
      return emptyStrokeRecord();
    }
    return {
      pages: data.pages,
      leaves: Array.isArray(data.leaves) ? data.leaves : null,
      outline: Array.isArray(data.outline) ? data.outline : [],
      gone: data.gone && typeof data.gone === "object" ? data.gone : {},
      leavesVersion: data.leavesVersion === 1 ? 1 : 0,
      savedAt: Number(data.savedAt) || 0,
    };
  } catch {
    return emptyStrokeRecord();
  }
}

export function loadPenOnly() {
  try {
    return localStorage.getItem(PEN_ONLY_KEY) === "1";
  } catch {
    return false;
  }
}

export function savePenOnly(on) {
  try {
    localStorage.setItem(PEN_ONLY_KEY, on ? "1" : "0");
  } catch {
    // Preference is best-effort.
  }
}

// #430: 작은 필기는 동기 저장을 유지해 pagehide에서도 남긴다. 한도에 닿으면
// 같은 레코드를 IndexedDB에 보관한다. 실패한 스냅샷은 탭 안에 남겨 재열기 때 살린다.
const pendingStrokeWrites = new Map();
const unsavedStrokeRecords = new Map();
const strokeSaveTimes = new Map();

export function saveStrokes(identity, pages, leaves = null, outline = null, gone = null) {
  const hasOutline = Array.isArray(outline);
  const savedAt = Math.max(Date.now(), (strokeSaveTimes.get(identity) || 0) + 1);
  const payload = JSON.stringify({
    version: gone ? 4 : hasOutline ? 3 : leaves ? 2 : 1,
    identity,
    pages,
    ...(leaves ? { leaves } : {}),
    ...(Array.isArray(leaves) ? { leavesVersion: 1 } : {}),
    ...(hasOutline ? { outline } : {}),
    ...(gone ? { gone } : {}),
    savedAt,
  });
  strokeSaveTimes.set(identity, savedAt);
  unsavedStrokeRecords.set(identity, payload);
  try {
    localStorage.setItem(STROKE_PREFIX + identity, payload);
    unsavedStrokeRecords.delete(identity);
    return Promise.resolve();
  } catch (localError) {
    // 문서별 순서를 지킨다. 이전 저장 실패 때문에 다음 저장도 건너뛰지 않는다.
    const previous = pendingStrokeWrites.get(identity) || Promise.resolve();
    const pending = previous.catch(() => {}).then(async () => {
      try {
        await strokeBackup(identity, payload);
      } catch (backupError) {
        throw new AggregateError([localError, backupError], "필기 저장 실패");
      }
      if (unsavedStrokeRecords.get(identity) === payload) {
        unsavedStrokeRecords.delete(identity);
      }
    });
    pendingStrokeWrites.set(identity, pending);
    const finished = () => {
      if (pendingStrokeWrites.get(identity) === pending) pendingStrokeWrites.delete(identity);
    };
    pending.then(finished, finished);
    return pending;
  }
}

/** #430: DB 버전을 올리지 않고 기존 session 저장소의 독립 키를 쓴다. */
async function strokeBackup(identity, payload) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(SESSION_STORE, payload === undefined ? "readonly" : "readwrite");
      const store = tx.objectStore(SESSION_STORE);
      const key = STROKE_PREFIX + identity;
      const request = payload === undefined ? store.get(key) : store.put(payload, key);
      // put 성공 이벤트만으로는 부족하다. 트랜잭션 commit까지 기다린다.
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error("필기 저장 트랜잭션 중단"));
    });
  } finally {
    db.close();
  }
}

/** 기존 기록·대체 저장·실패한 메모리 스냅샷 중 최신 것을 복원한다. */
export async function loadSavedStrokes(identity) {
  const pending = pendingStrokeWrites.get(identity);
  if (pending) await pending.catch(() => {});
  // 대체 기록을 읽지 못하면 오래된 localStorage로 조용히 덮지 않는다.
  let backup;
  try {
    backup = await strokeBackup(identity);
  } catch (error) {
    // 이 탭에서 실패한 최신 스냅샷이 있으면 DB 장애 중에도 잃지 않는다.
    if (!unsavedStrokeRecords.has(identity)) throw error;
  }
  const records = [loadStrokes(identity)];
  for (const raw of [backup, unsavedStrokeRecords.get(identity)]) {
    if (!raw) continue;
    const data = JSON.parse(raw);
    if (!data?.pages || typeof data.pages !== "object") throw new Error("필기 저장 기록 손상");
    records.push(data);
  }
  const latest = records.reduce((a, b) => (Number(b.savedAt) || 0) > (Number(a.savedAt) || 0) ? b : a);
  strokeSaveTimes.set(identity, Math.max(strokeSaveTimes.get(identity) || 0, Number(latest.savedAt) || 0));
  return { ...latest, unsaved: unsavedStrokeRecords.has(identity) };
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        db.createObjectStore(SESSION_STORE);
      }
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        db.createObjectStore(FILES_STORE, { keyPath: "identity" });
      }
      if (!db.objectStoreNames.contains(STICKER_STORE)) {
        db.createObjectStore(STICKER_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STICKER_FOLDER_STORE)) {
        db.createObjectStore(STICKER_FOLDER_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(THUMB_STORE)) {
        db.createObjectStore(THUMB_STORE);
      }
      if (!db.objectStoreNames.contains(SHELF_STORE)) {
        db.createObjectStore(SHELF_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(INK_IMAGE_STORE)) {
        db.createObjectStore(INK_IMAGE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function toEntry(record) {
  const entry = {
    identity: record.identity,
    name: record.name,
    buffer: record.buffer,
    page: record.page || 1,
    openedAt: record.openedAt || Date.now(),
  };
  // Chrome can store the file handle itself, so reopening keeps the overwrite
  // path alive (#82). Other browsers simply have none.
  if (record.handle) {
    entry.handle = record.handle;
  }
  return entry;
}

export async function saveLastSession(session) {
  await saveDocument(session);
}

/**
 * #437: 세션에는 **가리키는 값만** 둔다. 예전엔 같은 레코드를 files와
 * session 두 곳에 넣어 PDF 본문을 두 벌 보관했다 — 문서 하나가 할당량을 두
 * 배로 먹었고, #418로 상한이 200MB가 된 뒤로는 그 탓에 할당량이 차서
 * 필기 저장(localStorage → IndexedDB 대체까지)이 통째로 실패할 수 있었다.
 */
function toPlace(entry) {
  const place = {
    identity: entry.identity,
    name: entry.name,
    page: entry.page || 1,
    openedAt: entry.openedAt || Date.now(),
  };
  if (entry.handle) {
    place.handle = entry.handle;
  }
  return place;
}

export async function saveDocument(record) {
  const db = await openDb();
  const entry = toEntry(record);
  await new Promise((resolve, reject) => {
    const tx = db.transaction([FILES_STORE, SESSION_STORE], "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(FILES_STORE).put(entry);
    tx.objectStore(SESSION_STORE).put(toPlace(entry), "last");
  });
  db.close();
}

export async function loadLastSession() {
  const db = await openDb();
  const session = await new Promise((resolve, reject) => {
    const tx = db.transaction(SESSION_STORE, "readonly");
    const request = tx.objectStore(SESSION_STORE).get("last");
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  // 옛 기록에는 본문이 들어 있다. 없으면 files에서 본문을 찾아 붙인다.
  if (session?.identity && !session.buffer) {
    const row = await loadDocument(session.identity);
    return row ? { ...row, ...session, buffer: row.buffer } : session;
  }
  return session;
}

/**
 * #418: 쪽만 바뀐 경우엔 본문을 다시 쓰지 않는다. 200MB짜리 책에서 쪽을
 * 넘길 때마다 원본을 통째로 저장하면 그게 곧 멈춤이다 — 위치만 고쳐 넣는다.
 */
export async function saveDocumentPlace(identity, page) {
  if (!identity) {
    return;
  }
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([FILES_STORE, SESSION_STORE], "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    const files = tx.objectStore(FILES_STORE);
    const ask = files.get(identity);
    ask.onsuccess = () => {
      const row = ask.result;
      if (!row) {
        return;
      }
      const next = { ...row, page: Math.max(1, Math.round(Number(page) || 1)), openedAt: Date.now() };
      files.put(next);
      // #437: 세션에는 본문 없이 자리만.
      tx.objectStore(SESSION_STORE).put(toPlace(next), "last");
    };
  });
  db.close();
}

export async function loadDocument(identity) {
  const db = await openDb();
  const row = await new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, "readonly");
    const request = tx.objectStore(FILES_STORE).get(identity);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return row;
}

/**
 * #418: 최근 목록에 본문은 필요 없다. getAll은 모든 문서의 PDF를 **한꺼번에**
 * 메모리로 올렸다(200MB 책 세 권이면 그대로 600MB) — 커서로 한 건씩 훑으며
 * 메타데이터만 남긴다. 본문은 각 단계가 끝나면 바로 버려진다.
 */
export async function listDocuments() {
  const db = await openDb();
  const rows = await new Promise((resolve, reject) => {
    const out = [];
    const tx = db.transaction(FILES_STORE, "readonly");
    const request = tx.objectStore(FILES_STORE).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(out);
        return;
      }
      const row = cursor.value;
      if (row?.identity && row.buffer) {
        out.push({
          identity: row.identity,
          name: row.name,
          page: row.page || 1,
          openedAt: row.openedAt || 0,
          size: row.buffer.byteLength || 0,
          handle: row.handle || null,
        });
      }
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows.sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0));
}

/**
 * #441: 문서를 지우면 그 문서에 딸린 것이 **전부** 사라져야 한다 — 본문만
 * 지우고 필기·이미지·미리보기가 남으면 공간은 안 돌고 다른 문서에 섞일 위험만
 * 남는다(#362에서 데인 적 있다). 지운 뒤 세션 포인터가 이 문서를 가리키면
 * 그것도 거둔다.
 */
export async function deleteDocument(identity) {
  if (!identity) {
    return;
  }
  try {
    localStorage.removeItem(STROKE_PREFIX + identity);
    localStorage.removeItem(LINK_FIX_PREFIX + identity);
  } catch {
    // localStorage가 막힌 브라우저에서도 나머지는 지운다.
  }
  unsavedStrokeRecords.delete(identity);
  strokeSaveTimes.delete(identity);
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(
        [FILES_STORE, SESSION_STORE, THUMB_STORE, INK_IMAGE_STORE],
        "readwrite",
      );
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error || new Error("문서 삭제 실패"));
      tx.objectStore(FILES_STORE).delete(identity);
      const session = tx.objectStore(SESSION_STORE);
      session.delete(STROKE_PREFIX + identity);
      const last = session.get("last");
      last.onsuccess = () => {
        if (last.result?.identity === identity) {
          session.delete("last");
        }
      };
      deleteByPrefix(tx.objectStore(THUMB_STORE), `${identity}::`);
      deleteByPrefix(tx.objectStore(INK_IMAGE_STORE), `${identity}::`);
    });
  } finally {
    db.close();
  }
}

function deleteByPrefix(store, prefix) {
  const keys = store.getAllKeys();
  keys.onsuccess = () => {
    for (const key of keys.result || []) {
      if (typeof key === "string" && key.startsWith(prefix)) {
        store.delete(key);
      }
    }
  };
}

/** 기기에 있는 문서를 통째로 비운다. 스티커·선반·설정은 문서가 아니므로 남는다. */
export async function deleteAllDocuments() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(STROKE_PREFIX) || key.startsWith(LINK_FIX_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // 위와 같다.
  }
  unsavedStrokeRecords.clear();
  strokeSaveTimes.clear();
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(
        [FILES_STORE, SESSION_STORE, THUMB_STORE, INK_IMAGE_STORE],
        "readwrite",
      );
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error || new Error("문서 전체 삭제 실패"));
      tx.objectStore(FILES_STORE).clear();
      tx.objectStore(THUMB_STORE).clear();
      tx.objectStore(INK_IMAGE_STORE).clear();
      // 세션 저장소에는 대체 필기 기록(#430)도 함께 산다 — 통째로 비운다.
      tx.objectStore(SESSION_STORE).clear();
    });
  } finally {
    db.close();
  }
}

/** 브라우저가 알려 주는 사용량. 모르면 null이라 화면이 줄을 감춘다. */
export async function storageEstimate() {
  try {
    const estimate = await globalThis.navigator?.storage?.estimate?.();
    if (!estimate) {
      return null;
    }
    return { usage: Number(estimate.usage), quota: Number(estimate.quota) };
  } catch {
    return null;
  }
}

export async function migrateLastIntoFiles() {
  const last = await loadLastSession();
  if (!last?.identity || !last.buffer) {
    return;
  }
  const existing = await loadDocument(last.identity);
  if (existing) {
    return;
  }
  await saveDocument(last);
}

function readAll(store) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const request = tx.objectStore(store).getAll();
        request.onsuccess = () => {
          resolve(request.result || []);
          db.close();
        };
        request.onerror = () => {
          reject(request.error);
          db.close();
        };
      }),
  );
}

async function writeAll(store, rows) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    const objects = tx.objectStore(store);
    objects.clear();
    for (const row of rows || []) {
      objects.put(row);
    }
  });
  db.close();
}

export function loadStickers() {
  return readAll(STICKER_STORE);
}

export function saveStickers(rows) {
  return writeAll(STICKER_STORE, rows);
}

export function loadStickerFolders() {
  return readAll(STICKER_FOLDER_STORE);
}

export function saveStickerFolders(rows) {
  return writeAll(STICKER_FOLDER_STORE, rows);
}

export function thumbStoreKey(identity, key) {
  return `${identity || "?"}::${key}`;
}

export async function loadThumb(identity, key) {
  try {
    const db = await openDb();
    const blob = await new Promise((resolve, reject) => {
      const tx = db.transaction(THUMB_STORE, "readonly");
      const request = tx.objectStore(THUMB_STORE).get(thumbStoreKey(identity, key));
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return blob;
  } catch {
    return null;
  }
}

export async function saveThumb(identity, key, blob) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(THUMB_STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(THUMB_STORE).put(blob, thumbStoreKey(identity, key));
    });
    db.close();
  } catch {
    // thumbs are a cache: losing one costs a repaint, nothing more
  }
}

/**
 * Which thumbs this document already has (#151). One read instead of one
 * question per page, and the answer doubles as the "what still needs drawing"
 * list: anything not in here is missing or was invalidated by a new key.
 */
export async function listThumbKeys(identity) {
  try {
    const db = await openDb();
    const keys = await new Promise((resolve, reject) => {
      const tx = db.transaction(THUMB_STORE, "readonly");
      const request = tx.objectStore(THUMB_STORE).getAllKeys();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    const prefix = `${identity || "?"}::`;
    return new Set(
      keys.filter((key) => typeof key === "string" && key.startsWith(prefix)).map((key) => key.slice(prefix.length)),
    );
  } catch {
    return new Set();
  }
}

/**
 * #437: 할당량이 차서 필기 저장이 실패했을 때 가장 먼저 내줄 수 있는 것은
 * 미리보기 그림이다 — 다시 그리면 그만인 캐시라 지워도 잃는 것이 없다.
 * 지금 보고 있는 문서 것만 남긴다. 지운 건수를 돌려준다.
 */
export async function freeThumbsExcept(identity) {
  const keep = `${identity || "?"}::`;
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      let removed = 0;
      const tx = db.transaction(THUMB_STORE, "readwrite");
      const store = tx.objectStore(THUMB_STORE);
      const request = store.openKeyCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          return;
        }
        if (typeof cursor.key !== "string" || !cursor.key.startsWith(keep)) {
          store.delete(cursor.key);
          removed += 1;
        }
        cursor.continue();
      };
      tx.oncomplete = () => resolve(removed);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error("미리보기 정리 실패"));
    });
  } finally {
    db.close();
  }
}

/** 할당량 초과인가 — 브라우저마다 이름이 다르고 AggregateError 안에 있기도 하다. */
export function isQuotaError(error) {
  if (!error) {
    return false;
  }
  if (Array.isArray(error.errors)) {
    return error.errors.some((inner) => isQuotaError(inner));
  }
  const name = String(error.name || "");
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
    return true;
  }
  return /quota|storage is full|저장 공간/i.test(String(error.message || ""));
}

export async function loadThumbEntries(identity, keys) {
  const out = {};
  for (const key of keys || []) {
    const blob = await loadThumb(identity, key);
    if (blob) {
      out[key] = blob;
    }
  }
  return out;
}

/**
 * 고친 링크는 필기와 따로 둔다 (#190). 문서 하나에 몇 개뿐이고, 필기를
 * 저장하지 않는 순간에도 남아 있어야 하기 때문이다.
 */
const LINK_FIX_PREFIX = "pdf-ink:link-fixes:";

export function loadLinkFixes(identity) {
  try {
    const raw = localStorage.getItem(LINK_FIX_PREFIX + identity);
    const data = raw ? JSON.parse(raw) : null;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

export function saveLinkFixes(identity, fixes) {
  try {
    const key = LINK_FIX_PREFIX + identity;
    if (!fixes || !Object.keys(fixes).length) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify(fixes));
  } catch {
    // storage is best effort
  }
}

/**
 * 캡처 등록부 (#256). 붙일 때 그림 지문으로 원래 자리를 찾으려고 이 브라우저에
 * 둔다. 클립보드 재인코딩이 PNG 메타를 지워도 이건 남는다.
 */
const CAPTURE_REG_KEY = "pdf-ink:captures";

export function loadCaptures() {
  try {
    const raw = localStorage.getItem(CAPTURE_REG_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function saveCaptures(list) {
  try {
    localStorage.setItem(CAPTURE_REG_KEY, JSON.stringify(list || []));
  } catch {
    // 등록부는 있으면 좋은 것, 없어도 붙여넣기는 된다.
  }
}


/* ---- 선반 (#267) : 같은 브라우저의 모든 탭이 공유한다 ---- */

/** 열 때마다 IndexedDB에서 새로 읽는다 — 다른 탭이 담은 것이 바로 보이게. */
export async function loadShelf() {
  const db = await openDb();
  const rows = await new Promise((resolve, reject) => {
    const tx = db.transaction(SHELF_STORE, "readonly");
    const request = tx.objectStore(SHELF_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows;
}

export async function putShelfEntry(entry) {
  if (!entry?.id) {
    return;
  }
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(SHELF_STORE, "readwrite");
    tx.objectStore(SHELF_STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function deleteShelfEntry(id) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(SHELF_STORE, "readwrite");
    tx.objectStore(SHELF_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** 오래된 것을 지운다. 문서를 열 때 한 번 돈다. */
export async function pruneShelfStore(keepIds) {
  const keep = new Set(keepIds || []);
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(SHELF_STORE, "readwrite");
    const store = tx.objectStore(SHELF_STORE);
    const request = store.getAllKeys();
    request.onsuccess = () => {
      for (const id of request.result || []) {
        if (!keep.has(id)) {
          store.delete(id);
        }
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}


/* ---- 붙여넣은 이미지 원본 (#273) : 문서별로 IndexedDB에 ---- */

function inkImageKey(identity, id) {
  return `${identity}::${id}`;
}

/** 문서의 이미지 지도(id→src)를 저장하고, 지금 안 쓰는 것은 지운다. */
export async function saveInkImages(identity, images, liveIds) {
  if (!identity) {
    return;
  }
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(INK_IMAGE_STORE, "readwrite");
    const store = tx.objectStore(INK_IMAGE_STORE);
    for (const [id, src] of Object.entries(images || {})) {
      if (src) {
        store.put(src, inkImageKey(identity, id));
      }
    }
    // 이 문서의 것 중 지금 안 쓰는 이미지는 지운다.
    const prefix = `${identity}::`;
    const keep = new Set([...(liveIds || [])].map((id) => inkImageKey(identity, id)));
    const keysReq = store.getAllKeys();
    keysReq.onsuccess = () => {
      for (const key of keysReq.result || []) {
        if (typeof key === "string" && key.startsWith(prefix) && !keep.has(key)) {
          store.delete(key);
        }
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** 문서의 이미지 지도(id→src)를 읽는다. */
export async function loadInkImages(identity) {
  if (!identity) {
    return {};
  }
  const db = await openDb();
  const map = await new Promise((resolve, reject) => {
    const tx = db.transaction(INK_IMAGE_STORE, "readonly");
    const store = tx.objectStore(INK_IMAGE_STORE);
    const out = {};
    const prefix = `${identity}::`;
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(out);
        return;
      }
      if (typeof cursor.key === "string" && cursor.key.startsWith(prefix)) {
        out[cursor.key.slice(prefix.length)] = cursor.value;
      }
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
  db.close();
  return map;
}

/** #395: 스티커 무덤과 마지막 동기 시각. 가벼워서 localStorage로 족하다. */
const STICKER_SYNC_KEY = "pdf-ink:sticker-sync";

export function loadStickerSync() {
  try {
    const raw = localStorage.getItem(STICKER_SYNC_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return {
      gone: data?.gone && typeof data.gone === "object" ? data.gone : {},
      savedAt: Math.round(Number(data?.savedAt) || 0),
    };
  } catch {
    return { gone: {}, savedAt: 0 };
  }
}

export function saveStickerSync({ gone = {}, savedAt = 0 } = {}) {
  try {
    localStorage.setItem(STICKER_SYNC_KEY, JSON.stringify({ gone, savedAt }));
  } catch {
    // 못 적어도 다음 동기에서 합쳐진다.
  }
}
