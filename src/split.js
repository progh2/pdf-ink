/** 노트 분할 탭 (#72). 영역 연결을 옆/아래에 연다. */

export function splitAxis(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return "lr";
  return h > w ? "tb" : "lr";
}

export function splitTabId(link) {
  if (link?.kind === "page") return `page:${link.page}`;
  if (link?.kind === "doc") return `doc:${link.identity || link.name}`;
  if (link?.kind === "url") return `url:${link.href}`;
  return "";
}

export function splitTabFromLink(link, id = splitTabId(link)) {
  const kind = link?.kind;
  if (kind === "page") return { id, kind: "page", page: link.page, title: `${link.page}쪽` };
  if (kind === "doc") return { id, kind: "doc", name: link.name, identity: link.identity, title: link.name };
  if (kind === "url") {
    let host = link.href;
    try {
      host = new URL(link.href).host || link.href;
    } catch {
      /* keep href */
    }
    return { id, kind: "url", href: link.href, title: host };
  }
  return null;
}

export function emptySplit() {
  return { axis: "lr", tabs: [], active: "" };
}

export function openSplitTab(state, tab, axis) {
  const nextAxis = axis === "tb" || axis === "lr" ? axis : (state?.axis === "tb" ? "tb" : "lr");
  const tabs = [...(state?.tabs ?? [])];
  const existing = tabs.find((t) => t.id === tab.id);
  if (existing) return { axis: nextAxis, tabs, active: existing.id };
  tabs.push(tab);
  return { axis: nextAxis, tabs, active: tab.id };
}

export function closeSplitTab(state, id) {
  const tabs = (state?.tabs ?? []).filter((t) => t.id !== id);
  if (!tabs.length) return emptySplit();
  const active = tabs.some((t) => t.id === state.active) ? state.active : tabs[tabs.length - 1].id;
  return { axis: state?.axis === "tb" ? "tb" : "lr", tabs, active };
}

export function activateSplitTab(state, id) {
  if (!(state?.tabs ?? []).some((t) => t.id === id)) return state;
  return { ...state, active: id };
}
