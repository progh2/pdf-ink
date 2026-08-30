import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { validatePdfContents, validatePdfFile } from "./validate.js";
import {
  fileIdentity,
  listDocuments,
  loadDocument,
  loadLastSession,
  loadPenOnly,
  loadStrokes,
  migrateLastIntoFiles,
  saveDocument,
  savePenOnly,
  saveStrokes,
} from "./storage.js";
import {
  loadEraser,
  loadInkTools,
  loadInteractMode,
  loadToolbarFloat,
  loadToolbarPosition,
  loadViewMode,
  loadZoomLock,
  saveEraser,
  saveInkTools,
  saveInteractMode,
  saveToolbarFloat,
  saveToolbarPosition,
  saveViewMode,
  saveZoomLock,
} from "./prefs.js";
import {
  BAR_HEIGHT,
  COLOR_DOT_TOOLS,
  barNaturalWidth,
  constrainFloat,
  snapDockFromPoint,
  useNarrowCells,
} from "./toolbar.js";
import {
  constrainPan,
  inkCanvasScale,
  pointerDistance,
  pointerMidpoint,
  scaleFromPinch,
} from "./viewport.js";
import { applyEraserToInk, isPixelErase, isStrokeErase, paintGhost, paintItem, paintStamp, removeHitItems, removeHitStamps, stampInkItem, stampTilt } from "./ink.js";
import {
  appendInkPoint,
  beginInkPoints,
  canCreateInk,
  finishInkPoints,
  interactModeLabel,
  rectBigEnough,
  rectFromPoints,
  shouldPanPointer,
} from "./interact.js";
import { canRedo, canUndo, cloneItems, createHistory, recordChange, redoChange, undoChange } from "./history.js";
import { bindUndoHold } from "./undoHold.js";
import {
  SHAPE_HOLD_CHIP_GAP_PX,
  SHAPE_HOLD_CHIP_HEIGHT,
  SHAPE_HOLD_DISMISS_MS,
  SHAPE_HOLD_GHOST_ALPHA,
  SHAPE_HOLD_MS,
  canShapeHold,
  clientHitsShapeChipMenu,
  createShapeHold,
  placeShapeChipMenu,
} from "./shapeHold.js";
import { MOSAIC_CELL_CSS, mosaicBoxesPx, mosaicItem } from "./mosaic.js";
import { captureRegionPng, composePageRgba, cropRgba, writePngClipboard } from "./capture.js";
import {
  copyItems,
  deleteSelectedItems,
  itemBounds,
  offsetItems,
  pickItemsAt,
  pickItemsInRect,
  selectedBounds,
  translateItems,
} from "./select.js";
import {
  IMAGE_MAX_EDGE,
  acceptImageFile,
  acceptImageSrc,
  cropImage,
  cropRectOnImage,
  handleAt,
  imageItem,
  imageSizeOnPage,
  lockImage,
  resizeImage,
} from "./image.js";
import { addRotation, imagePaintDest, rotateItems, rotateSelectedItems } from "./rotate.js";
import {
  filterLeaves,
  inkKey,
  insertOutlineAfter,
  leafAt,
  normalizeLeaves,
  outlineViewport,
  pageOfInkKey,
  pageOfLeaf,
  setLeafRotate,
  toggleBookmark,
} from "./preview.js";
import {
  addOutlineEntry,
  deleteOutlineEntry,
  normalizeOutline,
  outlineDestPage,
  outlineTitleForPage,
  renameOutlineEntry,
  setOutlineTitleText,
  tocRowAction,
} from "./outline.js";
import {
  HIGHLIGHTER_OPACITY_DEFAULT,
  HIGHLIGHTER_PALETTE,
  PEN_PALETTE,
  PENCIL_COLOR,
  STAMP_LABELS,
  clampOpacity,
  defaultColorForKind,
  hexToRgba,
  normalizeStamp,
  slotAriaLabel,
  resizeStamp,
  stampPaintLayout,
} from "./tools.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const LONG_PRESS_MS = 450;
const SLOT_PRESS_SLOP = 24;
const STAMP_TAP_SLOP = 16;

const els = {
  fileInput: document.querySelector("#file-input"),
  banner: document.querySelector("#banner"),
  uploadScreen: document.querySelector("#upload-screen"),
  writeScreen: document.querySelector("#write-screen"),
  dropzone: document.querySelector("#dropzone"),
  recents: document.querySelector("#recents"),
  otherPdf: document.querySelector("#other-pdf"),
  penOnlyBtn: document.querySelector("#pen-only-btn"),
  docTitle: document.querySelector("#doc-title"),
  workspace: document.querySelector("#workspace"),
  viewport: document.querySelector("#viewport"),
  pageStack: document.querySelector("#page-stack"),
  toolbar: document.querySelector("#toolbar"),
  toolbarRail: document.querySelector("#toolbar-rail"),
  toolbarGrip: document.querySelector("#toolbar-grip"),
  prevBtn: document.querySelector("#prev-btn"),
  nextBtn: document.querySelector("#next-btn"),
  pageLabel: document.querySelector("#page-label"),
  zoomLockBtn: document.querySelector("#zoom-lock-btn"),
  interactBtn: document.querySelector("#interact-btn"),
  undoBtn: document.querySelector("#undo-btn"),
  redoBtn: document.querySelector("#redo-btn"),
  moreBtn: document.querySelector("#more-btn"),
  selectBtn: document.querySelector("#select-btn"),
  stampBtn: document.querySelector("#stamp-btn"),
  morePanel: document.querySelector("#more-panel"),
  imageInput: document.querySelector("#image-input"),
  previewDrawer: document.querySelector("#preview-drawer"),
  previewBackdrop: document.querySelector("#preview-backdrop"),
  previewClose: document.querySelector("#preview-close"),
  previewList: document.querySelector("#preview-list"),
  previewPages: document.querySelector("#preview-pages"),
  previewToc: document.querySelector("#preview-toc"),
  tocAdd: document.querySelector("#toc-add"),
  tocList: document.querySelector("#toc-list"),
  outlineInsert: document.querySelector("#outline-insert"),
  fullscreenItem: document.querySelector("#fullscreen-item"),
  marquee: document.querySelector("#marquee"),
  marqueeBox: document.querySelector("#marquee-box"),
  captureConfirm: document.querySelector("#capture-confirm"),
  selectLayer: document.querySelector("#select-layer"),
  selectBox: document.querySelector("#select-box"),
  floatBar: document.querySelector("#float-bar"),
  selectHud: document.querySelector("#float-bar"),
  copyBtn: document.querySelector("#copy-btn"),
  pasteBtn: document.querySelector("#paste-btn"),
  selLeftBtn: document.querySelector("#sel-left-btn"),
  selRightBtn: document.querySelector("#sel-right-btn"),
  deleteBtn: document.querySelector("#delete-btn"),
  cropBtn: document.querySelector("#crop-btn"),
  lockBtn: document.querySelector("#lock-btn"),
  cropConfirm: document.querySelector("#crop-confirm"),
  shapeChips: document.querySelector("#shape-chips"),
  settingsBtn: document.querySelector("#settings-btn"),
  settingsSheet: document.querySelector("#settings-sheet"),
  settingsBackdrop: document.querySelector("#settings-backdrop"),
  settingsDone: document.querySelector("#settings-done"),
  slotPanel: document.querySelector("#slot-panel"),
  slotPalette: document.querySelector("#slot-palette"),
  slotOpacity: document.querySelector("#slot-opacity"),
  slotOpacityRow: document.querySelector("#slot-opacity-row"),
  slotWidth: document.querySelector("#slot-width"),
  slotWidthRow: document.querySelector("#slot-width-row"),
  slotStamp: document.querySelector("#slot-stamp"),
  stampPreview: document.querySelector("#stamp-preview"),
  stampPhrases: document.querySelector("#stamp-phrases"),
  eraserBtn: document.querySelector("#eraser-btn"),
  eraserPanel: document.querySelector("#eraser-panel"),
  eraserWidth: document.querySelector("#eraser-width"),
};

const state = {
  pdf: null,
  identity: null,
  fileName: "",
  buffer: null,
  pageCount: 0,
  page: 1,
  pages: {},
  drawing: false,
  currentStroke: null,
  drawPage: 1,
  drawCanvas: null,
  tool: "pen",
  inkTools: loadInkTools(),
  editingKind: null,
  penOnly: loadPenOnly(),
  toolbarPos: loadToolbarPosition(window.innerWidth, window.innerHeight),
  toolbarFloat: loadToolbarFloat(window.innerWidth, window.innerHeight),
  viewMode: loadViewMode(),
  interactMode: loadInteractMode(),
  zoomLock: loadZoomLock(),
  history: createHistory(),
  rectTool: null,
  currentRect: null,
  pendingCapture: null,
  immersive: false,
  leaves: [],
  outline: [],
  previewFilter: "all",
  previewTab: "pages",
  selectIndices: [],
  selectPage: 1,
  selectDrag: null,
  inkClipboard: [],
  cropping: null,
  baseCss: { width: 0, height: 0 },
  eraseMode: loadEraser().mode,
  eraserWidth: loadEraser().width,
  pendingStamp: null,
  shapeOffer: null,
  userScale: 1,
  panX: 0,
  panY: 0,
  pageCssWidth: 0,
  pageCssHeight: 0,
  stackBase: { width: 0, height: 0 },
  pageViews: [],
};

const pointers = new Map();
let gesture = null;
let ignoreAfterPinch = false;
let ignoreAfterPanel = false;
let lastInkUpClient = null;
const shapeHold = createShapeHold({ holdMs: SHAPE_HOLD_MS });
let shapeOfferDismissTimer = 0;
let ignoreChipMountMoves = 0;
let lockedStrokePoints = null;
let chipMenuBox = null;
let frozenEndClient = null;
let captureConfirmArmedAt = 0;
let renderGen = 0;
let paperScrollHold = null;

const WRITE_CHROME =
  ".sheet-card, .slot-panel, .toolbar, .write-top, .m4-bar, .more-panel, .marquee, .preview-drawer, .select-hud, .float-bar, #float-bar, .shape-chips";

function isWriteChrome(target) {
  return Boolean(target?.closest?.(WRITE_CHROME));
}

function holdPaperScroll() {
  paperScrollHold = {
    left: els.workspace.scrollLeft,
    top: els.workspace.scrollTop,
  };
}

function releasePaperScroll() {
  paperScrollHold = null;
}

function restoreHeldPaperScroll() {
  if (!paperScrollHold) {
    return false;
  }
  const { left, top } = paperScrollHold;
  if (els.workspace.scrollLeft !== left || els.workspace.scrollTop !== top) {
    els.workspace.scrollLeft = left;
    els.workspace.scrollTop = top;
  }
  return true;
}

function activeSlot() {
  if (state.tool === "highlighter" || state.tool === "pencil" || state.tool === "stamp") {
    return state.inkTools[state.tool];
  }
  return state.inkTools.pen;
}

function usesStamp() {
  return state.tool === "stamp";
}

function showBanner(message) {
  els.banner.hidden = !message;
  els.banner.textContent = message || "";
}

function persistStrokes() {
  if (!state.identity) {
    return;
  }
  try {
    saveStrokes(state.identity, state.pages, state.leaves, state.outline);
  } catch {
    showBanner("필기를 저장하지 못했습니다. 브라우저 저장 공간이 부족할 수 있습니다.");
  }
}

function syncHistoryButtons() {
  els.undoBtn.disabled = !canUndo(state.history);
  els.redoBtn.disabled = !canRedo(state.history);
}

function commitPageChange(pageNum, apply) {
  const key = inkKey(leafAt(state.leaves, pageNum));
  const before = cloneItems(pageStrokes(pageNum));
  const leavesBefore = cloneItems(state.leaves);
  apply(key);
  const after = cloneItems(pageStrokes(pageNum));
  recordChange(state.history, {
    page: key,
    before,
    after,
    extra: { leavesBefore, leavesAfter: cloneItems(state.leaves) },
  });
  persistStrokes();
  syncHistoryButtons();
}

function resetEditorExtras() {
  state.history = createHistory();
  state.rectTool = null;
  state.currentRect = null;
  state.pendingCapture = null;
  state.selectIndices = [];
  state.selectDrag = null;
  state.cropping = null;
  state.inkClipboard = [];
  hideMarquee();
  hideSelectUi();
  closePreview();
  syncHistoryButtons();
  syncRectTool();
}

async function persistSession() {
  if (!state.identity || !state.buffer) {
    return;
  }
  try {
    await saveDocument({
      identity: state.identity,
      name: state.fileName,
      buffer: state.buffer,
      page: state.page,
    });
  } catch {
    // Session restore is best-effort; strokes are already in localStorage.
  }
}

function pageStrokes(pageNum = state.drawPage || state.page) {
  const key = inkKey(leafAt(state.leaves, pageNum));
  if (!state.pages[key]) {
    state.pages[key] = [];
  }
  return state.pages[key];
}

function eventToNorm(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || 1;
  const height = rect.height || 1;
  return {
    x: (event.clientX - rect.left) / width,
    y: (event.clientY - rect.top) / height,
  };
}

function strokeScale(view) {
  const canvas = view.inkCanvas;
  const cssWidth =
    view.cssWidth ||
    Number.parseFloat(canvas.style.width) ||
    canvas.clientWidth ||
    0;
  return inkCanvasScale(canvas.width, cssWidth);
}

function canvas2d(canvas) {
  return canvas.getContext("2d", { willReadFrequently: true });
}

