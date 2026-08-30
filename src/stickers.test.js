import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CHROMA_TOLERANCE,
  DEFAULT_FOLDER_ID,
  DEFAULT_FOLDER_NAME,
  STICKER_GAP,
  STICKER_THUMB,
  STUDIO_HANDLES,
  STUDIO_SCALE_MAX,
  STUDIO_SCALE_MIN,
  STUDIO_TOOLS,
  addFolder,
  cornerScale,
  applyChroma,
  deleteFolder,
  deleteSticker,
  eraseCircle,
  makeFolder,
  makeSticker,
  moveSticker,
  normalizeAngle,
  normalizeFolders,
  normalizeStickers,
  pixelAt,
  regionPixelRect,
  renameFolder,
  rotatedSize,
  scaledSize,
  stickerFitSize,
  stickerSizeOnPage,
  stickersInFolder,
  wholeImageRect,
} from "./stickers.js";

function solid(width, height, [r, g, b, a]) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = r;
    rgba[i + 1] = g;
    rgba[i + 2] = b;
    rgba[i + 3] = a;
  }
  return rgba;
}

describe("#79 스티커 폴더", () => {
  it("always keeps 미분류 first", () => {
    assert.deepEqual(normalizeFolders([]), [{ id: DEFAULT_FOLDER_ID, name: DEFAULT_FOLDER_NAME }]);
    const folders = addFolder([], "수학");
    assert.equal(folders[0].id, DEFAULT_FOLDER_ID);
    assert.equal(folders[1].name, "수학");
    assert.equal(normalizeFolders(folders).length, 2);
    // A stored list that already has 미분류 does not get a second one.
    assert.equal(normalizeFolders([{ id: DEFAULT_FOLDER_ID, name: "미분류" }]).length, 1);
  });

  it("renames anything but 미분류", () => {
    const folders = addFolder([], "수학");
    assert.equal(renameFolder(folders, folders[1].id, "국어")[1].name, "국어");
    assert.equal(renameFolder(folders, DEFAULT_FOLDER_ID, "딴이름")[0].name, DEFAULT_FOLDER_NAME);
    // An empty name keeps the old one.
    assert.equal(renameFolder(folders, folders[1].id, "   ")[1].name, "수학");
    assert.equal(makeFolder("  ").name, "새 폴더");
  });

  it("keeps the stickers when a folder goes", () => {
    const folders = addFolder([], "수학");
    const id = folders[1].id;
    const stickers = [makeSticker({ src: "data:x", folderId: id }), makeSticker({ src: "data:y" })];
    const out = deleteFolder(folders, stickers, id);
    assert.equal(out.folders.length, 1);
    assert.deepEqual(out.stickers.map((sticker) => sticker.folderId), [DEFAULT_FOLDER_ID, DEFAULT_FOLDER_ID]);
    assert.equal(deleteFolder(folders, stickers, DEFAULT_FOLDER_ID).folders.length, 2);
  });

  it("files a sticker in one folder and moves it by drag", () => {
    const folders = addFolder([], "수학");
    const sticker = makeSticker({ src: "data:x" });
    const moved = moveSticker([sticker], sticker.id, folders[1].id);
    assert.equal(moved[0].folderId, folders[1].id);
    assert.equal(stickersInFolder(moved, folders[1].id).length, 1);
    assert.equal(stickersInFolder(moved, DEFAULT_FOLDER_ID).length, 0);
    assert.equal(deleteSticker(moved, sticker.id).length, 0);
  });

  it("rescues a sticker whose folder is gone", () => {
    const orphan = { ...makeSticker({ src: "data:x" }), folderId: "f:missing" };
    assert.equal(normalizeStickers([orphan], []).at(0).folderId, DEFAULT_FOLDER_ID);
    // Entries without a picture are dropped.
    assert.equal(normalizeStickers([{ id: "s:1" }], []).length, 0);
  });

  it("locks the drawer numbers from the design note", () => {
    assert.equal(STICKER_THUMB, 64);
    assert.equal(STICKER_GAP, 8);
    assert.deepEqual(STUDIO_TOOLS, ["chroma", "eraser", "rotate"]);
  });
});

