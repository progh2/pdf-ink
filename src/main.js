import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { validatePdfContents, validatePdfFile } from "./validate.js";
import {
  fileIdentity,
  listDocuments,
  loadDocument,
  loadLastSession,
  loadPenOnly,
  loadImageRecord,
  loadStrokes,
  migrateLastIntoFiles,
  saveDocument,
  saveImageRecord,
  savePenOnly,
  saveStrokes,
} from "./storage.js";
import {
  loadEraser,
  loadInteractMode,
  loadSlotIndex,
  loadSlots,
  loadToolbarPosition,
  loadViewMode,
  loadZoomLock,
  saveEraser,
  saveInteractMode,
  saveSlotIndex,
  saveSlots,
  saveToolbarPosition,
  saveViewMode,
  saveZoomLock,
} from "./prefs.js";
import {
  constrainPan,
  inkCanvasScale,
  pointerDistance,
  pointerMidpoint,
  scaleFromPinch,
} from "./viewport.js";
import { applyEraserToInk, isPixelErase, isStrokeErase, paintItem, paintStamp, removeHitItems, removeHitStamps, stampInkItem, stampTilt } from "./ink.js";
import { canCreateInk, canSelectPointer, rectBigEnough, rectFromPoints, shouldPanPointer } from "./interact.js";
import { canRedo, canUndo, cloneItems, createHistory, recordChange, redoChange, undoChange } from "./history.js";
import { MOSAIC_CELL_CSS, mosaicBoxesPx, mosaicItem } from "./mosaic.js";
import { captureRegionPng, composePageRgba, cropRgba, writePngClipboard } from "./capture.js";
import {
  HIGHLIGHTER_OPACITY_DEFAULT,
  HIGHLIGHTER_PALETTE,
  PEN_PALETTE,
  PENCIL_COLOR,
  STAMP_COLOR,
  STAMP_LABELS,
  clampOpacity,
  defaultColorForKind,
  normalizeStamp,
  slotAriaLabel,
  stampPaintLayout,
} from "./tools.js";
import { nextRotation, rotateItems90 } from "./rotate.js";
import {
  applyRectToImage,
  boundsUnion,
  cloneItemsWithOffset,
  handleAtPoint,
  indexAtPoint,
  indexesInRect,
  isSelectable,
  itemBoundsNorm,
  pointInBounds,
  resizeRectFromCorner,
  SELECT_HANDLE_PX,
  translateItem,
} from "./select.js";
import {
  bakeCrop,
  fileFromPasteEvent,
  fitImageRect,
  imageInkItem,
  isFixedImage,
  isImageItem,
  newImageId,
  validateImageContents,
  validateImageFile,
} from "./images.js";
import { coerceSheets, defaultSheets, filterSheets, insertOutlineSheet, toggleBookmark } from "./preview.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const LONG_PRESS_MS = 450;
const SLOT_PRESS_SLOP = 24;
const STAMP_TAP_SLOP = 16;

const els = {
  fileInput: document.querySelector("#file-input"),
  imageInput: document.querySelector("#image-input"),
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
  prevBtn: document.querySelector("#prev-btn"),
  nextBtn: document.querySelector("#next-btn"),
  pageLabel: document.querySelector("#page-label"),
  zoomLockBtn: document.querySelector("#zoom-lock-btn"),
  interactBtn: document.querySelector("#interact-btn"),
  undoBtn: document.querySelector("#undo-btn"),
  moreBtn: document.querySelector("#more-btn"),
  morePanel: document.querySelector("#more-panel"),
  fullscreenItem: document.querySelector("#fullscreen-item"),
  marquee: document.querySelector("#marquee"),
  marqueeBox: document.querySelector("#marquee-box"),
  captureConfirm: document.querySelector("#capture-confirm"),
  selectLayer: document.querySelector("#select-layer"),
  selectBox: document.querySelector("#select-box"),
  floatBar: document.querySelector("#float-bar"),
  copyBtn: document.querySelector("#copy-btn"),
  pasteBtn: document.querySelector("#paste-btn"),
  cropBtn: document.querySelector("#crop-btn"),
  lockBtn: document.querySelector("#lock-btn"),
  previewDrawer: document.querySelector("#preview-drawer"),
  previewThumbs: document.querySelector("#preview-thumbs"),
  bookmarkBtn: document.querySelector("#bookmark-btn"),
  bookmarkFilterBtn: document.querySelector("#bookmark-filter-btn"),
  outlineInsertBtn: document.querySelector("#outline-insert-btn"),
  outlineFilterBtn: document.querySelector("#outline-filter-btn"),
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
  slots: loadSlots(),
  slotIndex: loadSlotIndex(),
  editingSlot: null,
  penOnly: loadPenOnly(),
  toolbarPos: loadToolbarPosition(window.innerWidth, window.innerHeight),
  viewMode: loadViewMode(),
  interactMode: loadInteractMode(),
  zoomLock: loadZoomLock(),
  history: createHistory(),
  rectTool: null,
  currentRect: null,
  pendingCapture: null,
  immersive: false,
  eraseMode: loadEraser().mode,
  eraserWidth: loadEraser().width,
  pendingStamp: null,
  userScale: 1,
  panX: 0,
  panY: 0,
  pageCssWidth: 0,
  pageCssHeight: 0,
  stackBase: { width: 0, height: 0 },
  pageViews: [],
  sheets: [],
  rotations: {},
  bookmarks: [],
  previewOpen: false,
  previewFilter: "all",
  selectionIndexes: [],
  inkClipboard: [],
  selectDrag: null,
  cropping: false,
};

