import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STICKER_PACK_NAME,
  mergeStickerPacks,
  normalizeStickerCloud,
  parseStickerPack,
  serializeStickerPack,
  stickerRemovals,
} from "./stickerSync.js";

const sticker = (id, folderId = "f1") => ({ id, folderId, src: "data:image/png;base64,AAAA", width: 8, height: 8 });

describe("#395 스티커 묶음", () => {
  it("round-trips, and refuses anything that is not ours", () => {
    const text = serializeStickerPack({ stickers: [sticker("s1")], folders: [{ id: "f1", name: "새" }], savedAt: 7 });
    const back = parseStickerPack(text);
    assert.equal(back.savedAt, 7);
    assert.equal(back.stickers[0].id, "s1");
    assert.equal(back.folders[0].id, "f1");
    assert.equal(parseStickerPack("not json"), null);
    assert.equal(parseStickerPack(JSON.stringify({ app: "someone-else", stickers: [] })), null);
  });

  it("keeps out a sticker whose picture is a foreign url (#372)", () => {
    const text = JSON.stringify({
      app: "pdf-ink-stickers",
      stickers: [sticker("ok"), { id: "bad", src: "https://evil.example/track.png" }],
    });
    const back = parseStickerPack(text, (src) => src.startsWith("data:image/"));
    assert.deepEqual(back.stickers.map((one) => one.id), ["ok"]);
  });

  it("unions both sides so neither device loses a sticker", () => {
    const merged = mergeStickerPacks(
      { stickers: [sticker("mine")], folders: [{ id: "f1" }], gone: {} },
      { stickers: [sticker("theirs")], folders: [{ id: "f2" }], gone: {} },
    );
    assert.deepEqual(merged.stickers.map((one) => one.id), ["mine", "theirs"]);
    assert.deepEqual(merged.folders.map((one) => one.id), ["f1", "f2"]);
    assert.equal(merged.added, 1, "새로 온 것만 센다");
  });

  it("never resurrects what someone deleted", () => {
    const merged = mergeStickerPacks(
      { stickers: [], folders: [], gone: { old: 100 } },
      { stickers: [sticker("old")], folders: [], gone: {} },
    );
    assert.deepEqual(merged.stickers, []);
    assert.equal(merged.added, 0);
  });

  it("writes a tombstone for what vanished, and clears one that came back", () => {
    const gone = stickerRemovals(new Set(["a", "b"]), new Set(["a"]), {}, 5);
    assert.deepEqual(gone, { b: 5 });
    assert.deepEqual(stickerRemovals(new Set(["b"]), new Set(["b"]), gone, 9), {});
  });

  it("names one pack file and keeps the choice honest", () => {
    assert.equal(STICKER_PACK_NAME, "pdf-ink-stickers.json");
    assert.equal(normalizeStickerCloud("dropbox"), "dropbox");
    assert.equal(normalizeStickerCloud("drive"), "drive");
    assert.equal(normalizeStickerCloud("someone-else"), "none");
    assert.equal(normalizeStickerCloud(undefined), "none");
  });
});
