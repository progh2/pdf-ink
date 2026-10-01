/**
 * #249: CI가 우리의 브라우저가 된다.
 *
 * 테스트 1000개가 통과해도 앱이 하얬던 적이 두 번 있었다 — 정규식 계약은 구조
 * 붕괴·런타임 예외·경쟁을 못 본다. 여기서는 빌드된 dist를 배포와 같은 헤더로
 * 띄우고 진짜 크로미움으로 다섯 가지를 지난다:
 *
 *   1. 열기        — 콘솔 오류·페이지 오류 0
 *   2. 링크(쪽넘김) — 목적지·GoTo 동작이 그 쪽으로 간다
 *   3. 링크(스크롤) — 폰 모양 화면에서 「다음」을 세 번 눌러 세 번 다 넘어간다(#458)
 *   4. 펜·되돌리기  — 세 획 뒤 되돌리기 둘·다시 실행 하나가 화면 픽셀과 함께 움직인다(#460)
 *   5. 성능 예산    — 200획 쌓인 쪽에서 펜을 뗀 뒤 긴 작업이 예산 안이다(#460)
 *
 * 로컬에서 돌리려면: npm run build 뒤 `npm run smoke`. 크로미움이 Playwright
 * 기본 자리에 없으면 SMOKE_CHROME(실행 파일)·SMOKE_LD(공유 라이브러리 폴더)로
 * 가리킨다 — 루트 없이 apt-get download로 받은 라이브러리면 된다.
 */
import { chromium } from "playwright";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeFixtures } from "./fixtures.mjs";
import { serveDist } from "./serve.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dist = join(root, "dist");
if (!existsSync(join(dist, "index.html"))) {
  console.error("dist/index.html이 없다 — 먼저 npm run build.");
  process.exit(2);
}

// #460에서 잰 값(데스크톱 300획: 수정 전 평균 79ms·최대 116ms, 수정 후 0)을 기준으로
// CI 러너가 느린 것을 감안해 넉넉히 잡는다. 되돌아가면 바로 넘는 값이다.
const BUDGET = { upAvgMs: 25, upMaxMs: 80, frameP95Ms: 40 };

const PHONE = { viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const DESK = { viewport: { width: 1100, height: 800 } };

const failures = [];
const notes = [];
const ok = (name, detail = "") => notes.push(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
const fail = (name, detail) => { failures.push(`${name}: ${detail}`); notes.push(`  ✗ ${name} — ${detail}`); };
const check = (cond, name, detail) => (cond ? ok(name, detail) : fail(name, detail));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openDoc(context, url, pdfPath) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e.message).slice(0, 200)}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/willReadFrequently/.test(m.text())) errors.push(`console: ${m.text().slice(0, 200)}`);
  });
  await page.goto(url, { waitUntil: "load" });
  await page.setInputFiles("#file-input", pdfPath);
  await page.waitForFunction(() => !document.querySelector("#write-screen").hidden, null, { timeout: 30000 });
  await sleep(1500);
  return { page, errors };
}

const state = (page) =>
  page.evaluate(() => ({
    pager: document.querySelector("#page-label")?.textContent,
    banner: document.querySelector("#banner")?.textContent,
    top: Math.round(document.querySelector("#workspace").scrollTop),
  }));

async function tapCenter(page, selector) {
  const [x, y] = await page.evaluate((sel) => {
    const b = document.querySelector(sel).getBoundingClientRect();
    return [b.left + b.width / 2, b.top + b.height / 2];
  }, selector);
  await page.mouse.click(x, y);
}

async function setScrollMode(page) {
  await page.evaluate(() => document.querySelector("#settings-btn")?.click());
  await sleep(200);
  await page.evaluate(() => {
    [...document.querySelectorAll("#settings-sheet button")].find((n) => n.textContent.trim() === "세로 스크롤")?.click();
    document.querySelector("#settings-done")?.click();
  });
  await sleep(1500);
}

async function unlockPen(page) {
  await page.evaluate(() => document.querySelector("#interact-btn")?.click());
  await sleep(300);
  await tapCenter(page, "#pen-btn"); // bindHold라 click()이 아니라 실제 탭
  await sleep(300);
}

/** 종이 사각형 안의 비율 좌표로 펜 획을 긋는다(CDP로 pointerType: "pen"). */
const withTimeout = (promise, ms, what) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`${what}가 ${ms}ms 안에 끝나지 않았다`)), ms))]);

