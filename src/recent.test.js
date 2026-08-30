import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recentCardEntries, recentTimeNote, recentTitle } from "./recent.js";

const now = new Date(2026, 7, 30, 18, 25).getTime();

describe("최근 카드", () => {
  it("drops the .pdf tail for the card name", () => {
    assert.equal(recentTitle("class-note.pdf"), "class-note");
    assert.equal(recentTitle("class-note.PDF"), "class-note");
    assert.equal(recentTitle(""), "문서");
  });

  it("shows the clock today and the date before that", () => {
    assert.equal(recentTimeNote(new Date(2026, 7, 30, 9, 5).getTime(), now), "09:05");
    assert.equal(recentTimeNote(new Date(2026, 7, 28, 21, 40).getTime(), now), "8월 28일 21:40");
    assert.equal(recentTimeNote(0, now), "");
  });

  it("leaves a unique name alone", () => {
    const entries = recentCardEntries(
      [
        { identity: "a", name: "class-note.pdf", openedAt: now },
        { identity: "b", name: "수학.pdf", openedAt: now },
      ],
      now,
    );
    assert.deepEqual(entries.map((entry) => entry.title), ["class-note", "수학"]);
    assert.deepEqual(entries.map((entry) => entry.note), ["", ""]);
  });

  it("tells two class-note cards apart by opened time", () => {
    const entries = recentCardEntries(
      [
        { identity: "a", name: "class-note.pdf", openedAt: new Date(2026, 7, 30, 18, 10).getTime() },
        { identity: "b", name: "class-note.pdf", openedAt: new Date(2026, 7, 29, 9, 30).getTime() },
      ],
      now,
    );
    assert.deepEqual(entries.map((entry) => entry.title), ["class-note", "class-note"]);
    assert.deepEqual(entries.map((entry) => entry.note), ["18:10", "8월 29일 09:30"]);
    assert.notEqual(entries[0].note, entries[1].note);
  });

  it("falls back to the page when the time also repeats", () => {
    const at = new Date(2026, 7, 30, 18, 10).getTime();
    const entries = recentCardEntries(
      [
        { identity: "a", name: "class-note.pdf", openedAt: at, page: 1 },
        { identity: "b", name: "class-note.pdf", openedAt: at, page: 7 },
      ],
      now,
    );
    assert.deepEqual(entries.map((entry) => entry.note), ["18:10", "18:10 · 7쪽"]);
  });

  it("skips rows without an identity", () => {
    const entries = recentCardEntries([{ name: "x.pdf" }, { identity: "b", name: "y.pdf" }], now);
    assert.deepEqual(entries.map((entry) => entry.identity), ["b"]);
  });
});
