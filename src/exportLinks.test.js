import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFName, PDFNumber, PDFString } from "pdf-lib";
import { buildAnnotatedPdf } from "./exportPdf.js";
import { destTarget, destView } from "./pdfLinks.js";

/**
 * A real round trip, because this bug was invisible to every unit test (#184):
 * pdf-lib copies a link's destination by following it, which lands on a page
 * object that is not in the new page tree. Only reading the result back shows it.
 */
async function sourcePdf() {
  const doc = await PDFDocument.create();
  const first = doc.addPage([600, 800]);
  const second = doc.addPage([600, 800]);
  const context = doc.context;
  const web = context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [50, 690, 300, 720],
    A: context.obj({ Type: "Action", S: "URI", URI: PDFString.of("https://example.com/a") }),
  });
  const inside = context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [50, 640, 300, 670],
    Dest: [second.ref, PDFName.of("XYZ"), PDFNumber.of(0), PDFNumber.of(800), PDFNumber.of(0)],
  });
  first.node.set(PDFName.of("Annots"), context.obj([web, inside]));
  return new Uint8Array(await doc.save());
}

async function readLinks(bytes) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdf.js takes the array over, so it never gets the caller's copy.
  const pdf = await pdfjs.getDocument({ data: Uint8Array.from(bytes) }).promise;
  const out = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    for (const item of await page.getAnnotations({ intent: "display" })) {
      if (item.subtype !== "Link") {
        continue;
      }
      let to = 0;
      let view = null;
      if (item.dest) {
        const explicit = typeof item.dest === "string" ? await pdf.getDestination(item.dest) : item.dest;
        to = (await pdf.getPageIndex(explicit?.[0])) + 1;
        view = explicit.slice(1);
      }
      out.push({ on: number, url: item.url || "", to, view });
    }
  }
  return { pages: pdf.numPages, links: out };
}

const bake = (buffer, leaves, linksOf) =>
  buildAnnotatedPdf({
    buffer,
    leaves,
    linksOf,
    strokesOf: () => [],
    renderOverlay: async () => null,
    renderRaster: async () => null,
  });

describe("#184 구운 PDF의 페이지 간 참조", () => {
  it("points at the page that is really there, not at a copy of it", async () => {
    const buffer = await sourcePdf();
    const before = await readLinks(buffer);
    assert.deepEqual(before.links.map((link) => link.to), [0, 2], "원본은 2쪽을 가리킨다");

    const leaves = [
      { id: "a", kind: "pdf", pdfPage: 1, rotate: 0 },
      { id: "b", kind: "pdf", pdfPage: 2, rotate: 0 },
    ];
    const links = new Map([["a", [
      { rect: [50, 690, 300, 720], url: "https://example.com/a" },
      { rect: [50, 640, 300, 670], page: 2, view: ["XYZ", 0, 800, 0] },
    ]], ["b", []]]);
    const after = await readLinks(await bake(buffer, leaves, (leaf) => links.get(leaf.id) || []));
    assert.deepEqual(after.links.map((link) => link.to), [0, 2], "구운 뒤에도 2쪽");
    assert.equal(after.links[0].url, "https://example.com/a", "웹 링크는 그대로");
  });

  it("follows a page that was moved, instead of the number it used to have", async () => {
    const buffer = await sourcePdf();
    // 원본 2쪽을 문서의 첫 자리로 옮긴다.
    const leaves = [
      { id: "b", kind: "pdf", pdfPage: 2, rotate: 0 },
      { id: "a", kind: "pdf", pdfPage: 1, rotate: 0 },
    ];
    const links = new Map([["b", []], ["a", [
      { rect: [50, 640, 300, 670], page: 1, view: ["XYZ", 0, 800, 0] },
    ]]]);
    const after = await readLinks(await bake(buffer, leaves, (leaf) => links.get(leaf.id) || []));
    const inside = after.links.find((link) => link.to);
    assert.equal(inside.on, 2, "링크는 옮겨진 쪽 위에 있고");
    assert.equal(inside.to, 1, "가리키는 곳은 그 쪽의 새 자리다");
    assert.deepEqual(inside.view.slice(1), [0, 800, 0], "보던 위치도 그대로");
  });

  it("drops a link whose page is not in the document any more", async () => {
    const buffer = await sourcePdf();
    const leaves = [{ id: "a", kind: "pdf", pdfPage: 1, rotate: 0 }];
    // 2쪽을 지웠으므로 main.js는 그 링크를 애초에 넘기지 않는다.
    const after = await readLinks(await bake(buffer, leaves, () => [
      { rect: [50, 690, 300, 720], url: "https://example.com/a" },
    ]));
    assert.equal(after.pages, 1);
    assert.deepEqual(after.links.map((link) => link.url), ["https://example.com/a"]);
    assert.ok(after.links.every((link) => !link.to), "가리킬 데 없는 링크는 남지 않는다");
  });

  it("leaves the file alone when nobody asked for relinking", async () => {
    const buffer = await sourcePdf();
    const leaves = [{ id: "a", kind: "pdf", pdfPage: 1, rotate: 0 }];
    const after = await readLinks(await bake(buffer, leaves, undefined));
    assert.equal(after.links.length, 2, "예전 동작 그대로");
  });
});

describe("#186 쪽 번호로 적힌 목적지", () => {
  it("resolves a destination that names a page index, and baking rewrites it as a reference", async () => {
    const doc = await PDFDocument.create();
    const first = doc.addPage([600, 800]);
    doc.addPage([600, 800]);
    const context = doc.context;
    // 첫 항목이 참조가 아니라 정수 1(0부터 세므로 2쪽)이다.
    first.node.set(
      PDFName.of("Annots"),
      context.obj([
        context.obj({
          Type: "Annot",
          Subtype: "Link",
          Rect: [50, 700, 300, 730],
          Dest: [PDFNumber.of(1), PDFName.of("XYZ"), PDFNumber.of(0), PDFNumber.of(800), PDFNumber.of(0)],
        }),
      ]),
    );
    const buffer = new Uint8Array(await doc.save());

    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const read = await pdfjs.getDocument({ data: Uint8Array.from(buffer) }).promise;
    const [link] = await (await read.getPage(1)).getAnnotations({ intent: "display" });
    const target = destTarget(link.dest);
    assert.deepEqual(target, { kind: "index", page: 2 }, "pdf.js hands us a number, not a reference");
    await assert.rejects(() => read.getPageIndex(link.dest[0]), "and refuses to look it up itself");

    const leaves = [
      { id: "a", kind: "pdf", pdfPage: 1, rotate: 0 },
      { id: "b", kind: "pdf", pdfPage: 2, rotate: 0 },
    ];
    const baked = await readLinks(
      await bake(buffer, leaves, (leaf) =>
        leaf.pdfPage === 1 ? [{ rect: [50, 700, 300, 730], page: target.page, view: destView(link.dest) }] : []),
    );
    assert.deepEqual(baked.links.map((item) => item.to), [2], "굽고 나면 참조로 제대로 적힌다");
  });
});
