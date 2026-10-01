/**
 * #249: 스모크 시험용 견본 문서. 저장소에는 PDF를 두지 않으므로(#199) 돌릴 때
 * 임시 폴더에 만든다. 셋 다 pdf-lib로 만들어 pdf.js·링크·필기 경로를 실제로
 * 지나게 한다.
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { PDFDocument, PDFName, PDFString, StandardFonts, rgb } = require("pdf-lib");

function link(doc, rect, extra) {
  return doc.context.register(
    doc.context.obj({ Type: "Annot", Subtype: "Link", Rect: rect, Border: [0, 0, 0], ...extra }),
  );
}

/** 6쪽. 1쪽에 목적지(dest)·GoTo 동작·웹 주소 링크 하나씩. */
async function linksPdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = [];
  for (let i = 1; i <= 6; i += 1) {
    const p = doc.addPage([400, 600]);
    p.drawText(`PAGE ${i}`, { x: 40, y: 540, size: 28, font });
    pages.push(p);
  }
  const first = pages[0];
  first.drawRectangle({ x: 40, y: 400, width: 200, height: 40, color: rgb(0.8, 0.9, 1) });
  first.drawRectangle({ x: 40, y: 300, width: 200, height: 40, color: rgb(0.8, 1, 0.8) });
  first.drawRectangle({ x: 40, y: 200, width: 200, height: 40, color: rgb(1, 0.9, 0.8) });
  const a1 = link(doc, [40, 400, 240, 440], { Dest: [pages[4].ref, PDFName.of("Fit")] });
  const a2 = link(doc, [40, 300, 240, 340], { A: { Type: "Action", S: "GoTo", D: [pages[2].ref, PDFName.of("Fit")] } });
  const a3 = link(doc, [40, 200, 240, 240], { A: { Type: "Action", S: "URI", URI: PDFString.of("https://example.com/") } });
  first.node.set(PDFName.of("Annots"), doc.context.obj([a1, a2, a3]));
  return doc.save();
}

/** 12쪽, 가로로 긴 쪽(400×280)마다 「다음」 링크 — 폰에서 여러 장이 한 화면에 든다(#458). */
async function chainPdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = [];
  for (let i = 1; i <= 12; i += 1) {
    const p = doc.addPage([400, 280]);
    p.drawText(`DAY ${i}`, { x: 30, y: 220, size: 30, font });
    pages.push(p);
  }
  pages.forEach((p, i) => {
    const annots = [];
    if (i < pages.length - 1) {
      p.drawRectangle({ x: 300, y: 140, width: 80, height: 40, color: rgb(0.8, 0.9, 1) });
      annots.push(link(doc, [300, 140, 380, 180], { Dest: [pages[i + 1].ref, PDFName.of("Fit")] }));
    }
    p.node.set(PDFName.of("Annots"), doc.context.obj(annots));
  });
  return doc.save();
}

/** 30쪽 글자 문서 — 썸네일 굽기·필기 성능 시험용. */
async function textPdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 30; i += 1) {
    const p = doc.addPage([400, 600]);
    for (let line = 0; line < 24; line += 1) {
      p.drawText(`page ${i} line ${line + 1} the quick brown fox jumps over the lazy dog`, { x: 24, y: 560 - line * 22, size: 9, font });
    }
  }
  return doc.save();
}

export async function makeFixtures(dir) {
  const out = {
    links: join(dir, "links.pdf"),
    chain: join(dir, "chain.pdf"),
    text: join(dir, "text.pdf"),
  };
  writeFileSync(out.links, await linksPdf());
  writeFileSync(out.chain, await chainPdf());
  writeFileSync(out.text, await textPdf());
  return out;
}