const pointers = new Map();
const imageBitmaps = new Map();
let gesture = null;
let ignoreAfterPinch = false;
let ignoreAfterPanel = false;
let captureConfirmArmedAt = 0;
let renderGen = 0;
let imagePasteArmedUntil = 0;

function activeSlot() {
  return state.slots[state.slotIndex] || state.slots[0];
}

function usesStamp() {
  return state.tool !== "eraser" && activeSlot().type === "stamp";
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
    saveStrokes(state.identity, state.pages, {
      rotations: state.rotations,
      sheets: state.sheets,
      bookmarks: state.bookmarks,
    });
  } catch {
    showBanner("필기를 저장하지 못했습니다. 브라우저 저장 공간이 부족할 수 있습니다.");
  }
}

function syncHistoryButtons() {
  els.undoBtn.disabled = !canUndo(state.history) && !canRedo(state.history);
}

function commitPageChange(pageNum, apply) {
  const key = sheetKey(pageNum);
  const before = cloneItems(pageStrokes(pageNum));
  const rotationBefore = state.rotations[key] || 0;
  apply(key);
  const after = cloneItems(pageStrokes(pageNum));
  const rotationAfter = state.rotations[key] || 0;
  recordChange(state.history, { page: key, before, after, rotationBefore, rotationAfter });
  persistStrokes();
  syncHistoryButtons();
}

function resetEditorExtras() {
  state.history = createHistory();
  state.rectTool = null;
  state.currentRect = null;
  state.pendingCapture = null;
  state.selectionIndexes = [];
  state.selectDrag = null;
  state.cropping = false;
  hideMarquee();
  hideSelectionUi();
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
      rotations: state.rotations,
      sheets: state.sheets,
      bookmarks: state.bookmarks,
    });
  } catch {
    // Session restore is best-effort; strokes are already in localStorage.
  }
}

function currentSheet(pageNum = state.drawPage || state.page) {
  return state.sheets[pageNum - 1] || state.sheets[0] || { key: String(pageNum), kind: "pdf", pdfPage: pageNum };
}

function sheetKey(pageNum = state.drawPage || state.page) {
  return currentSheet(pageNum).key;
}

function pageStrokes(pageNum = state.drawPage || state.page) {
  const key = sheetKey(pageNum);
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
  const fixed = items.filter((item) => isFixedImage(item));
  const rest = items.filter((item) => !isFixedImage(item));
  for (const item of [...fixed, ...rest]) {
    paintItem(ctx, item, scale, canvas, imageBitmaps);
  }
  if (liveStroke && (liveStroke.points?.length || liveStroke.type === "stamp")) {
    paintItem(ctx, liveStroke, scale, canvas, imageBitmaps);
  }
  paintMosaicOverlay(view);
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
  stage.append(pdfCanvas, inkCanvas, maskCanvas);
  const sheet = currentSheet(pageNum);
  return {
    pageNum,
    sheetKey: sheet.key,
    sheet,
    stage,
    pdfCanvas,
    inkCanvas,
    maskCanvas,
    rendered: false,
    token: 0,
  };
}

function applyPageSize(view, cssWidth, cssHeight, pixelWidth, pixelHeight) {
  view.cssWidth = cssWidth;
  view.cssHeight = cssHeight;
  view.stage.style.width = `${cssWidth}px`;
  view.stage.style.height = `${cssHeight}px`;
  for (const canvas of [view.pdfCanvas, view.inkCanvas, view.maskCanvas]) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
  }
}

async function donorPdfPage() {
  const donor = state.sheets.find((sheet) => sheet.kind === "pdf") || { pdfPage: 1 };
  return state.pdf.getPage(donor.pdfPage);
}

async function renderPageView(view) {
  if (!state.pdf) {
    return;
  }
  const token = ++view.token;
  const sheet = view.sheet || currentSheet(view.pageNum);
  const rotation = state.rotations[sheet.key] || 0;
  const page = sheet.kind === "outline" ? await donorPdfPage() : await state.pdf.getPage(sheet.pdfPage);
  if (token !== view.token || !state.pdf) {
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  const scale = fitScale(page, state.viewMode, rotation);
  const css = page.getViewport({ scale, rotation });
  const pixel = page.getViewport({ scale: scale * dpr, rotation });
  applyPageSize(view, css.width, css.height, pixel.width, pixel.height);
  if (state.viewMode === "page" || view.pageNum === state.page) {
    state.pageCssWidth = css.width;
    state.pageCssHeight = css.height;
  }
  const ctx = canvas2d(view.pdfCanvas);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, view.pdfCanvas.width, view.pdfCanvas.height);
  if (sheet.kind === "outline") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, view.pdfCanvas.width, view.pdfCanvas.height);
  } else {
    await page.render({ canvasContext: ctx, viewport: pixel }).promise;
  }
  if (token !== view.token) {
    return;
  }
  view.rendered = true;
  view.sheet = sheet;
  view.sheetKey = sheet.key;
  drawStrokesOn(view, state.drawing && state.drawPage === view.pageNum ? state.currentStroke : null);
  loadPageImages(view.pageNum);
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
  if (!state.pdf) {
    return;
  }

  if (state.viewMode === "page") {
    const view = makeStage(state.page);
    state.pageViews = [view];
    els.pageStack.append(view.stage);
    await renderPageView(view);
  } else {
    for (let index = 1; index <= state.pageCount; index += 1) {
      const view = makeStage(index);
      state.pageViews.push(view);
      els.pageStack.append(view.stage);
    }
    const firstSheet = state.sheets[0] || { kind: "pdf", pdfPage: 1, key: "1" };
    const first = firstSheet.kind === "outline" ? await donorPdfPage() : await state.pdf.getPage(firstSheet.pdfPage || 1);
    if (gen !== renderGen) {
      return;
    }
    const firstRot = state.rotations[firstSheet.key] || 0;
    const css = first.getViewport({ scale: fitScale(first, "scroll", firstRot), rotation: firstRot });
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
let undoHoldLock = false;

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
  state.pages = stored.pages || {};
  state.rotations = stored.rotations || {};
  state.sheets = coerceSheets(stored.sheets, pdf.numPages);
  state.bookmarks = stored.bookmarks || [];
  state.pageCount = state.sheets.length;
  state.page = Math.min(Math.max(1, page), state.pageCount);
  imageBitmaps.clear();
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
  if (state.previewOpen) {
    syncPreviewChrome();
    renderPreviewThumbs();
  }
}