describe("#79 영역 자르기", () => {
  it("turns each drag into its own source rect", () => {
    // Preview 280x160 showing a 1400x800 picture: 5x.
    const rect = regionPixelRect({ x1: 10, y1: 20, x2: 60, y2: 60 }, 280, 160, 1400, 800);
    assert.deepEqual(rect, { x: 50, y: 100, w: 250, h: 200 });
  });

  it("ignores a tap or a hairline drag", () => {
    assert.equal(regionPixelRect({ x1: 10, y1: 10, x2: 10, y2: 10 }, 280, 160, 280, 160), null);
    assert.equal(regionPixelRect({ x1: 10, y1: 10, x2: 14, y2: 40 }, 280, 160, 280, 160), null);
  });

  it("clamps a drag that ran off the picture", () => {
    const rect = regionPixelRect({ x1: -50, y1: -50, x2: 400, y2: 400 }, 280, 160, 280, 160);
    assert.deepEqual(rect, { x: 0, y: 0, w: 280, h: 160 });
    assert.deepEqual(wholeImageRect(300, 200), { x: 0, y: 0, w: 300, h: 200 });
  });

  it("caps a big picture but keeps its shape", () => {
    assert.deepEqual(stickerFitSize(200, 100), { width: 200, height: 100 });
    const big = stickerFitSize(2048, 1024);
    assert.equal(big.width, 512);
    assert.equal(big.height, 256);
  });
});

describe("#79 스튜디오", () => {
  it("turns to any angle, no 90 snap", () => {
    assert.deepEqual(rotatedSize(100, 100, 0), { width: 100, height: 100 });
    assert.deepEqual(rotatedSize(100, 100, 90), { width: 100, height: 100 });
    const tilted = rotatedSize(100, 100, 45);
    assert.equal(tilted.width, 141);
    assert.equal(tilted.height, 141);
    assert.equal(normalizeAngle(-30), 330);
    assert.equal(normalizeAngle(370), 10);
    assert.equal(normalizeAngle(17), 17, "not snapped to 90");
  });

  it("makes the picked colour see-through and leaves the rest", () => {
    const rgba = solid(2, 2, [255, 255, 255, 255]);
    rgba.set([10, 20, 30, 255], 0);
    const out = applyChroma(rgba, { r: 255, g: 255, b: 255 }, CHROMA_TOLERANCE);
    assert.equal(out[3], 255, "the dark pixel stays");
    assert.equal(out[7], 0, "white goes clear");
    assert.deepEqual(pixelAt(out, 2, 0, 0), { r: 10, g: 20, b: 30, a: 255 });
    assert.equal(pixelAt(out, 2, 9, 9), null);
    // The source buffer is untouched.
    assert.equal(rgba[7], 255);
  });

  it("erases a round patch, alpha only", () => {
    const rgba = solid(9, 9, [200, 100, 50, 255]);
    const out = eraseCircle(rgba, 9, 9, 4, 4, 2);
    assert.equal(pixelAt(out, 9, 4, 4).a, 0);
    assert.equal(pixelAt(out, 9, 4, 4).r, 200, "colour is kept, only alpha cleared");
    assert.equal(pixelAt(out, 9, 0, 0).a, 255);
    assert.equal(rgba[3], 255, "source untouched");
  });

  it("places a sticker at a readable size, never bigger than the picture", () => {
    const big = stickerSizeOnPage(512, 512, 360, 520);
    assert.ok(big.w <= 0.35 && big.w > 0.3);
    const small = stickerSizeOnPage(20, 20, 360, 520);
    assert.ok(Math.abs(small.w - 20 / 360) < 1e-9, "a small sticker is not blown up");
  });
});

