import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// #248: 이 앱의 버그 절반은 조용한 예외였다 — 없는 함수를 불러 스위치가 죽어도
// 화면엔 아무 표시가 없었다. main.js는 텍스트로만 읽는다(다른 계약 테스트와
// 같은 방식) — main.js는 DOM에 묶여 있어 이 파일에서 직접 실행하지 않는다.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const main = readFileSync(join(root, "src/main.js"), "utf8");
const viteConfig = readFileSync(join(root, "vite.config.js"), "utf8");
const html = readFileSync(join(root, "index.html"), "utf8");

describe("#248 전역 오류 배너", () => {
  it("binds error and unhandledrejection listeners on window", () => {
    assert.match(
      main,
      /window\.addEventListener\("error", \(event\) => \{\s*reportAppError\(event\.message \|\| event\.error\?\.message\)/,
      "잡히지 않은 예외를 배너로 보낸다",
    );
    assert.match(
      main,
      /window\.addEventListener\("unhandledrejection", \(event\) => \{\s*reportAppError\(event\.reason\?\.message \|\| String\(event\.reason\)\)/,
      "거부된 프라미스도 마찬가지",
    );
  });

  it("flashes a banner naming the error, truncated to 80 chars", () => {
    const helper = main.slice(main.indexOf("function reportAppError"), main.indexOf("function reportAppError") + 800);
    assert.match(helper, /\.slice\(0, 80\)/, "메시지가 배너를 뒤덮지 않게 자른다");
    assert.match(helper, /flashBanner\(`앱 오류: \$\{message\}`, 6000\)/, "flashBanner는 이미 있는 함수를 그대로 쓴다");
  });

  it("throttles repeats of the same message so it cannot spam the banner", () => {
    const helper = main.slice(main.indexOf("function reportAppError"), main.indexOf("function reportAppError") + 800);
    assert.match(
      helper,
      /if \(message === lastErrorBannerMessage && now - lastErrorBannerAt < 10000\) \{[\s\S]*?return;/,
      "같은 메시지는 10초에 한 번만 배너로",
    );
  });

  it("never calls preventDefault, so the console keeps showing the real error", () => {
    const errorBinding = main.slice(main.indexOf('window.addEventListener("error"'), main.indexOf('window.addEventListener("unhandledrejection"'));
    const rejectionBinding = main.slice(
      main.indexOf('window.addEventListener("unhandledrejection"'),
      main.indexOf('window.addEventListener("unhandledrejection"') + 300,
    );
    assert.doesNotMatch(errorBinding, /preventDefault/, "콘솔 기본 출력을 지우지 않는다");
    assert.doesNotMatch(rejectionBinding, /preventDefault/, "여기도 마찬가지");
  });
});

describe("#248 빌드 표식", () => {
  it("defines __BUILD_TAG__ in vite.config.js from the commit sha and build time", () => {
    assert.match(viteConfig, /__BUILD_TAG__:\s*JSON\.stringify\(/, "새로고침 후 화면이 새 배포인지 알 길이 있어야 한다");
    assert.match(viteConfig, /VERCEL_GIT_COMMIT_SHA/, "Vercel 배포에서 커밋 해시를 읽는다");
    assert.match(viteConfig, /GITHUB_SHA/, "다른 CI에서도 해시를 찾는다");
    assert.match(viteConfig, /"dev"/, "로컬 빌드는 dev로 표시된다");
  });

  it("puts #build-tag inside the settings sheet, next to the source note", () => {
    const sheetStart = html.indexOf('id="settings-sheet"');
    const sheetEnd = html.indexOf("<script", sheetStart);
    assert.ok(sheetStart > -1, "설정 시트가 있어야 한다");
    const sheet = html.slice(sheetStart, sheetEnd);
    assert.match(sheet, /<span class="build-tag" id="build-tag"><\/span>/, "빌드 표식이 설정 시트 안에 있다");
    // 소스 문단 바로 뒤여야 한다 — 사용자가 소스를 찾다가 같이 보게.
    const sourceAt = sheet.indexOf('id="settings-source-link"');
    const tagAt = sheet.indexOf('id="build-tag"');
    assert.ok(sourceAt > -1 && tagAt > sourceAt, "소스 링크 문단 뒤에 이어 붙인다");
  });

  it("writes the build tag into the DOM at startup, guarded for text-only readers", () => {
    assert.match(
      main,
      /els\.buildTag\.textContent = typeof __BUILD_TAG__ === "string" \? __BUILD_TAG__ : "dev"/,
      "typeof 가드는 main.js를 실행하지 않고 텍스트로만 읽는 계약 테스트를 위한 안전장치",
    );
    assert.match(main, /buildTag: document\.querySelector\("#build-tag"\)/, "els에 등록되어 있어야 위 대입이 통한다");
  });
});
