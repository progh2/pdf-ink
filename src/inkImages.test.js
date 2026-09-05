import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { liveImageIds, mergeImages, stripImages } from "./inkImages.js";

describe("#273 이미지를 필기에서 떼어 내기", () => {
  const pages = {
    5: [
      { type: "pen", id: "p1", points: [{ x: 0, y: 0 }] },
      { type: "image", id: "i1", src: "data:image/jpeg;base64,AAAA", x: 0.1, y: 0.2, w: 0.4, h: 0.3 },
    ],
  };

  it("empties the heavy src in the light copy, keeps the map", () => {
    const { light, images } = stripImages(pages);
    assert.equal(light[5][1].src, "", "localStorage용은 가볍게");
    assert.deepEqual(light[5][1], { type: "image", id: "i1", src: "", x: 0.1, y: 0.2, w: 0.4, h: 0.3 }, "자리·크기는 남는다");
    assert.equal(images.i1, "data:image/jpeg;base64,AAAA");
  });

  it("leaves non-image items untouched", () => {
    const { light } = stripImages(pages);
    assert.deepEqual(light[5][0], pages[5][0]);
  });

  it("gives an unnamed image a temporary id so nothing is lost", () => {
    const { light, images } = stripImages({ 1: [{ type: "image", src: "data:image/png,x" }] });
    const id = light[1][0].id;
    assert.ok(id, "id가 생긴다");
    assert.equal(images[id], "data:image/png,x");
  });

  it("puts the src back on load", () => {
    const { light, images } = stripImages(pages);
    const back = mergeImages(light, images);
    assert.equal(back[5][1].src, "data:image/jpeg;base64,AAAA");
  });

  it("leaves the src empty when the map has no match (another browser)", () => {
    const { light } = stripImages(pages);
    const back = mergeImages(light, {});
    assert.equal(back[5][1].src, "", "사이드카가 채운다");
  });

  it("lists only the images still in use", () => {
    assert.deepEqual([...liveImageIds(pages)], ["i1"]);
  });
});

describe("#273 배선", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const main = readFileSync(join(root, "src/main.js"), "utf8");

  it("saves light ink to localStorage and images to IndexedDB", () => {
    const write = main.slice(main.indexOf("function writeStrokesNow"), main.indexOf("function scheduleStrokeSave"));
    assert.match(write, /const \{ light, images \} = stripImages\(state\.pages\)/);
    assert.match(write, /saveStrokes\(state\.identity, light,/);
    assert.match(write, /saveInkImages\(state\.identity, images, liveImageIds\(state\.pages\)\)/);
  });

  it("merges images back on open", () => {
    assert.match(main, /const imgs = await loadInkImages\(identity\)/);
    assert.match(main, /stored\.pages = mergeImages\(stored\.pages, imgs\)/);
  });
});
