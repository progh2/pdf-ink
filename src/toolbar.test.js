import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { M4_OVERFLOW_ITEMS } from "./interact.js";
import { UNDO_HOLD_MS } from "./undoHold.js";
import {
  BAR_BORDER,
  BAR_HEIGHT,
  BAR_OVERFLOW_ITEMS,
  BAR_PAD,
  BAR_RADIUS,
  BAR_TOOLS,
  CELL,
  CELL_GAP,
  CELL_GAP_NARROW,
  CELL_NARROW,
  CELL_SELECTED,
  COLOR_DOT,
  COLOR_DOT_TOOLS,
  DOCK_BAND_PX,
  DOCK_POSITIONS,
  GRIP_DOT,
  GRIP_WIDTH,
  ICON,
  ICON_COLOR,
  ICON_NARROW,
  NARROW_BAR_WIDTH,
  barLength,
  barNaturalHeight,
  barNaturalWidth,
  isRail,
  migrateDock,
  snapDockFromPoint,
  useNarrowCells,
  useNarrowRail,
} from "./toolbar.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "src/style.css"), "utf8");
const main = readFileSync(join(root, "src/main.js"), "utf8");
const toolbar = html.slice(html.indexOf('id="toolbar"'), html.indexOf('id="workspace"'));
const more = html.slice(html.indexOf('id="more-panel"'), html.indexOf('id="image-input"'));
const header = html.slice(html.indexOf('class="write-top"'), html.indexOf('class="write-body"'));

