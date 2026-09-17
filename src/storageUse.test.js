import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { STORAGE_TIGHT_RATIO, documentSizeNote, formatBytes, storageNote } from "./storageUse.js";

describe("#441 저장 공간 표시", () => {
  it("사람이 읽는 크기로 바꾼다", () => {
    assert.equal(formatBytes(0), "0KB");
    assert.equal(formatBytes(-5), "0KB");
    assert.equal(formatBytes(900), "1KB 미만");
    assert.equal(formatBytes(2048), "2KB");
    assert.equal(formatBytes(20 * 1024 * 1024), "20MB");
    assert.equal(formatBytes(1.25 * 1024 ** 3), "1.3GB");
    // 세 자리를 넘으면 소수점이 거추장스럽다.
    assert.equal(formatBytes(120.4 * 1024 ** 2), "120MB");
  });

  it("쓴 양과 남은 양을 한 줄로 말한다", () => {
    const note = storageNote({ usage: 512 * 1024 ** 2, quota: 2 * 1024 ** 3 });
    assert.equal(note.text, "이 기기에 512MB 씀 · 1.5GB 남음");
    assert.equal(note.tight, false);
  });

  it("거의 다 찼으면 표시를 세운다", () => {
    const quota = 1024 ** 3;
    const note = storageNote({ usage: quota * STORAGE_TIGHT_RATIO, quota });
    assert.equal(note.tight, true);
  });

  it("남은 양을 모르는 브라우저는 쓴 양만, 아무것도 모르면 감춘다", () => {
    assert.equal(storageNote({ usage: 3 * 1024 ** 2 }).text, "이 기기에 3MB 씀");
    assert.equal(storageNote({}), null);
    assert.equal(storageNote(null), null);
    assert.equal(storageNote({ usage: "몰라", quota: 0 }), null);
  });

  it("카드에 붙는 크기는 모르면 빈 값이다", () => {
    assert.equal(documentSizeNote(24 * 1024 ** 2), "24MB");
    assert.equal(documentSizeNote(0), "");
    assert.equal(documentSizeNote(undefined), "");
  });
});

