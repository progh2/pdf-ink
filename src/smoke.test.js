import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const workflow = readFileSync(join(root, ".github/workflows/test.yml"), "utf8");
const runner = readFileSync(join(root, "scripts/smoke/run.mjs"), "utf8");
const fixtures = readFileSync(join(root, "scripts/smoke/fixtures.mjs"), "utf8");

/**
 * #249: CI가 우리의 브라우저가 된다. 여기서는 그 배선이 빠지지 않았는지만 본다 —
 * 스모크 자체는 크로미움이 있어야 돌므로 node --test 안에서는 돌리지 않는다.
 */
describe("#249 스모크 배선", () => {
  it("npm run smoke가 있고, CI의 smoke 잡이 빌드 뒤에 크로미움을 깔고 돌린다", () => {
    assert.equal(pkg.scripts.smoke, "node scripts/smoke/run.mjs");
    assert.ok(pkg.devDependencies.playwright, "playwright는 개발 의존성");
    assert.match(workflow, /^\s+smoke:\s*$/m);
    const job = workflow.slice(workflow.indexOf("smoke:"));
    assert.match(job, /npm run build/);
    assert.match(job, /npx playwright install --with-deps chromium/);
    assert.match(job, /npm run smoke/);
    assert.ok(job.indexOf("npm run build") < job.indexOf("npm run smoke"), "dist가 있어야 돈다");
  });

  it("다섯 시나리오가 다 있고, 성능 예산이 #460의 측정값 안쪽이다", () => {
    for (const name of ["scenarioOpen", "scenarioLinksPage", "scenarioLinksScroll", "scenarioPenUndo", "scenarioPerf"]) {
      assert.match(runner, new RegExp(`async function ${name}\\(`), name);
    }
    // 수정 전 300획에서 평균 79ms·최대 116ms였다 — 되돌아가면 바로 넘는 값이어야 한다.
    const budget = runner.match(/const BUDGET = \{ upAvgMs: (\d+), upMaxMs: (\d+), frameP95Ms: (\d+) \}/);
    assert.ok(budget, "예산 상수");
    assert.ok(Number(budget[1]) < 79 && Number(budget[2]) < 116);
  });

  it("배포와 같은 헤더(CSP)로 띄우고, 폰 모양 화면으로도 본다", () => {
    assert.match(runner, /vercelJson: join\(root, "vercel\.json"\)/);
    assert.match(runner, /width: 412, height: 915/, "#458은 폰 크기에서만 재현됐다");
    assert.match(runner, /pointerType: "pen"/);
  });

  it("견본 PDF는 저장소에 두지 않고 돌릴 때 만든다 (#199)", () => {
    assert.match(fixtures, /export async function makeFixtures\(dir\)/);
    assert.equal(existsSync(join(root, "scripts/smoke/links.pdf")), false);
    assert.equal(existsSync(join(root, "scripts/smoke/chain.pdf")), false);
    assert.match(readFileSync(join(root, ".gitignore"), "utf8"), /^\*\.pdf$/m);
  });
});
