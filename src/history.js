import { itemKey } from "./inkMerge.js";

export function createHistory(limit = 80) {
  return { undo: [], redo: [], limit };
}

export function cloneItems(items) {
  return JSON.parse(JSON.stringify(items || []));
}

export function recordChange(history, { page, before, after, extra = null, partner = null }) {
  history.undo.push({
    page: String(page),
    before: cloneItems(before),
    after: cloneItems(after),
    extra: extra == null ? null : cloneItems(extra),
    // #318: 페이지 사이 이동은 두 쪽을 한 번에 되돌려야 한다.
    partner: partner == null ? null : cloneItems(partner),
  });
  if (history.undo.length > history.limit) {
    history.undo.shift();
  }
  history.redo.length = 0;
  return history;
}

/**
 * #460: 획 하나를 더한 것은 쪽 전체 스냅샷이 아니라 **그 획 하나**로 기록한다.
 * 예전엔 더할 때마다 쪽의 모든 잉크를 JSON으로 네 번 복사해(commit의 before·
 * after + record의 before·after) 잉크가 쌓일수록 펜을 뗄 때 멈칫했다.
 * 되돌리기는 그 항목을 `itemKey`로 찾아 뺀다 — 참조가 아니라 내용 열쇠라
 * 중간에 복사본으로 바뀌어도 찾는다.
 */
export function recordAppend(history, { page, item }) {
  const copy = cloneItems([item])[0];
  history.undo.push({
    page: String(page),
    append: copy,
    key: itemKey(copy),
    before: null,
    after: null,
    extra: null,
    partner: null,
  });
  if (history.undo.length > history.limit) {
    history.undo.shift();
  }
  history.redo.length = 0;
  return history;
}

function withoutLast(items, key) {
  const list = (items || []).slice();
  for (let at = list.length - 1; at >= 0; at -= 1) {
    if (itemKey(list[at]) === key) {
      list.splice(at, 1);
      return list;
    }
  }
  return list;
}

export function undoChange(history, pages) {
  const entry = history.undo.pop();
  if (!entry) {
    return null;
  }
  history.redo.push(entry);
  if (entry.append) {
    pages[entry.page] = withoutLast(pages[entry.page], entry.key);
    return entry;
  }
  pages[entry.page] = cloneItems(entry.before);
  if (entry.partner) {
    pages[String(entry.partner.page)] = cloneItems(entry.partner.before);
  }
  return entry;
}

export function redoChange(history, pages) {
  const entry = history.redo.pop();
  if (!entry) {
    return null;
  }
  history.undo.push(entry);
  if (entry.append) {
    pages[entry.page] = [...(pages[entry.page] || []), cloneItems([entry.append])[0]];
    return entry;
  }
  pages[entry.page] = cloneItems(entry.after);
  if (entry.partner) {
    pages[String(entry.partner.page)] = cloneItems(entry.partner.after);
  }
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
