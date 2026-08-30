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
  barNaturalWidth,
  migrateDock,
  snapDockFromPoint,
  useNarrowCells,
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
    assert.doesNotMatch(css, /\[data-toolbar="left"\] \.toolbar/);
  });

  it("keeps view/edit on the header lock and palette off the bar", () => {
    assert.match(header, /id="interact-btn"/);
    assert.match(header, /id="prev-btn"/);
    assert.match(header, /id="next-btn"/);
    assert.doesNotMatch(header, /undo-btn|more-btn|select-btn|toolbar-grip/);
    assert.match(css, /\.interact-lock \{[\s\S]*color: #8a8478/);
    assert.match(css, /\.interact-lock-icon \{[\s\S]*width: 32px;[\s\S]*height: 32px/);
    assert.match(header, /읽기|편집/);
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
      "mosaic",
      "capture",
      "fullscreen",
      "image",
      "rotate",
      "preview",
      "save",
      "export",
    ]);
    assert.match(more, /마스킹\(모자이크\)/);
    assert.match(more, /영역캡처/);
    assert.match(more, /전체화면/);
    assert.match(more, /이미지/);
    assert.match(more, /data-rotate="-90">왼쪽/);
    assert.match(more, /data-rotate="90">오른쪽/);
    assert.match(more, /미리보기/);
    assert.match(more, /data-more="save">저장/);
    assert.match(more, /data-more="export">내보내기/);
    assert.doesNotMatch(more, /data-more="select"/);
    const saveFn = main.slice(main.indexOf("function saveDocumentNow"), main.indexOf("function exportDocumentStub"));
    const exportFn = main.slice(main.indexOf("function exportDocumentStub"), main.indexOf("function selectMoreAction"));
    assert.match(saveFn, /persistStrokes/);
    assert.match(saveFn, /저장했습니다/);
    assert.doesNotMatch(saveFn, /navigator\.share|createObjectURL|download|pdf-lib|jsPDF/);
    assert.match(exportFn, /내보내기는 다음입니다/);
    assert.doesNotMatch(exportFn, /navigator\.share|createObjectURL|download|pdf-lib|jsPDF/);
    assert.doesNotMatch(main, /navigator\.share/);
    assert.equal(UNDO_HOLD_MS, 400);
    assert.match(main, /bindUndoHold\(els\.undoBtn,\s*\{\s*onUndo:\s*undoInk,\s*onRedo:\s*redoInk/);
    assert.match(main, /els\.redoBtn\.disabled = !canRedo/);
    assert.match(main, /els\.undoBtn\.disabled = !canUndo/);
    assert.match(main, /beginInkPoints\(/);
    assert.match(main, /lastInkUpClient/);
  });

  it("long-press-drag docks top/bottom or floats without left/right rails", () => {
    assert.deepEqual(DOCK_POSITIONS, ["top", "bottom", "float"]);
    assert.equal(migrateDock("left"), "float");
    assert.equal(migrateDock("right"), "float");
    assert.equal(migrateDock("top"), "top");
    assert.equal(snapDockFromPoint(200, 20, 400, 800, 360, 56).pos, "top");
    assert.equal(snapDockFromPoint(200, 790, 400, 800, 360, 56).pos, "bottom");
    assert.equal(snapDockFromPoint(120, 400, 400, 800, 360, 56).pos, "float");
    assert.ok(DOCK_BAND_PX > 0);
    assert.match(main, /bindToolbarGrip/);
    assert.match(main, /snapDockFromPoint/);
    const railCss = css.slice(css.indexOf(".toolbar-rail {"), css.indexOf(".write-screen[data-toolbar=\"bottom\"] .toolbar-rail"));
    assert.match(railCss, /position: absolute/);
    assert.match(railCss, /inset: 0/);
    assert.doesNotMatch(railCss, /flex: 0 0 auto/);
    assert.match(css, /\[data-toolbar="bottom"\] \.toolbar-rail \{[\s\S]*align-items: flex-end/);
    assert.match(css, /\[data-toolbar="float"\] \.toolbar \{[\s\S]*position: fixed/);
    assert.doesNotMatch(html, /data-pos="left"|data-pos="right"/);
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
