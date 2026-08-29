export function createHistory(limit = 80) {
  return { undo: [], redo: [], limit };
}

export function cloneItems(items) {
  return JSON.parse(JSON.stringify(items || []));
}

export function recordChange(history, { page, before, after, rotationBefore, rotationAfter }) {
  history.undo.push({
    page: String(page),
    before: cloneItems(before),
    after: cloneItems(after),
    rotationBefore,
    rotationAfter,
  });
  if (history.undo.length > history.limit) {
    history.undo.shift();
  }
  history.redo.length = 0;
  return history;
}

export function undoChange(history, pages, rotations) {
  const entry = history.undo.pop();
  if (!entry) {
    return null;
  }
  history.redo.push(entry);
  pages[entry.page] = cloneItems(entry.before);
  if (rotations && entry.rotationBefore != null) {
    rotations[entry.page] = entry.rotationBefore;
  }
  return entry;
}

export function redoChange(history, pages, rotations) {
  const entry = history.redo.pop();
  if (!entry) {
    return null;
  }
  history.undo.push(entry);
  pages[entry.page] = cloneItems(entry.after);
  if (rotations && entry.rotationAfter != null) {
    rotations[entry.page] = entry.rotationAfter;
  }
  return entry;
}

export function canUndo(history) {
  return history.undo.length > 0;
}

export function canRedo(history) {
  return history.redo.length > 0;
}