function drawStrokesOn(view, liveStroke = null) {
  const canvas = view.inkCanvas;
  const ctx = canvas2d(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const scale = strokeScale(view);
  const cssWidth = view.cssWidth || Number.parseFloat(canvas.style.width) || 0;
  const cssHeight = view.cssHeight || Number.parseFloat(canvas.style.height) || 0;
  let items = pageStrokes(view.pageNum);
  if (liveStroke && isStrokeErase(liveStroke)) {
    items = removeHitItems(items, liveStroke, cssWidth, cssHeight);
  } else if (liveStroke && isPixelErase(liveStroke)) {
    items = removeHitStamps(items, liveStroke, cssWidth, cssHeight);
  }
  for (const item of items) {
    paintItem(ctx, item, scale, canvas);
  }
  if (liveStroke && (liveStroke.points?.length || liveStroke.type === "stamp")) {
    paintItem(ctx, liveStroke, scale, canvas);
  }
  if (state.shapeOffer && view.pageNum === state.shapeOffer.page && state.shapeOffer.ghostPoints?.length) {
    paintGhost(
      ctx,
      {
        points: state.shapeOffer.ghostPoints,
        color: hexToRgba(state.shapeOffer.color || "#1A1A1A", SHAPE_HOLD_GHOST_ALPHA),
        width: state.shapeOffer.width || 2,
      },
      scale,
      canvas,
    );
  }
  paintImageLayer(view.underCanvas, items, true, () => drawStrokesOn(view));
  paintImageLayer(view.overCanvas, items, false, () => drawStrokesOn(view));
  paintMosaicOverlay(view);
}

const imageCache = new Map();

function cachedImage(src, onReady) {
  if (!src) {
    return null;
  }
  let entry = imageCache.get(src);
  if (!entry) {
    const img = new Image();
    entry = { img, ready: false };
    img.onload = () => {
      entry.ready = true;
      onReady?.();
    };
    img.src = src;
    imageCache.set(src, entry);
  }
  return entry;
}

function paintImageLayer(canvas, items, locked, onReady) {
  if (!canvas) {
    return;
  }
  const ctx = canvas2d(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const item of items || []) {
    if (item.type !== "image" || Boolean(item.locked) !== locked) {
      continue;
    }
    const entry = cachedImage(item.src, onReady);
    if (!entry?.ready || !entry.img.width) {
      continue;
    }
    const crop = item.crop || { x: 0, y: 0, w: 1, h: 1 };
    const dest = imagePaintDest(item, canvas.width, canvas.height);
    const sx = crop.x * entry.img.width;
    const sy = crop.y * entry.img.height;
    const sw = Math.max(1, entry.img.width * crop.w);
    const sh = Math.max(1, entry.img.height * crop.h);
    if (!dest.rotate) {
      ctx.drawImage(entry.img, sx, sy, sw, sh, item.x * canvas.width, item.y * canvas.height, dest.destW, dest.destH);
      continue;
    }
    ctx.save();
    ctx.translate((item.x + item.w / 2) * canvas.width, (item.y + item.h / 2) * canvas.height);
    ctx.rotate((dest.rotate * Math.PI) / 180);
    ctx.drawImage(entry.img, sx, sy, sw, sh, -dest.destW / 2, -dest.destH / 2, dest.destW, dest.destH);
    ctx.restore();
  }
}

function paintMosaicOverlay(view) {
  const canvas = view.maskCanvas;
  if (!canvas) {
    return;
  }
  const ctx = canvas2d(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const boxes = mosaicBoxesPx(
    pageStrokes(view.pageNum),
    canvas.width,
    canvas.height,
    view.cssWidth || Number.parseFloat(view.inkCanvas.style.width) || 0,
  );
  if (!boxes.length || !view.pdfCanvas.width || !view.inkCanvas.width) {
    return;
  }
  let pdf;
  let ink;
  try {
    pdf = canvas2d(view.pdfCanvas).getImageData(0, 0, canvas.width, canvas.height);
    ink = canvas2d(view.inkCanvas).getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return;
  }
  const composed = composePageRgba(pdf.data, ink.data, canvas.width, canvas.height, boxes);
  for (const box of boxes) {
    const cropped = cropRgba(composed, canvas.width, canvas.height, box);
    ctx.putImageData(new ImageData(cropped.data, cropped.width, cropped.height), Math.floor(box.x), Math.floor(box.y));
  }
}

function drawLive() {
  const view = state.pageViews.find((item) => item.pageNum === state.drawPage);
  if (view) {
    drawStrokesOn(view, state.currentStroke);
  }
}

function fitScale(page, mode = state.viewMode, rotation = 0) {
  const viewport = page.getViewport({ scale: 1, rotation });
  const maxWidth = Math.max(120, els.workspace.clientWidth - 24);
  if (mode === "scroll") {
    return maxWidth / viewport.width;
  }
  const maxHeight = Math.max(120, els.workspace.clientHeight - 24);
  return Math.min(maxWidth / viewport.width, maxHeight / viewport.height);
}

async function basePageCss() {
  if (state.baseCss.width && state.baseCss.height) {
    return state.baseCss;
  }
  if (state.pdf) {
    const page = await state.pdf.getPage(1);
    const css = page.getViewport({ scale: fitScale(page) });
    state.baseCss = { width: css.width, height: css.height };
    return state.baseCss;
  }
  return { width: 360, height: 520 };
}

function makeStage(pageNum) {
  const stage = document.createElement("div");
  stage.className = "page-stage";
  stage.dataset.page = String(pageNum);
  const pdfCanvas = document.createElement("canvas");
  pdfCanvas.className = "pdf-canvas";
  const inkCanvas = document.createElement("canvas");
  inkCanvas.className = "ink-canvas";
  const maskCanvas = document.createElement("canvas");
  maskCanvas.className = "mask-canvas";
  const underCanvas = document.createElement("canvas");
  underCanvas.className = "under-canvas";
  const overCanvas = document.createElement("canvas");
  overCanvas.className = "over-canvas";
  stage.append(pdfCanvas, underCanvas, inkCanvas, overCanvas, maskCanvas);
  return { pageNum, stage, pdfCanvas, inkCanvas, maskCanvas, underCanvas, overCanvas, rendered: false, token: 0 };
}

function applyPageSize(view, cssWidth, cssHeight, pixelWidth, pixelHeight) {
  view.cssWidth = cssWidth;
  view.cssHeight = cssHeight;
  view.stage.style.width = `${cssWidth}px`;
  view.stage.style.height = `${cssHeight}px`;
  for (const canvas of [view.pdfCanvas, view.underCanvas, view.inkCanvas, view.overCanvas, view.maskCanvas]) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
  }
}

async function renderPageView(view) {
  const token = ++view.token;
  const leaf = leafAt(state.leaves, view.pageNum);
  const dpr = window.devicePixelRatio || 1;
  if (!leaf || leaf.kind === "outline" || !state.pdf) {
    const base = await basePageCss();
    if (token !== view.token) {
      return;
    }
    const css = outlineViewport(base.width, base.height, leaf?.rotate || 0);
    applyPageSize(view, css.width, css.height, Math.round(css.width * dpr), Math.round(css.height * dpr));
    if (state.viewMode === "page" || view.pageNum === state.page) {
      state.pageCssWidth = css.width;
      state.pageCssHeight = css.height;
    }
    const ctx = canvas2d(view.pdfCanvas);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#F7F4EC";
    ctx.fillRect(0, 0, view.pdfCanvas.width, view.pdfCanvas.height);
    ctx.fillStyle = "#5C574E";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `700 ${18 * dpr}px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
    ctx.fillText(leaf?.title || "개요", view.pdfCanvas.width / 2, 36 * dpr);
    view.rendered = true;
    drawStrokesOn(view, state.drawing && state.drawPage === view.pageNum ? state.currentStroke : null);
    return;
  }
  const page = await state.pdf.getPage(leaf.pdfPage);
  if (token !== view.token || !state.pdf) {
    return;
  }
  const rotation = ((page.rotate || 0) + (leaf.rotate || 0)) % 360;
  const scale = fitScale(page, state.viewMode, rotation);
  const css = page.getViewport({ scale, rotation });
  const pixel = page.getViewport({ scale: scale * dpr, rotation });
  applyPageSize(view, css.width, css.height, pixel.width, pixel.height);
  if (!state.baseCss.width) {
    const unrotated = page.getViewport({ scale: fitScale(page) });
    state.baseCss = { width: unrotated.width, height: unrotated.height };
  }
  if (state.viewMode === "page" || view.pageNum === state.page) {
    state.pageCssWidth = css.width;
    state.pageCssHeight = css.height;
  }
  const ctx = canvas2d(view.pdfCanvas);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, view.pdfCanvas.width, view.pdfCanvas.height);
  await page.render({ canvasContext: ctx, viewport: pixel }).promise;
  if (token !== view.token) {
    return;
  }
  view.rendered = true;
  drawStrokesOn(view, state.drawing && state.drawPage === view.pageNum ? state.currentStroke : null);
}

function visiblePageRange() {
  if (state.viewMode !== "scroll" || !state.pageViews.length) {
    return { from: state.page, to: state.page };
  }
  const scale = state.userScale;
  const viewTop = els.workspace.scrollTop;
  const viewBottom = viewTop + els.workspace.clientHeight;
  let from = state.pageCount;
  let to = 1;
  for (const view of state.pageViews) {
    const top = view.stage.offsetTop * scale;
    const bottom = top + view.stage.offsetHeight * scale;
    if (bottom > viewTop - 240 && top < viewBottom + 240) {
      from = Math.min(from, view.pageNum);
      to = Math.max(to, view.pageNum);
    }
  }
  if (from > to) {
    return { from: state.page, to: state.page };
  }
  return { from, to };
}

async function renderVisiblePages() {
  const { from, to } = visiblePageRange();
  const jobs = [];
  for (const view of state.pageViews) {
    const nearby = view.pageNum >= from && view.pageNum <= to;
    if (nearby && !view.rendered) {
      jobs.push(renderPageView(view));
    }
  }
  await Promise.all(jobs);
}

function updateCurrentPageFromScroll() {
  if (state.viewMode !== "scroll" || !state.pageViews.length) {
    return;
  }
  const scale = state.userScale;
  const mid = els.workspace.scrollTop + els.workspace.clientHeight / 2;
  let best = state.page;
  let bestDist = Infinity;
  for (const view of state.pageViews) {
    const center = (view.stage.offsetTop + view.stage.offsetHeight / 2) * scale;
    const dist = Math.abs(center - mid);
    if (dist < bestDist) {
      bestDist = dist;
      best = view.pageNum;
    }
  }
  if (best !== state.page) {
    state.page = best;
    updatePager();
    persistSession();
  }
}

function measureStackBase() {
  const stages = state.pageViews;
  if (!stages.length) {
    state.stackBase = { width: 0, height: 0 };
    return;
  }
  let width = 0;
  let bottom = 0;
  for (const view of stages) {
    width = Math.max(width, view.stage.offsetWidth);
    bottom = Math.max(bottom, view.stage.offsetTop + view.stage.offsetHeight);
  }
  state.stackBase = { width, height: bottom };
}

function applyViewport() {
  const scale = state.userScale;
  if (state.viewMode === "scroll") {
    measureStackBase();
    els.pageStack.style.transform = `scale(${scale})`;
    els.viewport.style.transform = "none";
    els.viewport.style.width = `${state.stackBase.width * scale}px`;
    els.viewport.style.height = `${state.stackBase.height * scale}px`;
    return;
  }
  els.pageStack.style.transform = "none";
  els.viewport.style.width = "";
  els.viewport.style.height = "";
  const next = constrainPan(
    state.panX,
    state.panY,
    scale,
    state.pageCssWidth,
    state.pageCssHeight,
    els.workspace.clientWidth,
    els.workspace.clientHeight,
  );
  state.panX = next.x;
  state.panY = next.y;
  els.viewport.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${scale})`;
}

async function rebuildPages() {
  const gen = ++renderGen;
  els.pageStack.replaceChildren();
  state.pageViews = [];
  if (!state.pdf && !state.leaves.length) {
    return;
  }
  state.pageCount = state.leaves.length;

  if (state.viewMode === "page") {
    const view = makeStage(state.page);
    state.pageViews = [view];
    els.pageStack.append(view.stage);
    await renderPageView(view);
  } else {
    for (let index = 1; index <= state.leaves.length; index += 1) {
      const view = makeStage(index);
      state.pageViews.push(view);
      els.pageStack.append(view.stage);
    }
    const firstLeaf = state.leaves[0];
    let css;
    if (firstLeaf?.kind === "pdf" && state.pdf) {
      const first = await state.pdf.getPage(firstLeaf.pdfPage);
      if (gen !== renderGen) {
        return;
      }
      const rotation = ((first.rotate || 0) + (firstLeaf.rotate || 0)) % 360;
      css = first.getViewport({ scale: fitScale(first, "scroll", rotation), rotation });
    } else {
      const base = await basePageCss();
      css = outlineViewport(base.width, base.height, firstLeaf?.rotate || 0);
    }
    if (gen !== renderGen) {
      return;
    }
    for (const view of state.pageViews) {
      view.stage.style.width = `${css.width}px`;
      view.stage.style.height = `${css.height}px`;
    }
    await renderVisiblePages();
    scrollPageIntoView(state.page, false);
  }
  if (gen !== renderGen) {
    return;
  }
  applyViewport();
  updatePager();
}

function scrollPageIntoView(pageNum, smooth) {
  const view = state.pageViews.find((item) => item.pageNum === pageNum);
  if (!view) {
    return;
  }
  const top = view.stage.offsetTop * state.userScale - 12;
  els.workspace.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
}

function updatePager() {
  els.pageLabel.textContent = `${state.page} / ${state.pageCount || 1}`;
  els.prevBtn.disabled = state.page <= 1;
  els.nextBtn.disabled = state.page >= state.pageCount;
}

function showDocumentUi() {
  els.uploadScreen.hidden = true;
  els.writeScreen.hidden = false;
  applyChrome();
}

let pickerBlockedUntil = 0;
let dropzoneGesture = false;
let stayOnWriteUntil = 0;

function armStayOnWrite(ms = 1600) {
  stayOnWriteUntil = performance.now() + ms;
}

function blockFilePicker(ms = 500) {
  pickerBlockedUntil = performance.now() + ms;
  dropzoneGesture = false;
}

function pickerAllowed() {
  return performance.now() >= pickerBlockedUntil;
}

async function showUploadScreen() {
  blockFilePicker();
  persistStrokes();
  abortStroke();
  resetEditorExtras();
  closeAllPanels();
  closeSettings();
  els.writeScreen.hidden = true;
  els.uploadScreen.hidden = false;
  showBanner("");
  await renderRecents();
  if (state.pdf) {
    await state.pdf.destroy();
    state.pdf = null;
  }
}

async function renderRecents() {
  let rows = [];
  try {
    await migrateLastIntoFiles();
    rows = await listDocuments();
  } catch {
    rows = [];
  }
  els.recents.replaceChildren();
  if (!rows.length) {
    els.recents.hidden = true;
    return;
  }
  for (const row of rows) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recent-card";
    button.textContent = displayName(row.name);
    button.addEventListener("click", () => openStoredDocument(row.identity));
    item.append(button);
    els.recents.append(item);
  }
  els.recents.hidden = false;
}

async function openStoredDocument(identity) {
  try {
    const row = await loadDocument(identity);
    if (!row?.buffer) {
      showBanner("저장된 파일을 열 수 없습니다.");
      await renderRecents();
      return;
    }
    await openPdfBuffer(row.buffer, {
      identity: row.identity,
      name: row.name || "문서.pdf",
      page: row.page || 1,
    });
  } catch {
    showBanner("저장된 파일을 열 수 없습니다.");
  }
}

function displayName(fileName) {
  return (fileName || "문서.pdf").replace(/\.pdf$/i, "") || "문서";
}

function newStroke(point) {
  if (state.tool === "eraser") {
    return {
      type: "erase",
      points: [point],
      color: "#000000",
      width: state.eraserWidth,
      erase: true,
      eraseMode: state.eraseMode,
    };
  }
  const slot = activeSlot();
  return {
    type: slot.type,
    points: [point],
    color: slot.type === "pencil" ? PENCIL_COLOR : slot.color,
    width: slot.width,
    opacity: slot.type === "highlighter" ? slot.opacity : undefined,
    erase: false,
  };
}

function placeStamp(view, point) {
  const item = stampInkItem(activeSlot().stamp, point.x, point.y, stampTilt(point.x, point.y));
  commitPageChange(view.pageNum, () => {
    pageStrokes(view.pageNum).push(item);
  });
  drawStrokesOn(view);
}

async function openPdfBuffer(buffer, { identity, name, page = 1 }) {
  if (state.pdf) {
    await state.pdf.destroy();
    state.pdf = null;
  }

  const loading = pdfjsLib.getDocument({ data: buffer.slice(0) });
  const pdf = await loading.promise;
  state.pdf = pdf;
  state.identity = identity;
  state.fileName = name;
  state.buffer = buffer;
  const stored = loadStrokes(identity);
  state.leaves = normalizeLeaves(stored.leaves, pdf.numPages);
  state.pageCount = state.leaves.length;
  state.page = Math.min(Math.max(1, page), state.pageCount);
  state.pages = stored.pages;
  state.outline = normalizeOutline(stored.outline);
  state.baseCss = { width: 0, height: 0 };
  resetEditorExtras();
  if (!state.zoomLock) {
    state.userScale = 1;
    state.panX = 0;
    state.panY = 0;
  }
  els.docTitle.textContent = displayName(name);
  showDocumentUi();
  showBanner("");
  await rebuildPages();
  await persistSession();
}

async function openSelectedFile(file) {
  const fileCheck = validatePdfFile(file);
  if (!fileCheck.ok) {
    showBanner(fileCheck.message);
    els.fileInput.value = "";
    return;
  }
  const contentCheck = await validatePdfContents(file);
  if (!contentCheck.ok) {
    showBanner(contentCheck.message);
    els.fileInput.value = "";
    return;
  }

  try {
    const buffer = await file.arrayBuffer();
    await openPdfBuffer(buffer, {
      identity: fileIdentity(file),
      name: file.name,
    });
  } catch {
    showBanner("PDF를 열 수 없습니다. 다른 파일을 선택해 주세요.");
  } finally {
    els.fileInput.value = "";
  }
}

async function goToPage(nextPage) {
  if (!state.pdf || nextPage < 1 || nextPage > state.pageCount || nextPage === state.page) {
    return;
  }
  state.page = nextPage;
  abortStroke();
  if (state.viewMode === "page") {
    await rebuildPages();
  } else {
    scrollPageIntoView(nextPage, true);
    updatePager();
    await renderVisiblePages();
  }
  await persistSession();
  if (!els.previewDrawer.hidden) {
    renderPreview();
  }
}

function allowsInkPointer(event) {
  return canCreateInk({
    interactMode: state.interactMode,
    penOnly: state.penOnly,
    pointerType: event.pointerType,
    rectTool: state.rectTool,
    tool: state.tool,
  });
}

function shouldPan(event) {
  return shouldPanPointer({
    interactMode: state.interactMode,
    penOnly: state.penOnly,
    pointerType: event.pointerType,
    rectTool: state.rectTool,
    tool: state.tool,
  });
}

function allowsSelectPointer(event) {
  return (
    state.interactMode === "edit" &&
    state.tool === "select" &&
    !state.rectTool &&
    (!state.penOnly || event.pointerType === "pen")
  );
}

function allowsRectPointer(event) {
  return state.interactMode === "edit" && state.rectTool && (!state.penOnly || event.pointerType === "pen");
}

function overlayOpen() {
  return (
    !els.settingsSheet.hidden ||
    !els.slotPanel.hidden ||
    !els.eraserPanel.hidden ||
    !els.morePanel.hidden ||
    !els.previewDrawer.hidden
  );
}

function hideShapeChips() {
  ignoreChipMountMoves = 0;
  chipMenuBox = null;
  if (els.shapeChips) {
    els.shapeChips.hidden = true;
    els.shapeChips.style.visibility = "";
  }
}

function copyStrokePoints(points) {
  if (!Array.isArray(points)) {
    return [];
  }
  return points
    .filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({ x: point.x, y: point.y }));
}

