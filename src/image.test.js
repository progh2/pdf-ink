import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  acceptImageFile,
  cropImage,
  cropRectOnImage,
  handleAt,
  imageItem,
  imageSizeOnPage,
  lockImage,
  resizeImage,
} from "./image.js";

describe("이미지", () => {
  it("creates a lockable image that can be resized and cropped", () => {
    const item = imageItem({ src: "data:image/png;base64,xx", x: 0.2, y: 0.2, w: 0.4, h: 0.3 });
    assert.equal(item.type, "image");
    assert.equal(item.locked, false);
    assert.deepEqual(item.crop, { x: 0, y: 0, w: 1, h: 1 });
    const locked = lockImage(item, true);
    assert.equal(locked.locked, true);
    assert.equal(item.locked, false);
    const resized = resizeImage(item, "se", { x: 0.8, y: 0.7 });
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
    assert.equal(acceptImageFile({ type: "application/pdf", size: 10 }).ok, false);
    assert.equal(acceptImageFile({ type: "image/png", size: 10 }).ok, true);
    assert.equal(acceptImageFile({ type: "image/png", size: 9 * 1024 * 1024 }).ok, false);
    const size = imageSizeOnPage(800, 400, 400, 600, 0.5);
    assert.ok(size.w > 0 && size.h > 0);
    assert.ok(Math.abs(size.h / size.w - (400 / 800) * (400 / 600)) < 1e-6);
  });
});