describe("#56 GoodNotes 4 utility bar", () => {
  it("locks one bar, cell metrics, and tool order", () => {
    assert.deepEqual(BAR_TOOLS, [
      "pen",
      "highlighter",
      "pencil",
      "eraser",
      "select",
      "stamp",
      "undo",
      "redo",
      "more",
    ]);
    assert.equal(BAR_HEIGHT, 56);
    assert.equal(BAR_PAD, 8);
    assert.equal(BAR_RADIUS, 28);
    assert.equal(BAR_BORDER, "#E6E1D6");
    assert.equal(CELL, 44);
    assert.equal(CELL_GAP, 4);
    assert.equal(CELL_NARROW, 36);
    assert.equal(CELL_GAP_NARROW, 2);
    assert.equal(NARROW_BAR_WIDTH, 444);
    assert.equal(ICON, 22);
    assert.equal(ICON_NARROW, 20);
    assert.equal(ICON_COLOR, "#2C2A26");
    assert.equal(CELL_SELECTED, "#EDE8DC");
    assert.equal(COLOR_DOT, 8);
    assert.deepEqual(COLOR_DOT_TOOLS, ["pen", "highlighter", "pencil"]);
    assert.equal(GRIP_WIDTH, 16);
    assert.equal(GRIP_DOT, "#D4CFC4");
    assert.ok(barNaturalWidth(false) >= 444);
    assert.ok(barNaturalWidth(true) < 444);
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.doesNotMatch(html, /id="m4-bar"|id="m4-rail"|class="m4-rail"/);
    assert.doesNotMatch(toolbar, /data-slot=/);
    assert.doesNotMatch(toolbar, /toolbar-cluster/);
    assert.ok(toolbar.indexOf("toolbar-grip") < toolbar.indexOf('data-tool="pen"'));
    assert.ok(toolbar.indexOf('data-tool="pen"') < toolbar.indexOf('data-tool="highlighter"'));
    assert.ok(toolbar.indexOf('data-tool="highlighter"') < toolbar.indexOf('data-tool="pencil"'));
    assert.ok(toolbar.indexOf('data-tool="pencil"') < toolbar.indexOf('id="eraser-btn"'));
    assert.ok(toolbar.indexOf('id="eraser-btn"') < toolbar.indexOf('id="select-btn"'));
    assert.ok(toolbar.indexOf('id="select-btn"') < toolbar.indexOf('id="stamp-btn"'));
    assert.ok(toolbar.indexOf('id="stamp-btn"') < toolbar.indexOf('id="undo-btn"'));
    assert.ok(toolbar.indexOf('id="undo-btn"') < toolbar.indexOf('id="redo-btn"'));
    assert.ok(toolbar.indexOf('id="redo-btn"') < toolbar.indexOf('id="more-btn"'));
    assert.match(toolbar, /id="toolbar-grip"/);
    assert.match(toolbar, /class="tool-dot"/);
    assert.equal((toolbar.match(/class="tool-dot"/g) || []).length, 3);
    assert.doesNotMatch(toolbar, /id="settings-btn"|id="prev-btn"|id="next-btn"|interact-btn/);
    assert.doesNotMatch(toolbar, /slot-color|data-color=/);
    assert.match(css, /\.toolbar \{[\s\S]*height: 56px/);
    assert.match(css, /\.toolbar \{[\s\S]*padding: var\(--bar-pad\)/);
    assert.match(css, /\.toolbar \{[\s\S]*border-radius: 28px/);
    assert.match(css, /\.toolbar \{[\s\S]*border: 1px solid #e6e1d6/);
    assert.match(css, /\.toolbar \{[\s\S]*background: #fff/);
    assert.match(css, /\.toolbar \{[\s\S]*flex-wrap: nowrap/);
    assert.match(css, /--bar-pad: 8px/);
    assert.match(css, /--cell: 44px/);
    assert.match(css, /--cell-gap: 4px/);
    assert.match(css, /--icon: 22px/);
    assert.match(css, /\.toolbar\.is-narrow \{[\s\S]*--cell: 36px/);
    assert.match(css, /\.toolbar\.is-narrow \{[\s\S]*--cell-gap: 2px/);
    assert.match(css, /\.toolbar\.is-narrow \{[\s\S]*--icon: 20px/);
    assert.match(css, /\.tool \{[\s\S]*color: #2c2a26/);
    assert.match(css, /\.tool\.is-selected \{[\s\S]*background: #ede8dc/);
    assert.match(css, /\.tool-dot \{[\s\S]*width: 8px;[\s\S]*height: 8px/);
    assert.match(css, /\.toolbar-grip \{[\s\S]*width: var\(--grip\)/);
    assert.match(css, /\.toolbar-grip span \{[\s\S]*background: #d4cfc4/);
    // #49: rails are back, but as the same one capsule turned on its side.
    assert.match(css, /\[data-toolbar="left"\] \.toolbar,[\s\S]*flex-direction: column/);
  });

  it("keeps view/edit on the header lock and palette off the bar", () => {
    assert.match(header, /id="interact-btn"/);
    assert.match(header, /id="prev-btn"/);
    assert.match(header, /id="next-btn"/);
    assert.doesNotMatch(header, /undo-btn|more-btn|select-btn|toolbar-grip/);
    assert.match(css, /\.interact-lock \{[\s\S]*color: #8a8478/);
    assert.match(css, /\.interact-lock-icon \{[\s\S]*width: 32px;[\s\S]*height: 32px/);
    assert.match(header, /보기|편집/);
    assert.doesNotMatch(header, /읽기/);
    assert.match(html, /id="slot-panel"/);
    assert.match(html, /id="slot-palette"/);
    assert.match(css, /\.slot-palette\[data-kind="pen"\] \{[\s\S]*repeat\(3, 28px\)/);
    assert.match(main, /function openInkEditor/);
    assert.match(main, /selectInkTool/);
    assert.match(main, /createShapeHold\(/);
    assert.match(main, /from "\.\/shapeHold\.js"/);
    assert.match(html, /id="shape-chips"/);
    assert.doesNotMatch(toolbar, /shape-chips|data-shape=/);
  });

  it("puts overflow rows on ⋯ and keeps undo hold + visible redo", () => {
    assert.deepEqual(BAR_OVERFLOW_ITEMS, M4_OVERFLOW_ITEMS);
    assert.deepEqual(M4_OVERFLOW_ITEMS, [
      "fullscreen",
      "image",
      "sticker",
      "rotate",
      "pagecopy",
      "pagepaste",
      "save",
      "bake",
      "saveas",
      "export",
      "inkmove",
    ]);
    assert.doesNotMatch(more, /마스킹\(모자이크\)|data-more="mosaic"/);
    assert.doesNotMatch(more, /영역캡처/, "#110: 선택 칸이 겸한다");
    assert.match(more, /전체화면/);
    assert.match(more, /이미지/);
    assert.match(more, /data-rotate="-90">왼쪽/);
    assert.match(more, /data-rotate="90">오른쪽/);
    assert.doesNotMatch(more, /미리보기/);
    assert.match(more, /data-more="save">저장/);
    assert.match(more, /data-more="export">내보내기/);
    assert.doesNotMatch(more, /data-more="select"/);
    const saveFn = main.slice(main.indexOf("async function saveDocumentNow"), main.indexOf("async function exportDocument("));
    const exportFn = main.slice(main.indexOf("async function exportDocument("), main.indexOf("function selectMoreAction"));
    // #54: 저장은 필기 persist + 주석 박힌 PDF 다운로드, 내보내기는 공유 시트.
    assert.match(saveFn, /persistStrokes/);
    assert.match(saveFn, /저장했습니다/);
    assert.match(saveFn, /downloadBlob/);
    assert.doesNotMatch(saveFn, /navigator\.share/);
    assert.match(exportFn, /navigator\.share/);
    assert.match(exportFn, /downloadBlob/);
    assert.doesNotMatch(main, /내보내기는 다음입니다/);
    assert.match(main, /import\("\.\/exportPdf\.js"\)/);
    assert.equal(UNDO_HOLD_MS, 400);
    assert.match(main, /bindUndoHold\(els\.undoBtn,\s*\{\s*onUndo:\s*undoInk,\s*onRedo:\s*redoInk/);
    assert.match(main, /els\.redoBtn\.disabled = !canRedo/);
    assert.match(main, /els\.undoBtn\.disabled = !canUndo/);
    assert.match(main, /beginInkPoints\(/);
    assert.match(main, /lastInkUpClient/);
  });

  it("long-press-drag docks top/bottom, the left/right rails, or floats (#49)", () => {
    assert.deepEqual(DOCK_POSITIONS, ["top", "bottom", "left", "right", "float"]);
    assert.equal(migrateDock("left"), "left");
    assert.equal(migrateDock("right"), "right");
    assert.equal(migrateDock("top"), "top");
    assert.equal(migrateDock("nonsense"), "top");
    assert.equal(snapDockFromPoint(200, 20, 400, 800, 360, 56).pos, "top");
    assert.equal(snapDockFromPoint(200, 790, 400, 800, 360, 56).pos, "bottom");
    assert.equal(snapDockFromPoint(20, 400, 400, 800, 360, 56).pos, "left");
    assert.equal(snapDockFromPoint(390, 400, 400, 800, 360, 56).pos, "right");
    assert.equal(snapDockFromPoint(200, 400, 400, 800, 360, 56).pos, "float");
    // A corner still docks to the band it was dropped in, top/bottom first.
    assert.equal(snapDockFromPoint(10, 10, 400, 800, 360, 56).pos, "top");
    assert.ok(DOCK_BAND_PX > 0);
    assert.match(main, /bindToolbarGrip/);
    assert.match(main, /snapDockFromPoint/);
    const railCss = css.slice(css.indexOf(".toolbar-rail {"), css.indexOf(".write-screen[data-toolbar=\"bottom\"] .toolbar-rail"));
    assert.match(railCss, /position: absolute/);
    assert.match(railCss, /inset: 0/);
    assert.doesNotMatch(railCss, /flex: 0 0 auto/);
    assert.match(css, /\[data-toolbar="bottom"\] \.toolbar-rail \{[\s\S]*align-items: flex-end/);
    assert.match(css, /\[data-toolbar="float"\] \.toolbar \{[\s\S]*position: fixed/);
    assert.match(html, /data-pos="left">왼쪽/);
    assert.match(html, /data-pos="right">오른쪽/);
    assert.match(html, /data-pos="float">떠 있게/);
    const dockFn = main.slice(main.indexOf("async function setToolbarPosition"), main.indexOf("async function setViewMode"));
    assert.doesNotMatch(dockFn, /rebuildPages/);
  });

  it("does not wrap or add a second bar/pill", () => {
    assert.match(css, /\.toolbar \{[\s\S]*flex-wrap: nowrap/);
    assert.match(css, /\.toolbar-cells \{[\s\S]*flex-wrap: nowrap/);
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.doesNotMatch(html, /class="m4-bar"|id="m4-bar"|class="touch-pill"/);
  });
});

describe("#49 메뉴 위치 왼·오 이동", () => {
  it("keeps one capsule and never squashes the paper", () => {
    // The rail overlays the workspace (#30): no column that shrinks the page.
    const railCss = css.slice(css.indexOf(".toolbar-rail {"), css.indexOf(".toolbar {"));
    assert.match(railCss, /position: absolute/);
    assert.doesNotMatch(railCss, /flex: 0 0 auto|width: 56px/);
    assert.match(css, /\[data-toolbar="left"\] \.toolbar-rail \{[\s\S]*justify-content: flex-start/);
    assert.match(css, /\[data-toolbar="right"\] \.toolbar-rail \{[\s\S]*justify-content: flex-end/);
    assert.match(css, /\[data-toolbar="left"\] \.toolbar-cells,[\s\S]*flex-direction: column/);
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.equal(
      (toolbar.match(/data-tool=|id="undo-btn"|id="redo-btn"|id="more-btn"/g) || []).length,
      BAR_TOOLS.length,
    );
    const dockFn = main.slice(main.indexOf("async function setToolbarPosition"), main.indexOf("async function setViewMode"));
    assert.doesNotMatch(dockFn, /rebuildPages|applyPageSize/);
  });

  it("stacks the same cells, going narrow only when the screen is short", () => {
    assert.equal(isRail("left"), true);
    assert.equal(isRail("right"), true);
    assert.equal(isRail("top"), false);
    assert.equal(barNaturalHeight(false), barNaturalWidth(false));
    assert.equal(barLength("left", false), barNaturalHeight(false));
    assert.equal(barLength("top", false), barNaturalWidth(false));
    assert.equal(useNarrowRail(900), false);
    assert.equal(useNarrowRail(380), true);
    assert.ok(barNaturalHeight(true) < barNaturalHeight(false));
  });

  it("opens the ⋯ panel away from the rail, and pages still turn in the header", () => {
    const overflow = main.slice(main.indexOf("function overflowSide"), main.indexOf("function placeOverflowPanel"));
    assert.match(overflow, /toolbarPos === "left"[\s\S]*return "right"/);
    assert.match(overflow, /toolbarPos === "right"[\s\S]*return "left"/);
    assert.match(header, /id="prev-btn"/);
    assert.match(header, /id="next-btn"/);
    assert.doesNotMatch(header, /toolbar-grip/);
  });
});

describe("#49 레일에서 패널", () => {
  it("opens the slot palette beside the rail, not under the whole bar", () => {
    const place = main.slice(main.indexOf("function placePanel"), main.indexOf("function paletteFor"));
    assert.match(place, /isRail\(state\.toolbarPos\)/);
    assert.match(place, /toolbarPos === "left" \? bar\.right \+ gap : bar\.left - gap - width/);
    assert.match(place, /top = anchor\.top \+ anchor\.height \/ 2 - height \/ 2/);
    // Top/bottom/float keep the old placement.
    assert.match(place, /toolbarPos === "bottom" \|\| \(state\.toolbarPos === "float"/);
  });
});

describe("#94 종이 여백", () => {
  it("adds push room without shrinking the paper", () => {
    assert.match(css, /--pan-margin: 64px/);
    assert.match(css, /\[data-view="scroll"\] \.workspace \{[\s\S]*padding: var\(--pan-margin\) 12px/);
    assert.match(
      css,
      /\[data-view="scroll"\]\[data-toolbar="left"\] \.workspace,[\s\S]*padding-left: var\(--pan-margin\)/,
    );
    // Page view keeps its own small padding: the bar never carves the workspace.
    const pageWorkspace = css.slice(css.indexOf(".workspace {"), css.indexOf('[data-view="scroll"] .workspace'));
    assert.match(pageWorkspace, /padding: 8px 12px/);
    // fitScale still measures the whole workspace, minus its 12+12 padding only.
    const fit = main.slice(main.indexOf("function fitScale"), main.indexOf("async function basePageCss"));
    assert.match(fit, /clientWidth - 24/);
    assert.doesNotMatch(fit, /BAR_HEIGHT|PAN_MARGIN_PX|toolbarPos/);
  });

  it("shifts the scroll math by the padding, not the page geometry", () => {
    assert.match(main, /function scrollPadPx\(\)[\s\S]*viewMode === "scroll" \? PAN_MARGIN_PX : 0/);
    assert.match(main, /offset: scrollPadPx\(\)/);
    assert.match(main, /pageStackOffset\(pageNum, metrics\) \* state\.userScale - 12 \+ scrollPadPx\(\)/);
  });
});

describe("#119 헤더로 옮긴 미리보기·보기/편집", () => {
  const top = html.slice(html.indexOf('class="write-top"'), html.indexOf('class="write-body"'));

  it("puts 다른 PDF · 미리보기 left, 보기/편집 right beside the pager (#212)", () => {
    const start = top.slice(top.indexOf('class="write-top-start"'), top.indexOf('class="doc-title"'));
    assert.match(start, /id="other-pdf"/);
    assert.match(start, /id="preview-btn"/);
    assert.doesNotMatch(start, /id="interact-btn"/, "the lock moved right (#212)");
    const end = top.slice(top.indexOf('class="write-top-end"'));
    assert.match(end, /id="interact-btn"/);
    assert.ok(end.indexOf('id="interact-btn"') < end.indexOf('class="page-pager"'), "lock, then the pager");
    // The title comes after the left group, the pager stays on the right.
    assert.ok(top.indexOf('id="preview-btn"') < top.indexOf('class="doc-title"'));
    assert.ok(top.indexOf('class="doc-title"') < top.indexOf('id="next-btn"'));
  });

  it("takes the preview cell off the bar and keeps it out of ⋯", () => {
    assert.equal(BAR_TOOLS.length, 9);
    assert.doesNotMatch(BAR_TOOLS.join(","), /preview/);
    assert.doesNotMatch(toolbar, /id="preview-btn"/);
    assert.doesNotMatch(html, /data-more="preview"/);
    assert.equal((html.match(/id="preview-btn"/g) || []).length, 1, "one preview button only");
  });

  it("keeps the header icon out of the way of the title", () => {
    assert.match(css, /\.write-top-start \{[\s\S]*display: flex/);
    assert.match(css, /\.header-icon \{[\s\S]*width: 32px[\s\S]*height: 32px/);
    assert.match(css, /\.doc-title \{[\s\S]*max-width: min\(38vw/);
  });
});