function lockStrokeBeforeChips() {
  const pts = shapeHold.frozenPoints?.() || state.currentStroke?.points;
  if (!pts?.length) {
    return;
  }
  lockedStrokePoints = copyStrokePoints(pts);
  if (state.currentStroke) {
    state.currentStroke.points = copyStrokePoints(lockedStrokePoints);
  }
}

function eventHitsShapeChips(event) {
  if (event?.target?.closest?.(".shape-chips")) {
    return true;
  }
  const client = { x: event?.clientX, y: event?.clientY };
  if (clientHitsShapeChipMenu(client, chipMenuBox)) {
    return true;
  }
  const bar = els.shapeChips;
  if (!bar || bar.hidden) {
    return false;
  }
  const box = bar.getBoundingClientRect();
  return clientHitsShapeChipMenu(client, {
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
  });
}

function restoreFrozenStroke() {
  const frozen = lockedStrokePoints || shapeHold.frozenPoints?.();
  if (!frozen?.length || !state.currentStroke) {
    return;
  }
  state.currentStroke.points = copyStrokePoints(frozen);
}

function clearShapeOfferDismiss() {
  if (shapeOfferDismissTimer) {
    window.clearTimeout(shapeOfferDismissTimer);
    shapeOfferDismissTimer = 0;
  }
}

function armShapeOfferDismiss() {
  clearShapeOfferDismiss();
  shapeOfferDismissTimer = window.setTimeout(() => {
    shapeOfferDismissTimer = 0;
    dismissShapeChips();
    drawLive();
  }, SHAPE_HOLD_DISMISS_MS);
}

function showShapeChips(offer, view) {
  if (!els.shapeChips || !offer) {
    hideShapeChips();
    return;
  }
  lockStrokeBeforeChips();
  ignoreChipMountMoves += 1;
  const lockedEnd = lockedStrokePoints?.at(-1);
  const box = view?.stage?.getBoundingClientRect();
  const tip = box && lockedEnd
    ? { x: box.left + lockedEnd.x * box.width, y: box.top + lockedEnd.y * box.height }
    : frozenEndClient;
  els.shapeChips.style.visibility = "hidden";
  els.shapeChips.hidden = false;
  const placed = placeShapeChipMenu({
    tip: tip || { x: 12, y: 80 },
    menuWidth: els.shapeChips.offsetWidth || 200,
    menuHeight: els.shapeChips.offsetHeight || SHAPE_HOLD_CHIP_HEIGHT + 8,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    gap: SHAPE_HOLD_CHIP_GAP_PX,
  });
  chipMenuBox = placed;
  els.shapeChips.style.left = `${placed.left}px`;
  els.shapeChips.style.top = `${placed.top}px`;
  for (const btn of els.shapeChips.querySelectorAll("[data-shape]")) {
    btn.classList.toggle("is-candidate", btn.dataset.shape === offer.kind);
  }
  els.shapeChips.style.visibility = "";
  restoreFrozenStroke();
  const releaseMount = () => {
    ignoreChipMountMoves = Math.max(0, ignoreChipMountMoves - 1);
    restoreFrozenStroke();
    if (state.drawing) {
      drawLive();
    }
  };
  const raf = typeof window.requestAnimationFrame === "function"
    ? window.requestAnimationFrame.bind(window)
    : (fn) => window.setTimeout(fn, 16);
  raf(() => raf(releaseMount));
  if (state.shapeOffer && Number.isInteger(state.shapeOffer.index)) {
    armShapeOfferDismiss();
  }
}

function dismissShapeChips() {
  clearShapeOfferDismiss();
  state.shapeOffer = null;
  if (!state.drawing) {
    lockedStrokePoints = null;
  }
  hideShapeChips();
}

function applyPickedShapeChip(chip) {
  const offer = state.shapeOffer;
  if (!offer || !offer.chips?.[chip]) {
    return;
  }
  if (state.drawing && state.currentStroke && !Number.isInteger(offer.index)) {
    state.currentStroke.points = offer.chips[chip];
    shapeHold.reset();
    dismissShapeChips();
    drawLive();
    return;
  }
  if (!Number.isInteger(offer.index)) {
    return;
  }
  const items = pageStrokes(offer.page);
  const item = items[offer.index];
  if (!item || !canShapeHold(item.type)) {
    dismissShapeChips();
    return;
  }
  commitPageChange(offer.page, () => {
    items[offer.index] = { ...item, points: offer.chips[chip] };
  });
  dismissShapeChips();
  const view = state.pageViews.find((row) => row.pageNum === offer.page);
  if (view) {
    drawStrokesOn(view);
  }
}

function shapeHoldCallbacks() {
  return {
    getPoints: () => state.currentStroke?.points || [],
    onOffer: (offer) => {
      if (!state.drawing || !state.currentStroke || !canShapeHold(state.currentStroke.type)) {
        return;
      }
      if (!offer) {
        if (state.shapeOffer && state.shapeOffer.index == null) {
          dismissShapeChips();
          drawLive();
        }
        return;
      }
      lockStrokeBeforeChips();
      state.shapeOffer = {
        page: state.drawPage,
        index: null,
        kind: offer.kind,
        chips: offer.chips,
        ghostPoints: offer.ghostPoints,
        box: offer.box,
        color: state.currentStroke.color || "#1A1A1A",
        width: state.currentStroke.width || 2,
      };
      const view = state.pageViews.find((item) => item.pageNum === state.drawPage);
      showShapeChips(offer, view);
      restoreFrozenStroke();
      drawLive();
    },
  };
}

function abortStroke() {
  state.pendingStamp = null;
  releasePaperScroll();
  shapeHold.reset();
  dismissShapeChips();
  lockedStrokePoints = null;
  frozenEndClient = null;
  if (state.currentRect) {
    hideMarquee();
  }
  if (!state.drawing && !state.currentStroke) {
    return;
  }
  state.currentStroke = null;
  state.drawing = false;
  const view = state.pageViews.find((item) => item.pageNum === state.drawPage);
  if (view) {
    drawStrokesOn(view);
  }
}

function startStroke(event, stage) {
  if (state.rectTool) {
    return;
  }
  if (state.interactMode === "view") {
    return;
  }
  if (!state.pdf || (event.button !== undefined && event.button !== 0)) {
    return;
  }
  if (!allowsInkPointer(event) || overlayOpen() || ignoreAfterPanel) {
    return;
  }
  const ink = stage.querySelector(".ink-canvas");
  if (!ink) {
    return;
  }
  event.preventDefault();
  try {
    ink.setPointerCapture(event.pointerId);
  } catch {
    // Capture is optional; some synthetic/test pointers reject it.
  }
  holdPaperScroll();
  const view = state.pageViews.find((item) => item.stage === stage);
  const point = eventToNorm(event, ink);
  const client = { x: event.clientX, y: event.clientY };
  state.drawPage = Number(stage.dataset.page) || state.page;
  state.drawCanvas = ink;
  if (usesStamp()) {
    shapeHold.reset();
    dismissShapeChips();
    state.pendingStamp = {
      view,
      point,
      startX: event.clientX,
      startY: event.clientY,
    };
    state.drawing = false;
    state.currentStroke = null;
    return;
  }
  state.pendingStamp = null;
  shapeHold.reset();
  dismissShapeChips();
  lockedStrokePoints = null;
  frozenEndClient = null;
  state.drawing = true;
  state.currentStroke = newStroke(point);
  state.currentStroke.points = beginInkPoints(point, client, lastInkUpClient);
  if (canShapeHold(state.currentStroke.type)) {
    shapeHold.begin({
      tool: state.currentStroke.type,
      client,
      ...shapeHoldCallbacks(),
    });
    shapeHold.rememberPoints(state.currentStroke.points);
    frozenEndClient = client;
  } else {
    shapeHold.reset();
  }
  drawLive();
}

