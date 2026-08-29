import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  coerceSheets,
  defaultSheets,
  filterSheets,
  insertOutlineSheet,
  PREVIEW_DRAWER_WIDTH,
  PREVIEW_THUMB_GAP,
  PREVIEW_THUMB_SIZE,
  toggleBookmark,
} from "./preview.js";

describe("preview drawer model", () => {
  it("keeps drawer metrics and outline/bookmark filters", () => {
    assert.equal(PREVIEW_DRAWER_WIDTH, 120);
    assert.equal(PREVIEW_THUMB_SIZE, 88);
    assert.equal(PREVIEW_THUMB_GAP, 8);
    const sheets = defaultSheets(2);
    assert.deepEqual(sheets.map((sheet) => sheet.key), ["1", "2"]);
    const withOutline = insertOutlineSheet(sheets, 0, "abc");
    assert.equal(withOutline[1].kind, "outline");
    assert.equal(withOutline[1].key, "ol-abc");
    const marks = toggleBookmark([], "1");
    assert.deepEqual(filterSheets(withOutline, marks, "bookmarks").map((sheet) => sheet.key), ["1"]);
    assert.deepEqual(filterSheets(withOutline, marks, "outlines").map((sheet) => sheet.key), ["ol-abc"]);
    assert.equal(coerceSheets(null, 3).length, 3);
  });
});