function penOn(cdp, box) {
  const send = (params) => withTimeout(cdp.send("Input.dispatchMouseEvent", params), 10000, `펜 ${params.type}`);
  // paced=false면 이벤트를 한꺼번에 보내고 마지막만 기다린다 — 쌓아 두는 획은
  // 빠르게, 재는 획은 실제 입력처럼 하나씩(paced=true).
  return async (fromX, fromY, toX, toY, steps = 40, paced = true) => {
    const at = (k) => ({ x: box.x + box.w * (fromX + ((toX - fromX) * k) / steps), y: box.y + box.h * (fromY + ((toY - fromY) * k) / steps) + Math.sin(k / 3) * 4 });
    const p0 = at(0);
    const pe = at(steps);
    const events = [
      { type: "mousePressed", x: p0.x, y: p0.y, button: "left", buttons: 1, clickCount: 1, pointerType: "pen" },
      ...Array.from({ length: steps }, (_, i) => { const p = at(i + 1); return { type: "mouseMoved", x: p.x, y: p.y, button: "left", buttons: 1, pointerType: "pen" }; }),
      { type: "mouseReleased", x: pe.x, y: pe.y, button: "left", buttons: 0, clickCount: 1, pointerType: "pen" },
    ];
    if (paced) {
      for (const e of events) await send(e);
      return;
    }
    const pending = events.map((e) => send(e));
    await Promise.all(pending);
  };
}

const stageBox = (page) =>
  page.evaluate(() => {
    const b = document.querySelector(".page-stage").getBoundingClientRect();
    return { x: b.left, y: b.top, w: b.width, h: b.height };
  });

const inkedPixels = (page) =>
  page.evaluate(() => {
    const c = document.querySelector(".ink-canvas");
    const d = c.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n += 1;
    return n;
  });

async function scenarioOpen(browser, url, fx) {
  const context = await browser.newContext(DESK);
  const { page, errors } = await openDoc(context, url, fx.text);
  const s = await state(page);
  check(errors.length === 0, "열기: 오류 0", errors.join(" | ") || `${s.pager}`);
  check(/^1 \/ 30$/.test(s.pager || ""), "열기: 30쪽이 열린다", s.pager);
  await context.close();
}

async function scenarioLinksPage(browser, url, fx) {
  const context = await browser.newContext(DESK);
  const { page, errors } = await openDoc(context, url, fx.links);
  const hint = async (i) => {
    const b = await page.locator(".pdf-link-hint").nth(i).boundingBox();
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await sleep(1500);
  };
  await hint(0);
  check((await state(page)).pager === "5 / 6", "링크(쪽넘김): 목적지 → 5쪽", (await state(page)).pager);
  for (let i = 0; i < 5; i += 1) await page.evaluate(() => document.querySelector("#prev-btn")?.click());
  await sleep(800);
  await hint(1);
  check((await state(page)).pager === "3 / 6", "링크(쪽넘김): GoTo 동작 → 3쪽", (await state(page)).pager);
  check(errors.length === 0, "링크(쪽넘김): 오류 0", errors.join(" | "));
  await context.close();
}

async function scenarioLinksScroll(browser, url, fx) {
  const context = await browser.newContext(PHONE);
  const { page, errors } = await openDoc(context, url, fx.chain);
  await setScrollMode(page);
  let moved = 0;
  for (let i = 0; i < 3; i += 1) {
    // 화면 맨 위에 걸린 쪽의 「다음」 상자 가운데(x 340/400, y 120/280).
    const pick = await page.evaluate(() => {
      const w = document.querySelector("#workspace").getBoundingClientRect();
      const top = [...document.querySelectorAll(".page-stage")]
        .map((s) => ({ n: Number(s.dataset.page), b: s.getBoundingClientRect() }))
        .filter((s) => s.b.bottom > w.top + 140)
        .sort((a, b) => a.b.top - b.b.top)[0];
      return { n: top.n, x: top.b.left + top.b.width * (340 / 400), y: top.b.top + top.b.height * (120 / 280) };
    });
    const before = await state(page);
    await page.touchscreen.tap(pick.x, pick.y);
    await sleep(1800);
    const after = await state(page);
    if (after.top !== before.top) moved += 1;
  }
  check(moved === 3, "링크(스크롤·폰): 「다음」 3번 다 넘어간다", `${moved}/3`);
  check(errors.length === 0, "링크(스크롤·폰): 오류 0", errors.join(" | "));
  await context.close();
}

async function scenarioPenUndo(browser, url, fx) {
  const context = await browser.newContext(PHONE);
  const { page, errors } = await openDoc(context, url, fx.chain);
  await unlockPen(page);
  const cdp = await context.newCDPSession(page);
  const pen = penOn(cdp, await stageBox(page));
  for (let i = 0; i < 3; i += 1) {
    await pen(0.1, 0.2 + i * 0.15, 0.9, 0.2 + i * 0.15, 30);
    await sleep(150);
  }
  const three = await inkedPixels(page);
  await tapCenter(page, "#undo-btn");
  await sleep(400);
  const two = await inkedPixels(page);
  await tapCenter(page, "#undo-btn");
  await sleep(400);
  const one = await inkedPixels(page);
  await tapCenter(page, "#redo-btn");
  await sleep(400);
  const back = await inkedPixels(page);
  check(three > 0 && three > two && two > one, "펜: 되돌리기가 화면에서 획을 뺀다", `${three} → ${two} → ${one}`);
  check(Math.abs(back - two) <= Math.max(8, three * 0.02), "펜: 다시 실행이 그 획을 돌려놓는다", `${one} → ${back} (기대 ${two})`);
  check(errors.length === 0, "펜: 오류 0", errors.join(" | "));
  await context.close();
}

