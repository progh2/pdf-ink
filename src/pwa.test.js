import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = readFileSync(join(root, "vite.config.js"), "utf8");
const html = readFileSync(join(root, "index.html"), "utf8");
const main = readFileSync(join(root, "src/main.js"), "utf8");

describe("#131 PWA", () => {
  it("declares an installable app in Korean", () => {
    assert.match(config, /name: "필기웹"/);
    assert.match(config, /display: "standalone"/);
    assert.match(config, /theme_color: "#F3F0E8"/);
    assert.match(config, /start_url: "\/"/);
  });

  it("ships the icons it promises, small enough to precache", () => {
    for (const name of ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"]) {
      const size = statSync(join(root, "public", name)).size;
      assert.ok(size > 200, `${name} exists`);
      assert.ok(size < 60_000, `${name} stays small (${size}B)`);
    }
    assert.match(config, /purpose: "maskable"/);
    assert.match(html, /rel="apple-touch-icon"/);
    assert.match(html, /name="theme-color" content="#F3F0E8"/);
  });

  it("keeps the pdf worker offline, since a document is useless without it", () => {
    assert.match(config, /globPatterns:.*mjs/);
    assert.match(config, /maximumFileSizeToCacheInBytes/);
    assert.match(config, /navigateFallback: "index\.html"/);
  });

  it("tells the reader about a new version instead of serving the old one", () => {
    assert.match(config, /registerType: "prompt"/);
    assert.match(config, /injectRegister: null/, "we register it ourselves");
    assert.match(main, /onNeedRefresh\(\)[\s\S]*els\.updateNote\.hidden = false/);
    // #331: 오래 켜둔 탭도 알림이 저절로 뜨도록 주기 점검을 돈다.
    assert.match(main, /onRegisteredSW\(url, registration\)/);
    assert.match(main, /setInterval\(check, 15 \* 60 \* 1000\)/);
    assert.match(main, /visibilitychange/);
    assert.match(main, /addEventListener\("online", check\)/);
    assert.match(main, /updateSW\(true\)/);
    assert.match(html, /id="update-reload">새로고침/);
  });

  it("asks to keep the ink, once, and only with a document open", () => {
    assert.match(main, /navigator\.storage\.persist/);
    assert.match(main, /if \(persistAsked \|\| !navigator\.storage\?\.persist\)/);
    assert.match(main, /await navigator\.storage\.persisted\(\)/, "does not re-ask when granted");
    const open = main.slice(main.indexOf("async function openPdfBuffer"), main.indexOf("async function openSelectedFile"));
    assert.match(open, /askPersistentStorage\(\)/);
  });
});

describe("#130 빌드 경고", () => {
  it("splits pdf.js off the app chunk", () => {
    assert.match(config, /manualChunks/);
    assert.match(config, /pdfjs-dist/);
    assert.doesNotMatch(config, /chunkSizeWarningLimit/, "the warning is fixed, not hidden");
  });
});

describe("#373 보안 헤더·iframe sandbox", () => {
  it("ships the safe header set and sandboxes the split iframe", () => {
    const here373 = dirname(fileURLToPath(import.meta.url));
    const vercel = readFileSync(join(here373, "../vercel.json"), "utf8");
    assert.match(vercel, /X-Content-Type-Options/);
    assert.match(vercel, /strict-origin-when-cross-origin/);
    assert.match(vercel, /X-Frame-Options/);
    assert.match(vercel, /Permissions-Policy/);
    const src373 = readFileSync(join(here373, "main.js"), "utf8");
    assert.match(src373, /setAttribute\("sandbox", "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"\)/);
  });
});

describe("#421 최소 CSP", () => {
  it("pins deploy CSP to the Drive/Dropbox origins the modules already use", () => {
    const here421 = dirname(fileURLToPath(import.meta.url));
    const vercel = readFileSync(join(here421, "../vercel.json"), "utf8");
    const gdrive = readFileSync(join(here421, "gdrive.js"), "utf8");
    const dropbox = readFileSync(join(here421, "dropbox.js"), "utf8");
    // #373 헤더는 그대로 — CSP만 얹는다.
    assert.match(vercel, /X-Content-Type-Options/);
    assert.match(vercel, /X-Frame-Options/);
    assert.match(vercel, /Permissions-Policy/);
    assert.match(vercel, /"key": "Content-Security-Policy"/);
    assert.match(vercel, /object-src 'none'/);
    assert.match(vercel, /base-uri 'self'/);
    // XFO DENY와 맞춤. frame-src는 두지 않는다: Picker·GIS iframe과
    // 분할 화면 외부 URL(#373)이 막히면 Drive/링크 분할이 죽는다.
    assert.match(vercel, /frame-ancestors 'none'/);
    assert.doesNotMatch(vercel, /frame-src/);
    assert.doesNotMatch(vercel, /default-src/);
    assert.match(gdrive, /https:\/\/accounts\.google\.com\/gsi\/client/);
    assert.match(gdrive, /https:\/\/apis\.google\.com\/js\/api\.js/);
    assert.match(gdrive, /https:\/\/www\.googleapis\.com/);
    assert.match(dropbox, /https:\/\/www\.dropbox\.com/);
    assert.match(dropbox, /https:\/\/api\.dropboxapi\.com/);
    assert.match(dropbox, /https:\/\/content\.dropboxapi\.com/);
    assert.match(
      vercel,
      /script-src 'self' https:\/\/accounts\.google\.com https:\/\/apis\.google\.com/,
    );
    assert.match(
      vercel,
      /connect-src 'self' https:\/\/www\.googleapis\.com https:\/\/accounts\.google\.com https:\/\/apis\.google\.com https:\/\/www\.dropbox\.com https:\/\/api\.dropboxapi\.com https:\/\/content\.dropboxapi\.com/,
    );
    // favicon·붙여넣기 래스터(#419)는 data:image. 워커는 self, pdf.js가 blob:을 쓰면 허용.
    assert.match(vercel, /img-src 'self' data:/);
    assert.match(vercel, /worker-src 'self' blob:/);
  });
});
