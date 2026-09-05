const STROKE_PREFIX = "pdf-ink:strokes:";
const PEN_ONLY_KEY = "pdf-ink:pen-only";
const DB_NAME = "pdf-ink";
const DB_VERSION = 5;
const SESSION_STORE = "session";
const FILES_STORE = "files";
/** Stickers live in this browser only, never on a server (#79). */
const STICKER_STORE = "stickers";
const STICKER_FOLDER_STORE = "sticker-folders";
/** Rendered page thumbs, so a reopened document shows its list at once (#141). */
const THUMB_STORE = "thumbs";
/** 선반: 문서 사이를 오가는 임시 복사 보관함 (#267). */
const SHELF_STORE = "shelf";

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

export function saveStrokes(identity, pages, leaves = null, outline = null, gone = null) {
  const hasOutline = Array.isArray(outline);
  const payload = JSON.stringify({
    version: gone ? 4 : hasOutline ? 3 : leaves ? 2 : 1,
    identity,
    pages,
    ...(leaves ? { leaves } : {}),
    ...(hasOutline ? { outline } : {}),
    ...(gone ? { gone } : {}),
    savedAt: Date.now(),
  });
  localStorage.setItem(STROKE_PREFIX + identity, payload);
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

export async function saveDocument(record) {
  const db = await openDb();
  const entry = toEntry(record);
  await new Promise((resolve, reject) => {
    const tx = db.transaction([FILES_STORE, SESSION_STORE], "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(FILES_STORE).put(entry);
    tx.objectStore(SESSION_STORE).put(entry, "last");
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
  return session;
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

export async function listDocuments() {
  const db = await openDb();
  const rows = await new Promise((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, "readonly");
    const request = tx.objectStore(FILES_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows
    .filter((row) => row?.identity && row.buffer)
    .sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0));
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
