import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PDFDict, PDFDocument, PDFName, degrees } from "pdf-lib";
import { encodePngRgba } from "./capture.js";
import {
  buildAnnotatedPdf,
  canShareFile,
  exportFileName,
  exportScale,
  hasInk,
  needsRaster,
  overlayPixelSize,
  overlayPlacement,
  viewSize,
} from "./exportPdf.js";

function redPng(width = 4, height = 4) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 220;
    rgba[i + 3] = 255;
  }
  return encodePngRgba(width, height, rgba);
}

async function sourcePdf() {
  const doc = await PDFDocument.create();
  doc.addPage([300, 400]);
  doc.addPage([500, 200]);
  return doc.save();
}

const stroke = { type: "pen", width: 2, points: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.4 }] };
const mosaic = { type: "mosaic", x: 0.1, y: 0.1, w: 0.2, h: 0.2 };

/** Where the overlay lands after the viewer turns the page by its rotation. */
function drawnCorners(spot) {
  const rad = (spot.rotate * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const local = [
    { x: 0, y: 0 },
    { x: spot.width, y: 0 },
    { x: spot.width, y: spot.height },
    { x: 0, y: spot.height },
  ];
  return local.map((point) => ({
    x: spot.x + point.x * cos - point.y * sin,
    y: spot.y + point.x * sin + point.y * cos,
  }));
}

describe("내보내기 (#54)", () => {
  it("names the file after the document", () => {
    assert.equal(exportFileName("class-note.pdf"), "class-note-필기.pdf");
    assert.equal(exportFileName("수학.PDF"), "수학-필기.pdf");
    assert.equal(exportFileName(""), "문서-필기.pdf");
  });

  it("draws at 2x but caps a poster page", () => {
    assert.equal(exportScale(595, 842), 2);
    assert.ok(exportScale(2400, 3600) < 2);
    assert.ok(exportScale(2400, 3600) * 3600 <= 2600 + 1);
    assert.deepEqual(overlayPixelSize(595, 842, 2), { width: 1190, height: 1684 });
  });

  it("flattens only a masked page", () => {
    assert.equal(needsRaster([stroke]), false);
    assert.equal(needsRaster([stroke, mosaic]), true);
    assert.equal(hasInk([]), false);
    assert.equal(hasInk([{ type: "area", x: 0, y: 0, w: 1, h: 1 }]), false);
    assert.equal(hasInk([stroke]), true);
  });

  it("swaps the page edges the writer sees at 90 and 270", () => {
    assert.deepEqual(viewSize(0, 300, 400), { width: 300, height: 400 });
    assert.deepEqual(viewSize(90, 300, 400), { width: 400, height: 300 });
    assert.deepEqual(viewSize(270, 300, 400), { width: 400, height: 300 });
    assert.deepEqual(viewSize(180, 300, 400), { width: 300, height: 400 });
  });

  it("places the overlay over the whole page at every rotation", () => {
    for (const rotation of [0, 90, 180, 270]) {
      const spot = overlayPlacement(rotation, 300, 400);
      const corners = drawnCorners(spot);
      const xs = corners.map((point) => point.x);
      const ys = corners.map((point) => point.y);
      assert.ok(Math.abs(Math.min(...xs)) < 1e-6, `x0 at ${rotation}`);
      assert.ok(Math.abs(Math.max(...xs) - 300) < 1e-6, `x1 at ${rotation}`);
      assert.ok(Math.abs(Math.min(...ys)) < 1e-6, `y0 at ${rotation}`);
      assert.ok(Math.abs(Math.max(...ys) - 400) < 1e-6, `y1 at ${rotation}`);
    }
  });

  it("writes the leaves in order, with outline leaves as blank pages", async () => {
    const buffer = await sourcePdf();
    const leaves = [
      { id: "p2", kind: "pdf", pdfPage: 2, rotate: 0 },
      { id: "o:1", kind: "outline", pdfPage: 0, rotate: 0 },
      { id: "p1", kind: "pdf", pdfPage: 1, rotate: 90 },
    ];
    const bytes = await buildAnnotatedPdf({
      buffer,
      leaves,
      strokesOf: () => [stroke],
      renderOverlay: () => redPng(),
      renderRaster: () => redPng(),
      blankSize: { width: 595, height: 842 },
    });
    const out = await PDFDocument.load(bytes);
    assert.equal(out.getPageCount(), 3);
    const sizes = out.getPages().map((page) => [
      Math.round(page.getSize().width),
      Math.round(page.getSize().height),
      page.getRotation().angle,
    ]);
    assert.deepEqual(sizes, [[500, 200, 0], [595, 842, 0], [300, 400, 90]]);
  });

  it("asks for the raster only on the masked leaf, and skips a clean page", async () => {
    const buffer = await sourcePdf();
    const asked = [];
    const leaves = [
      { id: "p1", kind: "pdf", pdfPage: 1, rotate: 0 },
      { id: "p2", kind: "pdf", pdfPage: 2, rotate: 0 },
    ];
    const pages = { p1: [], p2: [stroke, mosaic] };
    await buildAnnotatedPdf({
      buffer,
      leaves,
      strokesOf: (leaf) => pages[leaf.id],
      renderOverlay: (leaf) => {
        asked.push(`overlay:${leaf.id}`);
        return redPng();
      },
      renderRaster: (leaf) => {
        asked.push(`raster:${leaf.id}`);
        return redPng();
      },
    });
    assert.deepEqual(asked, ["raster:p2"]);
  });

  it("asks the overlay for the turned page size", async () => {
    const buffer = await sourcePdf();
    const seen = [];
    await buildAnnotatedPdf({
      buffer,
      leaves: [{ id: "p1", kind: "pdf", pdfPage: 1, rotate: 90 }],
      strokesOf: () => [stroke],
      renderOverlay: (leaf, pixels) => {
        seen.push(pixels);
        return redPng();
      },
      renderRaster: () => redPng(),
    });
    // 300x400 turned 90 is 400x300 to the writer, drawn at 2x.
    assert.deepEqual(seen, [{ width: 800, height: 600 }]);
  });

  it("keeps a rotation the file already had", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([300, 400]).setRotation(degrees(90));
    const buffer = await doc.save();
    const bytes = await buildAnnotatedPdf({
      buffer,
      leaves: [{ id: "p1", kind: "pdf", pdfPage: 1, rotate: 90 }],
      strokesOf: () => [stroke],
      renderOverlay: () => redPng(),
      renderRaster: () => redPng(),
    });
    const out = await PDFDocument.load(bytes);
    assert.equal(out.getPage(0).getRotation().angle, 180);
  });

  it("shares a file only when the browser takes one", () => {
    const file = { name: "x.pdf" };
    assert.equal(canShareFile(null, file), false);
    assert.equal(canShareFile({ share: () => {} }, file), false);
    assert.equal(canShareFile({ share: () => {}, canShare: () => true }, file), true);
    assert.equal(canShareFile({ share: () => {}, canShare: () => false }, file), false);
    assert.equal(
      canShareFile(
        {
          share: () => {},
          canShare: () => {
            throw new Error("nope");
          },
        },
        file,
      ),
      false,
    );
  });
});

