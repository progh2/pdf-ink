const STROKE_PREFIX = "pdf-ink:strokes:";
const PEN_ONLY_KEY = "pdf-ink:pen-only";
const DB_NAME = "pdf-ink";
const DB_VERSION = 2;
const SESSION_STORE = "session";
const FILES_STORE = "files";

export function fileIdentity(file) {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

export function loadStrokes(identity) {
  try {
    const raw = localStorage.getItem(STROKE_PREFIX + identity);
    if (!raw) {
      return { pages: {}, leaves: null };
    }
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object" || !data.pages || typeof data.pages !== "object") {
      return { pages: {}, leaves: null };
    }
    return {
      pages: data.pages,
      leaves: Array.isArray(data.leaves) ? data.leaves : null,
    };
  } catch {
    return { pages: {}, leaves: null };
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

export function saveStrokes(identity, pages, leaves = null) {
  const payload = JSON.stringify({
    version: leaves ? 2 : 1,
    identity,
    pages,
    ...(leaves ? { leaves } : {}),
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
