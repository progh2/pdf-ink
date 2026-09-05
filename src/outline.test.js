import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  addOutlineEntry,
  deleteOutlineEntry,
  firstOutlineEntryForPage,
  firstOutlineTitleForPage,
  flattenOutline,
  makeOutlineEntry,
  normalizeOutline,
  outlineDestPage,
  outlinePageLabel,
  outlineTitleForPage,
  PREVIEW_TAB_LABELS,
  PREVIEW_TABS,
  renameOutlineEntry,
  setOutlineTitleText,
  tocRowAction,
} from "./outline.js";
import { BAR_TOOLS } from "./toolbar.js";
import { loadStrokes, saveStrokes } from "./storage.js";
import { PREVIEW_FILTER_LABELS, insertOutlineAfter, makeOutlineLeaf } from "./preview.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "src/style.css"), "utf8");
const main = readFileSync(join(root, "src/main.js"), "utf8");
const toolbar = html.slice(html.indexOf('id="toolbar"'), html.indexOf('id="workspace"'));
const header = html.slice(html.indexOf('class="write-top"'), html.indexOf('class="write-body"'));
const drawer = html.slice(html.indexOf('id="preview-drawer"'), html.indexOf('id="preview-backdrop"'));
const more = html.slice(html.indexOf('id="more-panel"'), html.indexOf('id="image-input"'));

function withLocalStorage(run) {
  const store = new Map();
  const prev = globalThis.localStorage;
  globalThis.localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
  try {
    return run();
  } finally {
    globalThis.localStorage = prev;
  }
}