function moveStroke(event) {
  if (!state.drawing || !state.currentStroke || !state.drawCanvas) {
    return;
  }
  if (!allowsInkPointer(event)) {
    return;
  }
  event.preventDefault();
  const client = { x: event.clientX, y: event.clientY };
  const chipsUp = Boolean(els.shapeChips && !els.shapeChips.hidden);
  const chipHit = Boolean(ignoreChipMountMoves) || eventHitsShapeChips(event);
  let append = true;
  if (canShapeHold(state.currentStroke.type)) {
    const holdLocked = chipHit || chipsUp || shapeHold.isOffering() || shapeHold.isHoldLocked();
    append = shapeHold.noteMove({
      client,
      fromChips: chipHit,
      ...shapeHoldCallbacks(),
    });
    if (holdLocked || !append) {
      append = false;
    }
  } else if (chipHit) {
    append = false;
  }
  if (append) {
    state.currentStroke.points = appendInkPoint(
      state.currentStroke.points,
      eventToNorm(event, state.drawCanvas),
      client,
      lastInkUpClient,
    );
    if (canShapeHold(state.currentStroke.type)) {
      shapeHold.rememberPoints(state.currentStroke.points);
      frozenEndClient = client;
    }
  } else if (canShapeHold(state.currentStroke.type)) {
    restoreFrozenStroke();
    if (!chipHit && (chipsUp || state.shapeOffer) && !shapeHold.isOffering()) {
      dismissShapeChips();
      lockedStrokePoints = null;
    }
  }
  drawLive();
}

function endStroke(event) {
  if (state.pendingStamp) {
    if (event.pointerId != null && state.drawCanvas) {
      try {
        state.drawCanvas.releasePointerCapture(event.pointerId);
      } catch {
        // Capture may already be released.
      }
    }
    const moved = Math.hypot(event.clientX - state.pendingStamp.startX, event.clientY - state.pendingStamp.startY);
    const view = state.pendingStamp.view || state.pageViews.find((item) => item.pageNum === state.drawPage);
    if (moved <= STAMP_TAP_SLOP && view) {
      placeStamp(view, state.pendingStamp.point);
    }
    state.pendingStamp = null;
    releasePaperScroll();
    return;
  }
  if (!state.drawing || !state.currentStroke) {
    return;
  }
  if (!allowsInkPointer(event)) {
    return;
  }
  event.preventDefault();
  if (event.pointerId != null && state.drawCanvas) {
    try {
      state.drawCanvas.releasePointerCapture(event.pointerId);
    } catch {
      // Capture may already be released.
    }
  }
  const client = { x: event.clientX, y: event.clientY };
  if (canShapeHold(state.currentStroke.type)) {
    restoreFrozenStroke();
  }
  const chipUp = Boolean(ignoreChipMountMoves) || eventHitsShapeChips(event);
  const upNorm = !chipUp && state.drawCanvas ? eventToNorm(event, state.drawCanvas) : null;
  const freehand = finishInkPoints(state.currentStroke.points, upNorm, client, lastInkUpClient);
  const held = shapeHold.finish(freehand);
  lastInkUpClient = client;
  const live = {
    ...state.currentStroke,
    points: held.points,
  };
  if (!live.points.length) {
    state.currentStroke = null;
    state.drawing = false;
    releasePaperScroll();
    shapeHold.reset();
    dismissShapeChips();
    drawLive();
    return;
  }
  const view = state.pageViews.find((item) => item.pageNum === state.drawPage);
  commitPageChange(state.drawPage, () => {
    if (view) {
      const cssWidth = view.cssWidth || Number.parseFloat(view.inkCanvas.style.width) || 0;
      const cssHeight = view.cssHeight || Number.parseFloat(view.inkCanvas.style.height) || 0;
      if (isStrokeErase(live) || isPixelErase(live)) {
        state.pages[inkKey(leafAt(state.leaves, state.drawPage))] = applyEraserToInk(
          pageStrokes(state.drawPage),
          live,
          cssWidth,
          cssHeight,
        );
      } else {
        pageStrokes(state.drawPage).push(live);
      }
    } else {
      pageStrokes(state.drawPage).push(live);
    }
  });
  const offer = held.offer && canShapeHold(live.type) ? held.offer : null;
  state.currentStroke = null;
  state.drawing = false;
  releasePaperScroll();
  if (offer) {
    const items = pageStrokes(state.drawPage);
    state.shapeOffer = {
      page: state.drawPage,
      index: items.length - 1,
      kind: offer.kind,
      chips: offer.chips,
      ghostPoints: offer.ghostPoints,
      box: offer.box,
      color: live.color || "#1A1A1A",
      width: live.width || 2,
    };
    showShapeChips(offer, view);
  } else {
    dismissShapeChips();
  }
  drawLive();
}

function pickFile() {
  if (!pickerAllowed() || !dropzoneGesture) {
    return;
  }
  dropzoneGesture = false;
  els.fileInput.click();
}

function persistEraser() {
  saveEraser({ mode: state.eraseMode, width: state.eraserWidth });
}

function syncInkTools() {
  for (const kind of COLOR_DOT_TOOLS) {
    const btn = document.querySelector(`[data-tool="${kind}"]`);
    const tool = state.inkTools[kind];
    if (!btn || !tool) {
      continue;
    }
    const mini = kind === "pencil" ? PENCIL_COLOR : tool.color;
    btn.style.setProperty("--tool-color", mini);
    btn.setAttribute("aria-label", slotAriaLabel(tool));
  }
  if (els.stampBtn) {
    els.stampBtn.setAttribute("aria-label", slotAriaLabel(state.inkTools.stamp));
  }
}

function syncPenOnly() {
  els.penOnlyBtn.classList.toggle("is-on", state.penOnly);
  els.penOnlyBtn.setAttribute("aria-pressed", state.penOnly ? "true" : "false");
}

function syncZoomLock() {
  els.zoomLockBtn.classList.toggle("is-on", state.zoomLock);
  els.zoomLockBtn.setAttribute("aria-pressed", state.zoomLock ? "true" : "false");
}

function syncInteract() {
  const viewing = state.interactMode === "view";
  const label = interactModeLabel(state.interactMode);
  els.interactBtn.classList.toggle("is-on", viewing);
  els.interactBtn.setAttribute("aria-pressed", viewing ? "true" : "false");
  els.interactBtn.setAttribute("aria-label", label);
  const text = els.interactBtn.querySelector(".interact-lock-label");
  if (text) {
    text.textContent = label;
  }
  const closed = els.interactBtn.querySelector(".lock-closed");
  const opened = els.interactBtn.querySelector(".lock-open");
  if (closed && opened) {
    closed.hidden = !viewing;
    opened.hidden = viewing;
  }
}

function syncRectTool() {
  els.writeScreen.dataset.rect = state.rectTool || "";
  els.moreBtn.classList.toggle("is-selected", Boolean(state.rectTool) || !els.morePanel.hidden);
  document.querySelectorAll("#more-panel [data-more]").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.more === state.rectTool);
  });
}

function syncFullscreenItem() {
  els.fullscreenItem.textContent = isFullscreen() ? "전체화면 종료" : "전체화면";
}

function syncToolSelection() {
  document.querySelectorAll("[data-tool]").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.tool === state.tool);
  });
  syncInkTools();
  syncPenOnly();
  syncZoomLock();
}

function setPenOnly(on) {
  state.penOnly = Boolean(on);
  savePenOnly(state.penOnly);
  syncPenOnly();
  abortStroke();
}

function isFullscreen() {
  return Boolean(document.fullscreenElement) || state.immersive;
}

function syncToolbarNarrow() {
  const available = Math.min(window.innerWidth - 16, els.toolbarRail?.clientWidth || window.innerWidth);
  els.toolbar.classList.toggle("is-narrow", useNarrowCells(available));
}

function applyToolbarPlacement() {
  els.writeScreen.dataset.toolbar = state.toolbarPos;
  const barW = els.toolbar.offsetWidth || barNaturalWidth(useNarrowCells(window.innerWidth - 16));
  const next = constrainFloat(
    state.toolbarFloat.x,
    state.toolbarFloat.y,
    window.innerWidth,
    window.innerHeight,
    barW,
    BAR_HEIGHT,
  );
  state.toolbarFloat = next;
  els.toolbar.style.setProperty("--toolbar-x", `${next.x}px`);
  els.toolbar.style.setProperty("--toolbar-y", `${next.y}px`);
  syncToolbarNarrow();
}

function applyChrome() {
  applyToolbarPlacement();
  els.writeScreen.dataset.view = state.viewMode;
  els.writeScreen.dataset.interact = state.interactMode;
  els.writeScreen.dataset.rect = state.rectTool || "";
  els.writeScreen.classList.toggle("is-fullscreen", isFullscreen());
  document.querySelectorAll("#toolbar-pos-choices [data-pos]").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.pos === state.toolbarPos);
  });
  document.querySelectorAll("#view-mode-choices [data-view]").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.view === state.viewMode);
  });
  syncInteract();
  syncFullscreenItem();
}

function closeSettings() {
  els.settingsSheet.hidden = true;
}

function openSettings() {
  closeAllPanels();
  closePreview();
  applyChrome();
  els.settingsSheet.hidden = false;
}

function closeSlotPanel() {
  els.slotPanel.hidden = true;
  state.editingKind = null;
}

function closeEraserPanel() {
  els.eraserPanel.hidden = true;
}

function closeMorePanel() {
  els.morePanel.hidden = true;
  els.morePanel.style.left = "-9999px";
  els.morePanel.style.top = "-9999px";
  syncRectTool();
}

function closePreview() {
  if (!els.previewDrawer) {
    return;
  }
  els.previewDrawer.hidden = true;
  els.previewBackdrop.hidden = true;
}

function hideSelectUi() {
  if (!els.selectLayer) {
    return;
  }
  els.selectLayer.hidden = true;
  if (els.floatBar) {
    els.floatBar.hidden = true;
  }
}

function closeAllPanels() {
  closeSlotPanel();
  closeEraserPanel();
  closeMorePanel();
}

function placePanel(panel, anchorBtn) {
  panel.hidden = false;
  const bar = els.toolbar.getBoundingClientRect();
  const anchor = anchorBtn.getBoundingClientRect();
  const width = 240;
  const height = panel.getBoundingClientRect().height || 88;
  const gap = 8;
  let left = anchor.left + anchor.width / 2 - width / 2;
  let top = bar.bottom + gap;
  const preferAbove = state.toolbarPos === "bottom" || (state.toolbarPos === "float" && bar.top > window.innerHeight / 2);
  if (preferAbove) {
    top = bar.top - gap - height;
  }

  left = Math.min(window.innerWidth - width - 8, Math.max(8, left));
  top = Math.min(window.innerHeight - height - 8, Math.max(8, top));
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

function paletteFor(kind) {
  if (kind === "highlighter") {
    return HIGHLIGHTER_PALETTE;
  }
  if (kind === "pencil") {
    return [{ label: "색연필", hex: PENCIL_COLOR }];
  }
  return PEN_PALETTE;
}

function renderPalette(slot) {
  const root = els.slotPalette;
  root.replaceChildren();
  root.dataset.kind = slot.type;
  const colors = paletteFor(slot.type);
  for (const item of colors) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "slot-color";
    if (slot.type === "pencil") {
      btn.classList.add("is-chalk");
    }
    btn.dataset.color = item.hex;
    btn.setAttribute("aria-label", item.label);
    btn.style.setProperty("--swatch", item.hex);
    btn.classList.toggle("is-selected", item.hex.toLowerCase() === slot.color.toLowerCase());
    if (slot.type !== "pencil") {
      btn.addEventListener("click", () => {
        if (!state.editingKind) {
          return;
        }
        state.inkTools[state.editingKind].color = item.hex;
        persistSlotChange();
      });
    }
    root.append(btn);
  }
}

function paintStampPreview(label) {
  const canvas = els.stampPreview;
  if (!canvas) {
    return;
  }
  const layout = stampPaintLayout(label, 1);
  const pad = 12;
  const cssWidth = Math.ceil(layout.width + pad * 2);
  const cssHeight = Math.ceil(layout.height + pad * 2);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const item = stampInkItem(label, 0.5, 0.5, -0.1);
  paintStamp(ctx, item, dpr, canvas);
}

function syncStampPicker() {
  const slot = state.inkTools[state.editingKind] || activeSlot();
  const label = normalizeStamp(slot.stamp);
  els.stampPhrases.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.stamp === label);
  });
  paintStampPreview(label);
}

function syncSlotEditor() {
  const slot = state.inkTools[state.editingKind];
  if (!slot) {
    return;
  }
  document.querySelectorAll("#slot-kinds [data-kind]").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.kind === slot.type);
  });
  const isStamp = slot.type === "stamp";
  els.slotPalette.hidden = isStamp;
  els.slotStamp.hidden = !isStamp;
  if (isStamp) {
    syncStampPicker();
  } else {
    renderPalette(slot);
  }
  const showOpacity = slot.type === "highlighter";
  els.slotOpacityRow.hidden = !showOpacity;
  if (showOpacity) {
    els.slotOpacity.value = String(slot.opacity ?? HIGHLIGHTER_OPACITY_DEFAULT);
  }
  els.slotWidthRow.hidden = isStamp;
  if (!isStamp) {
    els.slotWidth.value = String(slot.width);
  }
}

function openInkEditor(kind, toolBtn) {
  closeEraserPanel();
  state.tool = kind;
  state.editingKind = kind;
  state.rectTool = null;
  if (kind !== "select") {
    hideMarquee();
  }
  syncToolSelection();
  syncRectTool();
  syncSlotEditor();
  placePanel(els.slotPanel, toolBtn);
}

function persistSlotChange() {
  saveInkTools(state.inkTools);
  syncInkTools();
  syncSlotEditor();
}