describe("내보낸 PDF 목차 (#53 → #54)", () => {
  async function outlineTitles(bytes) {
    const doc = await PDFDocument.load(bytes);
    if (!doc.catalog.get(PDFName.of("Outlines"))) {
      return null;
    }
    const root = doc.catalog.lookup(PDFName.of("Outlines"), PDFDict);
    const titles = [];
    let ref = root.get(PDFName.of("First"));
    while (ref) {
      const item = doc.context.lookup(ref, PDFDict);
      titles.push(item.get(PDFName.of("Title")).decodeText());
      ref = item.get(PDFName.of("Next"));
    }
    return { titles, count: root.get(PDFName.of("Count")).asNumber() };
  }

  it("bakes the drawer outline into the file as bookmarks", async () => {
    const buffer = await sourcePdf();
    const bytes = await buildAnnotatedPdf({
      buffer,
      leaves: [
        { id: "p1", kind: "pdf", pdfPage: 1, rotate: 0 },
        { id: "p2", kind: "pdf", pdfPage: 2, rotate: 0 },
      ],
      strokesOf: () => [],
      renderOverlay: () => null,
      renderRaster: () => null,
      outline: [
        { id: "t:1", title: "표지", page: 1 },
        { id: "t:2", title: "본문 · 2쪽", page: 2 },
      ],
    });
    const read = await outlineTitles(bytes);
    assert.deepEqual(read.titles, ["표지", "본문 · 2쪽"]);
    assert.equal(read.count, 2);
  });

  it("writes no outline when the drawer has none", async () => {
    const buffer = await sourcePdf();
    const bytes = await buildAnnotatedPdf({
      buffer,
      leaves: [{ id: "p1", kind: "pdf", pdfPage: 1, rotate: 0 }],
      strokesOf: () => [],
      renderOverlay: () => null,
      renderRaster: () => null,
      outline: [],
    });
    assert.equal(await outlineTitles(bytes), null);
  });

  it("clamps a stale outline page to the last page", async () => {
    const buffer = await sourcePdf();
    const bytes = await buildAnnotatedPdf({
      buffer,
      leaves: [{ id: "p1", kind: "pdf", pdfPage: 1, rotate: 0 }],
      strokesOf: () => [],
      renderOverlay: () => null,
      renderRaster: () => null,
      outline: [{ id: "t:9", title: "없는 쪽", page: 9 }],
    });
    const read = await outlineTitles(bytes);
    assert.deepEqual(read.titles, ["없는 쪽"]);
  });
});

