import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  acceptAreaUrl,
  areaItem,
  areaLinkOf,
  areaLinkPage,
  clampPageTarget,
  hasAreaLink,
  normalizeAreaLink,
  pickAreaAt,
  recentDocsForLink,
} from "./areaLink.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");
const css = readFileSync(join(root, "src/style.css"), "utf8");
const main = readFileSync(join(root, "src/main.js"), "utf8");
const hold = readFileSync(join(root, "src/marqueeHold.js"), "utf8");

test("#72 연결은 기존 #71 영역 메뉴에만 붙는다", () => {
  assert.match(html, /id="marquee-menu"/);
  assert.match(html, /data-marquee="link"[^>]*>연결/);
  assert.match(html, /data-marquee="copy"/);
  assert.match(html, /data-marquee="mosaic"/);
  assert.doesNotMatch(html, /id="area-menu"/);
  assert.doesNotMatch(html, /id="float-bar"[^]*연결/);
  assert.doesNotMatch(html, /#toolbar[\s\S]*연결/);
  assert.doesNotMatch(html, /overflow-extra[\s\S]*연결/);
});

test("#72 짧은 탭은 연결을 열고 길게 누르면 메뉴가 남는다", () => {
  assert.match(hold, /onTap/);
  assert.match(main, /onTap:/);
  assert.match(main, /openAreaLink/);
  assert.match(main, /bindMarqueeHold/);
});

test("#72 연결 대상은 이 문서 쪽·다른 PDF·URL이다", () => {
  assert.match(html, /id="area-link-panel"/);
  assert.match(html, /이 문서/);
  assert.match(html, /다른 PDF/);
  assert.match(html, /웹 주소/);
  assert.deepEqual(normalizeAreaLink({ kind: "page", page: 3 }), { kind: "page", page: 3 });
  assert.deepEqual(normalizeAreaLink({ kind: "doc", name: "a.pdf" }), { kind: "doc", name: "a.pdf" });
  assert.deepEqual(normalizeAreaLink({ kind: "url", href: "https://ex.com/x" }), {
    kind: "url",
    href: "https://ex.com/x",
  });
  assert.equal(normalizeAreaLink({ kind: "url", href: "javascript:alert(1)" }), null);
  assert.equal(acceptAreaUrl("https://ok.example/path"), "https://ok.example/path");
  assert.equal(acceptAreaUrl("ftp://no.example"), "");
  assert.equal(clampPageTarget(0, 4), 1);
  assert.equal(clampPageTarget(9, 4), 4);
});

test("#72 연결된 영역은 저장되고 탭으로 고른다", () => {
  const item = areaItem({ x: 10, y: 20, w: 80, h: 40 }, { kind: "page", page: 2 });
  assert.deepEqual(item.link, { kind: "page", page: 2 });
  assert.equal(hasAreaLink(item), true);
  assert.deepEqual(areaLinkOf(item), { kind: "page", page: 2 });
  assert.equal(pickAreaAt([item], 12, 22)?.link.page, 2);
  assert.equal(pickAreaAt([item], 1, 1), null);
  assert.equal(areaItem({ x: 0, y: 0, w: 10, h: 10 }, { kind: "url", href: "notaurl" }), null);
});

test("#72 최근 다른 PDF는 현재 문서를 뺀다", () => {
  const list = recentDocsForLink(
    [
      { name: "now.pdf", at: 3 },
      { name: "now.pdf", at: 2 },
      { name: "old.pdf", at: 1 },
    ],
    "now.pdf",
  );
  assert.deepEqual(list, [{ name: "old.pdf", at: 1 }]);
});

test("#72 분할은 탭이고 마지막을 닫으면 끝난다", () => {
  assert.match(html, /id="write-split"/);
  assert.match(html, /id="split-tabs"/);
  assert.match(css, /#write-split\.axis-tb/);
  assert.match(css, /#write-split\.axis-lr/);
  assert.match(main, /textContent = "x"/);
  assert.match(main, /closeSplitTab/);
  assert.match(main, /emptySplit/);
  assert.doesNotMatch(html, /data-tool="area"|data-tool="link"/);
  assert.doesNotMatch(main, /#float-bar[\s\S]{0,200}연결/);
});

const leaves194 = [{ id: "a" }, { id: "b" }, { id: "c" }];

test("#194 영역 연결도 쪽 번호가 아니라 그 쪽 자체를 붙든다", () => {
  assert.deepEqual(normalizeAreaLink({ kind: "page", page: 2, leafId: "b" }), {
    kind: "page",
    page: 2,
    leafId: "b",
  });
  // 앞에 한 장을 끼워도 같은 종이로 간다.
  const link = normalizeAreaLink({ kind: "page", page: 2, leafId: "b" });
  assert.equal(areaLinkPage(link, [{ id: "새" }, ...leaves194]), 3);
});

test("#194 예전에 만든 연결과 지워진 쪽은 옛 번호 그대로", () => {
  assert.deepEqual(normalizeAreaLink({ kind: "page", page: 2 }), { kind: "page", page: 2 });
  assert.equal(areaLinkPage({ kind: "page", page: 2 }, leaves194), 2);
  assert.equal(areaLinkPage({ kind: "page", page: 2, leafId: "없음" }, leaves194), 2);
  assert.equal(areaLinkPage({ kind: "url", href: "https://a.kr/" }, leaves194), 0);
});

test("#194 만들 때 잎을 함께 적고, 열 때 지금 자리를 쓴다", () => {
  assert.match(main, /saveAreaLink\(\{ kind: "page", page: at, leafId: state\.leaves\[at - 1\]\?\.id \}\)/);
  assert.match(main, /const at = areaLinkPage\(link, state\.leaves\)/);
});
