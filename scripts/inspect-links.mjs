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

let web = 0;
let inside = 0;
let broken = 0;

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
      console.log(`  ${number}쪽 → 끊김: ${error?.message}`);
      console.log(`        dest = ${raw?.length > 160 ? `${raw.slice(0, 160)}…` : raw}`);
    }
  }
}

console.log(`\n웹 ${web}개 · 문서 안 ${inside}개 · 끊김 ${broken}개`);
