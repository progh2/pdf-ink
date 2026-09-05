export function createHistory(limit = 80) {
  return { undo: [], redo: [], limit };
}

export function cloneItems(items) {
  return JSON.parse(JSON.stringify(items || []));
}

export function recordChange(history, { page, before, after, extra = null }) {
  history.undo.push({
    page: String(page),
    before: cloneItems(before),
    after: cloneItems(after),
    extra: extra == null ? null : cloneItems(extra),
  });
  if (history.undo.length > history.limit) {
    history.undo.shift();
  }
  history.redo.length = 0;
  return history;
}

export function undoChange(history, pages) {
  const entry = history.undo.pop();
  if (!entry) {
    return null;
  }
  history.redo.push(entry);
  pages[entry.page] = cloneItems(entry.before);
  return entry;
}

export function redoChange(history, pages) {
  const entry = history.redo.pop();
  if (!entry) {
    return null;
  }
  history.undo.push(entry);
  pages[entry.page] = cloneItems(entry.after);
  return entry;
}

export function canUndo(history) {
  return history.undo.length > 0;
}

export function canRedo(history) {
  return history.redo.length > 0;
}

/**
 * 방금 적은 것과 같은 줄기의 변화면 **그 한 벌의 끝만 고친다** (#236).
 * 화살표를 스무 번 눌렀다고 되돌리기를 스무 번 하게 만들면 못 쓴다.
 */
export function extendChange(history, { page, after } = {}) {
  const last = history?.undo?.[history.undo.length - 1];
  if (!last || last.page !== String(page)) {
    return false;
  }
  last.after = cloneItems(after);
  history.redo.length = 0;
  return true;
}
