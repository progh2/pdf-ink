import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ALLOWED_IMAGE_TYPES,
  fileFromPasteEvent,
  isSvgImage,
  looksLikeSvgBytes,
  validateImageContents,
  validateImageFile,
} from "./images.js";

function fakeFile({ name, type, size = 32, bytes }) {
  const data = bytes || new Uint8Array(size);
  return {
    name,
    type,
    size,
    slice() {
      return {
        arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      };
    },
  };
}

describe("image allowlist", () => {
  it("accepts PNG JPEG WebP only", () => {
    assert.ok(ALLOWED_IMAGE_TYPES.has("image/png"));
    assert.ok(ALLOWED_IMAGE_TYPES.has("image/jpeg"));
    assert.ok(ALLOWED_IMAGE_TYPES.has("image/webp"));
    assert.equal(ALLOWED_IMAGE_TYPES.has("image/svg+xml"), false);
    assert.equal(ALLOWED_IMAGE_TYPES.has("image/*"), false);
    assert.equal(validateImageFile(fakeFile({ name: "a.png", type: "image/png" })).ok, true);
    assert.equal(validateImageFile(fakeFile({ name: "a.jpg", type: "image/jpeg" })).ok, true);
    assert.equal(validateImageFile(fakeFile({ name: "a.webp", type: "image/webp" })).ok, true);
  });

  it("rejects SVG by type and extension", () => {
    assert.equal(isSvgImage({ name: "icon.svg", type: "image/svg+xml" }), true);
    assert.equal(isSvgImage({ name: "icon.SVG", type: "" }), true);
    assert.equal(isSvgImage({ name: "icon.svgz", type: "image/svg+xml" }), true);
    assert.equal(validateImageFile(fakeFile({ name: "icon.svg", type: "image/svg+xml" })).ok, false);
    assert.equal(validateImageFile(fakeFile({ name: "icon.svg", type: "image/svg+xml" })).message, "SVG 이미지는 넣을 수 없습니다.");
    assert.equal(validateImageFile(fakeFile({ name: "pic.svg", type: "image/png" })).ok, false);
    assert.equal(validateImageFile(fakeFile({ name: "pic.png", type: "image/svg+xml" })).ok, false);
    assert.equal(validateImageFile(fakeFile({ name: "pic.gif", type: "image/gif" })).ok, false);
  });

  it("rejects SVG bytes even without a name", async () => {
    const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    const xml = new TextEncoder().encode("<?xml version='1.0'?><svg></svg>");
    assert.equal(looksLikeSvgBytes(svg), true);
    assert.equal(looksLikeSvgBytes(xml), true);
    const result = await validateImageContents(fakeFile({ name: "", type: "", bytes: svg }));
    assert.equal(result.ok, false);
    assert.match(result.message, /SVG/);
  });

  it("does not take SVG from a paste event", () => {
    const svg = fakeFile({ name: "x.svg", type: "image/svg+xml" });
    const png = fakeFile({ name: "x.png", type: "image/png" });
    const event = {
      clipboardData: {
        items: [
          { kind: "file", type: "image/svg+xml", getAsFile: () => svg },
        ],
        files: [svg],
      },
    };
    assert.equal(fileFromPasteEvent(event), null);
    const mixed = {
      clipboardData: {
        items: [
          { kind: "file", type: "image/svg+xml", getAsFile: () => svg },
          { kind: "file", type: "image/png", getAsFile: () => png },
        ],
      },
    };
    assert.equal(fileFromPasteEvent(mixed), png);
  });
});