function setSlotKind(kind) {
  if (!state.editingKind) {
    return;
  }
  state.tool = kind;
  state.editingKind = kind;
  const slot = state.inkTools[kind];
  slot.color = defaultColorForKind(kind, slot.color);
  if (kind === "highlighter" && !slot.opacity) {
    slot.opacity = HIGHLIGHTER_OPACITY_DEFAULT;
  }
  if (kind === "stamp") {
    slot.stamp = normalizeStamp(slot.stamp);
  }
  persistSlotChange();
}

function clearSelection() {
  state.selectIndices = [];
  state.selectDrag = null;
  state.cropping = null;
  hideSelectUi();
}

function selectSelectTool() {
  state.tool = "select";
  state.rectTool = null;
  state.cropping = null;
  hideMarquee();
  closeAllPanels();
  syncToolSelection();
  syncRectTool();
  syncSelectHud();
}

function selectInkTool(kind) {
  const btn = document.querySelector(`[data-tool="${kind}"]`);
  if (state.tool === kind && btn) {
    openInkEditor(kind, btn);
    return;
  }
  state.tool = kind;
  state.rectTool = null;
  clearSelection();
  hideMarquee();
  closeAllPanels();
  syncToolSelection();
  syncRectTool();
}

function selectEraserPixel() {
  state.tool = "eraser";
  state.eraseMode = "pixel";
  state.rectTool = null;
  clearSelection();
  hideMarquee();
  persistEraser();
  closeAllPanels();
  syncToolSelection();
  syncRectTool();
}

function openEraserEditor() {
  closeSlotPanel();
  state.tool = "eraser";
  syncToolSelection();
  syncEraserEditor();
  placePanel(els.eraserPanel, els.eraserBtn);
}

function syncEraserEditor() {
  document.querySelectorAll("#eraser-mode-choices [data-erase-mode]").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.eraseMode === state.eraseMode);
  });
  els.eraserWidth.value = String(state.eraserWidth);
}

async function setToolbarPosition(position, floatPoint) {
  state.toolbarPos = position === "bottom" || position === "float" ? position : "top";
  if (floatPoint) {
    state.toolbarFloat = constrainFloat(
      floatPoint.x,
      floatPoint.y,
      window.innerWidth,
      window.innerHeight,
      els.toolbar.offsetWidth || 0,
      BAR_HEIGHT,
    );
    saveToolbarFloat(state.toolbarFloat);
  }
  saveToolbarPosition(state.toolbarPos);
  applyChrome();
  closeAllPanels();
}

async function setViewMode(mode) {
  if (state.viewMode === mode) {
    applyChrome();
    return;
  }
  state.viewMode = mode;
  saveViewMode(mode);
  state.panX = 0;
  state.panY = 0;
  if (!state.zoomLock) {
    state.userScale = 1;
  }
  applyChrome();
  if (state.pdf) {
    await rebuildPages();
  }
}

function setZoomLock(on) {
  state.zoomLock = Boolean(on);
  saveZoomLock(state.zoomLock);
  syncZoomLock();
}

function setInteractMode(mode) {
  state.interactMode = mode === "view" ? "view" : "edit";
  saveInteractMode(state.interactMode);
  if (state.interactMode === "view") {
    abortStroke();
    state.rectTool = null;
    clearSelection();
    hideMarquee();
  }
  applyChrome();
  syncRectTool();
}

function selectedImageItem() {
  if (state.selectIndices.length !== 1) {
    return null;
  }
  const item = pageStrokes(state.selectPage || state.page)[state.selectIndices[0]];
  return item?.type === "image" ? item : null;
}

function selectedStampItem() {
  if (state.selectIndices.length !== 1) {
    return null;
  }
  const item = pageStrokes(state.selectPage || state.page)[state.selectIndices[0]];
  return item?.type === "stamp" ? item : null;
}

function placeSelectBox(view, rect) {
  if (!view || !rect) {
    els.selectLayer.hidden = true;
    return;
  }
  const box = view.stage.getBoundingClientRect();
  els.selectLayer.hidden = false;
  els.selectBox.style.left = `${box.left + rect.x * box.width}px`;
  els.selectBox.style.top = `${box.top + rect.y * box.height}px`;
  els.selectBox.style.width = `${Math.max(1, rect.w * box.width)}px`;
  els.selectBox.style.height = `${Math.max(1, rect.h * box.height)}px`;
}

function placeSelectHud(view, rect) {
  if (!els.floatBar) {
    return;
  }
  els.floatBar.hidden = false;
  let left = 12;
  let top = 56;
  if (view && rect) {
    const box = view.stage.getBoundingClientRect();
    left = box.left + rect.x * box.width;
    top = box.top + (rect.y + rect.h) * box.height + 8;
  }
  const width = els.floatBar.offsetWidth || 220;
  const height = els.floatBar.offsetHeight || 56;
  els.floatBar.style.left = `${Math.min(window.innerWidth - width - 8, Math.max(8, left))}px`;
  els.floatBar.style.top = `${Math.min(window.innerHeight - height - 8, Math.max(8, top))}px`;
}

function syncSelectHud() {
  if (!els.floatBar || !els.selectLayer) {
    return;
  }
  if (state.tool !== "select" || state.interactMode === "view" || els.writeScreen.hidden) {
    hideSelectUi();
    return;
  }
  const pageNum = state.selectPage || state.page;
  const view = state.pageViews.find((item) => item.pageNum === pageNum);
  const items = pageStrokes(pageNum);
  const image = selectedImageItem();
  const cropping = Boolean(state.cropping);
  if (!state.selectIndices.length && !cropping) {
    hideSelectUi();
    return;
  }
  els.selectLayer.hidden = false;
  els.floatBar.hidden = false;
  els.cropBtn.hidden = !image || cropping;
  els.lockBtn.hidden = !image || cropping;
  els.lockBtn.classList.toggle("is-on", Boolean(image?.locked));
  els.lockBtn.textContent = image?.locked ? "고정 해제" : "고정";
  els.cropConfirm.hidden = !cropping;
  els.copyBtn.hidden = cropping;
  els.pasteBtn.hidden = cropping;
  if (els.selLeftBtn) {
    els.selLeftBtn.hidden = cropping;
  }
  if (els.selRightBtn) {
    els.selRightBtn.hidden = cropping;
  }
  if (els.deleteBtn) {
    els.deleteBtn.hidden = cropping;
  }
  const stamp = selectedStampItem();
  els.selectLayer.classList.toggle("is-image", Boolean(image) && !cropping);
  els.selectLayer.classList.toggle("is-stamp", Boolean(stamp) && !cropping);
  if (cropping) {
    const rect = rectFromPoints(state.cropping.a, state.cropping.b);
    placeSelectBox(view, rect);
    placeSelectHud(view, rect);
    return;
  }
  const bounds = selectedBounds(items, state.selectIndices, view?.cssWidth || 400, view?.cssHeight || 600);
  if (!bounds) {
    hideSelectUi();
    return;
  }
  els.selectLayer.hidden = false;
  els.floatBar.hidden = false;
  if (view) {
    placeSelectBox(view, bounds);
  }
  placeSelectHud(view, bounds);
}

function hideMarquee() {
  state.currentRect = null;
  state.pendingCapture = null;
  els.marquee.hidden = true;
  els.captureConfirm.hidden = true;
}

function updateMarquee(showConfirm) {
  const source = state.currentRect || state.pendingCapture;
  if (!source) {
    return;
  }
  const rect = source.rect || rectFromPoints(source.a, source.b);
  const view = state.pageViews.find((item) => item.pageNum === source.page);
  if (!view) {
    return;
  }
  const box = view.stage.getBoundingClientRect();
  const left = box.left + rect.x * box.width;
  const top = box.top + rect.y * box.height;
  const width = Math.max(1, rect.w * box.width);
  const height = Math.max(1, rect.h * box.height);
  els.marquee.hidden = false;
  els.marqueeBox.style.left = `${left}px`;
  els.marqueeBox.style.top = `${top}px`;
  els.marqueeBox.style.width = `${width}px`;
  els.marqueeBox.style.height = `${height}px`;
  if (showConfirm) {
    els.captureConfirm.hidden = false;
    const confirmW = els.captureConfirm.offsetWidth || 64;
    els.captureConfirm.style.left = `${Math.min(window.innerWidth - confirmW - 8, Math.max(8, left))}px`;
    els.captureConfirm.style.top = `${Math.min(window.innerHeight - 44, top + height + 8)}px`;
  } else {
    els.captureConfirm.hidden = true;
  }
}

function startRect(event, stage) {
  if (state.interactMode === "view") {
    return;
  }
  if (!state.pdf || (event.button !== undefined && event.button !== 0)) {
    return;
  }
  const ink = stage.querySelector(".ink-canvas");
  if (!ink) {
    return;
  }
  event.preventDefault();
  try {
    ink.setPointerCapture(event.pointerId);
  } catch {
    // optional
  }
  const point = eventToNorm(event, ink);
  state.drawPage = Number(stage.dataset.page) || state.page;
  state.drawCanvas = ink;
  state.pendingCapture = null;
  state.currentRect = { page: state.drawPage, a: point, b: point };
  updateMarquee(false);
}

function moveRect(event) {
  if (!state.currentRect || !state.drawCanvas) {
    return;
  }
  event.preventDefault();
  state.currentRect.b = eventToNorm(event, state.drawCanvas);
  updateMarquee(false);
}

function endRect(event) {
  if (!state.currentRect) {
    return;
  }
  if (event.pointerId != null && state.drawCanvas) {
    try {
      state.drawCanvas.releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }
  }
  const rect = rectFromPoints(state.currentRect.a, state.currentRect.b);
  const page = state.currentRect.page;
  const view = state.pageViews.find((item) => item.pageNum === page);
  state.currentRect = null;
  if (!rectBigEnough(rect) || !view) {
    hideMarquee();
    return;
  }
  if (state.rectTool === "mosaic") {
    commitPageChange(page, () => {
      pageStrokes(page).push(mosaicItem(rect, MOSAIC_CELL_CSS));
    });
    hideMarquee();
    drawStrokesOn(view);
    return;
  }
  if (state.rectTool === "capture") {
    state.pendingCapture = { page, rect };
    captureConfirmArmedAt = performance.now() + 400;
    updateMarquee(true);
  }
}

function startSelect(event, stage) {
  if (state.interactMode === "view") {
    return;
  }
  const ink = stage.querySelector(".ink-canvas");
  if (!ink) {
    return;
  }
  event.preventDefault();
  try {
    ink.setPointerCapture(event.pointerId);
  } catch {
    // optional
  }
  const view = state.pageViews.find((item) => item.stage === stage);
  const point = eventToNorm(event, ink);
  state.drawPage = Number(stage.dataset.page) || state.page;
  state.drawCanvas = ink;
  state.selectPage = state.drawPage;
  const items = pageStrokes(state.drawPage);
  const cssW = view?.cssWidth || 400;
  const cssH = view?.cssHeight || 600;

  if (state.cropping) {
    state.selectDrag = { mode: "crop", page: state.drawPage, a: point, b: point };
    state.cropping = { ...state.cropping, page: state.drawPage, a: point, b: point };
    syncSelectHud();
    return;
  }

  const image = selectedImageItem();
  const stamp = selectedStampItem();
  const resizable = image || stamp;
  if (resizable && state.selectPage === state.drawPage) {
    const handle = handleAt(itemBounds(resizable, cssW, cssH), point);
    if (handle) {
      state.selectDrag = {
        mode: "resize",
        handle,
        page: state.drawPage,
        start: point,
        origin: cloneItems(items),
        indices: [...state.selectIndices],
      };
      return;
    }
  }

  const hits = pickItemsAt(items, point, cssW, cssH);
  if (hits.length) {
    const top = hits[hits.length - 1];
    if (!state.selectIndices.includes(top)) {
      state.selectIndices = [top];
    }
    state.selectDrag = {
      mode: "move",
      page: state.drawPage,
      start: point,
      origin: cloneItems(items),
      indices: [...state.selectIndices],
    };
    syncSelectHud();
    return;
  }

  state.selectIndices = [];
  state.selectDrag = { mode: "marquee", page: state.drawPage, a: point, b: point };
  syncSelectHud();
}

function moveSelect(event) {
  const drag = state.selectDrag;
  if (!drag || !state.drawCanvas) {
    return;
  }
  event.preventDefault();
  const point = eventToNorm(event, state.drawCanvas);
  if (drag.mode === "marquee" || drag.mode === "crop") {
    drag.b = point;
    if (drag.mode === "crop") {
      state.cropping = { ...state.cropping, a: drag.a, b: point };
      syncSelectHud();
      return;
    }
    state.currentRect = { page: drag.page, a: drag.a, b: drag.b };
    updateMarquee(false);
    return;
  }
  const key = inkKey(leafAt(state.leaves, drag.page));
  if (drag.mode === "move") {
    state.pages[key] = translateItems(drag.origin, drag.indices, point.x - drag.start.x, point.y - drag.start.y);
  } else if (drag.mode === "resize") {
    const next = cloneItems(drag.origin);
    const origin = drag.origin[drag.indices[0]];
    const viewNow = state.pageViews.find((item) => item.pageNum === drag.page);
    const cssW = viewNow?.cssWidth || 400;
    const cssH = viewNow?.cssHeight || 600;
    next[drag.indices[0]] =
      origin?.type === "stamp"
        ? resizeStamp(origin, drag.handle, point, cssW, cssH)
        : resizeImage(origin, drag.handle, point);
    state.pages[key] = next;
  }
  const view = state.pageViews.find((item) => item.pageNum === drag.page);
  if (view) {
    drawStrokesOn(view);
  }
  syncSelectHud();
}