describe("#79 시트 배선", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const main = readFileSync(join(here, "main.js"), "utf8");
  const css = readFileSync(join(here, "style.css"), "utf8");
  const html = readFileSync(join(here, "..", "index.html"), "utf8");

  it("hangs off ⋯ and adds no bar cell, and does not touch the stamp", () => {
    assert.match(html, /data-more="sticker">스티커/);
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.doesNotMatch(html, /data-tool="sticker"/);
    // The stamp stays the red ellipse it was (#50).
    assert.match(html, /data-tool="stamp"/);
  });

  it("keeps the design numbers from the note", () => {
    assert.match(css, /\.sticker-head \{[\s\S]*height: 44px/);
    assert.match(css, /\.sticker-close \{[\s\S]*width: 32px[\s\S]*height: 32px/);
    assert.match(css, /\.sticker-sheet \{[\s\S]*background: #f3f0e8/);
    assert.match(css, /\.sticker-drop \{[\s\S]*width: 280px[\s\S]*height: 160px[\s\S]*border-radius: 16px/);
    assert.match(css, /\.sticker-drop \{[\s\S]*dashed #d4cfc4/);
    assert.match(css, /\.sticker-flat \{[\s\S]*height: 32px[\s\S]*color: #8a8478/);
    assert.match(css, /\.sticker-region \{[\s\S]*1\.5px solid #c4a574[\s\S]*border-radius: 8px/);
    assert.match(css, /\.sticker-tools \{[\s\S]*height: 56px[\s\S]*gap: 4px/);
    assert.match(css, /\.sticker-tools button \{[\s\S]*height: 44px[\s\S]*min-width: 44px/);
    assert.match(css, /\.sticker-folder \{[\s\S]*height: 36px/);
    assert.match(css, /\.sticker-folder-add \{[\s\S]*width: 32px/);
    assert.match(css, /\.sticker-cell \{[\s\S]*width: 64px[\s\S]*height: 64px/);
    assert.match(css, /\.sticker-grid \{[\s\S]*gap: 8px/);
  });

  it("stays in this browser: IndexedDB only, no upload", () => {
    assert.match(main, /saveStickers\(state\.stickers\)/);
    assert.match(main, /loadStickerFolders\(\), loadStickers\(\)/);
    const sticker = main.slice(main.indexOf("/* ---- 스티커 (#79)"), main.indexOf("function selectMoreAction"));
    assert.doesNotMatch(sticker, /fetch\(|XMLHttpRequest|navigator\.clipboard\.read/);
    assert.doesNotMatch(sticker, /image\/svg/);
  });

  it("cuts one sticker per region and can take the whole picture", () => {
    assert.match(main, /rects\.map\(\(rect\) => cutSticker\(rect\)\)/);
    assert.match(main, /addStickersFromRegions\(true\)/);
    assert.match(main, /wholeImageRect\(stickerSource\.width, stickerSource\.height\)/);
  });

  it("puts a sticker on the paper as an image item, so #68 handles work", () => {
    const place = main.slice(main.indexOf("function placeSticker"), main.indexOf("function selectMoreAction"));
    assert.match(place, /imageItem\(\{ src: sticker\.src/);
    assert.match(place, /commitPageChange/);
    assert.doesNotMatch(place, /stampInkItem|type: "stamp"/);
  });

  it("edits with chroma, eraser and a free angle", () => {
    for (const tool of STUDIO_TOOLS) {
      assert.match(html, new RegExp(`data-studio="${tool}"`), tool);
    }
    assert.match(main, /applyChroma\(studioPixels\.data, color, CHROMA_TOLERANCE\)/);
    assert.match(main, /eraseCircle\(studioPixels\.data/);
    assert.match(main, /rotate\(\$\{angle\}deg\)/);
    assert.doesNotMatch(main, /Math\.round\(angle \/ 90\)/, "no 90 snap");
  });
});

describe("#79 코너 크기", () => {
  it("scales by the diagonal drag, shape kept", () => {
    // 100 wide: dragging the se corner out by 50/50 grows it by one half.
    assert.equal(cornerScale(100, 100, "se", 50, 50, 1), 2);
    assert.equal(cornerScale(100, 100, "nw", -50, -50, 1), 2);
    assert.equal(cornerScale(100, 100, "se", -25, -25, 1), 0.5);
    assert.equal(cornerScale(100, 100, "ne", 50, -50, 1), 2);
  });

  it("stops at the ends instead of vanishing or exploding", () => {
    assert.equal(cornerScale(100, 100, "se", -9000, -9000, 1), STUDIO_SCALE_MIN);
    assert.equal(cornerScale(100, 100, "se", 9000, 9000, 1), STUDIO_SCALE_MAX);
  });

  it("keeps the shape when baking the new size", () => {
    assert.deepEqual(scaledSize(200, 100, 2), { width: 400, height: 200 });
    assert.deepEqual(scaledSize(200, 100, 1), { width: 200, height: 100 });
    assert.deepEqual(scaledSize(200, 100, 0.5), { width: 100, height: 50 });
  });
});

describe("#79 코너 크기 배선", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const main = readFileSync(join(here, "main.js"), "utf8");
  const css = readFileSync(join(here, "style.css"), "utf8");
  const html = readFileSync(join(here, "..", "index.html"), "utf8");

  it("has the four corner handles and bakes size with angle on save", () => {
    for (const handle of STUDIO_HANDLES) {
      assert.match(html, new RegExp(`data-handle="${handle}"`), handle);
    }
    assert.match(css, /\.sticker-handle \{[\s\S]*width: 8px[\s\S]*height: 8px/);
    assert.match(main, /cornerScale\(/);
    assert.match(main, /const sized = studioScaledCanvas\(state\.studioScale\)/);
    assert.match(main, /angle \? studioRotatedCanvas\(angle, sized\) : sized/);
  });
});
