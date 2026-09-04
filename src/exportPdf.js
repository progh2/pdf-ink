import { PDFDocument, PDFHexString, PDFName, PDFNull, PDFString, degrees } from "pdf-lib";
import { BOOKMARK_GROUP_TITLE, bookmarkTitle, hasOutlineContent } from "./pdfOutline.js";
import { normalizeRotation } from "./rotate.js";

/** Annotated PDF: the page stays vector, the ink rides on top as one PNG (#54). */
export const EXPORT_SUFFIX = "필기";
export const EXPORT_SCALE = 2;
export const EXPORT_MAX_EDGE_PX = 2600;

export function exportFileName(fileName, suffix = EXPORT_SUFFIX) {
  const base = (fileName || "문서.pdf").replace(/\.pdf$/i, "").trim() || "문서";
  return `${base}-${suffix}.pdf`;
}

/**
 * Raster scale for one page. 2x of the PDF point size reads well on a phone,
 * but a poster page is capped so the file does not blow up.
 */
export function exportScale(widthPt, heightPt, scale = EXPORT_SCALE, maxEdge = EXPORT_MAX_EDGE_PX) {
  const w = Math.max(1, Number(widthPt) || 1);
  const h = Math.max(1, Number(heightPt) || 1);
  const edge = Math.max(w, h) * scale;
  return edge <= maxEdge ? scale : maxEdge / Math.max(w, h);
}

export function overlayPixelSize(widthPt, heightPt, scale) {
  return {
    width: Math.max(1, Math.round(widthPt * scale)),
    height: Math.max(1, Math.round(heightPt * scale)),
  };
}

/**
 * Masking (#31) redacts: a mosaic page cannot stay vector or the covered text
 * is still in the file, so that page is exported as a flat picture.
 */
export function needsRaster(items) {
  return (items || []).some((item) => item?.type === "mosaic");
}

export function hasInk(items) {
  return (items || []).some((item) => item && item.type !== "area");
}

/**
 * The viewer turns the page by its rotation, so the overlay is placed turned
 * the other way. Returns the pdf-lib drawImage box in unrotated user space.
 */
export function overlayPlacement(rotation, pageWidthPt, pageHeightPt) {
  const rotate = normalizeRotation(rotation);
  const w = Math.max(1, Number(pageWidthPt) || 1);
  const h = Math.max(1, Number(pageHeightPt) || 1);
  if (rotate === 90) {
    return { x: 0, y: h, width: h, height: w, rotate: -90 };
  }
  if (rotate === 180) {
    return { x: w, y: h, width: w, height: h, rotate: 180 };
  }
  if (rotate === 270) {
    return { x: w, y: 0, width: h, height: w, rotate: 90 };
  }
  return { x: 0, y: 0, width: w, height: h, rotate: 0 };
}

/** Page size as the writer sees it: 90/270 swaps the edges. */
export function viewSize(rotation, widthPt, heightPt) {
  const rotate = normalizeRotation(rotation);
  return rotate === 90 || rotate === 270
    ? { width: heightPt, height: widthPt }
    : { width: widthPt, height: heightPt };
}

/**
 * Builds the annotated PDF.
 *
 * `renderOverlay(leaf, { width, height })` returns transparent ink PNG bytes,
 * `renderRaster(leaf, { width, height })` returns a flattened page PNG,
 * both may return null when there is nothing to draw.
 */
/**
 * Links the file came with, written fresh onto the copied page (#184).
 *
 * pdf-lib's `copyPages` follows a destination's page reference and copies that
 * page too — into an object that is not in the new page tree. The link survives
 * but lands somewhere else, which is why every inside-the-document link was
 * broken after 굽기 while web links were fine. So: drop what was copied, and
 * write our own, pointing at the page that is really there now.
 */
function relinkPage(out, page, links, pageRefAt) {
  const context = out.context;
  const annots = page.node.Annots();
  const kept = [];
  if (annots) {
    for (const entry of annots.asArray()) {
      const dict = context.lookup(entry);
      const subtype = dict?.get?.(PDFName.of("Subtype"));
      if (String(subtype) !== "/Link") {
        kept.push(entry);
      }
    }
  }
  for (const link of links || []) {
    const rect = Array.isArray(link?.rect) ? link.rect.map(Number) : null;
    if (!rect || rect.length !== 4 || !rect.every(Number.isFinite)) {
      continue;
    }
    const shape = {
      Type: "Annot",
      Subtype: "Link",
      Rect: rect,
      Border: [0, 0, 0],
      F: 4,
    };
    if (link.url) {
      shape.A = context.obj({ Type: "Action", S: "URI", URI: PDFString.of(String(link.url)) });
    } else {
      const ref = pageRefAt(link.page);
      if (!ref) {
        continue;
      }
      const view = Array.isArray(link.view) && link.view.length ? link.view : ["Fit"];
      shape.Dest = context.obj([
        ref,
        PDFName.of(String(view[0])),
        ...view.slice(1).map((value) => (Number.isFinite(Number(value)) && value !== null ? Number(value) : PDFNull)),
      ]);
    }
    kept.push(context.register(context.obj(shape)));
  }
  if (kept.length) {
    page.node.set(PDFName.of("Annots"), context.obj(kept));
  } else if (annots) {
    page.node.delete(PDFName.of("Annots"));
  }
}