function endSelect(event) {
  const drag = state.selectDrag;
  if (!drag) {
    return;
  }
  if (event.pointerId != null && state.drawCanvas) {
    try {
      state.drawCanvas.releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }
  }
  const view = state.pageViews.find((item) => item.pageNum === drag.page);
  if (drag.mode === "marquee") {
    const rect = rectFromPoints(drag.a, drag.b);
    const cssW = view?.cssWidth || 400;
    const cssH = view?.cssHeight || 600;
    if (rectBigEnough(rect)) {
      state.selectIndices = pickItemsInRect(pageStrokes(drag.page), rect, cssW, cssH);
    } else {
      state.selectIndices = pickItemsAt(pageStrokes(drag.page), drag.a, cssW, cssH);
    }
    hideMarquee();
    state.selectDrag = null;
    syncSelectHud();
    return;
  }
  if (drag.mode === "crop") {
    state.cropping = { ...state.cropping, a: drag.a, b: drag.b };
    state.selectDrag = null;
    syncSelectHud();
    return;
  }
  const key = inkKey(leafAt(state.leaves, drag.page));
  const after = pageStrokes(drag.page);
  if (JSON.stringify(drag.origin) !== JSON.stringify(after)) {
    recordChange(state.history, {
      page: key,
      before: drag.origin,
      after: cloneItems(after),
      extra: { leavesBefore: cloneItems(state.leaves), leavesAfter: cloneItems(state.leaves) },
    });
    persistStrokes();
    syncHistoryButtons();
  }
  state.selectDrag = null;
  syncSelectHud();
}

function copySelection() {
  const items = pageStrokes(state.selectPage || state.page);
  if (!state.selectIndices.length) {
    return;
  }
  state.inkClipboard = copyItems(items, state.selectIndices, 0, 0);
}

function rotateSelection(delta) {
  if (state.interactMode === "view" || state.cropping || !state.selectIndices.length) {
    return;
  }
  const pageNum = state.selectPage || state.page;
  const view = state.pageViews.find((item) => item.pageNum === pageNum);
  const cssW = view?.cssWidth || 400;
  const cssH = view?.cssHeight || 600;
  const items = pageStrokes(pageNum);
  const bounds = selectedBounds(items, state.selectIndices, cssW, cssH);
  if (!bounds) {
    return;
  }
  const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
  const next = rotateSelectedItems(items, state.selectIndices, delta, center, cssW, cssH);
  if (JSON.stringify(next) === JSON.stringify(items)) {
    return;
  }
  commitPageChange(pageNum, () => {
    state.pages[inkKey(leafAt(state.leaves, pageNum))] = next;
  });
  if (view) {
    drawStrokesOn(view);
  }
  syncSelectHud();
}

function deleteSelection() {
  if (state.interactMode === "view" || state.cropping || !state.selectIndices.length) {
    return;
  }
  const pageNum = state.selectPage || state.page;
  const items = pageStrokes(pageNum);
  const next = deleteSelectedItems(items, state.selectIndices);
  if (JSON.stringify(next) === JSON.stringify(items)) {
    return;
  }
  commitPageChange(pageNum, () => {
    state.pages[inkKey(leafAt(state.leaves, pageNum))] = next;
  });
  clearSelection();
  const view = state.pageViews.find((item) => item.pageNum === pageNum);
  if (view) {
    drawStrokesOn(view);
  }
}

function pasteClipboard() {
  if (!state.inkClipboard.length || state.interactMode === "view") {
    return;
  }
  const pasted = offsetItems(state.inkClipboard, 0.04, 0.04);
  state.inkClipboard = offsetItems(state.inkClipboard, 0.04, 0.04);
  const pageNum = state.page;
  commitPageChange(pageNum, () => {
    const list = pageStrokes(pageNum);
    const start = list.length;
    list.push(...pasted);
    state.selectIndices = pasted.map((_, index) => start + index);
    state.selectPage = pageNum;
  });
  state.tool = "select";
  const view = state.pageViews.find((item) => item.pageNum === pageNum);
  if (view) {
    drawStrokesOn(view);
  }
  syncToolSelection();
  syncSelectHud();
}

function beginCrop() {
  const image = selectedImageItem();
  if (!image) {
    return;
  }
  state.cropping = {
    page: state.selectPage || state.page,
    index: state.selectIndices[0],
    a: { x: image.x, y: image.y },
    b: { x: image.x + image.w, y: image.y + image.h },
  };
  syncSelectHud();
}

function confirmCrop() {
  if (!state.cropping) {
    return;
  }
  const pageNum = state.cropping.page;
  const index = state.cropping.index;
  const item = pageStrokes(pageNum)[index];
  if (!item || item.type !== "image") {
    state.cropping = null;
    syncSelectHud();
    return;
  }
  const rect = rectFromPoints(state.cropping.a, state.cropping.b);
  commitPageChange(pageNum, () => {
    pageStrokes(pageNum)[index] = cropImage(item, cropRectOnImage(item, rect));
  });
  state.cropping = null;
  const view = state.pageViews.find((entry) => entry.pageNum === pageNum);
  if (view) {
    drawStrokesOn(view);
  }
  syncSelectHud();
}

function toggleSelectedLock() {
  const image = selectedImageItem();
  if (!image) {
    return;
  }
  const pageNum = state.selectPage || state.page;
  const index = state.selectIndices[0];
  commitPageChange(pageNum, () => {
    pageStrokes(pageNum)[index] = lockImage(image, !image.locked);
  });
  const view = state.pageViews.find((entry) => entry.pageNum === pageNum);
  if (view) {
    drawStrokesOn(view);
  }
  syncSelectHud();
}

function readFileDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadHtmlImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

async function downscaleImage(img) {
  const max = Math.max(img.width, img.height);
  if (max <= IMAGE_MAX_EDGE) {
    return { src: img.src, width: img.width, height: img.height };
  }
  const scale = IMAGE_MAX_EDGE / max;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return { src: canvas.toDataURL("image/jpeg", 0.86), width: canvas.width, height: canvas.height };
}

async function addImageFile(file) {
  const check = acceptImageFile(file);
  if (!check.ok) {
    showBanner(check.message);
    return;
  }
  try {
    const raw = await readFileDataUrl(file);
    if (!acceptImageSrc(raw)) {
      showBanner("PNG, JPEG, WebP만 넣을 수 있습니다.");
      return;
    }
    const img = await loadHtmlImage(raw);
    const scaled = await downscaleImage(img);
    const view = state.pageViews.find((item) => item.pageNum === state.page);
    const size = imageSizeOnPage(scaled.width, scaled.height, view?.cssWidth || 400, view?.cssHeight || 600);
    const item = imageItem({ src: scaled.src, x: 0.25, y: 0.22, w: size.w, h: size.h });
    commitPageChange(state.page, () => {
      pageStrokes(state.page).push(item);
      state.selectIndices = [pageStrokes(state.page).length - 1];
      state.selectPage = state.page;
    });
    state.tool = "select";
    state.rectTool = null;
    if (view) {
      drawStrokesOn(view);
    }
    syncToolSelection();
    syncRectTool();
    syncSelectHud();
  } catch {
    showBanner("이미지를 넣지 못했습니다.");
  }
}

function rotateCurrentPage(delta) {
  const pageNum = state.page;
  const leaf = leafAt(state.leaves, pageNum);
  if (!leaf) {
    return;
  }
  commitPageChange(pageNum, () => {
    const key = inkKey(leaf);
    state.pages[key] = rotateItems(pageStrokes(pageNum), delta);
    state.leaves = setLeafRotate(state.leaves, pageNum - 1, addRotation(leaf.rotate, delta));
    state.pageCount = state.leaves.length;
    state.selectIndices = [];
  });
  closeMorePanel();
  rebuildPages();
}

function openPreview() {
  closeAllPanels();
  els.previewDrawer.hidden = false;
  els.previewBackdrop.hidden = false;
  renderPreview();
}

function setPreviewTab(tab) {
  state.previewTab = tab === "toc" ? "toc" : "pages";
  renderPreview();
}

function renderPreview() {
  const onToc = state.previewTab === "toc";
  document.querySelectorAll("#preview-tabs [data-preview-tab]").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.previewTab === state.previewTab);
  });
  if (els.previewPages) {
    els.previewPages.hidden = onToc;
  }
  if (els.previewToc) {
    els.previewToc.hidden = !onToc;
  }
  if (onToc) {
    renderTocList();
    return;
  }
  renderPreviewList();
}

function addTocEntry() {
  state.outline = addOutlineEntry(state.outline, state.page);
  persistStrokes();
  renderTocList();
}

function saveTocTitle(id, title) {
  state.outline = renameOutlineEntry(state.outline, id, title);
  persistStrokes();
  renderTocList();
}

function removeTocEntry(id) {
  state.outline = deleteOutlineEntry(state.outline, id);
  persistStrokes();
  renderTocList();
}

function beginTocTitleEdit(titleEl, entry) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "preview-toc-edit";
  input.value = entry.title;
  input.setAttribute("aria-label", "개요 제목");
  const commit = () => {
    if (input.dataset.saved) {
      return;
    }
    input.dataset.saved = "1";
    saveTocTitle(entry.id, input.value);
  };
  input.addEventListener("click", (event) => event.stopPropagation());
  input.addEventListener("pointerdown", (event) => event.stopPropagation());
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    }
  });
  input.addEventListener("blur", commit);
  titleEl.replaceWith(input);
  input.focus();
  input.select();
}

function renderTocList() {
  if (!els.tocList) {
    return;
  }
  els.tocList.replaceChildren();
  for (const entry of state.outline) {
    const dest = outlineDestPage(entry);
    const row = document.createElement("div");
    row.className = "preview-toc-row";
    if (dest === state.page) {
      row.classList.add("is-current");
    }
    const title = document.createElement("button");
    title.type = "button";
    title.className = "preview-toc-title";
    setOutlineTitleText(title, entry.title || outlineTitleForPage(dest));
    title.addEventListener("click", (event) => {
      event.stopPropagation();
      if (tocRowAction(title.className) === "edit") {
        beginTocTitleEdit(title, entry);
      }
    });
    const jump = document.createElement("span");
    jump.className = "preview-toc-jump";
    jump.setAttribute("aria-hidden", "true");
    const del = document.createElement("button");
    del.type = "button";
    del.className = "preview-toc-delete";
    del.textContent = "x";
    del.setAttribute("aria-label", "개요 삭제");
    del.addEventListener("click", (event) => {
      event.stopPropagation();
      if (tocRowAction(del.className) === "delete") {
        removeTocEntry(entry.id);
      }
    });
    row.append(title, jump, del);
    row.addEventListener("click", (event) => {
      if (tocRowAction(event.target?.className) === "jump") {
        goToPage(dest);
      }
    });
    els.tocList.append(row);
  }
}

async function renderPreviewList() {
  if (!els.previewList) {
    return;
  }
  document.querySelectorAll("#preview-filters [data-preview-filter]").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.previewFilter === state.previewFilter);
  });
  const shown = filterLeaves(state.leaves, state.previewFilter);
  els.previewList.replaceChildren();
  for (const leaf of shown) {
    const pageNum = pageOfLeaf(state.leaves, leaf.id);
    const row = document.createElement("div");
    row.className = "preview-row";
    if (pageNum === state.page) {
      row.classList.add("is-current");
    }
    const thumb = document.createElement("canvas");
    thumb.className = "preview-thumb";
    const meta = document.createElement("div");
    meta.className = "preview-meta";
    const label = document.createElement("span");
    label.textContent = leaf.kind === "outline" ? leaf.title : `${pageNum}`;
    const star = document.createElement("button");
    star.type = "button";
    star.className = "preview-bookmark";
    star.classList.toggle("is-on", leaf.bookmark);
    star.textContent = leaf.bookmark ? "★" : "☆";
    star.setAttribute("aria-label", "책갈피");
    star.addEventListener("click", (event) => {
      event.stopPropagation();
      state.leaves = toggleBookmark(state.leaves, pageNum - 1);
      persistStrokes();
      renderPreviewList();
    });
    meta.append(label, star);
    row.append(thumb, meta);
    row.addEventListener("click", () => {
      goToPage(pageNum);
    });
    els.previewList.append(row);
    paintPreviewThumb(thumb, leaf);
  }
}

async function paintPreviewThumb(canvas, leaf) {
  const ctx = canvas.getContext("2d");
  canvas.width = 180;
  canvas.height = 240;
  ctx.fillStyle = "#F7F4EC";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (leaf.kind === "outline" || !state.pdf) {
    ctx.fillStyle = "#5C574E";
    ctx.textAlign = "center";
    ctx.font = "600 16px sans-serif";
    ctx.fillText(leaf.title || "개요", 90, 40);
    return;
  }
  try {
    const page = await state.pdf.getPage(leaf.pdfPage);
    const rotation = ((page.rotate || 0) + (leaf.rotate || 0)) % 360;
    const base = page.getViewport({ scale: 1, rotation });
    const scale = Math.min(180 / base.width, 240 / base.height);
    const viewport = page.getViewport({ scale, rotation });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
  } catch {
    // cream placeholder
  }
}

function insertOutlinePage() {
  const pageNum = state.page;
  const id = `${Date.now().toString(36)}`;
  commitPageChange(pageNum, () => {
    state.leaves = insertOutlineAfter(state.leaves, pageNum - 1, id);
    state.pageCount = state.leaves.length;
  });
  state.page = Math.min(pageNum + 1, state.pageCount);
  rebuildPages();
  if (!els.previewDrawer.hidden) {
    renderPreview();
  }
}

let captureWriting = false;