function allowsInkPointer(event) {
  return canCreateInk({
    interactMode: state.interactMode,
    penOnly: state.penOnly,
    pointerType: event.pointerType,
    rectTool: state.rectTool,
  });
}

function shouldPan(event) {
  return shouldPanPointer({
    interactMode: state.interactMode,
    penOnly: state.penOnly,
    pointerType: event.pointerType,
    rectTool: state.rectTool,
  });
}

function allowsRectPointer(event) {
  return (
    state.interactMode === "edit" &&
    (state.rectTool === "mosaic" || state.rectTool === "capture") &&
    (!state.penOnly || event.pointerType === "pen")
  );
}

function allowsSelect(event) {
  return state.rectTool === "select" && canSelectPointer({
    interactMode: state.interactMode,
    penOnly: state.penOnly,
    pointerType: event.pointerType,
  });
}

function overlayOpen() {
  return (
    !els.settingsSheet.hidden ||
    !els.slotPanel.hidden ||
    !els.eraserPanel.hidden ||
    !els.morePanel.hidden ||
    state.previewOpen
  );
}

function abortStroke() {
  state.pendingStamp = null;
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
  const view = state.pageViews.find((item) => item.stage === stage);
  const point = eventToNorm(event, ink);
  state.drawPage = Number(stage.dataset.page) || state.page;
  state.drawCanvas = ink;
  if (usesStamp()) {
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
  state.drawing = true;
  state.currentStroke = newStroke(point);
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
  state.currentStroke.points.push(eventToNorm(event, state.drawCanvas));
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
  const live = state.currentStroke;
  const view = state.pageViews.find((item) => item.pageNum === state.drawPage);
  commitPageChange(state.drawPage, () => {
    if (view) {
      const cssWidth = view.cssWidth || Number.parseFloat(view.inkCanvas.style.width) || 0;
      const cssHeight = view.cssHeight || Number.parseFloat(view.inkCanvas.style.height) || 0;
      if (isStrokeErase(live) || isPixelErase(live)) {
        state.pages[String(state.drawPage)] = applyEraserToInk(pageStrokes(state.drawPage), live, cssWidth, cssHeight);
      } else {
        pageStrokes(state.drawPage).push(live);
      }
    } else {
      pageStrokes(state.drawPage).push(live);
    }
  });
  state.currentStroke = null;
  state.drawing = false;
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

function syncSlots() {
  document.querySelectorAll("[data-slot]").forEach((btn) => {
    const index = Number(btn.dataset.slot);
    const slot = state.slots[index];
    btn.classList.toggle("is-selected", state.tool !== "eraser" && index === state.slotIndex);
    btn.dataset.kind = slot.type;
    const mini =
      slot.type === "pencil" ? PENCIL_COLOR : slot.type === "stamp" ? STAMP_COLOR : slot.color;
    btn.style.setProperty("--slot-color", mini);
    btn.style.setProperty("--slot-width", String(slot.width));
    btn.setAttribute("aria-label", slotAriaLabel(slot));
  });
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
  els.interactBtn.classList.toggle("is-on", viewing);
  els.interactBtn.setAttribute("aria-pressed", viewing ? "true" : "false");
  els.interactBtn.setAttribute("aria-label", viewing ? "보기" : "편집");
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
  syncSlots();
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

function applyChrome() {
  els.writeScreen.dataset.toolbar = state.toolbarPos;
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
  applyChrome();
  els.settingsSheet.hidden = false;
}

function closeSlotPanel() {
  els.slotPanel.hidden = true;
  state.editingSlot = null;
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
  let top = anchor.bottom + gap;
  let left = anchor.left + anchor.width / 2 - width / 2;

  if (state.toolbarPos === "top") {
    top = bar.bottom + gap;
    left = anchor.left + anchor.width / 2 - width / 2;
  } else if (state.toolbarPos === "bottom") {
    top = bar.top - gap - height;
    left = anchor.left + anchor.width / 2 - width / 2;
  } else if (state.toolbarPos === "left") {
    left = bar.right + gap;
    top = anchor.top + anchor.height / 2 - height / 2;
  } else {
    left = bar.left - gap - width;
    top = anchor.top + anchor.height / 2 - height / 2;
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
        if (state.editingSlot == null) {
          return;
        }
        state.slots[state.editingSlot].color = item.hex;
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
  const pad = 16;
  const cssWidth = Math.ceil(layout.radius * 2 + pad * 2);
  const cssHeight = Math.ceil(layout.radius + layout.labelBottom + pad);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const item = stampInkItem(label, 0.5, (pad + layout.radius) / cssHeight, -0.1);
  paintStamp(ctx, item, dpr, canvas);
}

function syncStampPicker() {
  const slot = state.slots[state.editingSlot] || activeSlot();
  const label = normalizeStamp(slot.stamp);
  els.stampPhrases.querySelectorAll("button").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.stamp === label);
  });
  paintStampPreview(label);
}

function syncSlotEditor() {
  const slot = state.slots[state.editingSlot];
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

function openSlotEditor(index, slotBtn) {
  closeEraserPanel();
  state.slotIndex = index;
  state.editingSlot = index;
  state.tool = "pen";
  saveSlotIndex(index);
  syncToolSelection();
  syncSlotEditor();
  placePanel(els.slotPanel, slotBtn);
}

function persistSlotChange() {
  saveSlots(state.slots);
  syncSlots();
  syncSlotEditor();
}

function setSlotKind(kind) {
  if (state.editingSlot == null) {
    return;
  }
  const slot = state.slots[state.editingSlot];
  slot.type = kind;
  slot.color = defaultColorForKind(kind, slot.color);
  if (kind === "highlighter" && !slot.opacity) {
    slot.opacity = HIGHLIGHTER_OPACITY_DEFAULT;
  }
  if (kind === "stamp") {
    slot.stamp = normalizeStamp(slot.stamp);
  }
  persistSlotChange();
}

function selectSlot(index) {
  state.slotIndex = index;
  state.tool = "pen";
  state.rectTool = null;
  hideMarquee();
  clearSelection();
  saveSlotIndex(index);
  closeAllPanels();
  syncToolSelection();
  syncRectTool();
}

function selectEraserPixel() {
  state.tool = "eraser";
  state.eraseMode = "pixel";
  state.rectTool = null;
  hideMarquee();
  clearSelection();
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

async function setToolbarPosition(position) {
  state.toolbarPos = position;
  saveToolbarPosition(position);
  applyChrome();
  closeAllPanels();
  if (state.pdf) {
    await rebuildPages();
  }
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
    hideMarquee();
    clearSelection();
  }
  applyChrome();
  syncRectTool();
}

function hideMarquee() {
  state.currentRect = null;
  state.pendingCapture = null;
  els.marquee.hidden = true;
  els.captureConfirm.hidden = true;
}

function hideSelectionUi() {
  if (els.selectLayer) {
    els.selectLayer.hidden = true;
  }
  if (els.floatBar) {
    els.floatBar.hidden = true;
  }
}

function selectedItems(pageNum = state.page) {
  const items = pageStrokes(pageNum);
  return state.selectionIndexes.map((index) => items[index]).filter(Boolean);
}

function selectionBounds(pageNum = state.page) {
  const view = state.pageViews.find((item) => item.pageNum === pageNum);
  const cssWidth = view?.cssWidth || 1;
  const cssHeight = view?.cssHeight || 1;
  return boundsUnion(selectedItems(pageNum).map((item) => itemBoundsNorm(item, cssWidth, cssHeight)));
}

function syncSelectionUi() {
  const hasSel = state.selectionIndexes.length > 0;
  const hasClip = state.inkClipboard.length > 0;
  if (!hasSel && !(state.rectTool === "select" && hasClip)) {
    hideSelectionUi();
    return;
  }
  const bounds = selectionBounds();
  const view = state.pageViews.find((item) => item.pageNum === state.page);
  if (hasSel && bounds && view) {
    const box = view.stage.getBoundingClientRect();
    const left = box.left + bounds.x * box.width;
    const top = box.top + bounds.y * box.height;
    const width = Math.max(1, bounds.w * box.width);
    const height = Math.max(1, bounds.h * box.height);
    els.selectLayer.hidden = false;
    els.selectBox.style.left = `${left}px`;
    els.selectBox.style.top = `${top}px`;
    els.selectBox.style.width = `${width}px`;
    els.selectBox.style.height = `${height}px`;
    const singleImage = state.selectionIndexes.length === 1 && isImageItem(selectedItems()[0]);
    document.querySelectorAll("#select-layer [data-handle]").forEach((handle) => {
      handle.hidden = !singleImage;
      if (!singleImage) {
        return;
      }
      const name = handle.dataset.handle;
      const x = name.includes("e") ? left + width : left;
      const y = name.includes("s") ? top + height : top;
      handle.style.left = `${x - SELECT_HANDLE_PX / 2}px`;
      handle.style.top = `${y - SELECT_HANDLE_PX / 2}px`;
    });
  } else {
    els.selectLayer.hidden = true;
  }

  els.floatBar.hidden = false;
  const onlyImage = state.selectionIndexes.length === 1 && isImageItem(selectedItems()[0]);
  els.copyBtn.hidden = !hasSel;
  els.pasteBtn.hidden = false;
  els.cropBtn.hidden = !onlyImage;
  els.lockBtn.hidden = !onlyImage;
  if (onlyImage) {
    els.lockBtn.classList.toggle("is-selected", Boolean(selectedItems()[0].fixed));
    els.cropBtn.classList.toggle("is-selected", state.cropping);
  }
  const barW = els.floatBar.offsetWidth || 200;
  let barLeft = 8;
  let barTop = 80;
  if (hasSel && bounds && view) {
    const box = view.stage.getBoundingClientRect();
    barLeft = box.left + bounds.x * box.width;
    barTop = box.top + bounds.y * box.height - 52;
  }
  els.floatBar.style.left = `${Math.min(window.innerWidth - barW - 8, Math.max(8, barLeft))}px`;
  els.floatBar.style.top = `${Math.min(window.innerHeight - 52, Math.max(8, barTop))}px`;
}

function clearSelection() {
  state.selectionIndexes = [];
  state.selectDrag = null;
  state.cropping = false;
  hideSelectionUi();
}

function armImagePaste(ms = 20000) {
  imagePasteArmedUntil = performance.now() + ms;
}

function imagePasteArmed() {
  return performance.now() < imagePasteArmedUntil;
}

async function loadPageImages(pageNum) {
  if (!state.identity) {
    return;
  }
  const needed = pageStrokes(pageNum).filter((item) => isImageItem(item) && !imageBitmaps.has(item.id));
  if (!needed.length) {
    return;
  }
  await Promise.all(
    needed.map(async (item) => {
      try {
        const row = await loadImageRecord(state.identity, item.id);
        if (!row?.blob) {
          return;
        }
        const bitmap = await createImageBitmap(row.blob);
        imageBitmaps.set(item.id, bitmap);
      } catch {
        // Missing image bytes stay blank.
      }
    }),
  );
  const view = state.pageViews.find((item) => item.pageNum === pageNum);
  if (view) {
    drawStrokesOn(view);
  }
}

async function insertImageFile(file) {
  if (state.interactMode === "view" || !state.pdf) {
    return;
  }
  const named = validateImageFile(file);
  if (!named.ok) {
    showBanner(named.message);
    return;
  }
  const contents = await validateImageContents(file);
  if (!contents.ok) {
    showBanner(contents.message);
    return;
  }
  try {
    const id = newImageId();
    const bitmap = await createImageBitmap(file);
    const rect = fitImageRect(bitmap.width, bitmap.height);
    const item = imageInkItem({ id, ...rect });
    await saveImageRecord(state.identity, id, file, file.type || "image/png");
    imageBitmaps.set(id, bitmap);
    commitPageChange(state.page, () => {
      pageStrokes(state.page).push(item);
    });
    const view = state.pageViews.find((item) => item.pageNum === state.page);
    if (view) {
      drawStrokesOn(view);
    }
    state.rectTool = "select";
    state.selectionIndexes = [pageStrokes(state.page).length - 1];
    state.interactMode = "edit";
    saveInteractMode("edit");
    applyChrome();
    syncRectTool();
    syncSelectionUi();
  } catch {
    showBanner("이미지를 넣지 못했습니다.");
  }
}

function pickImageFile() {
  armStayOnWrite();
  armImagePaste();
  els.imageInput.value = "";
  els.imageInput.click();
}

function copySelection() {
  const items = selectedItems().filter(isSelectable);
  if (!items.length) {
    return;
  }
  state.inkClipboard = cloneItems(items);
  syncSelectionUi();
}

function pasteClipboard() {
  if (state.interactMode === "view") {
    return;
  }
  if (!state.inkClipboard.length) {
    armImagePaste();
    showBanner("이미지를 붙여넣거나 파일을 선택해 주세요.");
    return;
  }
  const clones = cloneItemsWithOffset(state.inkClipboard);
  commitPageChange(state.page, () => {
    pageStrokes(state.page).push(...clones);
  });
  const start = pageStrokes(state.page).length - clones.length;
  state.selectionIndexes = clones.map((_, index) => start + index);
  const view = state.pageViews.find((item) => item.pageNum === state.page);
  if (view) {
    drawStrokesOn(view);
  }
  syncSelectionUi();
}

function lockSelectedImage() {
  const items = pageStrokes(state.page);
  const index = state.selectionIndexes[0];
  const item = items[index];
  if (!isImageItem(item)) {
    return;
  }
  commitPageChange(state.page, () => {
    items[index] = { ...item, fixed: !item.fixed };
  });
  if (items[index].fixed) {
    state.selectionIndexes = [];
  }
  const view = state.pageViews.find((item) => item.pageNum === state.page);
  if (view) {
    drawStrokesOn(view);
  }
  syncSelectionUi();
}

function applySelectedCrop() {
  if (!state.cropping || state.selectionIndexes.length !== 1) {
    state.cropping = !state.cropping;
    syncSelectionUi();
    return;
  }
  const items = pageStrokes(state.page);
  const index = state.selectionIndexes[0];
  const item = items[index];
  if (!isImageItem(item) || !state.selectDrag?.crop) {
    state.cropping = !state.cropping;
    syncSelectionUi();
    return;
  }
  const next = bakeCrop(item, state.selectDrag.crop);
  commitPageChange(state.page, () => {
    items[index] = next;
  });
  state.cropping = false;
  state.selectDrag = null;
  const view = state.pageViews.find((item) => item.pageNum === state.page);
  if (view) {
    drawStrokesOn(view);
  }
  syncSelectionUi();
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
  const cssWidth = view?.cssWidth || 1;
  const cssHeight = view?.cssHeight || 1;
  const items = pageStrokes(state.drawPage);
  const bounds = selectionBounds(state.drawPage);
  if (state.selectionIndexes.length === 1 && isImageItem(selectedItems(state.drawPage)[0])) {
    const handle = handleAtPoint(bounds, point, cssWidth, cssHeight);
    if (handle) {
      state.selectDrag = {
        kind: state.cropping ? "crop" : "resize",
        handle,
        start: point,
        before: cloneItems(items),
        crop: { x: 0, y: 0, w: 1, h: 1 },
      };
      return;
    }
  }
  if (bounds && pointInBounds(point, bounds, 0.008)) {
    state.selectDrag = { kind: "move", start: point, before: cloneItems(items) };
    return;
  }
  const hit = indexAtPoint(items, point, cssWidth, cssHeight);
  if (hit >= 0) {
    state.selectionIndexes = [hit];
    state.selectDrag = { kind: "move", start: point, before: cloneItems(items) };
    syncSelectionUi();
    return;
  }
  state.selectionIndexes = [];
  state.selectDrag = { kind: "marquee", a: point, b: point };
  hideSelectionUi();
}

function moveSelect(event) {
  if (!state.selectDrag || !state.drawCanvas) {
    return;
  }
  event.preventDefault();
  const point = eventToNorm(event, state.drawCanvas);
  const items = pageStrokes(state.drawPage);
  if (state.selectDrag.kind === "marquee") {
    state.selectDrag.b = point;
    state.currentRect = { page: state.drawPage, a: state.selectDrag.a, b: point };
    updateMarquee(false);
    return;
  }
  if (state.selectDrag.kind === "move") {
    const dx = point.x - state.selectDrag.start.x;
    const dy = point.y - state.selectDrag.start.y;
    state.selectDrag.start = point;
    for (const index of state.selectionIndexes) {
      if (items[index] && isSelectable(items[index])) {
        items[index] = translateItem(items[index], dx, dy);
      }
    }
    const view = state.pageViews.find((item) => item.pageNum === state.drawPage);
    if (view) {
      drawStrokesOn(view);
    }
    syncSelectionUi();
    return;
  }
  if (state.selectDrag.kind === "resize" || state.selectDrag.kind === "crop") {
    const index = state.selectionIndexes[0];
    const item = items[index];
    if (!isImageItem(item)) {
      return;
    }
    const next = resizeRectFromCorner({ x: item.x, y: item.y, w: item.w, h: item.h }, state.selectDrag.handle, point);
    if (state.selectDrag.kind === "crop") {
      const ox = item.x;
      const oy = item.y;
      const ow = item.w;
      const oh = item.h;
      state.selectDrag.crop = {
        x: (next.x - ox) / Math.max(ow, 0.001),
        y: (next.y - oy) / Math.max(oh, 0.001),
        w: next.w / Math.max(ow, 0.001),
        h: next.h / Math.max(oh, 0.001),
      };
    }
    items[index] = applyRectToImage(item, next);
    const view = state.pageViews.find((item) => item.pageNum === state.drawPage);
    if (view) {
      drawStrokesOn(view);
    }
    syncSelectionUi();
  }
}

function endSelect(event) {
  if (!state.selectDrag) {
    return;
  }
  if (event.pointerId != null && state.drawCanvas) {
    try {
      state.drawCanvas.releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }
  }
  const drag = state.selectDrag;
  const page = state.drawPage;
  const items = pageStrokes(page);
  if (drag.kind === "marquee") {
    const rect = rectFromPoints(drag.a, drag.b);
    const view = state.pageViews.find((item) => item.pageNum === page);
    hideMarquee();
    state.selectDrag = null;
    if (!view) {
      return;
    }
    if (rectBigEnough(rect)) {
      state.selectionIndexes = indexesInRect(items, rect, view.cssWidth, view.cssHeight);
    } else {
      const hit = indexAtPoint(items, drag.a, view.cssWidth, view.cssHeight);
      state.selectionIndexes = hit >= 0 ? [hit] : [];
    }
    syncSelectionUi();
    return;
  }
  const after = cloneItems(items);
  const before = drag.before;
  state.selectDrag = drag.kind === "crop" ? drag : null;
  if (before && JSON.stringify(before) !== JSON.stringify(after) && drag.kind !== "crop") {
    recordChange(state.history, {
      page: sheetKey(page),
      before,
      after,
      rotationBefore: state.rotations[sheetKey(page)] || 0,
      rotationAfter: state.rotations[sheetKey(page)] || 0,
    });
    persistStrokes();
    syncHistoryButtons();
  }
  syncSelectionUi();
}

function rotateCurrentPage(dir) {
  if (!state.pdf || state.interactMode === "view") {
    return;
  }
  const key = sheetKey(state.page);
  commitPageChange(state.page, () => {
    state.rotations[key] = nextRotation(state.rotations[key] || 0, dir);
    state.pages[key] = rotateItems90(pageStrokes(state.page), dir);
  });
  clearSelection();
  rebuildPages();
}

function closePreviewDrawer() {
  state.previewOpen = false;
  if (els.previewDrawer) {
    els.previewDrawer.hidden = true;
  }
}

async function renderPreviewThumbs() {
  if (!els.previewThumbs || !state.pdf) {
    return;
  }
  const visible = filterSheets(state.sheets, state.bookmarks, state.previewFilter);
  els.previewThumbs.replaceChildren();
  for (const sheet of visible) {
    const pageIndex = state.sheets.findIndex((item) => item.key === sheet.key) + 1;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "preview-thumb";
    btn.classList.toggle("is-current", pageIndex === state.page);
    btn.classList.toggle("is-bookmark", state.bookmarks.includes(sheet.key));
    btn.setAttribute("aria-label", `${pageIndex}쪽`);
    const canvas = document.createElement("canvas");
    canvas.width = 88;
    canvas.height = 88;
    btn.append(canvas);
    btn.addEventListener("click", () => {
      armStayOnWrite();
      goToPage(pageIndex);
    });
    els.previewThumbs.append(btn);
    paintPreviewThumb(canvas, sheet);
  }
}

async function paintPreviewThumb(canvas, sheet) {
  try {
    const rotation = state.rotations[sheet.key] || 0;
    const page = sheet.kind === "outline" ? await donorPdfPage() : await state.pdf.getPage(sheet.pdfPage);
    const vp1 = page.getViewport({ scale: 1, rotation });
    const scale = 88 / Math.max(vp1.width, 1);
    const viewport = page.getViewport({ scale, rotation });
    canvas.width = 88;
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (sheet.kind !== "outline") {
      await page.render({ canvasContext: ctx, viewport }).promise;
    }
  } catch {
    // blank thumb
  }
}

function syncPreviewChrome() {
  if (!els.previewDrawer) {
    return;
  }
  els.previewDrawer.hidden = !state.previewOpen;
  els.bookmarkBtn.classList.toggle("is-selected", state.bookmarks.includes(sheetKey(state.page)));
  els.bookmarkFilterBtn.classList.toggle("is-selected", state.previewFilter === "bookmarks");
  els.outlineFilterBtn.classList.toggle("is-selected", state.previewFilter === "outlines");
}

async function togglePreviewDrawer() {
  state.previewOpen = !state.previewOpen;
  syncPreviewChrome();
  if (state.previewOpen) {
    await renderPreviewThumbs();
  }
}

function toggleCurrentBookmark() {
  const key = sheetKey(state.page);
  state.bookmarks = toggleBookmark(state.bookmarks, key);
  persistStrokes();
  persistSession();
  syncPreviewChrome();
  if (state.previewOpen) {
    renderPreviewThumbs();
  }
}

function insertOutlinePage() {
  const id = newImageId();
  state.sheets = insertOutlineSheet(state.sheets, state.page - 1, id);
  state.pageCount = state.sheets.length;
  state.page += 1;
  persistStrokes();
  persistSession();
  rebuildPages();
  if (state.previewOpen) {
    renderPreviewThumbs();
  }
}

function setPreviewFilter(filter) {
  state.previewFilter = state.previewFilter === filter ? "all" : filter;
  syncPreviewChrome();
  renderPreviewThumbs();
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

function redrawHistoryPage(pageKey) {
  const key = String(pageKey);
  const index = state.sheets.findIndex((sheet) => sheet.key === key);
  const num = index >= 0 ? index + 1 : Number(pageKey);
  const view = state.pageViews.find((item) => item.pageNum === num || item.sheetKey === key);
  if (view) {
    drawStrokesOn(view);
    return;
  }
  if (num !== state.page) {
    goToPage(num);
  }
}

function undoInk() {
  if (undoHoldLock) {
    return;
  }
  const entry = undoChange(state.history, state.pages, state.rotations);
  if (!entry) {
    return;
  }
  persistStrokes();
  syncHistoryButtons();
  if (entry.rotationBefore != null) {
    rebuildPages();
    return;
  }
  redrawHistoryPage(entry.page);
}

function redoInk() {
  const entry = redoChange(state.history, state.pages, state.rotations);
  if (!entry) {
    return;
  }
  persistStrokes();
  syncHistoryButtons();
  if (entry.rotationAfter != null) {
    rebuildPages();
    return;
  }
  redrawHistoryPage(entry.page);
}

function overflowSide() {
  if (state.toolbarPos === "bottom") {
    return "above";
  }
  if (state.toolbarPos === "top") {
    return "below";
  }
  if (state.toolbarPos === "left") {
    return "right";
  }
  return "left";
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

function selectMoreAction(action) {
  if (action === "fullscreen") {
    closeMorePanel();
    ignoreAfterPanel = true;
    toggleFullscreen();
    return;
  }
  if (action === "preview") {
    closeMorePanel();
    ignoreAfterPanel = true;
    togglePreviewDrawer();
    return;
  }
  if (action === "image") {
    closeMorePanel();
    ignoreAfterPanel = true;
    state.interactMode = "edit";
    saveInteractMode("edit");
    applyChrome();
    pickImageFile();
    return;
  }
  if (action !== "mosaic" && action !== "capture" && action !== "select") {
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
    if (!event.target.closest(".slot-panel, .sheet-card, .toolbar, .write-top, .m4-bar, .more-panel, .preview-drawer, .float-bar, .select-layer")) {
      closeAllPanels();
      closePreviewDrawer();
      ignoreAfterPanel = true;
    }
    return;
  }
  if (event.target.closest(".toolbar, .write-top, .sheet, .slot-panel, .m4-bar, .more-panel, .marquee, .preview-drawer, .float-bar, .select-layer")) {
    return;
  }

  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });

  if (pointers.size >= 2) {
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
  if (state.rectTool === "select") {
    if (allowsSelect(event)) {
      startSelect(event, stage);
    }
    return;
  }
  if (state.rectTool) {
    if (allowsRectPointer(event)) {
      startRect(event, stage);
    }
    return;
  }
  if (skipClickThrough) {
    return;
  }
  if (allowsInkPointer(event)) {
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

function bindSlot(btn) {
  const index = Number(btn.dataset.slot);
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

  const samePointer = (event) =>
    event.pointerId == null || pointerId == null || event.pointerId === pointerId;

  const onLift = (event) => {
    if (!active || !samePointer(event)) {
      return;
    }
    const wasLong = longPress;
    stopPress();
    if (wasLong) {
      return;
    }
    if (state.tool === "pen" && state.slotIndex === index) {
      openSlotEditor(index, btn);
      return;
    }
    selectSlot(index);
  };

  const onPointerCancel = (event) => {
    if (!active || !samePointer(event)) {
      return;
    }
    // Browser often cancels a touch pointer for the context menu while the
    // finger is still down. Keep the long-press timer in that case.
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
      openSlotEditor(index, btn);
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

function bindUndoHold(btn) {
  let pointerId = null;
  let startedAt = 0;
  let didLong = false;
  let timer = 0;

  const finish = (event) => {
    if (pointerId == null) {
      return;
    }
    if (event.pointerId != null && event.pointerId !== pointerId) {
      return;
    }
    window.clearTimeout(timer);
    timer = 0;
    const held = performance.now() - startedAt;
    const wasLong = didLong || held >= LONG_PRESS_MS;
    pointerId = null;
    undoHoldLock = wasLong;
    if (!wasLong) {
      undoInk();
    }
    window.setTimeout(() => {
      undoHoldLock = false;
    }, 200);
  };

  btn.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    if (pointerId != null) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    pointerId = event.pointerId;
    startedAt = performance.now();
    didLong = false;
    undoHoldLock = false;
    window.clearTimeout(timer);
    try {
      btn.setPointerCapture(event.pointerId);
    } catch {
      // optional
    }
    timer = window.setTimeout(() => {
      if (pointerId == null) {
        return;
      }
      didLong = true;
      undoHoldLock = true;
      redoInk();
    }, LONG_PRESS_MS);
  });
  btn.addEventListener("pointerup", finish);
  btn.addEventListener("pointercancel", finish);
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  btn.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
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

document.querySelectorAll("[data-slot]").forEach(bindSlot);
bindHold(els.eraserBtn, {
  onShort: selectEraserPixel,
  onLong: openEraserEditor,
});

document.querySelectorAll("#slot-kinds [data-kind]").forEach((btn) => {
  btn.addEventListener("click", () => setSlotKind(btn.dataset.kind));
});
els.slotOpacity.addEventListener("input", () => {
  if (state.editingSlot == null) {
    return;
  }
  state.slots[state.editingSlot].opacity = clampOpacity(els.slotOpacity.value);
  persistSlotChange();
});
els.slotWidth.addEventListener("input", () => {
  if (state.editingSlot == null) {
    return;
  }
  state.slots[state.editingSlot].width = Number(els.slotWidth.value);
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
    if (state.editingSlot == null) {
      return;
    }
    state.slots[state.editingSlot].type = "stamp";
    state.slots[state.editingSlot].stamp = label;
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
bindUndoHold(els.undoBtn);
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
    closeMorePanel();
    ignoreAfterPanel = true;
    rotateCurrentPage(btn.dataset.rotate);
  });
});
els.imageInput.addEventListener("change", () => {
  const file = els.imageInput.files?.[0];
  if (file) {
    insertImageFile(file);
  }
  els.imageInput.value = "";
});
els.copyBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  copySelection();
});
els.pasteBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  armStayOnWrite();
  armImagePaste();
  pasteClipboard();
});
els.cropBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  applySelectedCrop();
});
els.lockBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  lockSelectedImage();
});
els.bookmarkBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  armStayOnWrite();
  toggleCurrentBookmark();
});
els.bookmarkFilterBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  armStayOnWrite();
  setPreviewFilter("bookmarks");
});
els.outlineInsertBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  armStayOnWrite();
  insertOutlinePage();
});
els.outlineFilterBtn.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  armStayOnWrite();
  setPreviewFilter("outlines");
});
document.addEventListener("paste", (event) => {
  if (!imagePasteArmed() || els.writeScreen.hidden || state.interactMode === "view") {
    return;
  }
  const file = fileFromPasteEvent(event);
  if (!file) {
    return;
  }
  event.preventDefault();
  imagePasteArmedUntil = 0;
  insertImageFile(file);
});
els.captureConfirm.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  confirmCapture();
});
els.settingsBtn.addEventListener("click", () => {
  if (els.settingsSheet.hidden) {
    openSettings();
  } else {
    closeSettings();
  }
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
  if (!els.morePanel.hidden) {
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
  if (state.viewMode !== "scroll") {
    return;
  }
  updateCurrentPageFromScroll();
  renderVisiblePages();
});

els.writeScreen.addEventListener(
  "touchmove",
  (event) => {
    if (event.target.closest(".sheet-card, .slot-panel, .toolbar, .write-top, .m4-bar, .more-panel, .marquee, .preview-drawer, .float-bar, .select-layer")) {
      return;
    }
    event.preventDefault();
  },
  { passive: false },
);

document.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".slot-panel, [data-slot], #eraser-btn, #more-btn, .m4-bar, .marquee, .preview-drawer, .float-bar, .select-layer")) {
    return;
  }
  closeAllPanels();
});

document.addEventListener("keydown", (event) => {
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
    if (!els.slotPanel.hidden && state.editingSlot != null) {
      const btn = document.querySelector(`[data-slot="${state.editingSlot}"]`);
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
    if (state.selectionIndexes.length || state.rectTool === "select") {
      syncSelectionUi();
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
