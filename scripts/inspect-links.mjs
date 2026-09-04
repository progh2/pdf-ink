/**
 * 파일이 들고 있는 링크를 그대로 보여 준다 (#184).
 *
 *   node scripts/inspect-links.mjs 문서.pdf
 *
 * 「원래 없는 건지, 우리가 변환하면서 깨뜨린 건지」를 가르는 도구다.
 * 안쪽 링크가 → 로 쪽 번호를 못 보여 주면 그 파일 자체가 끊겨 있는 것이다.
 */
import { readFileSync } from "node:fs";
import { destTarget } from "../src/pdfLinks.js";

const file = process.argv[2];
if (!file) {
  console.error("쓰임: node scripts/inspect-links.mjs <파일.pdf>");
  process.exit(1);
}

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const pdf = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(file)) }).promise;
console.log(`${file} — ${pdf.numPages}쪽`);

/*
 * 이름 목적지 표 (#196). 링크가 「이름」으로 가리킬 때 그 이름이 어느 쪽인지
 * 적어 두는 표다. 이 표가 없으면 이름만 남고 갈 곳이 없다 — 굿노트 export가
 * 그런 상태였다.
 */
const table = await pdf.getDestinations().catch(() => ({}));
const names = Object.keys(table || {});
console.log(`이름 목적지 표: ${names.length}개${names.length ? ` (예: ${names.slice(0, 3).join(", ")})` : " — 표가 없습니다"}`);
console.log("");

let web = 0;
let inside = 0;
let broken = 0;
const missingNames = new Set();

for (let number = 1; number <= pdf.numPages; number += 1) {
  const page = await pdf.getPage(number);
  const links = (await page.getAnnotations({ intent: "display" })).filter((item) => item.subtype === "Link");
  for (const link of links) {
    if (link.url) {
      web += 1;
      console.log(`  ${number}쪽 → ${link.url}`);
      continue;
    }
    if (!link.dest) {
      console.log(`  ${number}쪽 → (가리키는 곳 없음) action=${link.action ?? "-"}`);
      broken += 1;
      continue;
    }
    try {
      const explicit = typeof link.dest === "string" ? await pdf.getDestination(link.dest) : link.dest;
      const target = destTarget(explicit);
      if (!target) {
        throw new Error("목적지가 비었다");
      }
      const at = target.kind === "index" ? target.page : (await pdf.getPageIndex(target.ref)) + 1;
      inside += 1;
      const how = target.kind === "index" ? "(쪽 번호로 적힌 링크)" : typeof link.dest === "string" ? `(이름: ${link.dest})` : "";
      console.log(`  ${number}쪽 → ${at}쪽  ${how}`);
    } catch (error) {
      broken += 1;
      const raw = JSON.stringify(link.dest);
      const named = typeof link.dest === "string";
      const why = named
        ? names.includes(link.dest)
          ? "표에는 있는데 그 항목이 쪽을 안 가리킵니다"
          : "이 이름이 목적지 표에 없습니다"
        : error?.message;
      console.log(`  ${number}쪽 → 끊김: ${why}`);
      console.log(`        dest = ${raw?.length > 160 ? `${raw.slice(0, 160)}…` : raw}`);
      if (named) {
        missingNames.add(link.dest);
      }
    }
  }
}

console.log(`\n웹 ${web}개 · 문서 안 ${inside}개 · 끊김 ${broken}개`);
if (missingNames.size) {
  console.log(`\n표에 없는 이름 ${missingNames.size}종. 파일이 이름만 들고 있고 목적지 표가 빠졌습니다 —`);
  console.log("읽는 쪽에서는 복구할 수 없고, 앱에서 링크를 길게 눌러 직접 고쳐야 합니다 (#190).");
} else if (broken) {
  console.log("\n이름 문제는 아닙니다. 위의 dest 원문을 그대로 알려 주세요.");
} else if (inside) {
  console.log("\n문서 안 링크가 모두 살아 있습니다.");
}