describe("#53 개요 추가·수정·삭제", () => {
  it("adds a 페이지 N entry for the current page", () => {
    const next = addOutlineEntry([], 3);
    assert.equal(next.length, 1);
    assert.equal(next[0].title, "페이지 3");
    assert.equal(outlineDestPage(next[0]), 3);
    assert.equal(outlineTitleForPage(2), "페이지 2");
    assert.match(next[0].id, /^t:/);
  });

  it("renames and deletes without touching outline pages", () => {
    let entries = addOutlineEntry([], 1);
    const id = entries[0].id;
    entries = addOutlineEntry(entries, 4);
    entries = renameOutlineEntry(entries, id, "서론");
    assert.equal(entries[0].title, "서론");
    assert.equal(entries[1].title, "페이지 4");
    entries = deleteOutlineEntry(entries, id);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].title, "페이지 4");
    assert.equal(renameOutlineEntry(entries, entries[0].id, "   ")[0].title, "페이지 4");
    const leaf = makeOutlineLeaf("blank");
    const pages = insertOutlineAfter([], 0, "blank");
    assert.equal(leaf.kind, "outline");
    assert.equal(pages[0].kind, "outline");
    assert.notEqual(entries[0].id, pages[0].id);
    assert.notEqual(entries[0].kind, "outline");
  });

  it("persists outline across reload and hands it to the PDF writer (#54)", () => {
    withLocalStorage(() => {
      const outline = addOutlineEntry([], 2);
      saveStrokes("doc::1::1", { 1: [] }, null, outline);
      const loaded = loadStrokes("doc::1::1");
      assert.deepEqual(normalizeOutline(loaded.outline), outline);
      saveStrokes("doc::1::1", { 1: [] }, null, deleteOutlineEntry(outline, outline[0].id));
      assert.deepEqual(normalizeOutline(loadStrokes("doc::1::1").outline), []);
    });
    assert.match(main, /saveStrokes\(state\.identity, state\.pages, state\.leaves, state\.outline, state\.inkGone\)/);
    assert.match(main, /state\.outline = normalizeOutline\(stored\.outline, state\.leaves\)/);
    // #54: 드로어 개요는 내보낸 PDF에 책갈피로 박힌다. 로컬 저장은 그대로.
    assert.match(main, /page: outlineDestPage\(entry, state\.leaves\)/);
  });

  it("jumps to the destination page and keeps 보기/편집 header", () => {
    const entry = makeOutlineEntry(5, { title: "본문" });
    assert.equal(outlineDestPage(entry), 5);
    assert.match(main, /function addTocEntry/);
    assert.match(main, /goToPage\(dest\)/);
    assert.match(main, /beginTocTitleEdit/);
    assert.match(main, /removeTocEntry/);
    assert.match(main, /keydown/);
    assert.match(main, /blur/);
    assert.doesNotMatch(main, /confirm\(|window\.confirm/);
    assert.match(header, /class="interact-lock-label">편집/);
    assert.match(header, /id="interact-btn"/);
    assert.doesNotMatch(header, /읽기/);
  });

  it("puts 페이지/목차 tabs and +/x in the drawer, not the bar", () => {
    assert.deepEqual(PREVIEW_TABS, ["pages", "toc"]);
    assert.equal(PREVIEW_TAB_LABELS.pages, "페이지");
    assert.equal(PREVIEW_TAB_LABELS.toc, "목차", "#107: 탭은 목차");
    assert.match(drawer, /data-preview-tab="pages">페이지/);
    assert.match(drawer, /data-preview-tab="toc">목차/);
    assert.match(drawer, /id="toc-add"[^>]*>\+/);
    assert.match(drawer, /id="toc-list"/);
    // #114: 상시 x는 사라지고 길게 누르기 메뉴로 갔다.
    assert.doesNotMatch(main, /preview-toc-delete/);
    assert.match(main, /data-toc-menu="delete"|runTocMenu/);
    assert.doesNotMatch(main, /drag.*outline|outline.*draggable|hierarchy|parentId/);
    assert.match(css, /\.preview-drawer \{[\s\S]*width: var\(--preview-w, 120px\)/);
    assert.match(css, /\.preview-thumb \{[\s\S]*width: var\(--thumb-w, 88px\)/);
    assert.match(css, /\.preview-list \{[\s\S]*gap: 8px/);
    assert.match(css, /\.preview-toc-add \{[\s\S]*height: 32px/);
    assert.match(css, /\.preview-toc-row \{[\s\S]*height: 36px/);
    assert.match(css, /\.preview-toc-list \{[\s\S]*gap: 4px/);
    assert.match(css, /\.preview-toc-row \{[\s\S]*touch-action: none/);
    assert.equal(BAR_TOOLS.length, 9, '#119: 미리보기는 헤더로 갔다');
    const cells = toolbar.slice(toolbar.indexOf("toolbar-cells"));
    assert.equal((cells.match(/<button/g) || []).length, 9);
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.doesNotMatch(toolbar, /개요|페이지|toc-add|preview-tab/);
    assert.doesNotMatch(more, /data-more="outline"|개요 추가/);
    assert.match(drawer, /빈 쪽 넣기/);
    assert.match(drawer, /data-preview-filter="outline">빈 쪽/);
  });

  it("keeps tag-looking title characters as textContent, never innerHTML", () => {
    const tagged = "<b>제목</b>";
    const entry = makeOutlineEntry(1, { title: tagged });
    assert.equal(entry.title, tagged);
    assert.equal(renameOutlineEntry([entry], entry.id, tagged)[0].title, tagged);
    const node = {
      textContent: "",
      set innerHTML(_value) {
        throw new Error("innerHTML");
      },
    };
    setOutlineTitleText(node, tagged);
    assert.equal(node.textContent, tagged);
    const tocUi = main.slice(main.indexOf("function beginTocTitleEdit"), main.indexOf("async function renderPreviewList"));
    assert.match(tocUi, /setOutlineTitleText\(/);
    assert.match(tocUi, /input\.value = entry\.title/);
    assert.doesNotMatch(tocUi, /innerHTML|insertAdjacentHTML|DOMParser|outerHTML/);
    assert.match(main, /from "\.\/outline\.js"/);
    assert.match(main, /setOutlineTitleText/);
  });

  it("tap jumps, hold renames or deletes (#114)", () => {
    // The row action helper still guards the title text field.
    assert.equal(tocRowAction("preview-toc-title"), "edit");
    assert.equal(tocRowAction("preview-toc-jump"), "jump");
    const tocUi = main.slice(main.indexOf("function renameTocRow"), main.indexOf("async function renderPreviewList"));
    assert.match(tocUi, /preview-toc-title/);
    assert.match(tocUi, /preview-toc-jump/);
    assert.match(tocUi, /beginTocTitleEdit/);
    assert.match(tocUi, /goToPage\(dest\)/);
    assert.match(tocUi, /PAGE_HOLD_MS/);
    assert.match(main, /function runTocMenu[\s\S]*removeTocEntry/);
    assert.match(html, /data-toc-menu="rename">이름 변경/);
    assert.match(html, /data-toc-menu="delete">삭제/);
    const titleCss = css.slice(css.indexOf(".preview-toc-title {"), css.indexOf(".preview-toc-jump {"));
    assert.match(titleCss, /flex: 0 1 auto/);
    assert.doesNotMatch(titleCss, /flex: 1;/);
    assert.match(css, /\.preview-toc-jump \{[\s\S]*flex: 1 1 auto/);
    assert.doesNotMatch(css, /\.preview-toc-delete/, "#114: 상시 x가 사라졌다");
  });
});

describe("#107 목차는 잎을 가리킨다", () => {
  const leaves = [
    { id: "p1", kind: "pdf", pdfPage: 1 },
    { id: "p2", kind: "pdf", pdfPage: 2 },
    { id: "p3", kind: "pdf", pdfPage: 3 },
  ];

  it("pins an old page-only entry to the leaf sitting there", () => {
    const [entry] = normalizeOutline([{ id: "t:1", title: "본문", page: 2 }], leaves);
    assert.equal(entry.leafId, "p2");
    assert.equal(outlineDestPage(entry, leaves), 2);
  });

  it("follows the page when the order changes", () => {
    const [entry] = normalizeOutline([{ id: "t:1", title: "본문", page: 2 }], leaves);
    const moved = [leaves[1], leaves[0], leaves[2]];
    assert.equal(outlineDestPage(entry, moved), 1, "the entry moved with its page");
    // The stale stored number is not used when the leaf is known.
    assert.equal(entry.page, 2);
  });

  it("drops an entry whose page is gone", () => {
    const kept = normalizeOutline([{ id: "t:1", title: "본문", leafId: "p2" }], leaves);
    assert.equal(kept.length, 1);
    const gone = normalizeOutline([{ id: "t:1", title: "본문", leafId: "p9" }], leaves);
    assert.deepEqual(gone, []);
  });

  it("adds a new entry pinned to the page it was made on", () => {
    const [entry] = addOutlineEntry([], 3, leaves);
    assert.equal(entry.leafId, "p3");
    assert.equal(entry.title, "페이지 3");
    assert.equal(outlineDestPage(entry, [leaves[2], leaves[0], leaves[1]]), 1);
  });

  it("still works with no leaves to hand (old callers)", () => {
    const [entry] = normalizeOutline([{ id: "t:1", title: "본문", page: 2 }]);
    assert.equal(outlineDestPage(entry), 2);
  });

  it("calls a blank page 빈 쪽 and the tab 목차", () => {
    assert.equal(PREVIEW_TAB_LABELS.toc, "목차");
    assert.equal(PREVIEW_FILTER_LABELS.outline, "빈 쪽");
  });
});

describe("#113 길게 눌러 연 메뉴는 떼면 실행", () => {
  const mainSrc = readFileSync(join(root, "src/main.js"), "utf8");

  it("does not capture the pointer while a menu is open", () => {
    const grab = mainSrc.slice(mainSrc.indexOf("const grab = () => {"), mainSrc.indexOf("row.addEventListener(\"pointerdown\""));
    assert.doesNotMatch(grab, /setPointerCapture/, "capture would steal the click from the menu");
    // Capture comes back only for the reorder drag.
    assert.match(mainSrc, /row\.classList\.add\("is-dragging"\);[\s\S]{0,120}setPointerCapture/);
  });

  it("runs the item the finger was released over", () => {
    assert.match(mainSrc, /function menuActionAtPoint[\s\S]*elementFromPoint/);
    assert.match(mainSrc, /menuActionAtPoint\(els\.pageMenu, event, "pageMenu"\)/);
    assert.match(mainSrc, /menuActionAtPoint\(els\.stickerMenu, event, "stickerMenu"\)/);
    assert.match(mainSrc, /menuActionAtPoint\(els\.lockMenu, event, "lockMenu"\)/);
    assert.match(mainSrc, /menuActionAtPoint\(els\.tocMenu, event, "tocMenu"\)/);
  });

  it("also fires on a plain tap, through the menu itself", () => {
    assert.match(mainSrc, /function bindMenuRelease[\s\S]*addEventListener\("pointerup"/);
    assert.match(mainSrc, /bindMenuRelease\(els\.pageMenu, "pageMenu", runPageMenu\)/);
    assert.match(mainSrc, /bindMenuRelease\(els\.tocMenu, "tocMenu", runTocMenu\)/);
    // A disabled row never runs.
    assert.match(mainSrc, /if \(!button \|\| button\.disabled/);
  });
});

describe("#120 목차 줄의 쪽 번호", () => {
  const mainSrc = readFileSync(join(root, "src/main.js"), "utf8");
  const cssSrc = readFileSync(join(root, "src/style.css"), "utf8");

  it("labels the row p5. style", () => {
    assert.equal(outlinePageLabel(5), "p5.");
    assert.equal(outlinePageLabel(0), "p1.");
    assert.equal(outlinePageLabel("nonsense"), "p1.");
  });

  it("uses the page the leaf sits on today (#107)", () => {
    const toc = mainSrc.slice(mainSrc.indexOf("function renderTocList"), mainSrc.indexOf("async function renderPreviewList"));
    assert.match(toc, /const dest = outlineDestPage\(entry, state\.leaves\)/);
    assert.match(toc, /outlinePageLabel\(dest\)/);
    assert.match(toc, /row\.append\(page, title, jump\)/);
  });

  it("keeps the number quiet and the row at 36", () => {
    assert.match(cssSrc, /\.preview-toc-page \{[\s\S]*color: var\(--muted\)[\s\S]*font-size: 12px/);
    assert.match(cssSrc, /\.preview-toc-row \{[\s\S]*height: 36px/);
  });
});

describe("#126 구운 뒤 목차 다시 붙이기", () => {
  const leaves = [
    { id: "p1", kind: "pdf", pdfPage: 1 },
    { id: "o:a", kind: "outline", pdfPage: 0 },
    { id: "p2", kind: "pdf", pdfPage: 2 },
  ];

  it("keeps the page it points at today and drops the leaf anchor", () => {
    const entries = [
      { id: "t:1", title: "표지", leafId: "p1", page: 1 },
      { id: "t:2", title: "뒤", leafId: "p2", page: 9 },
    ];
    const flat = flattenOutline(entries, leaves);
    assert.deepEqual(flat, [
      { id: "t:1", title: "표지", page: 1 },
      { id: "t:2", title: "뒤", page: 3 },
    ]);
    assert.equal(flat.every((entry) => entry.leafId === undefined), true);
  });

  it("re-attaches to the new 1..N leaves on the next open", () => {
    const flat = flattenOutline([{ id: "t:2", title: "뒤", leafId: "p2", page: 9 }], leaves);
    const fresh = [{ id: "p1", kind: "pdf", pdfPage: 1 }, { id: "p2", kind: "pdf", pdfPage: 2 }, { id: "p3", kind: "pdf", pdfPage: 3 }];
    const [entry] = normalizeOutline(flat, fresh);
    assert.equal(entry.leafId, "p3");
    assert.equal(outlineDestPage(entry, fresh), 3);
  });
});

describe("#155 서랍이 밀고, 목차는 더블탭으로 이름 변경", () => {
  const mainSrc = readFileSync(join(root, "src/main.js"), "utf8");
  const cssSrc = readFileSync(join(root, "src/style.css"), "utf8");

  it("pushes the page instead of covering it", () => {
    assert.match(cssSrc, /\[data-preview="open"\] \{[\s\S]*padding-left: var\(--preview-w, 120px\)/);
    assert.match(mainSrc, /els\.writeScreen\.dataset\.preview = "open"/);
    assert.match(mainSrc, /els\.writeScreen\.dataset\.preview = ""/);
    assert.match(mainSrc, /els\.writeScreen\.style\.setProperty\("--preview-w"/);
  });

  it("re-fits the paper when the space changes, but not mid-drag", () => {
    assert.match(mainSrc, /function refitPages[\s\S]*rebuildPages\(\)/);
    const grip = mainSrc.slice(mainSrc.indexOf("function bindPreviewGrip"), mainSrc.indexOf("/**\n * The drawer stays open"));
    assert.doesNotMatch(grip.slice(0, grip.indexOf("const stop =")), /refitPages/, "not on every move");
    assert.match(grip, /savePreviewWidth\(state\.previewWidth\);[\s\S]{0,200}refitPages\(\)/);
  });

  it("keeps the toolbar rail an overlay (#49 unchanged)", () => {
    const rail = cssSrc.slice(cssSrc.indexOf(".toolbar-rail {"), cssSrc.indexOf(".toolbar {"));
    assert.match(rail, /position: absolute/);
    assert.doesNotMatch(rail, /padding-left: var\(--preview-w/);
  });

  it("renames on a double tap or double click, and still jumps on one", () => {
    assert.match(mainSrc, /isDoubleTap\(now, lastTapAt, away\)/);
    assert.match(mainSrc, /row\.addEventListener\("dblclick"[\s\S]{0,120}renameTocRow\(row, entry\)/);
    assert.match(mainSrc, /lastTapAt = now;[\s\S]{0,120}goToPage\(dest\)/);
  });
});

describe("#161 목차는 쪽 순서에 들어간다", () => {
  const leaves = Array.from({ length: 9 }, (_, index) => ({
    id: `p${index + 1}`,
    kind: "pdf",
    pdfPage: index + 1,
  }));
  const pages = (list) => list.map((entry) => outlineDestPage(entry, leaves));

  it("puts a new item where its page belongs", () => {
    let list = addOutlineEntry([], 5, leaves);
    list = addOutlineEntry(list, 2, leaves);
    list = addOutlineEntry(list, 8, leaves);
    list = addOutlineEntry(list, 1, leaves);
    assert.deepEqual(pages(list), [1, 2, 5, 8]);
  });

  it("puts a second item on the same page after the first", () => {
    let list = addOutlineEntry([], 3, leaves);
    const first = list[0].id;
    list = addOutlineEntry(list, 3, leaves);
    assert.deepEqual(pages(list), [3, 3]);
    assert.equal(list[0].id, first, "the one that was there stays first");
  });

  it("does not reshuffle what is already in the list", () => {
    const made = [
      { id: "t:1", title: "뒤", page: 9 },
      { id: "t:2", title: "앞", page: 1 },
    ];
    const list = addOutlineEntry(made, 5, leaves);
    // The hand-made order is kept; only the new one is placed.
    assert.deepEqual(list.map((entry) => entry.title), ["뒤", "앞", "페이지 5"]);
  });
});

describe("#215 미리보기 썸 아래 목차", () => {
  const leaves = [
    { id: "p1", kind: "pdf", pdfPage: 1 },
    { id: "p2", kind: "pdf", pdfPage: 2 },
    { id: "p3", kind: "pdf", pdfPage: 3 },
  ];

  it("uses the first outline title for that page", () => {
    const entries = normalizeOutline(
      [
        { id: "t:1", title: "서론", page: 2 },
        { id: "t:2", title: "본문", page: 2 },
        { id: "t:3", title: "끝", page: 3 },
      ],
      leaves,
    );
    assert.equal(firstOutlineTitleForPage(entries, 2, leaves), "서론");
    assert.equal(firstOutlineTitleForPage(entries, 3, leaves), "끝");
    assert.equal(firstOutlineTitleForPage(entries, 1, leaves), "");
    assert.equal(firstOutlineTitleForPage([], 2, leaves), "");
    assert.equal(firstOutlineTitleForPage(entries, 2), "서론");
  });

  it("follows the leaf when pages move (#107)", () => {
    const [entry] = normalizeOutline([{ id: "t:1", title: "서론", page: 2 }], leaves);
    const moved = [leaves[1], leaves[0], leaves[2]];
    assert.equal(firstOutlineTitleForPage([entry], 1, moved), "서론");
    assert.equal(firstOutlineTitleForPage([entry], 2, moved), "");
  });

  it("skips a blank title and takes the next on that page", () => {
    const entries = [
      { id: "t:1", title: "   ", page: 1 },
      { id: "t:2", title: "표지", page: 1 },
    ];
    assert.equal(firstOutlineTitleForPage(entries, 1), "표지");
  });

  it("wires a caption only when that page has a TOC title, never as HTML", () => {
    const row = main.slice(main.indexOf("function makePreviewRow"), main.indexOf("function syncPreviewCurrent"));
    assert.match(row, /firstOutlineTitleForPage\(state\.outline, pageNum, state\.leaves\)/);
    assert.match(row, /if \(tocTitle\)/);
    assert.match(row, /preview-toc-caption/);
    assert.match(row, /setOutlineTitleText\(caption, tocTitle\)/);
    assert.doesNotMatch(row, /innerHTML/);
    assert.match(row, /meta\.append\(label\)/, "no caption node when the page has no TOC");
    assert.match(css, /\.preview-toc-caption \{[\s\S]*font-size: 12px/);
    assert.match(css, /\.preview-toc-caption \{[\s\S]*color: #5c574e/);
    assert.match(css, /\.preview-toc-caption \{[\s\S]*text-overflow: ellipsis/);
    assert.match(css, /\.preview-toc-caption \{[\s\S]*white-space: nowrap/);
    assert.match(css, /\.preview-toc-caption \{[\s\S]*overflow: hidden/);
    assert.match(css, /\.preview-row \{[\s\S]*gap: 6px/, "6 under the 88 thumb");
    assert.match(css, /\.preview-row \{[\s\S]*min-height: 167px/, "windowed list stride stays");
    assert.match(main, /from "\.\/outline\.js"/);
    assert.match(main, /firstOutlineTitleForPage/);
  });
});

describe("#217 미리보기 별은 썸 위, 목차는 쪽번호 옆", () => {
  const leaves = [
    { id: "p1", kind: "pdf", pdfPage: 1 },
    { id: "p2", kind: "pdf", pdfPage: 2 },
    { id: "p3", kind: "pdf", pdfPage: 3 },
  ];

  it("finds the first outline entry on a page", () => {
    const entries = normalizeOutline(
      [
        { id: "t:1", title: "서론", page: 2 },
        { id: "t:2", title: "본문", page: 2 },
        { id: "t:3", title: "끝", page: 3 },
      ],
      leaves,
    );
    assert.equal(firstOutlineEntryForPage(entries, 2, leaves)?.title, "서론");
    assert.equal(firstOutlineEntryForPage(entries, 3, leaves)?.title, "끝");
    assert.equal(firstOutlineEntryForPage(entries, 1, leaves), null);
    assert.equal(firstOutlineEntryForPage([], 2, leaves), null);
  });

  it("puts the star on the thumb and the caption beside the page number", () => {
    const row = main.slice(main.indexOf("function makePreviewRow"), main.indexOf("function syncPreviewCurrent"));
    assert.match(row, /preview-thumb-wrap/);
    assert.match(row, /wrap\.append\(thumb, star\)/);
    assert.match(row, /meta\.append\(label, caption\)/);
    assert.match(row, /meta\.append\(label\)/);
    assert.doesNotMatch(row, /meta\.append\([^)]*star/);
    assert.match(css, /\.preview-thumb-wrap \{[\s\S]*position: relative/);
    const starOnThumb = css.slice(css.indexOf(".preview-thumb-wrap .preview-bookmark {"), css.indexOf(".preview-meta {"));
    assert.match(starOnThumb, /position: absolute/);
    assert.match(starOnThumb, /top: 6px/);
    assert.match(starOnThumb, /right: 6px/);
    assert.match(starOnThumb, /width: 44px/);
    assert.match(starOnThumb, /height: 44px/);
    assert.match(starOnThumb, /line-height: 28px/);
    assert.match(starOnThumb, /font-size: 18px/);
    assert.match(starOnThumb, /color: #d4cfc4/);
    assert.match(css, /\.preview-bookmark \{[\s\S]*width: 44px/);
    assert.match(css, /\.preview-bookmark \{[\s\S]*height: 44px/);
    assert.match(css, /\.preview-bookmark \{[\s\S]*color: #d4cfc4/);
    assert.match(css, /\.preview-bookmark\.is-on \{[\s\S]*color: #c4a574/);
    assert.match(css, /\.preview-toc-caption \{[\s\S]*font-size: 12px/);
    assert.match(css, /\.preview-toc-caption \{[\s\S]*color: #5c574e/);
    assert.match(css, /\.preview-toc-caption \{[\s\S]*text-overflow: ellipsis/);
    assert.match(css, /\.preview-row \{[\s\S]*min-height: 167px/, "windowed list stride stays");
  });

  it("double-tap creates a missing outline entry then edits the title", () => {
    const edit = main.slice(main.indexOf("function ensurePreviewTocCaption"), main.indexOf("function runTocMenu"));
    assert.match(edit, /function beginPreviewOutlineEdit/);
    assert.match(edit, /firstOutlineEntryForPage/);
    assert.match(edit, /addOutlineEntry\(state\.outline, pageNum, state\.leaves\)/);
    assert.match(edit, /beginTocTitleEdit/);
    assert.match(edit, /setOutlineTitleText/);
    assert.doesNotMatch(edit, /innerHTML|insertAdjacentHTML|DOMParser|outerHTML/);
    const gestures = main.slice(main.indexOf("function bindPreviewRowGestures"), main.indexOf("function dropIndexForEvent"));
    assert.match(gestures, /isDoubleTap\(now, lastTapAt, away\)/);
    assert.match(gestures, /beginPreviewOutlineEdit\(row, pageOf\(\)\)/);
    assert.match(gestures, /row\.addEventListener\("dblclick"/);
    assert.match(main, /function saveTocTitle[\s\S]*syncPreviewOutlineCaptions/);
  });
});
