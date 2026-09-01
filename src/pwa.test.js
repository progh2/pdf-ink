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
