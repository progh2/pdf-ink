import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadStrokes, saveStrokes } from "./storage.js";

const mem = new Map();
globalThis.localStorage = {
  getItem(key) {
    return mem.has(key) ? mem.get(key) : null;
  },
  setItem(key, value) {
    mem.set(key, String(value));
  },
  removeItem(key) {
    mem.delete(key);
  },
};

describe("#53 outline persist", () => {
  it("roundtrips outline with the same stroke store", () => {
    const identity = "demo.pdf::10::1";
    saveStrokes(identity, { 1: [] }, [{ id: "p1", kind: "pdf", pdfPage: 1 }], [
      { id: "ol:a", title: "페이지 1", page: 1 },
    ]);
    const loaded = loadStrokes(identity);
    assert.equal(loaded.outline.length, 1);
    assert.equal(loaded.outline[0].title, "페이지 1");
    assert.equal(loaded.outline[0].page, 1);
    saveStrokes(identity, { 1: [] }, [{ id: "p1", kind: "pdf", pdfPage: 1 }], []);
    assert.deepEqual(loadStrokes(identity).outline, []);
  });

  it("treats missing outline as empty so old ink still loads", () => {
    mem.set(
      "pdf-ink:strokes:old.pdf::1::1",
      JSON.stringify({ version: 1, identity: "old.pdf::1::1", pages: { 1: [] } }),
    );
    const loaded = loadStrokes("old.pdf::1::1");
    assert.deepEqual(loaded.outline, []);
    assert.ok(loaded.pages[1]);
  });
});
