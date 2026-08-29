const STROKE_PREFIX = "pdf-ink:strokes:";
const PEN_ONLY_KEY = "pdf-ink:pen-only";
const DB_NAME = "pdf-ink";
const DB_VERSION = 3;
const SESSION_STORE = "session";
const FILES_STORE = "files";
const IMAGES_STORE = "images";

export function fileIdentity(file) {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

export function loadStrokes(identity) {
  try {
    const raw = localStorage.getItem(STROKE_PREFIX + identity);
    if (!raw) {
      return { pages: {} };
    }
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || !data.pages || typeof data.pages !== "object") {
      return { pages: {} };
    }
    return {
      pages: data.pages,
      rotations: data.rotations && typeof data.rotations === "object" ? data.rotations : {},
      sheets: Array.isArray(data.sheets) ? data.sheets : null,
      bookmarks: Array.isArray(data.bookmarks) ? data.bookmarks : [],
    };
  } catch {
    return { pages: {} };
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

export function saveStrokes(identity, pages, meta = {}) {
  const payload = JSON.stringify({
    version: 2,
    identity,
    pages,
    rotations: meta.rotations || {},
    sheets: meta.sheets || null,
    bookmarks: meta.bookmarks || [],
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
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        db.createObjectStore(IMAGES_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function toEntry(record) {
  return {
    identity: record.identity,
    name: record.name,
    buffer: record.buffer,
    page: record.page || 1,
    openedAt: record.openedAt || Date.now(),
    rotations: record.rotations && typeof record.rotations === "object" ? record.rotations : {},
    sheets: Array.isArray(record.sheets) ? record.sheets : null,
    bookmarks: Array.isArray(record.bookmarks) ? record.bookmarks : [],
  };
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

export async function saveImageRecord(identity, id, blob, mime) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGES_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(IMAGES_STORE).put({
      key: `${identity}::${id}`,
      identity,
      id,
      blob,
      mime,
      size: blob.size,
    });
  });
  db.close();
}

export async function loadImageRecord(identity, id) {
  const db = await openDb();
  const row = await new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGES_STORE, "readonly");
    const request = tx.objectStore(IMAGES_STORE).get(`${identity}::${id}`);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return row;
}