async function confirmCapture() {
  const pending = state.pendingCapture;
  if (!pending || captureWriting || performance.now() < captureConfirmArmedAt) {
    return;
  }
  captureWriting = true;
  try {
    const view = state.pageViews.find((item) => item.pageNum === pending.page);
    if (!view?.pdfCanvas.width || !view.inkCanvas.width) {
      showBanner("이 영역을 복사하지 못했습니다.");
      return;
    }
    let pdf;
    let ink;
    try {
      pdf = canvas2d(view.pdfCanvas).getImageData(0, 0, view.pdfCanvas.width, view.pdfCanvas.height);
      ink = canvas2d(view.inkCanvas).getImageData(0, 0, view.inkCanvas.width, view.inkCanvas.height);
    } catch {
      showBanner("이 영역을 복사하지 못했습니다.");
      return;
    }
    const boxes = mosaicBoxesPx(
      pageStrokes(pending.page),
      view.pdfCanvas.width,
      view.pdfCanvas.height,
      view.cssWidth || Number.parseFloat(view.inkCanvas.style.width) || 0,
    );
    const crop = {
      x: pending.rect.x * view.pdfCanvas.width,
      y: pending.rect.y * view.pdfCanvas.height,
      w: pending.rect.w * view.pdfCanvas.width,
      h: pending.rect.h * view.pdfCanvas.height,
    };
    const result = captureRegionPng(pdf.data, ink.data, view.pdfCanvas.width, view.pdfCanvas.height, boxes, crop);
    await writePngClipboard(result.png, navigator.clipboard, window.ClipboardItem);
    hideMarquee();
    state.rectTool = null;
    syncRectTool();
    showBanner("영역을 복사했습니다.");
    window.setTimeout(() => {
      if (els.banner.textContent === "영역을 복사했습니다.") {
        showBanner("");
      }
    }, 1800);
  } catch {
    showBanner("클립보드에 복사하지 못했습니다.");
  } finally {
    captureWriting = false;
  }
}

function leavesNeedRebuild(before, after) {
  if (!before || !after || before.length !== after.length) {
    return true;
  }
  return before.some(
    (leaf, index) =>
      leaf.id !== after[index].id || leaf.kind !== after[index].kind || leaf.rotate !== after[index].rotate,
  );
}

function applyHistoryLeaves(entry, side) {
  const next = side === "undo" ? entry?.extra?.leavesBefore : entry?.extra?.leavesAfter;
  if (!next) {
    return false;
  }
  const prev = state.leaves;
  state.leaves = cloneItems(next);
  state.pageCount = state.leaves.length;
  if (state.page > state.pageCount) {
    state.page = state.pageCount;
  }
  return leavesNeedRebuild(prev, state.leaves);
}

function redrawHistoryPage(key) {
  const num = pageOfInkKey(state.leaves, key);
  const view = state.pageViews.find((item) => item.pageNum === num);
  if (view) {
    drawStrokesOn(view);
    syncSelectHud();
    return;
  }
  if (num !== state.page) {
    goToPage(num);
  }
}

function undoInk() {
  const entry = undoChange(state.history, state.pages);
  if (!entry) {
    return;
  }
  persistStrokes();
  syncHistoryButtons();
  if (applyHistoryLeaves(entry, "undo")) {
    rebuildPages();
    if (!els.previewDrawer.hidden) {
      renderPreview();
    }
    return;
  }
  redrawHistoryPage(entry.page);
}

function redoInk() {
  const entry = redoChange(state.history, state.pages);
  if (!entry) {
    return;
  }
  persistStrokes();
  syncHistoryButtons();
  if (applyHistoryLeaves(entry, "redo")) {
    rebuildPages();
    if (!els.previewDrawer.hidden) {
      renderPreview();
    }
    return;
  }
  redrawHistoryPage(entry.page);
}

function overflowSide() {
  if (state.toolbarPos === "bottom") {
    return "above";
  }
  if (state.toolbarPos === "float") {
    const bar = els.toolbar.getBoundingClientRect();
    return bar.top > window.innerHeight / 2 ? "above" : "below";
  }
  return "below";
}

function placeOverflowPanel() {
  const panel = els.morePanel;
  const anchor = els.moreBtn.getBoundingClientRect();
  panel.style.visibility = "hidden";
  panel.style.left = "-9999px";
  panel.style.top = "-9999px";
  panel.hidden = false;
  const width = 240;
  const height = panel.getBoundingClientRect().height || 160;
  const gap = 8;
  const side = overflowSide();
  let top = anchor.bottom + gap;
  let left = anchor.left + anchor.width / 2 - width / 2;
  if (side === "above") {
    top = anchor.top - gap - height;
  } else if (side === "left") {
    left = anchor.left - gap - width;
    top = anchor.top + anchor.height / 2 - height / 2;
  } else if (side === "right") {
    left = anchor.right + gap;
    top = anchor.top + anchor.height / 2 - height / 2;
  }
  left = Math.min(window.innerWidth - width - 8, Math.max(8, left));
  top = Math.min(window.innerHeight - height - 8, Math.max(8, top));
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.style.visibility = "";
  syncRectTool();
}

function toggleMorePanel() {
  if (els.morePanel.hidden) {
    closeSlotPanel();
    closeEraserPanel();
    placeOverflowPanel();
  } else {
    closeMorePanel();
  }
}

function saveDocumentNow() {
  persistStrokes();
  persistSession();
  showBanner("저장했습니다.");
  window.setTimeout(() => {
    if (els.banner.textContent === "저장했습니다.") {
      showBanner("");
    }
  }, 1600);
}

function exportDocumentStub() {
  showBanner("내보내기는 다음입니다.");
  window.setTimeout(() => {
    if (els.banner.textContent === "내보내기는 다음입니다.") {
      showBanner("");
    }
  }, 1800);
}

function selectMoreAction(action) {
  if (action === "fullscreen") {
    closeMorePanel();
    ignoreAfterPanel = true;
    toggleFullscreen();
    return;
  }
  if (action === "select") {
    closeMorePanel();
    ignoreAfterPanel = true;
    selectSelectTool();
    return;
  }
  if (action === "image") {
    closeMorePanel();
    ignoreAfterPanel = true;
    els.imageInput.click();
    return;
  }
  if (action === "preview") {
    closeMorePanel();
    ignoreAfterPanel = true;
    openPreview();
    return;
  }
  if (action === "save") {
    closeMorePanel();
    ignoreAfterPanel = true;
    saveDocumentNow();
    return;
  }
  if (action === "export") {
    closeMorePanel();
    ignoreAfterPanel = true;
    exportDocumentStub();
    return;
  }
  if (action === "settings") {
    closeMorePanel();
    ignoreAfterPanel = true;
    openSettings();
    return;
  }
  if (action !== "mosaic" && action !== "capture") {
    return;
  }
  abortStroke();
  if (state.rectTool === action && !ignoreAfterPanel) {
    state.rectTool = null;
  } else {
    state.rectTool = action;
  }
  state.interactMode = "edit";
  saveInteractMode("edit");
  hideMarquee();
  closeMorePanel();
  ignoreAfterPanel = true;
  applyChrome();
  syncRectTool();
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
      return;
    }
  } catch {
    // Fall back to hiding app chrome.
  }
  state.immersive = !state.immersive;
  applyChrome();
  if (state.pdf) {
    await rebuildPages();
  }
}

function startPinch() {
  const pts = [...pointers.values()];
  if (pts.length < 2) {
    return;
  }
  abortStroke();
  gesture = {
    type: "pinch",
    startDist: pointerDistance(pts[0], pts[1]),
    startScale: state.userScale,
    startMid: pointerMidpoint(pts[0], pts[1]),
    startPanX: state.panX,
    startPanY: state.panY,
    startScrollLeft: els.workspace.scrollLeft,
    startScrollTop: els.workspace.scrollTop,
  };
}

function movePinch() {
  if (!gesture || gesture.type !== "pinch") {
    return;
  }
  const pts = [...pointers.values()];
  if (pts.length < 2) {
    return;
  }
  const mid = pointerMidpoint(pts[0], pts[1]);
  const dist = pointerDistance(pts[0], pts[1]);
  if (!state.zoomLock) {
    state.userScale = scaleFromPinch(gesture.startDist, dist, gesture.startScale);
  }
  const dx = mid.x - gesture.startMid.x;
  const dy = mid.y - gesture.startMid.y;
  if (state.viewMode === "scroll") {
    const ws = els.workspace.getBoundingClientRect();
    const startLocal = { x: gesture.startMid.x - ws.left, y: gesture.startMid.y - ws.top };
    const now = { x: mid.x - ws.left, y: mid.y - ws.top };
    const startScale = Math.max(gesture.startScale, 0.001);
    const contentX = (gesture.startScrollLeft + startLocal.x) / startScale;
    const contentY = (gesture.startScrollTop + startLocal.y) / startScale;
    applyViewport();
    els.workspace.scrollLeft = contentX * state.userScale - now.x;
    els.workspace.scrollTop = contentY * state.userScale - now.y;
  } else {
    state.panX = gesture.startPanX + dx;
    state.panY = gesture.startPanY + dy;
    applyViewport();
  }
}

function startPan(event) {
  gesture = {
    type: "pan",
    lastX: event.clientX,
    lastY: event.clientY,
  };
  try {
    els.workspace.setPointerCapture(event.pointerId);
  } catch {
    // optional
  }
}

function movePan(event) {
  if (!gesture || gesture.type !== "pan") {
    return;
  }
  const dx = event.clientX - gesture.lastX;
  const dy = event.clientY - gesture.lastY;
  gesture.lastX = event.clientX;
  gesture.lastY = event.clientY;
  if (state.viewMode === "scroll") {
    els.workspace.scrollLeft -= dx;
    els.workspace.scrollTop -= dy;
  } else {
    state.panX += dx;
    state.panY += dy;
    applyViewport();
  }
}

function onWorkspacePointerDown(event) {
  if (event.target.closest("#other-pdf")) {
    return;
  }
  if (overlayOpen()) {
    if (!event.target.closest(".slot-panel, .sheet-card, .toolbar, .write-top, .m4-bar, .more-panel, .preview-drawer, .select-hud, .float-bar, #float-bar, .shape-chips")) {
      closeAllPanels();
      ignoreAfterPanel = true;
    }
    return;
  }
  if (event.target.closest(".toolbar, .write-top, .sheet, .slot-panel, .m4-bar, .more-panel, .marquee, .preview-drawer, .select-hud, .float-bar, #float-bar, .shape-chips")) {
    return;
  }

  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });

  if (pointers.size >= 2) {
    event.preventDefault();
    startPinch();
    return;
  }
  if (ignoreAfterPinch) {
    return;
  }
  const skipClickThrough = ignoreAfterPanel;
  ignoreAfterPanel = false;
  if (shouldPan(event)) {
    event.preventDefault();
    startPan(event);
    return;
  }
  const stage = event.target.closest(".page-stage");
  if (!stage) {
    return;
  }
  if (state.rectTool) {
    if (allowsRectPointer(event)) {
      startRect(event, stage);
    }
    return;
  }
  if (state.tool === "select") {
    if (allowsSelectPointer(event)) {
      startSelect(event, stage);
    }
    return;
  }
  if (skipClickThrough) {
    return;
  }
  if (
    state.shapeOffer &&
    Number.isInteger(state.shapeOffer.index) &&
    event.target.closest(".page-stage") &&
    !event.target.closest(".shape-chips")
  ) {
    event.preventDefault();
    dismissShapeChips();
    drawLive();
    return;
  }
  if (allowsInkPointer(event)) {
    event.preventDefault();
    startStroke(event, stage);
  }
}

function onWorkspacePointerMove(event) {
  if (pointers.has(event.pointerId)) {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });
  }
  if (pointers.size >= 2 || gesture?.type === "pinch") {
    event.preventDefault();
    if (pointers.size >= 2 && gesture?.type !== "pinch") {
      startPinch();
    }
    movePinch();
    return;
  }
  if (gesture?.type === "pan") {
    event.preventDefault();
    movePan(event);
    return;
  }
  if (state.selectDrag) {
    moveSelect(event);
    return;
  }
  if (state.currentRect) {
    moveRect(event);
    return;
  }
  moveStroke(event);
}

function onWorkspacePointerUp(event) {
  if (event.type === "pointercancel" && state.drawing && event.buttons > 0) {
    return;
  }
  pointers.delete(event.pointerId);
  if (gesture?.type === "pinch") {
    if (pointers.size < 2) {
      gesture = null;
      ignoreAfterPinch = pointers.size > 0;
      applyViewport();
    }
    return;
  }
  if (gesture?.type === "pan") {
    gesture = null;
    if (event.pointerId != null) {
      try {
        els.workspace.releasePointerCapture(event.pointerId);
      } catch {
        // already released
      }
    }
    return;
  }
  if (state.selectDrag) {
    endSelect(event);
    if (pointers.size === 0) {
      ignoreAfterPinch = false;
      ignoreAfterPanel = false;
    }
    return;
  }
  if (state.currentRect) {
    endRect(event);
    if (pointers.size === 0) {
      ignoreAfterPinch = false;
      ignoreAfterPanel = false;
    }
    return;
  }
  endStroke(event);
  if (pointers.size === 0) {
    ignoreAfterPinch = false;
    ignoreAfterPanel = false;
  }
}

