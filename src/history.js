export function createHistory(limit = 80) {
  return { undo: [], redo: [], limit };
}

export function cloneItems(items) {
  return JSON.parse(JSON.stringify(items || []));
}

export function recordChange(history, { page, before, after }) {
  history.undo.push({
    page: String(page),
    before: cloneItems(before),
    after: cloneItems(after),
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
