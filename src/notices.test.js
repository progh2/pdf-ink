import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BUNDLED, buildNotices } from "../scripts/notices.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");

describe("#176 다른 사람 코드 표시", () => {
  const notices = read("public/THIRD-PARTY-NOTICES.txt");

  it("covers every dependency that ships in the browser", () => {
    const deps = Object.keys(JSON.parse(read("package.json")).dependencies || {});
    const named = BUNDLED.map((item) => item.name);
    for (const dep of deps) {
      assert.ok(named.includes(dep), `${dep}이 목록에 없습니다`);
    }
  });

  it("is in sync with node_modules — regenerating changes nothing", () => {
    assert.equal(notices, buildNotices(), "npm run notices를 다시 돌리세요");
  });

  it("carries the licenses the bundle drops, in full", () => {
    assert.match(notices, /Apache License\s*\n\s*Version 2\.0/, "pdfjs 아파치 전문");
    assert.match(notices, /pdfjs-dist [\d.]+ {2}— {2}Apache-2\.0/);
    assert.match(notices, /pdf-lib [\d.]+ {2}— {2}MIT/);
    assert.match(notices, /Copyright/);
    assert.ok(notices.includes("AGPL-3.0-or-later"), "우리 것이 무엇인지도 밝힌다");
  });

  it("is reachable from the app, not just the repo", () => {
    const html = read("index.html");
    assert.equal((html.match(/href="\/THIRD-PARTY-NOTICES\.txt"/g) || []).length, 2);
  });
});