describe("#441 문서 지우기 배선", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const main = readFileSync(join(root, "src/main.js"), "utf8");
  const store = readFileSync(join(root, "src/storage.js"), "utf8");
  const html = readFileSync(join(root, "index.html"), "utf8");
  const css = readFileSync(join(root, "src/style.css"), "utf8");

  it("최근 카드마다 지우기, 그리고 모두 지우기가 있다", () => {
    assert.match(html, /id="recents-clear"/);
    assert.match(html, /id="storage-note"/);
    assert.match(main, /del\.className = "recent-del"/);
    assert.match(main, /removeRecent\(entry\.identity, entry\.title\)/);
    assert.match(main, /els\.recentsClear\.onclick = \(\) => removeAllRecents\(rows\.length\)/);
    assert.match(css, /\.recent-del \{/);
  });

  it("지우기는 배너로 한 번 더 묻는다 (#100·#103: 브라우저 대화상자 금지)", () => {
    assert.match(main, /if \(recentDeleteArmed !== identity\)/);
    assert.match(main, /if \(recentDeleteArmed !== "\*"\)/);
    assert.match(main, /한 번 더 누르세요/);
    const block = main.slice(main.indexOf("async function removeRecent"), main.indexOf("async function renderRecents"));
    assert.doesNotMatch(block, /confirm\(/);
  });

  it("문서를 지우면 딸린 것도 전부 지운다", () => {
    const block = store.slice(
      store.indexOf("export async function deleteDocument"),
      store.indexOf("function deleteByPrefix"),
    );
    // 본문·필기(로컬+대체)·링크 고침·미리보기·이미지·세션 포인터
    assert.match(block, /localStorage\.removeItem\(STROKE_PREFIX \+ identity\)/);
    assert.match(block, /localStorage\.removeItem\(LINK_FIX_PREFIX \+ identity\)/);
    assert.match(block, /objectStore\(FILES_STORE\)\.delete\(identity\)/);
    assert.match(block, /session\.delete\(STROKE_PREFIX \+ identity\)/);
    assert.match(block, /last\.result\?\.identity === identity/);
    assert.match(block, /deleteByPrefix\(tx\.objectStore\(THUMB_STORE\), `\$\{identity\}::`\)/);
    assert.match(block, /deleteByPrefix\(tx\.objectStore\(INK_IMAGE_STORE\), `\$\{identity\}::`\)/);
  });

  it("모두 지우기는 문서만 비우고 스티커·선반은 남긴다", () => {
    const block = store.slice(
      store.indexOf("export async function deleteAllDocuments"),
      store.indexOf("export async function storageEstimate"),
    );
    for (const name of ["FILES_STORE", "THUMB_STORE", "INK_IMAGE_STORE", "SESSION_STORE"]) {
      assert.match(block, new RegExp(`objectStore\\(${name}\\)\\.clear\\(\\)`));
    }
    assert.doesNotMatch(block, /STICKER_STORE|SHELF_STORE/);
  });
});

describe("#443 표지 보기", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const main = readFileSync(join(root, "src/main.js"), "utf8");
  const store = readFileSync(join(root, "src/storage.js"), "utf8");
  const html = readFileSync(join(root, "index.html"), "utf8");
  const css = readFileSync(join(root, "src/style.css"), "utf8");

  it("목록과 표지를 오가고 고른 보기를 기억한다", () => {
    assert.match(html, /data-recents-view="list"/);
    assert.match(html, /data-recents-view="cover"/);
    assert.match(store, /export function loadRecentsView/);
    assert.match(store, /export function saveRecentsView/);
    assert.match(main, /recentsView: loadRecentsView\(\)/);
    assert.match(main, /saveRecentsView\(next\)/);
  });

  it("제목은 표지 아래에 온다", () => {
    const block = main.slice(main.indexOf("    if (cover) {"), main.indexOf("button.addEventListener(\"click\", () => openStoredDocument"));
    assert.ok(block.indexOf("recent-cover") < block.indexOf("recent-card-name"), "표지가 먼저 붙는다");
    assert.match(css, /\.recents\.is-cover \{[\s\S]*?grid-template-columns/);
  });

  it("표지는 캐시를 먼저 보고, 없을 때만 한 번에 하나씩 연다", () => {
    const block = main.slice(main.indexOf("function paintCover"), main.indexOf("function syncRecentsViews"));
    assert.match(block, /coverQueue = coverQueue/, "줄을 세워 한 번에 하나만 연다");
    assert.match(block, /drawStoredPage\(canvas, COVER_THUMB_KEY, identity, valid\)/);
    assert.match(block, /storeThumb\(canvas, COVER_THUMB_KEY, identity\)/);
    // 표지 한 장 때문에 200MB를 두 벌 들지 않는다(#418과 대비되는 자리다).
    const draw = main.slice(main.indexOf("async function drawCoverFromPdf"), main.indexOf("function paintCover"));
    assert.match(draw, /getDocument\(\{ data: row\.buffer \}\)/);
    assert.doesNotMatch(draw, /row\.buffer\.slice/);
    assert.match(draw, /pdf\?\.destroy\(\)/, "표지를 뜬 문서는 곧바로 닫는다");
  });

  it("다시 그리면 이전 표지 작업은 버린다", () => {
    assert.match(main, /coverGen \+= 1;/);
    assert.match(main, /const valid = \(\) => gen === coverGen;/);
  });
});

describe("문서가 없는 기능을 말하지 않는다", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const readme = readFileSync(join(root, "README.md"), "utf8");
  const main = readFileSync(join(root, "src/main.js"), "utf8");

  it("라이브 층 워커는 꺼져 있다 — README도 그렇게 말한다", () => {
    // #282에서 껐다(비동기 메시지 순서 때문에 짧은 획이 먹혔다). 다시 켜면
    // 이 핀이 깨지고, 그때 README도 같이 고치게 된다.
    const gate = main.slice(main.indexOf("function liveWorkerReady"), main.indexOf("function adoptLiveCanvas"));
    assert.match(gate, /return false;/);
    assert.doesNotMatch(readme, /워커가 자기 프레임 시계/);
  });
});