export async function buildAnnotatedPdf({
  buffer,
  leaves,
  strokesOf,
  linksOf,
  renderOverlay,
  renderRaster,
  outline = [],
  bookmarkPages = [],
  blankSize = { width: 595, height: 842 },
}) {
  const source = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const list = (leaves || []).filter((leaf) => leaf);
  const plans = list.map((leaf) => {
    const items = strokesOf ? strokesOf(leaf) || [] : [];
    const isPdf = leaf.kind !== "outline";
    return {
      leaf,
      items,
      flatten: needsRaster(items),
      index: isPdf ? Math.max(1, Number(leaf.pdfPage) || 1) - 1 : -1,
    };
  });
  const keep = plans.filter((plan) => plan.index >= 0 && !plan.flatten);
  const copied = await out.copyPages(source, keep.map((plan) => plan.index));
  keep.forEach((plan, order) => {
    plan.copied = copied[order];
  });

  for (const plan of plans) {
    let page;
    let baseRotation = 0;
    if (plan.copied) {
      page = out.addPage(plan.copied);
      baseRotation = normalizeRotation(page.getRotation().angle);
    } else if (plan.index >= 0) {
      // A masked page is rebuilt from the picture, so the covered text is gone.
      const original = source.getPage(plan.index);
      const size = original.getSize();
      baseRotation = normalizeRotation(original.getRotation().angle);
      page = out.addPage([size.width, size.height]);
    } else {
      page = out.addPage([blankSize.width, blankSize.height]);
    }
    const rotation = normalizeRotation(baseRotation + (Number(plan.leaf.rotate) || 0));
    page.setRotation(degrees(rotation));
    const size = page.getSize();
    const view = viewSize(rotation, size.width, size.height);
    const scale = exportScale(view.width, view.height);
    const pixels = overlayPixelSize(view.width, view.height, scale);
    const png = plan.flatten
      ? await renderRaster?.(plan.leaf, pixels)
      : hasInk(plan.items)
        ? await renderOverlay?.(plan.leaf, pixels)
        : null;
    if (!png) {
      continue;
    }
    const image = await out.embedPng(png);
    page.drawImage(image, overlayPlacementArgs(rotation, size.width, size.height));
  }
  if (linksOf) {
    // Second pass: every page exists now, so a destination can name a real one.
    const pages = out.getPages();
    const pageRefAt = (position) => pages[Math.trunc(Number(position)) - 1]?.ref || null;
    plans.forEach((plan, order) => {
      if (!plan.copied || plan.flatten) {
        return;
      }
      relinkPage(out, pages[order], linksOf(plan.leaf) || [], pageRefAt);
    });
  }
  setPdfOutline(out, outline, bookmarkPages);
  return out.save();
}

function overlayPlacementArgs(rotation, width, height) {
  const spot = overlayPlacement(rotation, width, height);
  return {
    x: spot.x,
    y: spot.y,
    width: spot.width,
    height: spot.height,
    rotate: degrees(spot.rotate),
  };
}

/**
 * Writes the drawer outline (#53) into the file as real PDF bookmarks, so the
 * reader's table of contents survives outside this browser.
 */
export function setPdfOutline(doc, entries, bookmarkPages = []) {
  const list = (entries || [])
    .filter((entry) => entry && String(entry.title ?? "").trim())
    .map((entry) => ({
      title: String(entry.title).trim(),
      page: Math.max(1, Math.round(Number(entry.page) || 1)),
    }));
  const marks = [...new Set((bookmarkPages || []).map((page) => Math.max(1, Math.round(Number(page) || 0))))]
    .filter(Boolean)
    .sort((a, b) => a - b);
  const catalog = doc.catalog;
  if (!hasOutlineContent(list, marks)) {
    catalog.delete(PDFName.of("Outlines"));
    return 0;
  }
  const context = doc.context;
  const pages = doc.getPages();
  const rootRef = context.nextRef();
  const destOf = (page) => [pages[Math.min(pages.length, page) - 1].ref, PDFName.of("XYZ"), null, null, null];

  const nodes = list.map((entry) => ({ title: entry.title, page: entry.page, ref: context.nextRef() }));
  // 책갈피 ride in their own group, so they never read as chapters (#145).
  const groupRef = marks.length ? context.nextRef() : null;
  const markNodes = marks.map((page) => ({ title: bookmarkTitle(page), page, ref: context.nextRef() }));

  const chain = (items, parentRef) => {
    items.forEach((node, index) => {
      const dict = context.obj({
        Title: PDFHexString.fromText(node.title),
        Parent: parentRef,
        Dest: destOf(node.page),
      });
      if (index > 0) {
        dict.set(PDFName.of("Prev"), items[index - 1].ref);
      }
      if (index < items.length - 1) {
        dict.set(PDFName.of("Next"), items[index + 1].ref);
      }
      context.assign(node.ref, dict);
    });
  };
  chain(nodes, rootRef);
  chain(markNodes, groupRef);

  const top = [...nodes.map((node) => node.ref)];
  if (groupRef) {
    const group = context.obj({
      Title: PDFHexString.fromText(BOOKMARK_GROUP_TITLE),
      Parent: rootRef,
      First: markNodes[0].ref,
      Last: markNodes[markNodes.length - 1].ref,
      // Negative: the group starts folded, so it does not bury the contents.
      Count: -markNodes.length,
    });
    if (top.length) {
      group.set(PDFName.of("Prev"), top[top.length - 1]);
      const lastEntry = context.lookup(top[top.length - 1]);
      lastEntry.set(PDFName.of("Next"), groupRef);
    }
    context.assign(groupRef, group);
    top.push(groupRef);
  }

  context.assign(
    rootRef,
    context.obj({
      Type: "Outlines",
      First: top[0],
      Last: top[top.length - 1],
      Count: top.length,
    }),
  );
  catalog.set(PDFName.of("Outlines"), rootRef);
  return top.length;
}

/** Web Share with a file, or the same PDF as a download (#54 lock). */
export function canShareFile(nav, file) {
  if (!nav || typeof nav.share !== "function" || typeof nav.canShare !== "function") {
    return false;
  }
  try {
    return Boolean(nav.canShare({ files: [file] }));
  } catch {
    return false;
  }
}
