const STROKE_PREFIX = "pdf-ink:strokes:";
const DB_NAME = "pdf-ink";
const DB_VERSION = 1;
const STORE = "session";

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
    return { pages: data.pages };
  } catch {
    return { pages: {} };
  }
}

export function saveStrokes(identity, pages) {
  const payload = JSON.stringify({
    version: 1,
    identity,
    pages,
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
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export async function saveLastSession(session) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(session, "last");
  });
  db.close();
}

export async function loadLastSession() {
  const db = await openDb();
  const session = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get("last");
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return session;
}
