import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  findImageEntry,
  pasteAvailability,
  pastePlacement,
  pickImageType,
  readClipboardImage,
} from "./clipboardPaste.js";

const entry = (types) => ({ types, getType: async (type) => `blob:${type}` });

describe("#219 바깥에서 복사해 온 것", () => {
  it("takes the picture kinds we can draw", () => {
    assert.equal(pickImageType(["text/plain", "image/png"]), "image/png");
    assert.equal(pickImageType(["image/jpeg"]), "image/jpeg");
  });

  it("refuses svg, which can carry code", () => {
    assert.equal(pickImageType(["image/svg+xml"]), "", "#25와 같은 이유");
    assert.equal(pickImageType(["text/html"]), "");
    assert.equal(pickImageType([]), "");
  });

  it("finds the picture among several clipboard items", () => {
    const found = findImageEntry([entry(["text/plain"]), entry(["image/png"])]);
    assert.equal(found.type, "image/png");
    assert.equal(findImageEntry([entry(["text/plain"])]), null);
  });

  describe("붙여넣을 것이 있나", () => {
    it("says yes at once when the app itself holds something", async () => {
      const out = await pasteAvailability([{ type: "pen" }], null);
      assert.deepEqual(out, { ready: true, source: "ink" });
    });

    it("looks in the system clipboard when the app holds nothing", async () => {
      const clipboard = { read: async () => [entry(["image/png"])] };
      assert.deepEqual(await pasteAvailability([], clipboard), { ready: true, source: "image" });
    });

    it("says no — never maybe — when the clipboard has no picture", async () => {
      const clipboard = { read: async () => [entry(["text/plain"])] };
      assert.deepEqual(await pasteAvailability([], clipboard), { ready: false, source: "" });
    });

    it("treats a refused clipboard as empty instead of throwing", async () => {
      const denied = { read: async () => { throw new Error("NotAllowedError"); } };
      assert.deepEqual(await pasteAvailability([], denied), { ready: false, source: "" });
      assert.deepEqual(await pasteAvailability([], undefined), { ready: false, source: "" });
    });
  });

  it("reads the picture out as something we can draw", async () => {
    const clipboard = { read: async () => [entry(["image/png"])] };
    const src = await readClipboardImage(clipboard, async (blob) => `data:${blob}`);
    assert.equal(src, "data:blob:image/png");
    assert.equal(await readClipboardImage(null, async () => "x"), "");
  });

  describe("놓일 자리", () => {
    it("centres it on the spot that was pressed", () => {
      assert.deepEqual(pastePlacement({ x: 0.5, y: 0.5 }, { w: 0.4, h: 0.2 }), {
        x: 0.3,
        y: 0.4,
        w: 0.4,
        h: 0.2,
      });
    });

    it("keeps it on the paper when pressed near an edge", () => {
      const at = pastePlacement({ x: 0.02, y: 0.98 }, { w: 0.4, h: 0.2 });
      assert.equal(at.x, 0, "왼쪽으로 안 넘어간다");
      assert.equal(at.y, 0.8, "아래로도");
    });

    it("falls back to a sensible spot when nothing was pressed", () => {
      const at = pastePlacement(null, { w: 0.4, h: 0.3 });
      assert.ok(at.x > 0 && at.y > 0);
    });
  });
});

describe("#219 배선", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const main = readFileSync(join(root, "src/main.js"), "utf8");
  const html = readFileSync(join(root, "index.html"), "utf8");

  it("offers 붙여넣기 on the area menu, greyed out when there is nothing", () => {
    assert.match(html, /data-marquee="paste">붙여넣기/);
    const refresh = main.slice(main.indexOf("function refreshPasteCell"), main.indexOf("function showMarqueeMenu"));
    assert.match(refresh, /cell\.disabled = !mine/, "먼저 내 것으로 판단하고");
    assert.match(refresh, /pasteAvailability\(state\.inkClipboard, navigator\.clipboard\)/, "클립보드 답이 오면 고친다");
  });

  it("opens the same menu on a hold with no drag, showing only 붙여넣기", () => {
    const show = main.slice(main.indexOf("function showPasteMenuAt"), main.indexOf("function restoreMarqueeCells"));
    assert.match(show, /cell\.hidden = cell\.dataset\.marquee !== "paste"/);
    assert.match(main, /rectHoldTimer = window\.setTimeout/);
    assert.match(main, /if \(!live \|\| rectBigEnough\(rectFromPoints\(live\.a, live\.b\)\)\) \{\s*return;/, "끌었으면 영역이지 붙여넣기가 아니다");
    assert.match(main, /restoreMarqueeCells\(\)/, "닫을 때 칸을 되살린다");
  });

  it("pastes the app's own items first, the clipboard picture second", () => {
    const paste = main.slice(main.indexOf("async function pasteHere"), main.indexOf("function readBlobDataUrl"));
    assert.ok(paste.indexOf("state.inkClipboard.length") < paste.indexOf("readClipboardImage"), "내 것이 먼저");
    assert.match(paste, /state\.interactMode === "view"/, "보기 중엔 안 붙인다");
    assert.match(paste, /붙여넣을 것이 없습니다/);
  });

  it("puts what came from outside where it was pressed, undoable in one go", () => {
    const image = main.slice(main.indexOf("async function pasteImageAt"), main.indexOf("function beginCrop"));
    assert.match(image, /acceptImageSrc\(src\)/, "같은 검사(#25)를 지난다");
    assert.match(image, /pastePlacement\(at, size\)/);
    assert.match(image, /commitPageChange\(page, \(\) =>/);
  });
});
