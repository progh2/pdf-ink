/**
 * Chrome local overwrite (#82). Opening through the file picker keeps a
 * FileSystemFileHandle, so 저장 writes back to the very same file instead of
 * dropping another copy in Downloads. Safari/iOS have no handle: they download.
 */

export const PICKER_TYPES = [
  { description: "PDF", accept: { "application/pdf": [".pdf"] } },
];

export function supportsFileHandles(win = globalThis) {
  return typeof win?.showOpenFilePicker === "function";
}

export function pickerOptions() {
  return { types: PICKER_TYPES, excludeAcceptAllOption: false, multiple: false };
}

export function canWriteHandle(handle) {
  return Boolean(handle && typeof handle.createWritable === "function");
}

/** What 저장 will do, so the banner never promises the wrong thing. */
export function saveTargetLabel(handle) {
  return canWriteHandle(handle) ? "원본에 저장했습니다." : null;
}

/**
 * Asks only when the browser has not granted it yet. Requesting needs a user
 * gesture, so this runs from the 저장 click, never on load.
 */
export async function ensureWritePermission(handle) {
  if (!canWriteHandle(handle)) {
    return false;
  }
  const mode = { mode: "readwrite" };
  try {
    if (typeof handle.queryPermission === "function") {
      const state = await handle.queryPermission(mode);
      if (state === "granted") {
        return true;
      }
      if (state === "denied") {
        return false;
      }
    }
    if (typeof handle.requestPermission === "function") {
      return (await handle.requestPermission(mode)) === "granted";
    }
    // No permission API (older builds): the write itself will throw if blocked.
    return true;
  } catch {
    return false;
  }
}

export async function writeHandle(handle, blob) {
  const writable = await handle.createWritable();
  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }
}
