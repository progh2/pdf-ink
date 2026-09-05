import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SHELF_TTL_MS, newShelfId, pruneShelf, shelfEntry, shelfRemainLabel } from "./shelf.js";

describe("#267 선반", () => {
  it("makes a page entry that carries its ink", () => {
    const e = shelfEntry({ kind: "page", src: "data:image/jpeg;base64,x", items: [{ type: "pen" }], w: 800, h: 600 });
    assert.equal(e.kind, "page");
    assert.equal(e.items.length, 1);
    assert.ok(e.id.startsWith("p:"));
  });

  it("falls back thumb to src, and refuses a bad entry", () => {
    assert.equal(shelfEntry({ kind: "image", src: "data:image/png,x" }).thumb, "data:image/png,x");
    assert.equal(shelfEntry({ kind: "page", src: "" }), null);
    assert.equal(shelfEntry({ kind: "nope", src: "x" }), null);
  });

  it("drops entries older than the TTL, newest first", () => {
    const now = 1_000_000_000_000;
    const fresh = { id: "a", src: "x", createdAt: now - 1000 };
    const old = { id: "b", src: "x", createdAt: now - SHELF_TTL_MS - 1 };
    const newer = { id: "c", src: "x", createdAt: now - 10 };
    const kept = pruneShelf([fresh, old, newer], now);
    assert.deepEqual(kept.map((one) => one.id), ["c", "a"], "오래된 b는 빠지고 최근 c 먼저");
  });

  it("caps the list", () => {
    const now = Date.now();
    const many = Array.from({ length: 80 }, (_, i) => ({ id: `k${i}`, src: "x", createdAt: now - i }));
    assert.equal(pruneShelf(many, now).length, 60);
  });

  it("says how long is left in words", () => {
    const now = Date.now();
    assert.match(shelfRemainLabel({ createdAt: now }, now), /일 남음/);
    assert.match(shelfRemainLabel({ createdAt: now - (SHELF_TTL_MS - 3600_000) }, now), /시간 남음|곧/);
    assert.equal(shelfRemainLabel({ createdAt: now - SHELF_TTL_MS }, now), "곧 지워짐");
  });

  it("gives each entry its own id", () => {
    assert.notEqual(newShelfId(), newShelfId());
  });
});

describe("#267 배선", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const main = readFileSync(join(root, "src/main.js"), "utf8");
  const html = readFileSync(join(root, "index.html"), "utf8");

  it("offers shelve and open on the overflow menu", () => {
    assert.match(html, /data-more="shelfadd">이 쪽을 선반에/);
    assert.match(html, /data-more="shelf">선반 열기/);
    assert.match(main, /action === "shelfadd"[\s\S]{0,80}shelveCurrentPage\(\)/);
    assert.match(main, /action === "shelf"[\s\S]{0,80}openShelf\(\)/);
  });

  it("reads the shelf fresh each open, so another tab's add shows up", () => {
    const open = main.slice(main.indexOf("async function openShelf"), main.indexOf("function closeShelf"));
    assert.match(open, /pruneShelf\(await loadShelf\(\)\)/, "IndexedDB에서 새로 읽는다");
    assert.match(open, /pruneShelfStore/, "오래된 것은 저장소에서도 지운다");
  });

  it("pastes a shelved page as a new page, image as an image", () => {
    const paste = main.slice(main.indexOf("async function pasteFromShelf"), main.indexOf("function movePageByDrag"));
    assert.match(paste, /entry\.kind === "image"[\s\S]{0,120}pasteImageAt\(state\.page, null, entry\.src\)/);
    assert.match(paste, /insertOutlineAfter\(state\.leaves, index, id\)/, "쪽은 새 쪽으로");
    assert.match(paste, /state\.pages\[id\] = \[image, \.\.\.cloneItems\(entry\.items \|\| \[\]\)\]/);
  });

  it("prunes the shelf on startup", () => {
    assert.match(main, /pruneShelfStore\(pruneShelf\(await loadShelf\(\)\)\.map/);
  });
});