function bindHold(btn, { onShort, onLong }) {
  let timer = 0;
  let longPress = false;
  let startX = 0;
  let startY = 0;
  let active = false;
  let pointerId = null;

  const clearTimer = () => {
    window.clearTimeout(timer);
    timer = 0;
  };
  const detachLift = () => {
    window.removeEventListener("pointerup", onLift, true);
    window.removeEventListener("pointercancel", onPointerCancel, true);
    window.removeEventListener("touchend", onLift, true);
  };
  const stopPress = () => {
    clearTimer();
    active = false;
    pointerId = null;
    detachLift();
  };
  const samePointer = (event) => event.pointerId == null || pointerId == null || event.pointerId === pointerId;

  const onLift = (event) => {
    if (!active || !samePointer(event)) {
      return;
    }
    const wasLong = longPress;
    stopPress();
    if (wasLong) {
      return;
    }
    onShort();
  };
  const onPointerCancel = (event) => {
    if (!active || !samePointer(event)) {
      return;
    }
    if (event.buttons > 0 || event.pointerType !== "mouse") {
      return;
    }
    stopPress();
  };

  btn.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    event.preventDefault();
    try {
      btn.setPointerCapture(event.pointerId);
    } catch {
      // Capture is optional; some synthetic pointers reject it.
    }
    active = true;
    pointerId = event.pointerId;
    longPress = false;
    startX = event.clientX;
    startY = event.clientY;
    clearTimer();
    detachLift();
    window.addEventListener("pointerup", onLift, true);
    window.addEventListener("pointercancel", onPointerCancel, true);
    window.addEventListener("touchend", onLift, true);
    timer = window.setTimeout(() => {
      if (!active) {
        return;
      }
      longPress = true;
      onLong();
    }, LONG_PRESS_MS);
  });
  btn.addEventListener("pointermove", (event) => {
    if (!active || !timer || !samePointer(event)) {
      return;
    }
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > SLOT_PRESS_SLOP) {
      clearTimer();
    }
  });
  btn.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
}

function bindToolbarGrip(grip) {
  let pointerId = null;
  let dragging = false;
  let armed = false;
  let startX = 0;
  let startY = 0;
  let grabX = 0;
  let grabY = 0;
  let timer = 0;

  const clearTimer = () => {
    window.clearTimeout(timer);
    timer = 0;
  };

  const barSize = () => ({
    w: els.toolbar.offsetWidth || barNaturalWidth(useNarrowCells(window.innerWidth - 16)),
    h: els.toolbar.offsetHeight || BAR_HEIGHT,
  });

  const moveBar = (clientX, clientY) => {
    const { w, h } = barSize();
    const next = constrainFloat(clientX - grabX, clientY - grabY, window.innerWidth, window.innerHeight, w, h);
    els.toolbar.style.setProperty("--toolbar-x", `${next.x}px`);
    els.toolbar.style.setProperty("--toolbar-y", `${next.y}px`);
    return next;
  };

  const beginDrag = (event) => {
    if (dragging) {
      return;
    }
    dragging = true;
    closeAllPanels();
    const rect = els.toolbar.getBoundingClientRect();
    grabX = event.clientX - rect.left;
    grabY = event.clientY - rect.top;
    els.toolbar.classList.add("is-dragging");
    moveBar(event.clientX, event.clientY);
  };

  const endDrag = async (event) => {
    const wasDragging = dragging;
    const id = pointerId;
    pointerId = null;
    armed = false;
    dragging = false;
    clearTimer();
    if (id != null) {
      try {
        grip.releasePointerCapture?.(id);
      } catch {
        // optional
      }
    }
    els.toolbar.classList.remove("is-dragging");
    if (!wasDragging) {
      return;
    }
    const { w, h } = barSize();
    const snap = snapDockFromPoint(event.clientX, event.clientY, window.innerWidth, window.innerHeight, w, h, grabX, grabY);
    await setToolbarPosition(snap.pos, snap.pos === "float" ? snap : undefined);
  };

  grip.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    pointerId = event.pointerId;
    armed = true;
    dragging = false;
    startX = event.clientX;
    startY = event.clientY;
    try {
      grip.setPointerCapture(event.pointerId);
    } catch {
      // optional
    }
    clearTimer();
    timer = window.setTimeout(() => {
      if (armed && !dragging) {
        beginDrag({ clientX: startX, clientY: startY });
      }
    }, LONG_PRESS_MS);
  });
  grip.addEventListener("pointermove", (event) => {
    if (!armed || (event.pointerId != null && event.pointerId !== pointerId)) {
      return;
    }
    if (!dragging) {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > SLOT_PRESS_SLOP) {
        beginDrag(event);
      }
      return;
    }
    event.preventDefault();
    moveBar(event.clientX, event.clientY);
  });
  grip.addEventListener("pointerup", (event) => {
    if (event.pointerId != null && pointerId != null && event.pointerId !== pointerId) {
      return;
    }
    endDrag(event);
  });
  grip.addEventListener("pointercancel", (event) => {
    if (event.buttons > 0 || event.pointerType !== "mouse") {
      return;
    }
    endDrag(event);
  });
  grip.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
}

for (const kind of ["pen", "highlighter", "pencil", "stamp"]) {
  const btn = document.querySelector(`[data-tool="${kind}"]`);
  if (!btn) {
    continue;
  }
  bindHold(btn, {
    onShort: () => selectInkTool(kind),
    onLong: () => openInkEditor(kind, btn),
  });
}
bindHold(els.eraserBtn, {
  onShort: selectEraserPixel,
  onLong: openEraserEditor,
});
els.selectBtn.addEventListener("click", () => {
  if (state.tool === "select") {
    return;
  }
  selectSelectTool();
});
bindToolbarGrip(els.toolbarGrip);

document.querySelectorAll("#slot-kinds [data-kind]").forEach((btn) => {
  btn.addEventListener("click", () => setSlotKind(btn.dataset.kind));
});
els.slotOpacity.addEventListener("input", () => {
  if (!state.editingKind) {
    return;
  }
  state.inkTools[state.editingKind].opacity = clampOpacity(els.slotOpacity.value);
  persistSlotChange();
});
els.slotWidth.addEventListener("input", () => {
  if (!state.editingKind) {
    return;
  }
  state.inkTools[state.editingKind].width = Number(els.slotWidth.value);
  persistSlotChange();
});
document.querySelectorAll("#eraser-mode-choices [data-erase-mode]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.eraseMode = btn.dataset.eraseMode;
    state.tool = "eraser";
    persistEraser();
    syncEraserEditor();
    syncToolSelection();
  });
});
els.eraserWidth.addEventListener("input", () => {
  state.eraserWidth = Number(els.eraserWidth.value);
  persistEraser();
});

for (const label of STAMP_LABELS) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.stamp = label;
  btn.textContent = label;
  btn.addEventListener("click", () => {
    if (state.editingKind !== "stamp") {
      return;
    }
    state.inkTools.stamp.stamp = label;
    persistSlotChange();
  });
  els.stampPhrases.append(btn);
}

document.querySelectorAll("#toolbar-pos-choices [data-pos]").forEach((btn) => {
  btn.addEventListener("click", () => setToolbarPosition(btn.dataset.pos));
});
document.querySelectorAll("#view-mode-choices [data-view]").forEach((btn) => {
  btn.addEventListener("click", () => setViewMode(btn.dataset.view));
});

els.penOnlyBtn.addEventListener("click", () => {
  setPenOnly(!state.penOnly);
});
els.zoomLockBtn.addEventListener("click", () => {
  setZoomLock(!state.zoomLock);
});
els.interactBtn.addEventListener("click", () => {
  setInteractMode(state.interactMode === "view" ? "edit" : "view");
});
bindUndoHold(els.undoBtn, { onUndo: undoInk, onRedo: redoInk });
els.redoBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  redoInk();
});
els.moreBtn.addEventListener("pointerdown", (event) => {
  event.stopPropagation();
  armStayOnWrite();
});
els.moreBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  armStayOnWrite();
  toggleMorePanel();
});
document.querySelectorAll("#more-panel [data-more]").forEach((btn) => {
  btn.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    armStayOnWrite();
  });
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    armStayOnWrite();
    selectMoreAction(btn.dataset.more);
  });
});
document.querySelectorAll("#more-panel [data-rotate]").forEach((btn) => {
  btn.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    armStayOnWrite();
  });
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    armStayOnWrite();
    rotateCurrentPage(Number(btn.dataset.rotate));
  });
});
els.imageInput.addEventListener("change", () => {
  const file = els.imageInput.files?.[0];
  els.imageInput.value = "";
  if (file) {
    addImageFile(file);
  }
});
els.previewClose.addEventListener("click", closePreview);
els.previewBackdrop.addEventListener("click", closePreview);
document.querySelectorAll("#preview-tabs [data-preview-tab]").forEach((btn) => {
  btn.addEventListener("click", () => {
    setPreviewTab(btn.dataset.previewTab);
  });
});
document.querySelectorAll("#preview-filters [data-preview-filter]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.previewFilter = btn.dataset.previewFilter;
    renderPreviewList();
  });
});
els.tocAdd.addEventListener("click", addTocEntry);
els.outlineInsert.addEventListener("click", insertOutlinePage);
els.copyBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  copySelection();
});
if (els.shapeChips) {
  const stopChipPointer = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  els.shapeChips.addEventListener("pointerdown", stopChipPointer, true);
  els.shapeChips.addEventListener("pointermove", stopChipPointer, true);
  els.shapeChips.addEventListener("pointerup", stopChipPointer, true);
  els.shapeChips.addEventListener("pointercancel", stopChipPointer, true);
  els.shapeChips.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-shape]");
    if (!btn) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    applyPickedShapeChip(btn.dataset.shape);
  });
}
els.pasteBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  pasteClipboard();
});
els.selLeftBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  rotateSelection(-90);
});
els.selRightBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  rotateSelection(90);
});
els.deleteBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  deleteSelection();
});
els.cropBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  beginCrop();
});
els.lockBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  toggleSelectedLock();
});
els.cropConfirm.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  confirmCrop();
});
els.captureConfirm.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  confirmCapture();
});
els.settingsBackdrop.addEventListener("click", closeSettings);
els.settingsDone.addEventListener("click", closeSettings);

els.otherPdf.addEventListener("pointerdown", (event) => {
  event.stopPropagation();
  blockFilePicker();
});
els.otherPdf.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (!event.isTrusted) {
    return;
  }
  if (performance.now() < stayOnWriteUntil) {
    return;
  }
  if (!els.morePanel.hidden || !els.previewDrawer.hidden) {
    return;
  }
  if (event.target !== els.otherPdf) {
    return;
  }
  showUploadScreen();
});
els.dropzone.addEventListener("pointerdown", () => {
  dropzoneGesture = pickerAllowed();
});
els.dropzone.addEventListener("click", (event) => {
  event.preventDefault();
  if (!dropzoneGesture || !pickerAllowed()) {
    dropzoneGesture = false;
    return;
  }
  pickFile();
});
els.dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  els.dropzone.classList.add("is-over");
});
els.dropzone.addEventListener("dragleave", () => {
  els.dropzone.classList.remove("is-over");
});
els.dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  els.dropzone.classList.remove("is-over");
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    openSelectedFile(file);
  }
});
els.fileInput.addEventListener("change", () => {
  const file = els.fileInput.files?.[0];
  if (file) {
    openSelectedFile(file);
  }
});
els.prevBtn.addEventListener("click", () => goToPage(state.page - 1));
els.nextBtn.addEventListener("click", () => goToPage(state.page + 1));

els.workspace.addEventListener("pointerdown", onWorkspacePointerDown);
els.workspace.addEventListener("pointermove", onWorkspacePointerMove);
els.workspace.addEventListener("pointerup", onWorkspacePointerUp);
els.workspace.addEventListener("pointercancel", onWorkspacePointerUp);
els.workspace.addEventListener("scroll", () => {
  if (restoreHeldPaperScroll()) {
    return;
  }
  if (state.viewMode !== "scroll") {
    return;
  }
  updateCurrentPageFromScroll();
  renderVisiblePages();
});

function preventWriteSurfaceTouch(event) {
  if (isWriteChrome(event.target)) {
    return;
  }
  event.preventDefault();
}

els.writeScreen.addEventListener("touchstart", preventWriteSurfaceTouch, { passive: false });
els.writeScreen.addEventListener("touchmove", preventWriteSurfaceTouch, { passive: false });

document.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".slot-panel, .toolbar, [data-tool], #eraser-btn, #more-btn, .m4-bar, .marquee, .select-hud, .float-bar, #float-bar, .preview-drawer, .shape-chips")) {
    return;
  }
  closeAllPanels();
});

document.addEventListener("keydown", (event) => {
  const typing = event.target.closest?.("input, textarea, [contenteditable='true']");
  if ((event.key === "Delete" || event.key === "Backspace") && !typing) {
    if (!els.writeScreen.hidden && state.interactMode !== "view") {
      event.preventDefault();
      deleteSelection();
    }
    return;
  }
  if (!(event.ctrlKey || event.metaKey)) {
    return;
  }
  const key = event.key.toLowerCase();
  if (key === "z") {
    event.preventDefault();
    if (event.shiftKey) {
      redoInk();
    } else {
      undoInk();
    }
  }
  if (key === "y") {
    event.preventDefault();
    redoInk();
  }
  if (els.writeScreen.hidden || state.interactMode === "view") {
    return;
  }
  if (key === "c") {
    event.preventDefault();
    copySelection();
  }
});

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    state.immersive = false;
  }
  applyChrome();
  if (state.pdf && !state.drawing) {
    rebuildPages();
  }
});

let resizeTimer = 0;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    applyToolbarPlacement();
    if (!els.slotPanel.hidden && state.editingKind) {
      const btn = document.querySelector(`[data-tool="${state.editingKind}"]`);
      if (btn) {
        placePanel(els.slotPanel, btn);
      }
    }
    if (!els.eraserPanel.hidden) {
      placePanel(els.eraserPanel, els.eraserBtn);
    }
    if (!els.morePanel.hidden) {
      placeOverflowPanel();
    }
    if (state.pendingCapture || state.currentRect) {
      updateMarquee(Boolean(state.pendingCapture));
    }
    if (state.tool === "select") {
      syncSelectHud();
    }
    if (state.pdf && !state.drawing) {
      rebuildPages();
    }
  }, 120);
});

applyChrome();
syncToolSelection();
syncHistoryButtons();
syncRectTool();

migrateLastIntoFiles()
  .then(() => loadLastSession())
  .then((session) => {
    if (!session?.buffer || !session.identity) {
      return renderRecents();
    }
    return openPdfBuffer(session.buffer, {
      identity: session.identity,
      name: session.name || "문서.pdf",
      page: session.page || 1,
    });
  })
  .catch(() => {
    return renderRecents();
  });