async function scenarioPerf(browser, url, fx) {
  const context = await browser.newContext(PHONE);
  const { page, errors } = await openDoc(context, url, fx.text);
  await unlockPen(page);
  const cdp = await context.newCDPSession(page);
  const pen = penOn(cdp, await stageBox(page));
  const row = (i) => 0.12 + ((i * 0.037) % 0.76);
  for (let i = 0; i < 200; i += 1) {
    await pen(0.08, row(i), 0.92, row(i), 20, false);
    if (i % 50 === 49) console.log(`    쌓는 중 ${i + 1}/200`);
  }
  await sleep(2500); // 손이 쉬는 틈 — 저장·썸네일이 돌고 지나간다.
  await page.evaluate(() => {
    window.__m = { long: [], frames: [], ups: [], downs: [] };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__m.long.push({ t: e.startTime, d: e.duration });
    }).observe({ entryTypes: ["longtask"] });
    let last = performance.now();
    const tick = (now) => { window.__m.frames.push([now, now - last]); last = now; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    window.addEventListener("pointerdown", () => window.__m.downs.push(performance.now()), true);
    window.addEventListener("pointerup", () => window.__m.ups.push(performance.now()), true);
  });
  for (let i = 0; i < 10; i += 1) {
    await pen(0.08, row(200 + i), 0.92, row(200 + i), 90);
    await sleep(120);
  }
  await sleep(600);
  const m = await page.evaluate(() => window.__m);
  const upLong = m.ups.map((u) => m.long.filter((l) => l.t >= u - 5 && l.t <= u + 400).reduce((a, l) => a + l.d, 0));
  const avg = upLong.reduce((a, b) => a + b, 0) / Math.max(1, upLong.length);
  const max = Math.max(0, ...upLong);
  const during = [];
  for (const [t, g] of m.frames) {
    if (m.downs.some((d, i) => t >= d && t <= (m.ups[i] ?? Infinity))) during.push(g);
  }
  const sorted = [...during].sort((a, b) => a - b);
  const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(0.95 * sorted.length))] : 0;
  check(avg <= BUDGET.upAvgMs && max <= BUDGET.upMaxMs, "성능: 펜 뗀 뒤 긴 작업이 예산 안", `평균 ${avg.toFixed(1)}ms 최대 ${max.toFixed(0)}ms (예산 ${BUDGET.upAvgMs}/${BUDGET.upMaxMs})`);
  check(p95 <= BUDGET.frameP95Ms, "성능: 획 중 프레임 p95가 예산 안", `${p95.toFixed(1)}ms (예산 ${BUDGET.frameP95Ms})`);
  check(errors.length === 0, "성능: 오류 0", errors.join(" | "));
  await context.close();
}

const tmp = mkdtempSync(join(tmpdir(), "pdf-ink-smoke-"));
const fx = await makeFixtures(tmp);
const { server, url } = await serveDist({ root: dist, vercelJson: join(root, "vercel.json") });
// TMPDIR는 그대로 넘긴다 — Playwright가 크로미움의 공유 메모리를 /tmp에 두는데
// (--disable-dev-shm-usage), /tmp가 작은 tmpfs라 차 있으면 캔버스 버퍼 할당이
// 실패해 렌더러가 조용히 죽는다(이 기계에서 60MB 남은 /tmp로 겪었다).
// 그럴 땐 TMPDIR=~/.cache/pdfink-tmp 처럼 넉넉한 곳을 가리키면 된다.
const launch = { args: ["--no-sandbox"], env: { ...process.env } };
if (process.env.SMOKE_CHROME) launch.executablePath = process.env.SMOKE_CHROME;
if (process.env.SMOKE_LD) launch.env.LD_LIBRARY_PATH = process.env.SMOKE_LD;
const browser = await chromium.launch(launch);
const started = Date.now();
try {
  const all = [
    ["열기", scenarioOpen],
    ["링크(쪽넘김)", scenarioLinksPage],
    ["링크(스크롤·폰)", scenarioLinksScroll],
    ["펜·되돌리기", scenarioPenUndo],
    ["성능 예산", scenarioPerf],
  ];
  const only = process.env.SMOKE_ONLY;
  for (const [name, fn] of only ? all.filter(([n]) => n.includes(only)) : all) {
    const t0 = Date.now();
    console.log(`▶ ${name}`);
    try {
      await fn(browser, url, fx);
      console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    } catch (error) {
      console.log(`  ✗ 던짐: ${String(error?.message || error).slice(0, 300)}`);
      fail(name, `시나리오가 던졌다: ${String(error?.message || error).slice(0, 300)}`);
    }
  }
} finally {
  await browser.close();
  server.close();
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`스모크 (${((Date.now() - started) / 1000).toFixed(0)}s, ${url})`);
console.log(notes.join("\n"));
if (failures.length) {
  console.log(`\n실패 ${failures.length}건`);
  process.exit(1);
}
console.log("\n모두 통과");