describe("#145 책갈피를 PDF 안에", () => {
  async function outlineTree(bytes) {
    const doc = await PDFDocument.load(bytes);
    if (!doc.catalog.get(PDFName.of("Outlines"))) {
      return null;
    }
    const root = doc.catalog.lookup(PDFName.of("Outlines"), PDFDict);
    const walk = (ref) => {
      const out = [];
      let at = ref;
      while (at) {
        const node = doc.context.lookup(at, PDFDict);
        const first = node.get(PDFName.of("First"));
        out.push({
          title: node.get(PDFName.of("Title")).decodeText(),
          count: node.get(PDFName.of("Count"))?.asNumber?.() ?? 0,
          children: first ? walk(first) : [],
        });
        at = node.get(PDFName.of("Next"));
      }
      return out;
    };
    return walk(root.get(PDFName.of("First")));
  }

  const leaves = [
    { id: "p1", kind: "pdf", pdfPage: 1, rotate: 0 },
    { id: "p2", kind: "pdf", pdfPage: 2, rotate: 0 },
  ];

  async function build(extra) {
    return buildAnnotatedPdf({
      buffer: await sourcePdf(),
      leaves,
      strokesOf: () => [],
      renderOverlay: () => null,
      renderRaster: () => null,
      ...extra,
    });
  }

  it("puts the stars in their own folded group", async () => {
    const tree = await outlineTree(await build({ outline: [{ title: "표지", page: 1 }], bookmarkPages: [2] }));
    assert.deepEqual(tree.map((node) => node.title), ["표지", "책갈피"]);
    const group = tree[1];
    assert.deepEqual(group.children.map((node) => node.title), ["2쪽"]);
    assert.equal(group.count, -1, "folded, so it does not bury the contents");
  });

  it("writes bookmarks even with no table of contents", async () => {
    const tree = await outlineTree(await build({ outline: [], bookmarkPages: [1, 2] }));
    assert.deepEqual(tree.map((node) => node.title), ["책갈피"]);
    assert.deepEqual(tree[0].children.map((node) => node.title), ["1쪽", "2쪽"]);
  });

  it("writes nothing when there is neither", async () => {
    assert.equal(await outlineTree(await build({ outline: [], bookmarkPages: [] })), null);
  });

  it("drops duplicates and keeps the pages in order", async () => {
    const tree = await outlineTree(await build({ outline: [], bookmarkPages: [2, 1, 2] }));
    assert.deepEqual(tree[0].children.map((node) => node.title), ["1쪽", "2쪽"]);
  });
});
