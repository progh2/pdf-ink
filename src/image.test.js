import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  IMAGE_HANDLE_CSS,
  acceptImageFile,
  acceptImageSrc,
  cropImage,
  cropRectOnImage,
  handleAt,
  imageItem,
  imageSizeOnPage,
  lockImage,
  resizeImage,
  trueSizeOnPage,
} from "./image.js";

describe("이미지", () => {
  it("creates a lockable image that can be resized and cropped", () => {
    const item = imageItem({ src: "data:image/png;base64,xx", x: 0.2, y: 0.2, w: 0.4, h: 0.3 });
    assert.equal(item.type, "image");
    assert.equal(item.locked, false);
    assert.equal(item.rotate, 0);
    assert.deepEqual(item.crop, { x: 0, y: 0, w: 1, h: 1 });
    const locked = lockImage(item, true);
    assert.equal(locked.locked, true);
    assert.equal(item.locked, false);
    // #224부터 기본은 비율 유지 — 자유비율은 골라서 켠다.
    const resized = resizeImage(item, "se", { x: 0.8, y: 0.7 }, { freeRatio: true });
    assert.ok(Math.abs(resized.w - 0.6) < 1e-10);
    assert.ok(Math.abs(resized.h - 0.5) < 1e-10);
    const cropped = cropImage(item, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
    assert.deepEqual(cropped.crop, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
  });

  it("maps a page crop rect onto the image and finds corner handles", () => {
    const item = imageItem({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 });
    const cropped = cropRectOnImage(item, { x: 0.3, y: 0.3, w: 0.2, h: 0.2 });
    assert.ok(Math.abs(cropped.x - 0.25) < 1e-10);
    assert.ok(Math.abs(cropped.y - 0.25) < 1e-10);
    assert.ok(Math.abs(cropped.w - 0.5) < 1e-10);
    assert.ok(Math.abs(cropped.h - 0.5) < 1e-10);
    const bounds = { x: 0.2, y: 0.2, w: 0.4, h: 0.3 };
    assert.equal(handleAt(bounds, { x: 0.2, y: 0.2 }), "nw");
    assert.equal(handleAt(bounds, { x: 0.6, y: 0.5 }), "se");
    assert.equal(handleAt(bounds, { x: 0.4, y: 0.35 }), null);
  });

  it("rejects non-images and keeps page aspect for placement", () => {
    assert.equal(IMAGE_HANDLE_CSS, 8);
    assert.equal(acceptImageFile({ type: "application/pdf", name: "a.pdf", size: 10 }).ok, false);
    assert.equal(acceptImageFile({ type: "image/svg+xml", name: "a.svg", size: 10 }).ok, false);
    assert.equal(acceptImageSrc("data:image/svg+xml;utf8,<svg>"), false);
    assert.equal(acceptImageFile({ type: "image/png", name: "a.png", size: 10 }).ok, true);
    assert.equal(acceptImageFile({ type: "image/png", name: "a.png", size: 9 * 1024 * 1024 }).ok, false);
    const size = imageSizeOnPage(800, 400, 400, 600, 0.5);
    assert.ok(size.w > 0 && size.h > 0);
    assert.ok(Math.abs(size.h / size.w - (400 / 800) * (400 / 600)) < 1e-6);
  });
});

describe("#224 비율 유지 크기 조절", () => {
  const item = imageItem({ src: "data:image/png;base64,xx", x: 0.2, y: 0.2, w: 0.4, h: 0.3 });
  // 정사각형이 아닌 종이: 화면상의 비를 지키려면 쪽 크기를 알아야 한다.
  const page = { cssWidth: 400, cssHeight: 600 };

  const screenRatio = (box) => (box.w * page.cssWidth) / (box.h * page.cssHeight);

  it("keeps the shape when a corner is dragged", () => {
    const before = screenRatio(item);
    const after = screenRatio(resizeImage(item, "se", { x: 0.9, y: 0.4 }, page));
    assert.ok(Math.abs(before - after) < 1e-9, `${before} → ${after}`);
  });

  it("keeps the opposite corner pinned", () => {
    const grown = resizeImage(item, "nw", { x: 0.05, y: 0.05 }, page);
    assert.ok(Math.abs(grown.x + grown.w - (item.x + item.w)) < 1e-9, "오른쪽 변이 그대로");
    assert.ok(Math.abs(grown.y + grown.h - (item.y + item.h)) < 1e-9, "아래 변이 그대로");
  });

  it("follows whichever way the hand pulled further", () => {
    const wide = resizeImage(item, "se", { x: 0.95, y: 0.25 }, page);
    assert.ok(wide.w > item.w, "가로로 크게 끌면 커진다");
    const tall = resizeImage(item, "se", { x: 0.25, y: 0.95 }, page);
    assert.ok(tall.h > item.h, "세로로 크게 끌어도 커진다");
  });

  it("lets it be squashed only when free ratio is on", () => {
    const free = resizeImage(item, "se", { x: 0.9, y: 0.25 }, { ...page, freeRatio: true });
    assert.ok(Math.abs(screenRatio(free) - screenRatio(item)) > 1e-6, "자유비율은 찌그러뜨릴 수 있다");
  });

  it("never shrinks below the floor, whichever mode", () => {
    for (const opts of [page, { ...page, freeRatio: true }]) {
      const tiny = resizeImage(item, "se", { x: 0, y: 0 }, opts);
      assert.ok(tiny.w >= 0.04 && tiny.h >= 0.04);
    }
  });
});

describe("#238 붙여넣기는 보던 크기 그대로", () => {
  const page = { cssWidth: 400, cssHeight: 600 };

  it("puts a 200pt-wide capture at half a 400pt page", () => {
    const size = trueSizeOnPage({ imgWidth: 200, imgHeight: 300, ...page });
    assert.ok(Math.abs(size.w - 0.5) < 1e-9);
    assert.ok(Math.abs(size.h - 0.5) < 1e-9);
  });

  it("undoes the device pixel ratio — a phone capture is not twice as big", () => {
    const size = trueSizeOnPage({ imgWidth: 400, imgHeight: 600, ...page, devicePixelRatio: 2 });
    assert.ok(Math.abs(size.w - 0.5) < 1e-9, "2배 화면의 400px은 200pt다");
  });

  it("undoes the zoom — the same capture lands the same however far you zoomed", () => {
    const atOne = trueSizeOnPage({ imgWidth: 200, imgHeight: 200, ...page });
    const atThree = trueSizeOnPage({ imgWidth: 600, imgHeight: 600, ...page, pageScale: 3 });
    assert.ok(Math.abs(atOne.w - atThree.w) < 1e-9, "3배로 확대해 캡처해도 같은 크기");
  });

  it("fills the page rather than shrinking to 92% (#242)", () => {
    const full = trueSizeOnPage({ imgWidth: 400, imgHeight: 600, ...page, maxShare: 1 });
    assert.ok(Math.abs(full.w - 1) < 1e-9, "쪽에 꼭 맞는 캡처는 꼭 맞게");
    assert.equal(full.shrunk, false);
  });

  it("keeps a huge capture on the paper, in proportion", () => {
    const size = trueSizeOnPage({ imgWidth: 4000, imgHeight: 2000, ...page });
    assert.ok(size.w <= 0.92 && size.h <= 0.92, "쪽 밖으로 안 나간다");
    assert.ok(Math.abs(size.w / size.h - (4000 / 400) / (2000 / 600)) < 1e-9, "비율은 그대로");
    assert.equal(size.shrunk, true, "줄였다고 말해 준다");
  });

  it("never lands so small it cannot be grabbed", () => {
    const size = trueSizeOnPage({ imgWidth: 2, imgHeight: 2, ...page });
    assert.ok(size.w >= 0.04 && size.h >= 0.04);
  });

  it("survives nonsense instead of producing NaN", () => {
    const size = trueSizeOnPage({});
    assert.ok(Number.isFinite(size.w) && Number.isFinite(size.h));
  });
});

describe("#238 배선", () => {
  const root4 = join(dirname(fileURLToPath(import.meta.url)), "..");
  const main4 = readFileSync(join(root4, "src/main.js"), "utf8");

  it("uses the true size when pasting, not the half-page default", () => {
    const paste = main4.slice(main4.indexOf("async function pasteImageAt"), main4.indexOf("function beginCrop"));
    assert.match(paste, /trueSizeOnPage\(\{/);
    assert.match(paste, /devicePixelRatio: window\.devicePixelRatio \|\| 1/);
    assert.match(paste, /pageScale: state\.userScale \|\| 1/);
    assert.match(paste, /maxShare: 1/, "#242: 92%로 줄이지 않는다");
    assert.doesNotMatch(paste, /imageSizeOnPage/, "붙여넣기는 반쪽 규칙을 안 쓴다");
  });

  it("leaves the file picker on the old rule, where half a page is handy", () => {
    const add = main4.slice(main4.indexOf("async function addImageFile"), main4.indexOf("function rotateCurrentPage"));
    assert.match(add, /imageSizeOnPage\(/);
  });
});
