import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { validatePdfContents, validatePdfFile } from "./validate.js";
import {
  fileIdentity,
  listDocuments,
  loadDocument,
  loadLastSession,
  loadPenOnly,
  loadStickerFolders,
  loadStickers,
  loadStrokes,
  migrateLastIntoFiles,
  saveDocument,
  savePenOnly,
  saveStickerFolders,
  saveStickers,
  saveStrokes,
} from "./storage.js";
import {
  loadEraser,
  loadInkTools,
  loadInteractMode,
  loadPreviewWidth,
  loadToolbarFloat,
  loadToolbarPosition,
  loadViewMode,
  loadZoomLock,
  saveEraser,
  saveInkTools,
  saveInteractMode,
  savePreviewWidth,
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
  isRail,
  normalizeDock,
  snapDockFromPoint,
  useNarrowCells,
  useNarrowRail,
} from "./toolbar.js";
import {
  PAN_MARGIN_PX,
  constrainPan,
  inkCanvasScale,
  renderZoomFactor,
  pointerDistance,
  pointerMidpoint,
  scaleFromPinch,
} from "./viewport.js";
import { applyEraserToInk, isPixelErase, isStrokeErase, paintGhost, paintItem, paintStamp, removeHitItems, removeHitStamps, stampInkItem, stampTilt } from "./ink.js";
import { followStampGhost, stampGhostItem, stampPlaceFromGhost } from "./stampGhost.js";
import {
  appendInkPoint,
  beginInkPoints,
  canCreateInk,
  finishInkPoints,
  interactModeLabel,
  rectBigEnough,
  rectFromPoints,
  shouldPanPointer,
  shouldNoticeViewMode,
  VIEW_NOTICE_MS,
  VIEW_NOTICE_TEXT,
} from "./interact.js";
import { canRedo, canUndo, cloneItems, createHistory, recordChange, redoChange, undoChange } from "./history.js";
import { bindUndoHold } from "./undoHold.js";
import { bindMarqueeHold, placeMarqueeMenu } from "./marqueeHold.js";
import {
  PAGE_DRAG_SLOP_PX,
  PAGE_HOLD_MS,
  canPastePage,
  copyPageLeaf,
  dropIndexAt,
  dropLineTop,
  duplicatePageLeaf,
  movePageLeaf,
  pastePageLeaf,
  placePageMenu,
  reorderPageLeaf,
} from "./pageOps.js";
import {
  acceptAreaUrl,
  areaItem,
  areaLinkOf,
  clampPageTarget,
  hasAreaLink,
  pickAreaAt,
  recentDocsForLink,
} from "./areaLink.js";
import {
  activateSplitTab,
  closeSplitTab,
  emptySplit,
  openSplitTab,
  splitAxis,
  splitTabFromLink,
} from "./split.js";
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
import { recentCardEntries } from "./recent.js";
import {
  ensureWritePermission,
  pickerOptions,
  supportsFileHandles,
  writeHandle,
} from "./fileHandle.js";
import {
  CHROMA_TOLERANCE,
  DEFAULT_FOLDER_ID,
  ERASER_RADIUS_CSS,
  addFolder,
  applyChroma,
  deleteFolder,
  deleteSticker,
  eraseCircle,
  makeSticker,
  moveSticker,
  normalizeAngle,
  normalizeFolders,
  normalizeStickers,
  REGION_HANDLES,
  STICKER_GAP,
  STICKER_THUMB,
  cornerScale,
  gridIndexAt,
  deleteRegionAt,
  moveRegion,
  pixelAt,
  regionHandleAt,
  regionPixelRect,
  resizeRegion,
  renameFolder,
  reorderStickers,
  rotatedSize,
  scaledSize,
  stickerFitSize,
  stickerSizeOnPage,
  stickersInFolder,
  topRegionAt,
  wholeImageRect,
} from "./stickers.js";
import { captureRegionPng, composePageRgba, cropRgba, encodePngRgba, writePngClipboard } from "./capture.js";
import {
  copyItems,
  copyItemsInRect,
  deleteItemsInRect,
  deleteSelectedItems,
  duplicateItemsInRect,
  itemBounds,
  offsetItems,
  pickItemsAt,
  pickItemsInRect,
  lockedImageAt,
  rotateHandleAt,
  selectedBounds,
  selectHudTop,
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
import { addRotation, angleDegFromCenter, imagePaintDest, normalizeRotation, rotateItems, rotateSelectedItems } from "./rotate.js";
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
  PAGE_BITMAP_LIMIT,
  PAGE_STACK_GAP,
  THUMB_REFRESH_MS,
  clampPreviewWidth,
  previewThumbSize,
  THUMB_BITMAP_LIMIT,
  createPaintCache,
  pageAtScrollMid,
  pageBitmapKey,
  pageStackOffset,
  previewListHeight,
  previewRowBody,
  previewRowStride,
  previewUpdateOnPageChange,
  scrollStackMetrics,
  thumbCacheKey,
  visiblePreviewRows,
  visibleScrollPages,
} from "./pageWindow.js";
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
  writeSplit: document.querySelector("#write-split"),
  splitPane: document.querySelector("#split-pane"),
  splitTabs: document.querySelector("#split-tabs"),
  splitStage: document.querySelector("#split-stage"),
  areaLayer: document.querySelector("#area-layer"),
  areaLinkPanel: document.querySelector("#area-link-panel"),
  areaLinkPage: document.querySelector("#area-link-page"),
  areaLinkPageGo: document.querySelector("#area-link-page-go"),
  areaLinkDocs: document.querySelector("#area-link-docs"),
  areaLinkUrl: document.querySelector("#area-link-url"),
  areaLinkUrlGo: document.querySelector("#area-link-url-go"),
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
  pageMenu: document.querySelector("#page-menu"),
  stickerSheet: document.querySelector("#sticker-sheet"),
  stickerBackdrop: document.querySelector("#sticker-backdrop"),
  stickerClose: document.querySelector("#sticker-close"),
  stickerDrop: document.querySelector("#sticker-drop"),
  stickerDropLabel: document.querySelector("#sticker-drop-label"),
  stickerFile: document.querySelector("#sticker-file"),
  stickerSource: document.querySelector("#sticker-source"),
  stickerCanvas: document.querySelector("#sticker-canvas"),
  stickerRegions: document.querySelector("#sticker-regions"),
  stickerMakeActions: document.querySelector("#sticker-make-actions"),
  stickerWhole: document.querySelector("#sticker-whole"),
  stickerCut: document.querySelector("#sticker-cut"),
  stickerFolders: document.querySelector("#sticker-folders"),
  stickerGrid: document.querySelector("#sticker-grid"),
  stickerStudio: document.querySelector("#sticker-studio"),
  stickerStudioCanvas: document.querySelector("#sticker-studio-canvas"),
  stickerStudioBox: document.querySelector("#sticker-studio-box"),
  stickerMenu: document.querySelector("#sticker-menu"),
  lockMenu: document.querySelector("#lock-menu"),
  stickerTools: document.querySelector("#sticker-tools"),
  stickerAngle: document.querySelector("#sticker-angle"),
  stickerSave: document.querySelector("#sticker-save"),
  stickerDelete: document.querySelector("#sticker-delete"),
  previewDrop: document.querySelector("#preview-drop"),
  previewClose: document.querySelector("#preview-close"),
  previewBtn: document.querySelector("#preview-btn"),
  previewGrip: document.querySelector("#preview-grip"),
  previewList: document.querySelector("#preview-list"),
  previewPages: document.querySelector("#preview-pages"),
  previewToc: document.querySelector("#preview-toc"),
  tocAdd: document.querySelector("#toc-add"),
  tocList: document.querySelector("#toc-list"),
  outlineInsert: document.querySelector("#outline-insert"),
  fullscreenItem: document.querySelector("#fullscreen-item"),
  marquee: document.querySelector("#marquee"),
  marqueeBox: document.querySelector("#marquee-box"),
  marqueeMenu: document.querySelector("#marquee-menu"),
  selectLayer: document.querySelector("#select-layer"),
  selectBox: document.querySelector("#select-box"),
  floatBar: document.querySelector("#float-bar"),
  selectHud: document.querySelector("#float-bar"),
  copyBtn: document.querySelector("#copy-btn"),
  pasteBtn: document.querySelector("#paste-btn"),
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
  previewWidth: loadPreviewWidth(),
  inkStamp: 0,
  previewTab: "pages",
  pageClip: null,
  fileHandle: null,
  stickers: [],
  stickerFolders: [],
  stickerFolder: DEFAULT_FOLDER_ID,
  stickerPick: null,
  stickerMenuAt: null,
  lockMenuAt: null,
  studioTool: "chroma",
  studioScale: 1,
  pageMenuAt: 0,
  selectIndices: [],
  selectPage: 1,
  selectDrag: null,
  inkClipboard: [],
  cropping: null,
  baseCss: { width: 0, height: 0 },
  eraseMode: loadEraser().mode,
  eraserWidth: loadEraser().width,
  pendingStamp: null,
  stampGhost: null,
  shapeOffer: null,
  userScale: 1,
  renderFactor: 1,
  panX: 0,
  panY: 0,
  pageCssWidth: 0,
  pageCssHeight: 0,
  stackBase: { width: 0, height: 0 },
  pageViews: [],
  scrollLayout: null,
  split: emptySplit(),
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
let renderGen = 0;
let paperScrollHold = null;
const pageCache = createPaintCache(PAGE_BITMAP_LIMIT);
const thumbCache = createPaintCache(THUMB_BITMAP_LIMIT);
const stagePool = [];

const WRITE_CHROME =
  ".sheet-card, .slot-panel, .toolbar, .write-top, .m4-bar, .more-panel, .marquee, .preview-drawer, .page-menu, .sticker-sheet, #lock-menu, #sticker-menu, .select-hud, .float-bar, #float-bar, .select-layer, #select-layer, .shape-chips, #area-link-panel, #split-tabs, #split-pane, #area-layer";

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

function clearStampGhost() {
  if (!state.stampGhost) {
    return;
  }
  const page = state.stampGhost.page;
  state.stampGhost = null;
  const view = state.pageViews.find((item) => item.pageNum === page);
  if (view) {
    drawStrokesOn(view);
  }
}

function showStampGhostAt(view, point) {
  if (!usesStamp() || state.interactMode === "view" || !view || !point) {
    clearStampGhost();
    return;
  }
  const prevPage = state.stampGhost?.page;
  const next = followStampGhost(state.stampGhost, point, activeSlot().stamp) || stampGhostItem(
    activeSlot().stamp,
    point.x,
    point.y,
    stampTilt(point.x, point.y),
  );
  next.tilt = stampTilt(point.x, point.y);
  next.page = view.pageNum;
  state.stampGhost = next;
  if (state.pendingStamp) {
    state.pendingStamp.point = point;
    state.pendingStamp.view = view;
  }
  if (prevPage && prevPage !== view.pageNum) {
    const prev = state.pageViews.find((item) => item.pageNum === prevPage);
    if (prev) {
      drawStrokesOn(prev);
    }
  }
  drawStrokesOn(view);
}

function trackStampGhost(event) {
  if (!usesStamp() || state.interactMode === "view") {
    clearStampGhost();
    return;
  }
  if (overlayOpen() || gesture || state.rectTool) {
    return;
  }
  const stage = event.target.closest(".page-stage");
  if (!stage) {
    if (!state.pendingStamp) {
      clearStampGhost();
    }
    return;
  }
  const ink = stage.querySelector(".ink-canvas");
  if (!ink) {
    return;
  }
  const view = state.pageViews.find((item) => item.stage === stage);
  showStampGhostAt(view, eventToNorm(event, ink));
}

function refreshStampGhostPhrase() {
  if (!usesStamp()) {
    clearStampGhost();
    return;
  }
  if (!state.stampGhost) {
    return;
  }
  state.stampGhost = {
    ...state.stampGhost,
    stamp: normalizeStamp(activeSlot().stamp),
  };
  const view = state.pageViews.find((item) => item.pageNum === state.stampGhost.page);
  if (view) {
    drawStrokesOn(view);
  }
}

function showBanner(message) {
  els.banner.hidden = !message;
  els.banner.textContent = message || "";
}

let viewNoticeAt = null;

function noticeViewMode() {
  const now = performance.now();
  if (!shouldNoticeViewMode({
    interactMode: state.interactMode,
    tool: state.tool,
    rectTool: state.rectTool,
    now,
    lastAt: viewNoticeAt,
  })) {
    return;
  }
  viewNoticeAt = now;
  showBanner(VIEW_NOTICE_TEXT);
  window.setTimeout(() => {
    if (els.banner.textContent === VIEW_NOTICE_TEXT) {
      showBanner("");
    }
  }, VIEW_NOTICE_MS);
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
  refreshPageThumb(pageNum);
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
  state.scrollLayout = null;
  pageCache.clear();
  thumbCache.clear();
  stagePool.length = 0;
  hideMarquee();
  hideSelectUi();
  closePreview();
  state.split = emptySplit();
  syncSplitUi();
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
      handle: state.fileHandle,
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
  if (state.stampGhost && view.pageNum === state.stampGhost.page) {
    paintStamp(ctx, state.stampGhost, scale, canvas);
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
    const factor = state.renderFactor;
    applyPageSize(
      view,
      css.width,
      css.height,
      Math.round(css.width * dpr * factor),
      Math.round(css.height * dpr * factor),
    );
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
    const outlineScale = dpr * state.renderFactor;
    ctx.font = `700 ${18 * outlineScale}px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
    ctx.fillText(leaf?.title || "개요", view.pdfCanvas.width / 2, 36 * outlineScale);
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
  // Zoomed pages are rendered sharper, not stretched (#96).
  const pixel = page.getViewport({ scale: scale * dpr * state.renderFactor, rotation });
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

function snapshotCanvas(source) {
  if (!source?.width || !source.height) {
    return null;
  }
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  const ctx = copy.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.drawImage(source, 0, 0);
  return copy;
}

function pageViewCacheKey(view) {
  const leaf = leafAt(state.leaves, view?.pageNum);
  return pageBitmapKey(leaf, {
    cssWidth: view?.cssWidth || state.scrollLayout?.pageWidth || state.pageCssWidth,
    cssHeight: view?.cssHeight || state.scrollLayout?.pageHeight || state.pageCssHeight,
    viewMode: state.viewMode,
    factor: state.renderFactor,
  });
}

function cachePageView(view) {
  if (!view?.rendered || !view.pdfCanvas?.width) {
    return;
  }
  const bitmap = snapshotCanvas(view.pdfCanvas);
  if (!bitmap) {
    return;
  }
  pageCache.set(pageViewCacheKey(view), {
    cssWidth: view.cssWidth,
    cssHeight: view.cssHeight,
    pixelWidth: view.pdfCanvas.width,
    pixelHeight: view.pdfCanvas.height,
    bitmap,
  });
}

function restorePageBitmap(view, entry) {
  if (!view || !entry?.bitmap) {
    return false;
  }
  applyPageSize(view, entry.cssWidth, entry.cssHeight, entry.pixelWidth, entry.pixelHeight);
  const ctx = canvas2d(view.pdfCanvas);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, view.pdfCanvas.width, view.pdfCanvas.height);
  ctx.drawImage(entry.bitmap, 0, 0);
  if (state.viewMode === "page" || view.pageNum === state.page) {
    state.pageCssWidth = entry.cssWidth;
    state.pageCssHeight = entry.cssHeight;
  }
  view.rendered = true;
  return true;
}

function acquireStage(pageNum) {
  const pooled = stagePool.pop();
  if (!pooled) {
    return makeStage(pageNum);
  }
  pooled.pageNum = pageNum;
  pooled.stage.dataset.page = String(pageNum);
  pooled.rendered = false;
  pooled.token += 1;
  return pooled;
}

function releaseStage(view) {
  if (!view) {
    return;
  }
  cachePageView(view);
  view.stage.remove();
  if (stagePool.length < 8) {
    stagePool.push(view);
  }
}

function resetPageStackChrome() {
  els.pageStack.classList.remove("is-windowed");
  els.pageStack.style.width = "";
  els.pageStack.style.height = "";
}

function positionScrollStage(view) {
  const metrics = state.scrollLayout;
  if (!metrics || !view) {
    return;
  }
  view.stage.style.position = "absolute";
  view.stage.style.top = `${pageStackOffset(view.pageNum, metrics)}px`;
  view.stage.style.left = "50%";
  view.stage.style.marginLeft = `${-metrics.pageWidth / 2}px`;
  if (!view.cssWidth) {
    view.stage.style.width = `${metrics.pageWidth}px`;
    view.stage.style.height = `${metrics.pageHeight}px`;
  }
}

/** Scroll padding that keeps the paper clear of the bar (#94). */
function scrollPadPx() {
  return state.viewMode === "scroll" ? PAN_MARGIN_PX : 0;
}

/** A rail leaves side room in scroll view: start centred, let the reader slide. */
function centerScrollX() {
  if (state.viewMode !== "scroll") {
    return;
  }
  const room = els.workspace.scrollWidth - els.workspace.clientWidth;
  if (room > 0) {
    els.workspace.scrollLeft = Math.round(room / 2);
  }
}

function visiblePageRange() {
  if (state.viewMode !== "scroll") {
    return { from: state.page, to: state.page };
  }
  if (state.scrollLayout?.count) {
    return visibleScrollPages({
      scrollTop: els.workspace.scrollTop,
      viewportHeight: els.workspace.clientHeight,
      scale: state.userScale,
      metrics: state.scrollLayout,
      currentPage: state.page,
      offset: scrollPadPx(),
    });
  }
  return { from: state.page, to: state.page };
}

async function renderVisiblePages() {
  await syncScrollWindow();
  const jobs = [];
  for (const view of state.pageViews) {
    if (view.rendered) {
      continue;
    }
    const cached = pageCache.get(pageViewCacheKey(view));
    if (cached && restorePageBitmap(view, cached)) {
      drawStrokesOn(view, state.drawing && state.drawPage === view.pageNum ? state.currentStroke : null);
      continue;
    }
    jobs.push(renderPageView(view).then(() => cachePageView(view)));
  }
  await Promise.all(jobs);
}

async function syncScrollWindow() {
  if (state.viewMode !== "scroll" || !state.scrollLayout?.count) {
    return;
  }
  const range = visiblePageRange();
  const keep = new Set();
  for (let page = range.from; page <= range.to; page += 1) {
    keep.add(page);
  }
  keep.add(state.page);
  if (state.drawPage) {
    keep.add(state.drawPage);
  }
  const next = [];
  for (const view of state.pageViews) {
    if (keep.has(view.pageNum)) {
      positionScrollStage(view);
      next.push(view);
      keep.delete(view.pageNum);
    } else {
      releaseStage(view);
    }
  }
  for (const pageNum of [...keep].sort((a, b) => a - b)) {
    if (pageNum < 1 || pageNum > state.scrollLayout.count) {
      continue;
    }
    const view = acquireStage(pageNum);
    positionScrollStage(view);
    els.pageStack.append(view.stage);
    const cached = pageCache.get(pageViewCacheKey(view));
    if (cached) {
      restorePageBitmap(view, cached);
      drawStrokesOn(view);
    }
    next.push(view);
  }
  state.pageViews = next;
}

function updateCurrentPageFromScroll() {
  if (state.viewMode !== "scroll" || !state.scrollLayout?.count) {
    return;
  }
  const best = pageAtScrollMid({
    scrollTop: els.workspace.scrollTop,
    viewportHeight: els.workspace.clientHeight,
    scale: state.userScale,
    metrics: state.scrollLayout,
    offset: scrollPadPx(),
  });
  if (best !== state.page) {
    state.page = best;
    updatePager();
    persistSession();
    applyPreviewAfterPageChange();
  }
}

function measureStackBase() {
  if (state.scrollLayout) {
    state.stackBase = { width: state.scrollLayout.width, height: state.scrollLayout.height };
    return;
  }
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

/** The step the visible page should be rendered at for the current zoom (#96). */
function wantedRenderFactor() {
  const dpr = window.devicePixelRatio || 1;
  const view = state.pageViews.find((item) => item.pageNum === state.page) || state.pageViews[0];
  const cssW = view?.cssWidth || state.pageCssWidth || 360;
  const cssH = view?.cssHeight || state.pageCssHeight || 520;
  return renderZoomFactor(state.userScale, cssW * dpr, cssH * dpr);
}

let zoomRenderTimer = 0;

/** Repaints after the pinch settles, so a live pinch stays cheap. */
function scheduleZoomRender() {
  window.clearTimeout(zoomRenderTimer);
  zoomRenderTimer = window.setTimeout(() => {
    zoomRenderTimer = 0;
    const next = wantedRenderFactor();
    if (next === state.renderFactor || !state.pdf) {
      return;
    }
    state.renderFactor = next;
    // Bitmaps rendered at the old step are dead weight, and the new ones are big.
    pageCache.clear();
    for (const view of state.pageViews) {
      view.rendered = false;
      view.token += 1;
    }
    renderVisiblePages();
  }, 180);
}

async function rebuildPages() {
  const gen = ++renderGen;
  stagePool.length = 0;
  state.pageViews = [];
  els.pageStack.replaceChildren();
  resetPageStackChrome();
  state.scrollLayout = null;
  if (!state.pdf && !state.leaves.length) {
    return;
  }
  state.pageCount = state.leaves.length;

  if (state.viewMode === "page") {
    const view = makeStage(state.page);
    state.pageViews = [view];
    els.pageStack.append(view.stage);
    const cached = pageCache.get(pageViewCacheKey(view));
    if (cached && restorePageBitmap(view, cached)) {
      drawStrokesOn(view);
    } else {
      await renderPageView(view);
      cachePageView(view);
    }
  } else {
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
    state.scrollLayout = scrollStackMetrics(state.leaves.length, css.width, css.height, PAGE_STACK_GAP);
    els.pageStack.classList.add("is-windowed");
    els.pageStack.style.width = `${state.scrollLayout.width}px`;
    els.pageStack.style.height = `${state.scrollLayout.height}px`;
    await syncScrollWindow();
    await renderVisiblePages();
    scrollPageIntoView(state.page, false);
  }
  if (gen !== renderGen) {
    return;
  }
  applyViewport();
  updatePager();
  updateMarquee();
  updateAreaHits();
  if (state.split?.tabs?.length) {
    renderSplitStage();
  }
}

function scrollPageIntoView(pageNum, smooth) {
  const metrics = state.scrollLayout;
  if (metrics) {
    const top = pageStackOffset(pageNum, metrics) * state.userScale - 12 + scrollPadPx();
    els.workspace.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
    return;
  }
  const view = state.pageViews.find((item) => item.pageNum === pageNum);
  if (!view) {
    return;
  }
  const top = view.stage.offsetTop * state.userScale - 12 + scrollPadPx();
  els.workspace.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
}

async function showPageInPlace(pageNum) {
  let view = state.pageViews.find((item) => item.pageNum === pageNum) || state.pageViews[0];
  if (!view) {
    view = makeStage(pageNum);
    state.pageViews = [view];
    els.pageStack.replaceChildren(view.stage);
  }
  if (view.pageNum !== pageNum) {
    cachePageView(view);
    view.token += 1;
    view.pageNum = pageNum;
    view.stage.dataset.page = String(pageNum);
    view.rendered = false;
  }
  const cached = pageCache.get(pageViewCacheKey(view));
  if (cached && restorePageBitmap(view, cached)) {
    drawStrokesOn(view, state.drawing && state.drawPage === view.pageNum ? state.currentStroke : null);
    updateMarquee();
    updateAreaHits();
    return;
  }
  await renderPageView(view);
  cachePageView(view);
  updateMarquee();
  updateAreaHits();
}

function applyPreviewAfterPageChange() {
  const plan = previewUpdateOnPageChange({
    drawerOpen: Boolean(els.previewDrawer && !els.previewDrawer.hidden),
    tab: state.previewTab,
    listBuilt: Boolean(els.previewList?.querySelector(".preview-list-window")),
  });
  if (plan.rebuildList) {
    renderPreview();
    return;
  }
  if (plan.moveCurrent) {
    syncPreviewCurrent({ paintVisible: plan.paintVisible });
  }
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
  for (const entry of recentCardEntries(rows)) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recent-card";
    const title = document.createElement("span");
    title.className = "recent-card-name";
    title.textContent = entry.title;
    button.append(title);
    if (entry.note) {
      const note = document.createElement("span");
      note.className = "recent-card-note";
      note.textContent = entry.note;
      button.append(note);
    }
    button.addEventListener("click", () => openStoredDocument(entry.identity));
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
      handle: row.handle || null,
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

async function openPdfBuffer(buffer, { identity, name, page = 1, handle = null }) {
  // Always replace: a handle from the previous file must never write this one.
  state.fileHandle = handle;
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
  state.renderFactor = 1;
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

async function openSelectedFile(file, handle = null) {
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
      handle,
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
    await showPageInPlace(nextPage);
    applyViewport();
    updatePager();
  } else {
    await syncScrollWindow();
    scrollPageIntoView(nextPage, true);
    updatePager();
    await renderVisiblePages();
  }
  await persistSession();
  applyPreviewAfterPageChange();
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
    !els.stickerSheet.hidden
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
  clearStampGhost();
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
    noticeViewMode();
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
    showStampGhostAt(view, point);
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
    const view = state.pendingStamp.view || state.pageViews.find((item) => item.pageNum === state.drawPage);
    if (event.type !== "pointercancel") {
      const ink = state.drawCanvas || view?.inkCanvas;
      if (ink && view) {
        showStampGhostAt(view, eventToNorm(event, ink));
      }
      const place = stampPlaceFromGhost(state.stampGhost) || state.pendingStamp.point;
      if (view && place) {
        placeStamp(view, place);
      }
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

async function pickFile() {
  if (!pickerAllowed() || !dropzoneGesture) {
    return;
  }
  dropzoneGesture = false;
  // Chrome hands back a handle, so 저장 can write the original file (#82).
  if (supportsFileHandles(window)) {
    try {
      const [handle] = await window.showOpenFilePicker(pickerOptions());
      if (!handle) {
        return;
      }
      const file = await handle.getFile();
      await openSelectedFile(file, handle);
      return;
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
      // Fall through to the plain input (sandboxed frames, older builds).
    }
  }
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
  if (!usesStamp()) {
    state.pendingStamp = null;
    clearStampGhost();
  }
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
  if (isRail(state.toolbarPos)) {
    const room = Math.min(window.innerHeight - 16, els.toolbarRail?.clientHeight || window.innerHeight);
    els.toolbar.classList.toggle("is-narrow", useNarrowRail(room));
    return;
  }
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
  hidePageMenu();
  if (!els.previewDrawer) {
    return;
  }
  els.previewDrawer.hidden = true;
  syncPreviewButton();
}

function hideSelectUi() {
  if (!els.selectLayer) {
    return;
  }
  els.selectLayer.hidden = true;
  els.selectLayer.classList.remove("is-rotating", "is-cropping");
  if (els.selectBox) {
    els.selectBox.style.transform = "none";
  }
  if (els.floatBar) {
    els.floatBar.hidden = true;
  }
}

function closeAllPanels() {
  closeSlotPanel();
  closeEraserPanel();
  closeMorePanel();
  hidePageMenu();
  hideLockMenu();
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
  if (isRail(state.toolbarPos)) {
    // A rail opens the palette beside itself, level with the cell (#49).
    left = state.toolbarPos === "left" ? bar.right + gap : bar.left - gap - width;
    top = anchor.top + anchor.height / 2 - height / 2;
  } else if (state.toolbarPos === "bottom" || (state.toolbarPos === "float" && bar.top > window.innerHeight / 2)) {
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
  refreshStampGhostPhrase();
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
  state.toolbarPos = normalizeDock(position, "top");
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
  centerScrollX();
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
  state.renderFactor = 1;
  applyChrome();
  if (state.pdf) {
    await rebuildPages();
  }
  centerScrollX();
}

function setZoomLock(on) {
  state.zoomLock = Boolean(on);
  saveZoomLock(state.zoomLock);
  syncZoomLock();
}

function setInteractMode(mode) {
  state.interactMode = mode === "view" ? "view" : "edit";
  saveInteractMode(state.interactMode);
  hideLockMenu();
  viewNoticeAt = null;
  if (state.interactMode === "edit" && els.banner.textContent === VIEW_NOTICE_TEXT) {
    showBanner("");
  }
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

function placeSelectBox(view, rect, angle = 0) {
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
  els.selectBox.style.transformOrigin = "50% 50%";
  els.selectBox.style.transform = angle ? `rotate(${angle}deg)` : "none";
}

function placeSelectHud(view, rect) {
  if (!els.floatBar) {
    return;
  }
  els.floatBar.hidden = false;
  const width = els.floatBar.offsetWidth || 220;
  const height = els.floatBar.offsetHeight || 56;
  let left = 12;
  let selection = { top: 56 - height - 8, bottom: 56 - 8 };
  if (view && rect) {
    const box = view.stage.getBoundingClientRect();
    left = box.left + rect.x * box.width;
    selection = {
      top: box.top + rect.y * box.height,
      bottom: box.top + (rect.y + rect.h) * box.height,
    };
  }
  const spot = selectHudTop(selection, height, window.innerHeight);
  els.floatBar.style.left = `${Math.min(window.innerWidth - width - 8, Math.max(8, left))}px`;
  els.floatBar.style.top = `${Math.round(spot.top)}px`;
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
  if (els.deleteBtn) {
    els.deleteBtn.hidden = cropping;
  }
  const stamp = selectedStampItem();
  const rotating = state.selectDrag?.mode === "rotate";
  els.selectLayer.classList.toggle("is-image", Boolean(image) && !cropping);
  els.selectLayer.classList.toggle("is-stamp", Boolean(stamp) && !cropping);
  els.selectLayer.classList.toggle("is-cropping", cropping);
  els.selectLayer.classList.toggle("is-rotating", rotating);
  if (cropping) {
    const rect = rectFromPoints(state.cropping.a, state.cropping.b);
    placeSelectBox(view, rect);
    placeSelectHud(view, rect);
    return;
  }
  const cssW = view?.cssWidth || 400;
  const cssH = view?.cssHeight || 600;
  const bounds = rotating
    ? state.selectDrag.originBounds
    : selectedBounds(items, state.selectIndices, cssW, cssH);
  if (!bounds) {
    hideSelectUi();
    return;
  }
  els.selectLayer.hidden = false;
  els.floatBar.hidden = false;
  if (view) {
    placeSelectBox(view, bounds, rotating ? state.selectDrag.angle : 0);
  }
  placeSelectHud(view, bounds);
}

function hideMarqueeMenu() {
  if (els.marqueeMenu) {
    els.marqueeMenu.hidden = true;
  }
}

function hideAreaLinkPanel() {
  if (els.areaLinkPanel) {
    els.areaLinkPanel.hidden = true;
  }
}

function hideMarquee() {
  state.currentRect = null;
  state.pendingCapture = null;
  els.marquee.hidden = true;
  hideMarqueeMenu();
  hideAreaLinkPanel();
  updateAreaHits();
}

function sameNormRect(a, b) {
  return (
    Math.abs(Number(a?.x) - Number(b?.x)) < 1e-6 &&
    Math.abs(Number(a?.y) - Number(b?.y)) < 1e-6 &&
    Math.abs(Number(a?.w) - Number(b?.w)) < 1e-6 &&
    Math.abs(Number(a?.h) - Number(b?.h)) < 1e-6
  );
}

function noteViewSize() {
  const box = els.writeScreen?.getBoundingClientRect();
  return { width: box?.width || window.innerWidth, height: box?.height || window.innerHeight };
}

function applySplitChange(next) {
  const had = (state.split?.tabs?.length || 0) > 0;
  state.split = next;
  syncSplitUi();
  const has = (state.split?.tabs?.length || 0) > 0;
  if (state.pdf && had !== has && !state.drawing) {
    rebuildPages().then(() => {
      if (state.split?.tabs?.length) {
        renderSplitStage();
      }
    });
  }
}

function syncSplitUi() {
  if (!els.writeSplit || !els.splitPane || !els.splitTabs) {
    return;
  }
  const size = noteViewSize();
  const axis = splitAxis(size.width, size.height);
  const tabs = state.split?.tabs ?? [];
  if (tabs.length) {
    state.split = { ...state.split, axis };
    els.writeSplit.classList.add("is-open");
    els.writeSplit.classList.toggle("axis-tb", axis === "tb");
    els.writeSplit.classList.toggle("axis-lr", axis === "lr");
    els.splitPane.hidden = false;
  } else {
    state.split = emptySplit();
    els.writeSplit.classList.remove("is-open", "axis-tb", "axis-lr");
    els.splitPane.hidden = true;
    els.splitTabs.replaceChildren();
    els.splitStage?.replaceChildren();
    return;
  }
  els.splitTabs.replaceChildren();
  for (const tab of tabs) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "split-tab";
    btn.classList.toggle("is-active", tab.id === state.split.active);
    const title = document.createElement("span");
    title.textContent = tab.title;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "split-tab-close";
    close.textContent = "x";
    close.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      applySplitChange(closeSplitTab(state.split, tab.id));
    });
    btn.append(title, close);
    btn.addEventListener("click", () => {
      applySplitChange(activateSplitTab(state.split, tab.id));
      renderSplitStage();
    });
    els.splitTabs.append(btn);
  }
  renderSplitStage();
}

async function renderSplitPdfPage(pdf, pdfPageNum) {
  if (!pdf || !els.splitStage) {
    return;
  }
  const page = await pdf.getPage(pdfPageNum);
  const canvas = document.createElement("canvas");
  const box = els.splitStage.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const unscaled = page.getViewport({ scale: 1 });
  const fit = Math.min(
    Math.max(48, box.width || 240) / unscaled.width,
    Math.max(48, box.height || 240) / unscaled.height,
  );
  const css = page.getViewport({ scale: fit });
  const pixel = page.getViewport({ scale: fit * dpr });
  canvas.width = pixel.width;
  canvas.height = pixel.height;
  canvas.style.width = `${css.width}px`;
  canvas.style.height = `${css.height}px`;
  await page.render({ canvasContext: canvas.getContext("2d"), viewport: pixel }).promise;
  els.splitStage.replaceChildren(canvas);
}

async function renderSplitStage() {
  if (!els.splitStage) {
    return;
  }
  const tab = (state.split?.tabs ?? []).find((item) => item.id === state.split.active);
  els.splitStage.replaceChildren();
  if (!tab) {
    return;
  }
  if (tab.kind === "url") {
    const frame = document.createElement("iframe");
    frame.src = tab.href;
    frame.title = tab.title;
    frame.referrerPolicy = "no-referrer";
    els.splitStage.append(frame);
    return;
  }
  if (tab.kind === "page") {
    const leaf = leafAt(state.leaves, tab.page);
    if (!leaf || leaf.kind === "outline" || !state.pdf) {
      const note = document.createElement("p");
      note.textContent = leaf?.title || `${tab.page}쪽`;
      els.splitStage.append(note);
      return;
    }
    try {
      await renderSplitPdfPage(state.pdf, leaf.pdfPage);
    } catch {
      const note = document.createElement("p");
      note.textContent = `${tab.page}쪽을 열 수 없습니다.`;
      els.splitStage.append(note);
    }
    return;
  }
  if (tab.kind === "doc") {
    if (!tab.identity) {
      const note = document.createElement("p");
      note.textContent = `${tab.name}을(를) 다시 열어 주세요.`;
      els.splitStage.append(note);
      return;
    }
    try {
      const row = await loadDocument(tab.identity);
      if (!row?.buffer) {
        throw new Error("missing");
      }
      const other = await pdfjsLib.getDocument({ data: row.buffer }).promise;
      await renderSplitPdfPage(other, 1);
      other.destroy();
    } catch {
      const note = document.createElement("p");
      note.textContent = `${tab.name}을(를) 다시 열어 주세요.`;
      els.splitStage.append(note);
    }
  }
}

function openAreaLink(link) {
  const tab = splitTabFromLink(link);
  if (!tab) {
    return;
  }
  const size = noteViewSize();
  applySplitChange(openSplitTab(state.split, tab, splitAxis(size.width, size.height)));
}

function pendingLink() {
  return areaLinkOf(state.pendingCapture);
}

function openPendingOrHitLink() {
  const fromPending = pendingLink();
  if (fromPending) {
    openAreaLink(fromPending);
    return;
  }
  if (!state.pendingCapture) {
    return;
  }
  const hit = pickAreaAt(pageStrokes(state.pendingCapture.page), state.pendingCapture.rect.x + state.pendingCapture.rect.w / 2, state.pendingCapture.rect.y + state.pendingCapture.rect.h / 2);
  if (hit) {
    openAreaLink(areaLinkOf(hit));
  }
}

function saveAreaLink(link) {
  const ctx = regionView();
  const item = ctx ? areaItem(ctx.pending.rect, link) : null;
  if (!ctx || !item || state.interactMode === "view") {
    return;
  }
  commitPageChange(ctx.pending.page, () => {
    const items = pageStrokes(ctx.pending.page);
    const index = items.findIndex((row) => row?.type === "area" && sameNormRect(row, item));
    if (index >= 0) {
      items[index] = item;
    } else {
      items.push(item);
    }
  });
  state.pendingCapture = { ...ctx.pending, link: item.link };
  hideAreaLinkPanel();
  hideMarqueeMenu();
  updateAreaHits();
}

function placeAreaLinkPanel() {
  if (!els.areaLinkPanel || els.areaLinkPanel.hidden || !state.pendingCapture) {
    return;
  }
  const box = els.marqueeBox.getBoundingClientRect();
  const size = noteViewSize();
  const width = els.areaLinkPanel.offsetWidth || 280;
  const height = els.areaLinkPanel.offsetHeight || 220;
  let left = box.left;
  let top = box.bottom + 8;
  left = Math.min(Math.max(8, left), Math.max(8, size.width - width - 8));
  if (top + height > size.height - 8) {
    top = Math.max(8, box.top - 8 - height);
  }
  els.areaLinkPanel.style.left = `${left}px`;
  els.areaLinkPanel.style.top = `${top}px`;
}

async function showAreaLinkPanel() {
  if (!state.pendingCapture || !els.areaLinkPanel) {
    return;
  }
  hideMarqueeMenu();
  els.areaLinkPanel.hidden = false;
  if (els.areaLinkPage) {
    els.areaLinkPage.max = String(Math.max(1, state.pageCount));
    els.areaLinkPage.value = String(clampPageTarget(state.page, state.pageCount));
  }
  if (els.areaLinkUrl) {
    els.areaLinkUrl.value = "";
  }
  await renderAreaLinkDocs();
  placeAreaLinkPanel();
}

async function renderAreaLinkDocs() {
  if (!els.areaLinkDocs) {
    return;
  }
  let rows = [];
  try {
    rows = await listDocuments();
  } catch {
    rows = [];
  }
  const list = recentDocsForLink(
    rows.map((row) => ({ name: row.name, at: row.openedAt || 0, identity: row.identity })),
    state.fileName,
  );
  els.areaLinkDocs.replaceChildren();
  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "area-link-empty";
    empty.textContent = "최근 다른 PDF가 없습니다";
    els.areaLinkDocs.append(empty);
    return;
  }
  for (const row of list) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = displayName(row.name);
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      saveAreaLink({ kind: "doc", name: row.name, identity: row.identity });
    });
    els.areaLinkDocs.append(btn);
  }
}

function updateAreaHits() {
  if (!els.areaLayer) {
    return;
  }
  els.areaLayer.replaceChildren();
  let any = false;
  for (const view of state.pageViews || []) {
    const stage = view.stage?.getBoundingClientRect();
    if (!stage) {
      continue;
    }
    for (const item of pageStrokes(view.pageNum)) {
      if (item?.type !== "area" || !hasAreaLink(item)) {
        continue;
      }
      if (
        state.pendingCapture &&
        state.pendingCapture.page === view.pageNum &&
        sameNormRect(state.pendingCapture.rect, item)
      ) {
        continue;
      }
      const hit = document.createElement("div");
      hit.className = "area-hit";
      hit.style.left = `${stage.left + item.x * stage.width}px`;
      hit.style.top = `${stage.top + item.y * stage.height}px`;
      hit.style.width = `${Math.max(1, item.w * stage.width)}px`;
      hit.style.height = `${Math.max(1, item.h * stage.height)}px`;
      bindMarqueeHold(hit, {
        onHold: () => {
          state.pendingCapture = { page: view.pageNum, rect: { x: item.x, y: item.y, w: item.w, h: item.h }, link: item.link };
          hideAreaLinkPanel();
          updateMarquee();
          showMarqueeMenu();
        },
        onTap: () => {
          openAreaLink(areaLinkOf(item));
        },
      });
      els.areaLayer.append(hit);
      any = true;
    }
  }
  els.areaLayer.hidden = !any;
}

function placeMarqueeMenuUi() {
  if (!els.marqueeMenu || els.marqueeMenu.hidden || !state.pendingCapture) {
    return;
  }
  const box = els.marqueeBox.getBoundingClientRect();
  const view = state.pageViews.find((item) => item.pageNum === state.pendingCapture.page);
  const paper = view?.stage.getBoundingClientRect() || {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
  const pos = placeMarqueeMenu(box, paper, els.marqueeMenu.offsetWidth || 360);
  els.marqueeMenu.style.left = `${pos.left}px`;
  els.marqueeMenu.style.top = `${pos.top}px`;
}

function showMarqueeMenu() {
  if (!state.pendingCapture || !els.marqueeMenu) {
    return;
  }
  els.marqueeMenu.hidden = false;
  placeMarqueeMenuUi();
}

function updateMarquee() {
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
  if (!els.marqueeMenu.hidden) {
    placeMarqueeMenuUi();
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
  hideMarqueeMenu();
  state.currentRect = { page: state.drawPage, a: point, b: point };
  updateMarquee();
}

function moveRect(event) {
  if (!state.currentRect || !state.drawCanvas) {
    return;
  }
  event.preventDefault();
  state.currentRect.b = eventToNorm(event, state.drawCanvas);
  updateMarquee();
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
    hideMarqueeMenu();
    updateMarquee();
  }
}

/* ---- 고정한 이미지 풀기 (#104) ---- */

let lockHoldTimer = 0;

function hideLockMenu() {
  if (els.lockMenu) {
    els.lockMenu.hidden = true;
  }
  state.lockMenuAt = null;
}

function cancelLockHold() {
  window.clearTimeout(lockHoldTimer);
  lockHoldTimer = 0;
}

/** Select tool only: a locked image has no other way back (#104). */
function armLockHold(event, point, items, cssW, cssH) {
  cancelLockHold();
  if (state.tool !== "select" || state.interactMode === "view") {
    return;
  }
  const index = lockedImageAt(items, point, cssW, cssH);
  if (index < 0) {
    return;
  }
  const page = state.drawPage;
  const at = { x: event.clientX, y: event.clientY };
  lockHoldTimer = window.setTimeout(() => {
    lockHoldTimer = 0;
    openLockMenu(page, index, at);
  }, PAGE_HOLD_MS);
}

function openLockMenu(page, index, at) {
  if (!els.lockMenu) {
    return;
  }
  state.lockMenuAt = { page, index };
  els.lockMenu.hidden = false;
  const width = 140;
  els.lockMenu.style.left = `${Math.min(window.innerWidth - width - 8, Math.max(8, at.x))}px`;
  els.lockMenu.style.top = `${Math.min(window.innerHeight - 52, Math.max(8, at.y))}px`;
}

function unlockFromMenu() {
  const spot = state.lockMenuAt;
  hideLockMenu();
  if (!spot) {
    return;
  }
  const item = pageStrokes(spot.page)[spot.index];
  if (item?.type !== "image" || !item.locked) {
    return;
  }
  commitPageChange(spot.page, () => {
    pageStrokes(spot.page)[spot.index] = lockImage(item, false);
    state.selectIndices = [spot.index];
    state.selectPage = spot.page;
  });
  const view = state.pageViews.find((entry) => entry.pageNum === spot.page);
  if (view) {
    drawStrokesOn(view);
  }
  syncSelectHud();
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

  armLockHold(event, point, items, cssW, cssH);

  if (state.cropping) {
    state.selectDrag = { mode: "crop", page: state.drawPage, a: point, b: point };
    state.cropping = { ...state.cropping, page: state.drawPage, a: point, b: point };
    syncSelectHud();
    return;
  }

  if (!state.cropping && state.selectIndices.length && state.selectPage === state.drawPage) {
    const bounds = selectedBounds(items, state.selectIndices, cssW, cssH);
    if (bounds && rotateHandleAt(bounds, point, cssW, cssH)) {
      state.selectDrag = makeRotateDrag(point, items, bounds, cssW, cssH, state.drawPage);
      syncSelectHud();
      return;
    }
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
  cancelLockHold();
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
    updateMarquee();
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
  } else if (drag.mode === "rotate") {
    const viewNow = state.pageViews.find((item) => item.pageNum === drag.page);
    const cssW = viewNow?.cssWidth || 400;
    const cssH = viewNow?.cssHeight || 600;
    const delta = angleDegFromCenter(drag.center, point, cssW, cssH) - drag.startAngle;
    drag.angle = delta;
    state.pages[key] = rotateSelectedItems(drag.origin, drag.indices, delta, drag.center, cssW, cssH);
  }
  const view = state.pageViews.find((item) => item.pageNum === drag.page);
  if (view) {
    drawStrokesOn(view);
  }
  syncSelectHud();
}

function endSelect(event) {
  cancelLockHold();
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

function makeRotateDrag(point, items, bounds, cssW, cssH, pageNum) {
  const center = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
  return {
    mode: "rotate",
    page: pageNum,
    start: point,
    origin: cloneItems(items),
    indices: [...state.selectIndices],
    center,
    originBounds: bounds,
    startAngle: angleDegFromCenter(center, point, cssW, cssH),
    angle: 0,
  };
}

function beginRotateFromHandle(event) {
  if (state.interactMode === "view" || state.cropping || !state.selectIndices.length) {
    return false;
  }
  const pageNum = state.selectPage || state.page;
  const view = state.pageViews.find((item) => item.pageNum === pageNum);
  const ink = view?.inkCanvas || view?.stage?.querySelector(".ink-canvas");
  if (!ink || !view) {
    return false;
  }
  const items = pageStrokes(pageNum);
  const cssW = view.cssWidth || 400;
  const cssH = view.cssHeight || 600;
  const bounds = selectedBounds(items, state.selectIndices, cssW, cssH);
  if (!bounds) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  try {
    ink.setPointerCapture(event.pointerId);
  } catch {
    try {
      els.workspace.setPointerCapture(event.pointerId);
    } catch {
      // optional
    }
  }
  const point = eventToNorm(event, ink);
  state.drawPage = pageNum;
  state.drawCanvas = ink;
  state.selectPage = pageNum;
  state.selectDrag = makeRotateDrag(point, items, bounds, cssW, cssH, pageNum);
  const onRotateDocMove = (moveEvent) => {
    if (state.selectDrag?.mode === "rotate") {
      moveSelect(moveEvent);
    }
  };
  const onRotateDocUp = (upEvent) => {
    document.removeEventListener("pointermove", onRotateDocMove);
    document.removeEventListener("pointerup", onRotateDocUp);
    document.removeEventListener("pointercancel", onRotateDocUp);
    if (state.selectDrag?.mode === "rotate") {
      endSelect(upEvent);
    }
  };
  document.addEventListener("pointermove", onRotateDocMove);
  document.addEventListener("pointerup", onRotateDocUp);
  document.addEventListener("pointercancel", onRotateDocUp);
  syncSelectHud();
  return true;
}

function regionView() {
  const pending = state.pendingCapture;
  if (!pending) {
    return null;
  }
  const view = state.pageViews.find((item) => item.pageNum === pending.page);
  return {
    pending,
    view,
    cssW: view?.cssWidth || 400,
    cssH: view?.cssHeight || 600,
    items: pageStrokes(pending.page),
  };
}

function redrawRegionPage(pageNum) {
  const view = state.pageViews.find((item) => item.pageNum === pageNum);
  if (view) {
    drawStrokesOn(view);
  }
}

function copyRegion() {
  const ctx = regionView();
  if (!ctx) {
    return;
  }
  state.inkClipboard = copyItemsInRect(ctx.items, ctx.pending.rect, ctx.cssW, ctx.cssH);
  hideMarqueeMenu();
}

function duplicateRegion() {
  const ctx = regionView();
  if (!ctx || state.interactMode === "view") {
    return;
  }
  const next = duplicateItemsInRect(ctx.items, ctx.pending.rect, ctx.cssW, ctx.cssH);
  if (next.length === ctx.items.length) {
    hideMarqueeMenu();
    return;
  }
  commitPageChange(ctx.pending.page, () => {
    state.pages[inkKey(leafAt(state.leaves, ctx.pending.page))] = next;
  });
  redrawRegionPage(ctx.pending.page);
  hideMarqueeMenu();
}

function deleteRegion() {
  const ctx = regionView();
  if (!ctx || state.interactMode === "view") {
    return;
  }
  const next = deleteItemsInRect(ctx.items, ctx.pending.rect, ctx.cssW, ctx.cssH);
  if (JSON.stringify(next) === JSON.stringify(ctx.items)) {
    hideMarqueeMenu();
    return;
  }
  commitPageChange(ctx.pending.page, () => {
    state.pages[inkKey(leafAt(state.leaves, ctx.pending.page))] = next;
  });
  redrawRegionPage(ctx.pending.page);
  hideMarqueeMenu();
}

function mosaicRegion() {
  const ctx = regionView();
  if (!ctx || state.interactMode === "view") {
    return;
  }
  commitPageChange(ctx.pending.page, () => {
    pageStrokes(ctx.pending.page).push(mosaicItem(ctx.pending.rect, MOSAIC_CELL_CSS));
  });
  redrawRegionPage(ctx.pending.page);
  hideMarqueeMenu();
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
  rotatePageAt(state.page, delta);
}

function rotatePageAt(pageNum, delta) {
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

/* ---- 서랍 폭 (#106) ---- */

function applyPreviewWidth() {
  if (!els.previewDrawer) {
    return;
  }
  const width = clampPreviewWidth(state.previewWidth);
  state.previewWidth = width;
  els.previewDrawer.style.setProperty("--preview-w", `${width}px`);
  const thumb = previewThumbSize(width);
  els.previewDrawer.style.setProperty("--thumb-w", `${thumb.width}px`);
  els.previewDrawer.style.setProperty("--thumb-h", `${thumb.height}px`);
}

function bindPreviewGrip(grip) {
  if (!grip) {
    return;
  }
  let drag = null;
  grip.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    drag = { id: event.pointerId };
    try {
      grip.setPointerCapture(event.pointerId);
    } catch {
      // optional
    }
  });
  grip.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) {
      return;
    }
    event.preventDefault();
    const box = els.previewDrawer.getBoundingClientRect();
    state.previewWidth = clampPreviewWidth(event.clientX - box.left);
    applyPreviewWidth();
  });
  const stop = () => {
    if (!drag) {
      return;
    }
    drag = null;
    savePreviewWidth(state.previewWidth);
    // Thumbs are keyed by width, so the new size repaints once.
    renderPreviewList();
  };
  grip.addEventListener("pointerup", stop);
  grip.addEventListener("pointercancel", stop);
}

/**
 * The drawer stays open while writing (#106), so a stroke has to refresh just
 * that page's thumb, once the hand settles.
 */
let thumbRefreshTimer = 0;

function refreshPageThumb(pageNum) {
  if (els.previewDrawer?.hidden || state.previewTab === "toc") {
    return;
  }
  window.clearTimeout(thumbRefreshTimer);
  thumbRefreshTimer = window.setTimeout(() => {
    thumbRefreshTimer = 0;
    state.inkStamp += 1;
    const leaf = leafAt(state.leaves, pageNum);
    const row = els.previewList?.querySelector(`[data-leaf="${leaf?.id}"] .preview-thumb`);
    if (!leaf || !row) {
      return;
    }
    paintPreviewThumb(row, leaf);
  }, THUMB_REFRESH_MS);
}

function openPreview() {
  closeAllPanels();
  els.previewDrawer.hidden = false;
  applyPreviewWidth();
  renderPreview();
  syncPreviewButton();
}

function togglePreview() {
  if (els.previewDrawer.hidden) {
    openPreview();
    return;
  }
  closePreview();
}

function syncPreviewButton() {
  els.previewBtn?.classList.toggle("is-selected", !els.previewDrawer.hidden);
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
    row.dataset.dest = String(dest);
    row.append(title, jump, del);
    row.addEventListener("click", (event) => {
      if (tocRowAction(event.target?.className) === "jump") {
        goToPage(dest);
      }
    });
    els.tocList.append(row);
  }
}

/** Ink lives under a leaf key, so a page op records that key plus the leaves. */
function commitLeafChange(key, apply) {
  const before = cloneItems(state.pages[key] || []);
  const leavesBefore = cloneItems(state.leaves);
  apply();
  const after = cloneItems(state.pages[key] || []);
  recordChange(state.history, {
    page: key,
    before,
    after,
    extra: { leavesBefore, leavesAfter: cloneItems(state.leaves) },
  });
  persistStrokes();
  syncHistoryButtons();
}

function afterPageOp(nextPage) {
  state.pageCount = state.leaves.length;
  state.page = Math.min(Math.max(1, nextPage), state.pageCount);
  state.selectIndices = [];
  rebuildPages();
  if (!els.previewDrawer.hidden) {
    renderPreview();
  }
}

function hidePageMenu() {
  if (els.pageMenu) {
    els.pageMenu.hidden = true;
  }
}

function openPageMenu(pageNum, rowTop) {
  if (!els.pageMenu || state.previewTab === "toc") {
    return;
  }
  state.pageMenuAt = pageNum;
  const buttons = [...els.pageMenu.querySelectorAll("[data-page-menu]")];
  const last = state.leaves.length;
  for (const btn of buttons) {
    const action = btn.dataset.pageMenu;
    btn.disabled =
      (action === "paste" && !canPastePage(state.pageClip)) ||
      (action === "up" && pageNum <= 1) ||
      (action === "down" && pageNum >= last);
  }
  els.pageMenu.hidden = false;
  const drawer = els.previewDrawer.getBoundingClientRect();
  const spot = placePageMenu(rowTop, drawer.right, window.innerHeight, buttons.length);
  els.pageMenu.style.left = `${spot.left}px`;
  els.pageMenu.style.top = `${spot.top}px`;
}

function runPageMenu(action) {
  const pageNum = state.pageMenuAt;
  const index = pageNum - 1;
  const leaf = leafAt(state.leaves, pageNum);
  hidePageMenu();
  if (!leaf) {
    return;
  }
  if (action === "copy") {
    state.pageClip = copyPageLeaf(state.leaves, state.pages, index);
    flashBanner(`${pageNum}쪽을 복사했습니다.`);
    return;
  }
  if (action === "left" || action === "right") {
    rotatePageAt(pageNum, action === "left" ? -90 : 90);
    if (!els.previewDrawer.hidden) {
      renderPreview();
    }
    return;
  }
  if (action === "up" || action === "down") {
    const delta = action === "up" ? -1 : 1;
    const moved = movePageLeaf(state.leaves, index, delta);
    if (moved === state.leaves) {
      return;
    }
    commitLeafChange(inkKey(leaf), () => {
      state.leaves = moved;
    });
    afterPageOp(pageNum + delta);
    return;
  }
  if (action === "delete") {
    if (state.leaves.length <= 1) {
      flashBanner("마지막 한 장은 지울 수 없습니다.");
      return;
    }
    const key = inkKey(leaf);
    commitLeafChange(key, () => {
      state.leaves = state.leaves.filter((_, at) => at !== index);
      delete state.pages[key];
    });
    afterPageOp(Math.min(pageNum, state.leaves.length));
    return;
  }
  if (action === "duplicate" || action === "paste") {
    const out =
      action === "duplicate"
        ? duplicatePageLeaf(state.leaves, state.pages, index)
        : pastePageLeaf(state.leaves, state.pages, index, state.pageClip);
    if (!out.key) {
      return;
    }
    commitLeafChange(out.key, () => {
      state.leaves = out.leaves;
      state.pages = out.pages;
    });
    afterPageOp(out.at + 1);
  }
}

function movePageByDrag(from, to) {
  if (from === to) {
    return;
  }
  const leaf = leafAt(state.leaves, from + 1);
  const moved = reorderPageLeaf(state.leaves, from, to);
  if (!leaf || moved === state.leaves) {
    return;
  }
  commitLeafChange(inkKey(leaf), () => {
    state.leaves = moved;
  });
  afterPageOp(to + 1);
}

function hideDropLine() {
  if (els.previewDrop) {
    els.previewDrop.hidden = true;
  }
}

function showDropLine(index) {
  if (!els.previewDrop) {
    return;
  }
  els.previewDrop.hidden = false;
  els.previewDrop.style.top = `${dropLineTop(index, previewRowStride(state.previewWidth))}px`;
}

/**
 * Tap jumps. Hold 400ms (or right-click) grabs the page: the menu opens and the
 * row takes the pointer, so dragging from there reorders instead of scrolling
 * the drawer (#55).
 */
function bindPreviewRowGestures(row, fallbackPage) {
  let timer = 0;
  let startY = 0;
  let pointerId = null;
  let dragging = false;
  let held = false;

  const pageOf = () => pageOfLeaf(state.leaves, row.dataset.leaf) || fallbackPage;

  const stop = () => {
    window.clearTimeout(timer);
    timer = 0;
  };

  const release = () => {
    stop();
    row.classList.remove("is-grabbed", "is-dragging");
    hideDropLine();
    pointerId = null;
    dragging = false;
  };

  const grab = (event) => {
    held = true;
    row.classList.add("is-grabbed");
    if (event?.pointerId != null) {
      try {
        row.setPointerCapture(event.pointerId);
      } catch {
        // optional
      }
    }
    openPageMenu(pageOf(), row.getBoundingClientRect().top);
  };

  row.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    pointerId = event.pointerId;
    startY = event.clientY;
    held = false;
    dragging = false;
    timer = window.setTimeout(() => {
      timer = 0;
      grab(event);
    }, PAGE_HOLD_MS);
  });

  row.addEventListener("pointermove", (event) => {
    if (pointerId !== event.pointerId) {
      return;
    }
    const moved = Math.abs(event.clientY - startY);
    if (!held) {
      // Still deciding: a scroll of the drawer cancels the hold.
      if (moved > PAGE_DRAG_SLOP_PX) {
        release();
      }
      return;
    }
    if (!dragging && moved > PAGE_DRAG_SLOP_PX && state.previewFilter === "all") {
      dragging = true;
      hidePageMenu();
      row.classList.add("is-dragging");
    }
    if (dragging) {
      event.preventDefault();
      showDropLine(dropIndexForEvent(event));
    }
  });

  const end = (event) => {
    if (pointerId !== event.pointerId) {
      return;
    }
    const wasDragging = dragging;
    const wasHeld = held;
    const from = pageOf() - 1;
    const to = wasDragging ? dropIndexForEvent(event) : -1;
    release();
    if (wasDragging) {
      movePageByDrag(from, to);
      return;
    }
    if (!wasHeld) {
      goToPage(pageOf());
    }
  };

  row.addEventListener("pointerup", end);
  row.addEventListener("pointercancel", release);
  row.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    stop();
    grab(null);
  });
}

function dropIndexForEvent(event) {
  const list = els.previewList.getBoundingClientRect();
  return dropIndexAt({
    pointerY: event.clientY,
    listTop: list.top,
    scrollTop: els.previewList.scrollTop,
    stride: previewRowStride(state.previewWidth),
    count: state.leaves.length,
  });
}

function makePreviewRow(leaf) {
  const pageNum = pageOfLeaf(state.leaves, leaf.id);
  const row = document.createElement("div");
  row.className = "preview-row";
  row.dataset.page = String(pageNum);
  row.dataset.leaf = leaf.id;
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
    if (state.previewFilter !== "all") {
      renderPreviewList();
      return;
    }
    const now = leafAt(state.leaves, pageNum);
    star.classList.toggle("is-on", Boolean(now?.bookmark));
    star.textContent = now?.bookmark ? "★" : "☆";
  });
  meta.append(label, star);
  row.append(thumb, meta);
  bindPreviewRowGestures(row, pageNum);
  return row;
}

function syncPreviewCurrent({ paintVisible = false } = {}) {
  if (els.previewDrawer?.hidden) {
    return;
  }
  if (state.previewTab === "toc") {
    els.tocList?.querySelectorAll(".preview-toc-row").forEach((row) => {
      row.classList.toggle("is-current", Number(row.dataset.dest) === state.page);
    });
    return;
  }
  if (!els.previewList) {
    return;
  }
  const shown = filterLeaves(state.leaves, state.previewFilter);
  const index = shown.findIndex((leaf) => pageOfLeaf(state.leaves, leaf.id) === state.page);
  if (index >= 0) {
    const top = index * previewRowStride(state.previewWidth);
    const viewH = els.previewList.clientHeight;
    const body = previewRowBody(state.previewWidth);
    if (top < els.previewList.scrollTop || top + body > els.previewList.scrollTop + viewH) {
      els.previewList.scrollTop = Math.max(0, top - 8);
    }
  }
  els.previewList.querySelectorAll(".preview-row").forEach((row) => {
    row.classList.toggle("is-current", Number(row.dataset.page) === state.page);
  });
  if (paintVisible) {
    paintVisiblePreviewRows();
  }
}

async function paintVisiblePreviewRows() {
  if (!els.previewList || els.previewDrawer?.hidden || state.previewTab === "toc") {
    return;
  }
  const windowEl = els.previewList.querySelector(".preview-list-window");
  if (!windowEl) {
    return;
  }
  const shown = filterLeaves(state.leaves, state.previewFilter);
  const range = visiblePreviewRows({
    scrollTop: els.previewList.scrollTop,
    viewportHeight: els.previewList.clientHeight || 640,
    count: shown.length,
  });
  const stride = previewRowStride(state.previewWidth);
  windowEl.style.transform = `translateY(${Math.max(0, range.from) * stride}px)`;
  const needed = shown.slice(Math.max(0, range.from), range.to + 1);
  const have = new Map([...windowEl.children].map((row) => [row.dataset.leaf, row]));
  const next = [];
  for (const leaf of needed) {
    let row = have.get(leaf.id);
    if (row) {
      have.delete(leaf.id);
    } else {
      row = makePreviewRow(leaf);
    }
    row.classList.toggle("is-current", pageOfLeaf(state.leaves, leaf.id) === state.page);
    next.push(row);
  }
  for (const stale of have.values()) {
    stale.remove();
  }
  windowEl.replaceChildren(...next);
  await Promise.all(
    next.map((row) => {
      const leaf = shown.find((item) => item.id === row.dataset.leaf);
      const canvas = row.querySelector(".preview-thumb");
      if (!leaf || !canvas) {
        return null;
      }
      return paintPreviewThumb(canvas, leaf);
    }),
  );
}

async function renderPreviewList() {
  if (!els.previewList) {
    return;
  }
  document.querySelectorAll("#preview-filters [data-preview-filter]").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.previewFilter === state.previewFilter);
  });
  const shown = filterLeaves(state.leaves, state.previewFilter);
  const spacer = document.createElement("div");
  spacer.className = "preview-list-spacer";
  spacer.style.height = `${previewListHeight(shown.length, state.previewWidth)}px`;
  const windowEl = document.createElement("div");
  windowEl.className = "preview-list-window";
  els.previewList.replaceChildren(spacer, windowEl);
  await paintVisiblePreviewRows();
}

async function paintPreviewThumb(canvas, leaf) {
  const size = previewThumbSize(state.previewWidth);
  const key = thumbCacheKey(leaf, size.width, state.inkStamp);
  if (canvas.dataset.painted === key) {
    return;
  }
  const hit = thumbCache.get(key);
  if (hit?.bitmap) {
    canvas.width = hit.width;
    canvas.height = hit.height;
    const blit = canvas.getContext("2d");
    blit.drawImage(hit.bitmap, 0, 0);
    canvas.dataset.painted = key;
    return;
  }
  const ctx = canvas.getContext("2d");
  canvas.width = Math.round(size.width * 2);
  canvas.height = Math.round(size.height * 2);
  ctx.fillStyle = "#F7F4EC";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (leaf.kind === "outline" || !state.pdf) {
    ctx.fillStyle = "#5C574E";
    ctx.textAlign = "center";
    ctx.font = "600 16px sans-serif";
    ctx.fillText(leaf.title || "빈 쪽", canvas.width / 2, 40);
    const bitmap = snapshotCanvas(canvas);
    if (bitmap) {
      thumbCache.set(key, { width: canvas.width, height: canvas.height, bitmap });
    }
    canvas.dataset.painted = key;
    return;
  }
  try {
    const page = await state.pdf.getPage(leaf.pdfPage);
    const rotation = ((page.rotate || 0) + (leaf.rotate || 0)) % 360;
    const base = page.getViewport({ scale: 1, rotation });
    const scale = Math.min((size.width * 2) / base.width, (size.height * 2) / base.height);
    const viewport = page.getViewport({ scale, rotation });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const bitmap = snapshotCanvas(canvas);
    if (bitmap) {
      thumbCache.set(key, { width: canvas.width, height: canvas.height, bitmap });
    }
    canvas.dataset.painted = key;
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
  if (!pending || captureWriting) {
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
  if (state.toolbarPos === "left") {
    return "right";
  }
  if (state.toolbarPos === "right") {
    return "left";
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

function offscreenCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function waitForImage(src) {
  return new Promise((resolve) => {
    const entry = cachedImage(src, () => resolve());
    if (!entry || entry.ready) {
      resolve();
      return;
    }
    entry.img.addEventListener("load", () => resolve(), { once: true });
    entry.img.addEventListener("error", () => resolve(), { once: true });
  });
}

async function preloadItemImages(items) {
  const sources = (items || []).filter((item) => item.type === "image" && item.src).map((item) => item.src);
  await Promise.all([...new Set(sources)].map((src) => waitForImage(src)));
}

/** Ink layers in screen order (locked image, ink, free image) on one canvas. */
async function exportInkCanvas(items, pixels, cssWidth) {
  await preloadItemImages(items);
  const canvas = offscreenCanvas(pixels.width, pixels.height);
  const ctx = canvas2d(canvas);
  // Ink keeps its own canvas: a pixel eraser must not eat the image layers.
  const inkOnly = offscreenCanvas(pixels.width, pixels.height);
  const inkCtx = canvas2d(inkOnly);
  const scale = inkCanvasScale(inkOnly.width, cssWidth);
  for (const item of items) {
    paintItem(inkCtx, item, scale, inkOnly);
  }
  const under = offscreenCanvas(pixels.width, pixels.height);
  paintImageLayer(under, items, true, null);
  const over = offscreenCanvas(pixels.width, pixels.height);
  paintImageLayer(over, items, false, null);
  ctx.drawImage(under, 0, 0);
  ctx.drawImage(inkOnly, 0, 0);
  ctx.drawImage(over, 0, 0);
  return canvas;
}

async function exportOverlayPng(items, pixels, cssWidth) {
  const canvas = await exportInkCanvas(items, pixels, cssWidth);
  const data = canvas2d(canvas).getImageData(0, 0, canvas.width, canvas.height);
  return encodePngRgba(canvas.width, canvas.height, data.data);
}

/** A masked page is flattened so the covered text is really gone (#31 #54). */
async function exportFlatPagePng(leaf, items, pixels, cssWidth) {
  const ink = await exportInkCanvas(items, pixels, cssWidth);
  const paper = offscreenCanvas(pixels.width, pixels.height);
  const paperCtx = canvas2d(paper);
  paperCtx.fillStyle = "#FFFFFF";
  paperCtx.fillRect(0, 0, paper.width, paper.height);
  if (leaf.kind !== "outline" && state.pdf) {
    const page = await state.pdf.getPage(leaf.pdfPage);
    const rotation = normalizeRotation((page.rotate || 0) + (leaf.rotate || 0));
    const base = page.getViewport({ scale: 1, rotation });
    const viewport = page.getViewport({ scale: paper.width / base.width, rotation });
    await page.render({ canvasContext: paperCtx, viewport }).promise;
  }
  const pdfData = paperCtx.getImageData(0, 0, paper.width, paper.height);
  const inkData = canvas2d(ink).getImageData(0, 0, ink.width, ink.height);
  const boxes = mosaicBoxesPx(items, paper.width, paper.height, cssWidth);
  const composed = composePageRgba(pdfData.data, inkData.data, paper.width, paper.height, boxes);
  return encodePngRgba(paper.width, paper.height, composed);
}

let buildingPdf = false;

/** pdf-lib only loads when the reader actually saves or exports (#54). */
function loadExportPdf() {
  return import("./exportPdf.js");
}

/** Ink thickness is css px, so the writer keeps the width the reader sees. */
function exportCssWidth(leaf, base) {
  const view = state.pageViews.find((item) => item.pageNum === pageOfLeaf(state.leaves, leaf.id));
  if (view?.cssWidth) {
    return view.cssWidth;
  }
  const turned = normalizeRotation(leaf.rotate || 0) % 180 !== 0;
  return turned ? base.height : base.width;
}

async function annotatedPdfBlob() {
  const { buildAnnotatedPdf } = await loadExportPdf();
  const base = await basePageCss();
  const bytes = await buildAnnotatedPdf({
    buffer: state.buffer,
    leaves: state.leaves,
    outline: state.outline,
    blankSize: { width: 595, height: 842 },
    strokesOf: (leaf) => state.pages[inkKey(leaf)] || [],
    renderOverlay: (leaf, pixels) =>
      exportOverlayPng(state.pages[inkKey(leaf)] || [], pixels, exportCssWidth(leaf, base)),
    renderRaster: (leaf, pixels) =>
      exportFlatPagePng(leaf, state.pages[inkKey(leaf)] || [], pixels, exportCssWidth(leaf, base)),
  });
  return new Blob([bytes], { type: "application/pdf" });
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function flashBanner(message, ms = 1800) {
  showBanner(message);
  window.setTimeout(() => {
    if (els.banner.textContent === message) {
      showBanner("");
    }
  }, ms);
}

async function withAnnotatedPdf(run, failMessage) {
  if (buildingPdf) {
    return;
  }
  if (!state.pdf || !state.buffer) {
    flashBanner("먼저 PDF를 여세요.");
    return;
  }
  buildingPdf = true;
  showBanner("PDF를 만드는 중…");
  try {
    const { exportFileName } = await loadExportPdf();
    const blob = await annotatedPdfBlob();
    const fileName = exportFileName(state.fileName);
    showBanner("");
    await run(blob, fileName);
  } catch {
    flashBanner(failMessage);
  } finally {
    buildingPdf = false;
  }
}

async function saveDocumentNow() {
  persistStrokes();
  persistSession();
  await withAnnotatedPdf(async (blob, fileName) => {
    // #82: the file the reader opened, not another copy in Downloads.
    if (await ensureWritePermission(state.fileHandle)) {
      try {
        await writeHandle(state.fileHandle, blob);
        flashBanner(`원본에 저장했습니다. ${state.fileHandle.name || fileName}`, 2200);
        return;
      } catch {
        flashBanner("원본에 쓰지 못해 파일로 내려받습니다.", 2200);
      }
    }
    downloadBlob(blob, fileName);
    flashBanner(`저장했습니다. ${fileName}`, 2200);
  }, "PDF를 저장하지 못했습니다.");
}

async function exportDocument() {
  await withAnnotatedPdf(async (blob, fileName) => {
    const { canShareFile } = await loadExportPdf();
    const file = new File([blob], fileName, { type: "application/pdf" });
    if (canShareFile(navigator, file)) {
      try {
        await navigator.share({ files: [file], title: fileName });
        flashBanner("내보냈습니다.");
        return;
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }
      }
    }
    downloadBlob(blob, fileName);
    flashBanner(`내보냈습니다. ${fileName}`, 2200);
  }, "내보내지 못했습니다.");
}

/* ---- 스티커 (#79) : 이 브라우저에만, 서버에 안 올림 ---- */

let stickerSource = null;
let stickerRegions = [];
let stickerRegionPick = -1;
let studioPixels = null;

function stickerCtx(canvas) {
  return canvas.getContext("2d", { willReadFrequently: true });
}

async function loadStickerLibrary() {
  try {
    const [folders, stickers] = await Promise.all([loadStickerFolders(), loadStickers()]);
    state.stickerFolders = normalizeFolders(folders);
    state.stickers = normalizeStickers(stickers, state.stickerFolders);
  } catch {
    state.stickerFolders = normalizeFolders([]);
    state.stickers = [];
  }
}

async function persistStickers() {
  try {
    await Promise.all([saveStickerFolders(state.stickerFolders), saveStickers(state.stickers)]);
  } catch {
    flashBanner("스티커를 저장하지 못했습니다.");
  }
}

async function openStickerSheet() {
  if (!els.stickerSheet) {
    return;
  }
  await loadStickerLibrary();
  closeStudio();
  clearStickerSource();
  els.stickerSheet.hidden = false;
  els.stickerBackdrop.hidden = false;
  renderStickerFolders();
  renderStickerGrid();
}

function closeStickerSheet() {
  if (!els.stickerSheet) {
    return;
  }
  hideStickerMenu();
  els.stickerSheet.hidden = true;
  els.stickerBackdrop.hidden = true;
  closeStudio();
  clearStickerSource();
}

function clearStickerSource() {
  stickerSource = null;
  stickerRegions = [];
  stickerRegionPick = -1;
  if (els.stickerSource) {
    els.stickerSource.hidden = true;
  }
  if (els.stickerMakeActions) {
    els.stickerMakeActions.hidden = true;
  }
  if (els.stickerRegions) {
    els.stickerRegions.replaceChildren();
  }
  if (els.stickerDropLabel) {
    els.stickerDropLabel.textContent = "그림을 골라 영역을 잘라요";
  }
}

async function loadStickerFile(file) {
  const check = acceptImageFile(file);
  if (!check.ok) {
    flashBanner(check.message);
    return;
  }
  try {
    const raw = await readFileDataUrl(file);
    if (!acceptImageSrc(raw)) {
      flashBanner("PNG, JPEG, WebP만 넣을 수 있습니다.");
      return;
    }
    const img = await loadHtmlImage(raw);
    const box = els.stickerSheet.clientWidth - 32 || 280;
    const scale = Math.min(1, box / img.width, 220 / img.height);
    const canvas = els.stickerCanvas;
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    stickerCtx(canvas).drawImage(img, 0, 0, canvas.width, canvas.height);
    stickerSource = { img, width: img.width, height: img.height };
    stickerRegions = [];
    stickerRegionPick = -1;
    renderStickerRegions();
    els.stickerSource.hidden = false;
    els.stickerMakeActions.hidden = false;
    els.stickerDropLabel.textContent = "영역을 끌어 잘라요";
  } catch {
    flashBanner("그림을 열지 못했습니다.");
  }
}

function renderStickerRegions(live = null) {
  if (!els.stickerRegions) {
    return;
  }
  const scale = regionViewScale();
  const boxes = live ? [...stickerRegions, live] : stickerRegions;
  els.stickerRegions.replaceChildren(
    ...boxes.map((rect, index) => {
      const div = document.createElement("div");
      div.className = "sticker-region";
      const left = Math.min(rect.x1, rect.x2);
      const top = Math.min(rect.y1, rect.y2);
      div.style.left = `${left * scale}px`;
      div.style.top = `${top * scale}px`;
      div.style.width = `${Math.abs(rect.x2 - rect.x1) * scale}px`;
      div.style.height = `${Math.abs(rect.y2 - rect.y1) * scale}px`;
      if (!live && index === stickerRegionPick) {
        div.classList.add("is-selected");
        for (const handle of REGION_HANDLES) {
          const dot = document.createElement("span");
          dot.className = "sticker-region-handle";
          dot.dataset.handle = handle;
          div.append(dot);
        }
        const close = document.createElement("button");
        close.type = "button";
        close.className = "sticker-region-close";
        close.dataset.regionClose = String(index);
        close.textContent = "✕";
        close.setAttribute("aria-label", "이 영역 지우기");
        div.append(close);
      }
      return div;
    }),
  );
}

/** Canvas pixels to the css box the reader is touching. */
function regionViewScale() {
  const canvas = els.stickerCanvas;
  const box = canvas.getBoundingClientRect();
  return canvas.width ? box.width / canvas.width : 1;
}

/** Each rect becomes its own sticker: a drag list never merges into one. */
function cutSticker(rect) {
  const fit = stickerFitSize(rect.w, rect.h);
  const canvas = document.createElement("canvas");
  canvas.width = fit.width;
  canvas.height = fit.height;
  stickerCtx(canvas).drawImage(stickerSource.img, rect.x, rect.y, rect.w, rect.h, 0, 0, fit.width, fit.height);
  return makeSticker({
    src: canvas.toDataURL("image/png"),
    width: fit.width,
    height: fit.height,
    folderId: state.stickerFolder,
  });
}

async function addStickersFromRegions(whole = false) {
  if (!stickerSource) {
    return;
  }
  const rects = whole
    ? [wholeImageRect(stickerSource.width, stickerSource.height)]
    : stickerRegions
        .map((rect) =>
          regionPixelRect(
            rect,
            els.stickerCanvas.width,
            els.stickerCanvas.height,
            stickerSource.width,
            stickerSource.height,
          ),
        )
        .filter(Boolean);
  if (!rects.length) {
    flashBanner("자를 영역을 먼저 끌어 주세요.");
    return;
  }
  state.stickers = [...state.stickers, ...rects.map((rect) => cutSticker(rect))];
  await persistStickers();
  clearStickerSource();
  renderStickerGrid();
  flashBanner(`스티커 ${rects.length}장을 만들었습니다.`);
}

function renderStickerFolders() {
  if (!els.stickerFolders) {
    return;
  }
  const rows = state.stickerFolders.map((folder) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sticker-folder";
    btn.dataset.folder = folder.id;
    btn.textContent = folder.name;
    btn.classList.toggle("is-selected", folder.id === state.stickerFolder);
    btn.addEventListener("click", () => {
      state.stickerFolder = folder.id;
      hideStickerMenu();
      closeStudio();
      renderStickerFolders();
      renderStickerGrid();
    });
    btn.addEventListener("dblclick", () => renameStickerFolder(folder.id));
    btn.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      removeStickerFolder(folder.id);
    });
    return btn;
  });
  const add = document.createElement("button");
  add.type = "button";
  add.className = "sticker-folder-add";
  add.textContent = "+";
  add.setAttribute("aria-label", "폴더 추가");
  add.addEventListener("click", () => {
    const name = window.prompt("폴더 이름");
    if (!name) {
      return;
    }
    state.stickerFolders = addFolder(state.stickerFolders, name);
    state.stickerFolder = state.stickerFolders.at(-1).id;
    persistStickers();
    renderStickerFolders();
    renderStickerGrid();
  });
  els.stickerFolders.replaceChildren(...rows, add);
}

function renameStickerFolder(id) {
  if (id === DEFAULT_FOLDER_ID) {
    return;
  }
  const now = state.stickerFolders.find((folder) => folder.id === id);
  const name = window.prompt("폴더 이름", now?.name || "");
  if (!name) {
    return;
  }
  state.stickerFolders = renameFolder(state.stickerFolders, id, name);
  persistStickers();
  renderStickerFolders();
}

function removeStickerFolder(id) {
  if (id === DEFAULT_FOLDER_ID) {
    return;
  }
  const out = deleteFolder(state.stickerFolders, state.stickers, id);
  state.stickerFolders = out.folders;
  state.stickers = out.stickers;
  state.stickerFolder = DEFAULT_FOLDER_ID;
  persistStickers();
  renderStickerFolders();
  renderStickerGrid();
}

function renderStickerGrid() {
  if (!els.stickerGrid) {
    return;
  }
  const mine = stickersInFolder(state.stickers, state.stickerFolder);
  if (!mine.length) {
    const empty = document.createElement("p");
    empty.className = "sticker-empty";
    empty.textContent = "이 폴더는 비었습니다.";
    els.stickerGrid.replaceChildren(empty);
    return;
  }
  els.stickerGrid.replaceChildren(
    ...mine.map((sticker) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "sticker-cell";
      cell.dataset.sticker = sticker.id;
      cell.classList.toggle("is-selected", state.stickerPick === sticker.id);
      const img = document.createElement("img");
      img.src = sticker.src;
      img.alt = sticker.name || "스티커";
      cell.append(img);
      bindStickerCell(cell, sticker);
      return cell;
    }),
  );
}

/**
 * Tap puts it on the paper. Hold opens the menu (편집·삭제), and holding then
 * dragging reorders inside the folder. A plain drag still files it away (#103).
 */
function bindStickerCell(cell, sticker) {
  let dragging = false;
  let start = null;
  let held = false;
  let timer = 0;

  const stop = () => {
    window.clearTimeout(timer);
    timer = 0;
  };

  const release = () => {
    stop();
    cell.classList.remove("is-grabbed");
    start = null;
    dragging = false;
    clearFolderDrop();
  };

  cell.addEventListener("pointerdown", (event) => {
    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    dragging = false;
    held = false;
    timer = window.setTimeout(() => {
      timer = 0;
      held = true;
      cell.classList.add("is-grabbed");
      try {
        cell.setPointerCapture(event.pointerId);
      } catch {
        // optional
      }
      openStickerMenu(sticker.id, cell.getBoundingClientRect());
    }, PAGE_HOLD_MS);
  });

  cell.addEventListener("pointermove", (event) => {
    if (!start || start.id !== event.pointerId) {
      return;
    }
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (moved <= 8) {
      return;
    }
    if (!dragging) {
      stop();
      dragging = true;
      if (held) {
        hideStickerMenu();
      } else {
        try {
          cell.setPointerCapture(event.pointerId);
        } catch {
          // optional
        }
      }
    }
    event.preventDefault();
    if (held) {
      cell.classList.add("is-dragging");
      return;
    }
    markFolderDrop(event);
  });

  const finish = (event) => {
    if (!start || start.id !== event.pointerId) {
      return;
    }
    const wasDragging = dragging;
    const wasHeld = held;
    const target = folderAtPoint(event);
    const slot = wasHeld && wasDragging ? stickerSlotAt(event) : -1;
    cell.classList.remove("is-dragging");
    release();
    if (wasHeld && wasDragging) {
      reorderStickerTo(sticker, slot);
      return;
    }
    if (wasDragging) {
      if (target && target !== sticker.folderId) {
        state.stickers = moveSticker(state.stickers, sticker.id, target);
        persistStickers();
        renderStickerGrid();
      }
      return;
    }
    if (!wasHeld) {
      placeSticker(sticker);
    }
  };

  cell.addEventListener("pointerup", finish);
  cell.addEventListener("pointercancel", release);
  cell.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    stop();
    held = true;
    openStickerMenu(sticker.id, cell.getBoundingClientRect());
  });
}

function stickerSlotAt(event) {
  const box = els.stickerGrid.getBoundingClientRect();
  const stride = STICKER_THUMB + STICKER_GAP;
  return gridIndexAt({
    x: event.clientX,
    y: event.clientY,
    gridLeft: box.left,
    gridTop: box.top,
    columns: Math.max(1, Math.floor((box.width + STICKER_GAP) / stride)),
    count: stickersInFolder(state.stickers, state.stickerFolder).length,
  });
}

function reorderStickerTo(sticker, slot) {
  const mine = stickersInFolder(state.stickers, state.stickerFolder);
  const from = mine.findIndex((item) => item.id === sticker.id);
  if (from < 0 || slot < 0 || slot === from) {
    return;
  }
  state.stickers = reorderStickers(state.stickers, state.stickerFolder, from, slot);
  persistStickers();
  renderStickerGrid();
}

function hideStickerMenu() {
  if (els.stickerMenu) {
    els.stickerMenu.hidden = true;
  }
  state.stickerMenuAt = null;
}

function openStickerMenu(id, rect) {
  if (!els.stickerMenu) {
    return;
  }
  state.stickerMenuAt = id;
  els.stickerMenu.hidden = false;
  const spot = placePageMenu(rect.top, rect.right, window.innerHeight, 2);
  els.stickerMenu.style.left = `${Math.min(window.innerWidth - 148, spot.left)}px`;
  els.stickerMenu.style.top = `${spot.top}px`;
}

function runStickerMenu(action) {
  const id = state.stickerMenuAt;
  hideStickerMenu();
  if (!id) {
    return;
  }
  if (action === "edit") {
    openStudio(id);
    return;
  }
  if (action === "delete") {
    removeSticker(id);
  }
}

function folderAtPoint(event) {
  const node = document.elementFromPoint(event.clientX, event.clientY);
  return node?.closest?.(".sticker-folder")?.dataset.folder || null;
}

function markFolderDrop(event) {
  const id = folderAtPoint(event);
  els.stickerFolders.querySelectorAll(".sticker-folder").forEach((btn) => {
    btn.classList.toggle("is-drop", btn.dataset.folder === id);
  });
}

function clearFolderDrop() {
  els.stickerFolders?.querySelectorAll(".sticker-folder").forEach((btn) => {
    btn.classList.remove("is-drop");
  });
}

/* ---- 스튜디오: 투명 · 지우개 · 회전 · 코너 크기 ---- */

function closeStudio() {
  state.stickerPick = null;
  studioPixels = null;
  if (els.stickerStudio) {
    els.stickerStudio.hidden = true;
  }
  if (els.stickerAngle) {
    els.stickerAngle.hidden = true;
    els.stickerAngle.value = "0";
  }
  if (els.stickerStudioCanvas) {
    els.stickerStudioCanvas.style.transform = "";
  }
  state.studioScale = 1;
}

async function openStudio(id) {
  const sticker = state.stickers.find((item) => item.id === id);
  if (!sticker || !els.stickerStudio) {
    return;
  }
  state.stickerPick = id;
  state.studioTool = "chroma";
  const img = await loadHtmlImage(sticker.src);
  const canvas = els.stickerStudioCanvas;
  canvas.width = sticker.width;
  canvas.height = sticker.height;
  const ctx = stickerCtx(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  studioPixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  els.stickerStudio.hidden = false;
  els.stickerAngle.hidden = true;
  els.stickerAngle.value = "0";
  state.studioScale = 1;
  canvas.style.transform = "";
  syncStudioTools();
  renderStickerGrid();
}

function syncStudioPreview() {
  const angle = normalizeAngle(Number(els.stickerAngle?.value) || 0);
  els.stickerStudioCanvas.style.transform = `scale(${state.studioScale}) rotate(${angle}deg)`;
}

function syncStudioTools() {
  els.stickerTools?.querySelectorAll("[data-studio]").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.studio === state.studioTool);
  });
  if (els.stickerAngle) {
    els.stickerAngle.hidden = state.studioTool !== "rotate";
  }
}

function studioPoint(event) {
  const canvas = els.stickerStudioCanvas;
  const box = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - box.left) / Math.max(1, box.width)) * canvas.width,
    y: ((event.clientY - box.top) / Math.max(1, box.height)) * canvas.height,
  };
}

function putStudioPixels(data) {
  const canvas = els.stickerStudioCanvas;
  studioPixels = new ImageData(data, canvas.width, canvas.height);
  stickerCtx(canvas).putImageData(studioPixels, 0, 0);
}

function studioTap(event) {
  if (!studioPixels || state.studioTool !== "chroma") {
    return;
  }
  const point = studioPoint(event);
  const color = pixelAt(studioPixels.data, els.stickerStudioCanvas.width, point.x, point.y);
  if (!color) {
    return;
  }
  putStudioPixels(applyChroma(studioPixels.data, color, CHROMA_TOLERANCE));
}

function studioErase(event) {
  if (!studioPixels || state.studioTool !== "eraser") {
    return;
  }
  const canvas = els.stickerStudioCanvas;
  const point = studioPoint(event);
  putStudioPixels(
    eraseCircle(studioPixels.data, canvas.width, canvas.height, point.x, point.y, ERASER_RADIUS_CSS),
  );
}

/** Free angle, no 90 snap: the turned picture is baked on save. */
function studioScaledCanvas(scale) {
  const source = els.stickerStudioCanvas;
  if (Math.abs(Number(scale) - 1) < 1e-6) {
    return source;
  }
  const size = scaledSize(source.width, source.height, scale);
  const out = document.createElement("canvas");
  out.width = size.width;
  out.height = size.height;
  out.getContext("2d").drawImage(source, 0, 0, size.width, size.height);
  return out;
}

function studioRotatedCanvas(angle, source = els.stickerStudioCanvas) {
  const canvas = source;
  const size = rotatedSize(canvas.width, canvas.height, angle);
  const out = document.createElement("canvas");
  out.width = size.width;
  out.height = size.height;
  const ctx = out.getContext("2d");
  ctx.translate(size.width / 2, size.height / 2);
  ctx.rotate((normalizeAngle(angle) * Math.PI) / 180);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}

async function saveStudio() {
  const sticker = state.stickers.find((item) => item.id === state.stickerPick);
  if (!sticker) {
    return;
  }
  const angle = normalizeAngle(Number(els.stickerAngle?.value) || 0);
  const sized = studioScaledCanvas(state.studioScale);
  const canvas = angle ? studioRotatedCanvas(angle, sized) : sized;
  state.stickers = state.stickers.map((item) =>
    item.id === sticker.id
      ? { ...item, src: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height }
      : item,
  );
  await persistStickers();
  closeStudio();
  renderStickerGrid();
  flashBanner("스티커를 고쳤습니다.");
}

async function deleteStudioSticker() {
  if (!state.stickerPick) {
    return;
  }
  await removeSticker(state.stickerPick);
}

/** ✕ on the thumb, no confirm, same as the outline x (#53). */
async function removeSticker(id) {
  state.stickers = deleteSticker(state.stickers, id);
  if (state.stickerPick === id) {
    closeStudio();
  }
  await persistStickers();
  renderStickerGrid();
}

/** On the paper a sticker is an image item: same select, #68 handle, lock. */
function placeSticker(sticker) {
  if (!state.pdf) {
    flashBanner("먼저 PDF를 여세요.");
    return;
  }
  const view = state.pageViews.find((item) => item.pageNum === state.page);
  const size = stickerSizeOnPage(
    sticker.width,
    sticker.height,
    view?.cssWidth || 400,
    view?.cssHeight || 600,
  );
  const item = imageItem({ src: sticker.src, x: 0.3, y: 0.28, w: size.w, h: size.h });
  commitPageChange(state.page, () => {
    pageStrokes(state.page).push(item);
    state.selectIndices = [pageStrokes(state.page).length - 1];
    state.selectPage = state.page;
  });
  state.tool = "select";
  state.rectTool = null;
  closeStickerSheet();
  if (view) {
    drawStrokesOn(view);
  }
  syncToolSelection();
  syncRectTool();
  syncSelectHud();
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
  if (action === "sticker") {
    closeMorePanel();
    ignoreAfterPanel = true;
    openStickerSheet();
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
    exportDocument();
    return;
  }
  if (action === "settings") {
    closeMorePanel();
    ignoreAfterPanel = true;
    openSettings();
    return;
  }
  if (action !== "capture") {
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
  cancelLockHold();
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
    if (!event.target.closest(".slot-panel, .sheet-card, .toolbar, .write-top, .m4-bar, .more-panel, .preview-drawer, .select-hud, .float-bar, #float-bar, .select-layer, #select-layer, .shape-chips")) {
      closeAllPanels();
      ignoreAfterPanel = true;
    }
    return;
  }
  if (event.target.closest(".toolbar, .write-top, .sheet, .slot-panel, .m4-bar, .more-panel, .marquee, .preview-drawer, .select-hud, .float-bar, #float-bar, .select-layer, #select-layer, .shape-chips")) {
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
  if (usesStamp()) {
    trackStampGhost(event);
    if (state.pendingStamp) {
      event.preventDefault();
    }
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
      scheduleZoomRender();
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

bindPreviewGrip(els.previewGrip);
applyPreviewWidth();
els.previewBtn?.addEventListener("click", () => {
  closeAllPanels();
  togglePreview();
});
els.lockMenu?.querySelectorAll("[data-lock-menu]").forEach((btn) => {
  btn.addEventListener("click", unlockFromMenu);
});
els.stickerMenu?.querySelectorAll("[data-sticker-menu]").forEach((btn) => {
  btn.addEventListener("click", () => runStickerMenu(btn.dataset.stickerMenu));
});
els.stickerClose?.addEventListener("click", closeStickerSheet);
els.stickerBackdrop?.addEventListener("click", closeStickerSheet);
els.stickerDrop?.addEventListener("click", () => els.stickerFile.click());
els.stickerFile?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (file) {
    await loadStickerFile(file);
  }
});
els.stickerWhole?.addEventListener("click", () => addStickersFromRegions(true));
els.stickerCut?.addEventListener("click", () => addStickersFromRegions(false));
els.stickerTools?.querySelectorAll("[data-studio]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.studioTool = btn.dataset.studio;
    syncStudioTools();
  });
});
els.stickerSave?.addEventListener("click", saveStudio);
els.stickerDelete?.addEventListener("click", deleteStudioSticker);
els.stickerAngle?.addEventListener("input", () => {
  // Preview only turns the view; the pixels are baked once, on save.
  syncStudioPreview();
});

// 코너 크기: 모서리를 끌면 비율을 지킨 채 커지고 작아진다.
els.stickerStudioBox?.querySelectorAll("[data-handle]").forEach((handle) => {
  let drag = null;
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    drag = { x: event.clientX, y: event.clientY, id: event.pointerId, scale: state.studioScale };
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // optional
    }
  });
  handle.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) {
      return;
    }
    event.preventDefault();
    state.studioScale = cornerScale(
      els.stickerStudioCanvas.width,
      els.stickerStudioCanvas.height,
      handle.dataset.handle,
      event.clientX - drag.x,
      event.clientY - drag.y,
      drag.scale,
    );
    syncStudioPreview();
  });
  const stop = () => {
    drag = null;
  };
  handle.addEventListener("pointerup", stop);
  handle.addEventListener("pointercancel", stop);
});

// 자르기: 빈 곳을 끌면 새 영역, 그린 영역은 고르고 옮기고 크기 바꾸고 지운다.
if (els.stickerSource) {
  let drag = null;
  const localPoint = (event) => {
    const box = els.stickerCanvas.getBoundingClientRect();
    const scaleX = els.stickerCanvas.width / Math.max(1, box.width);
    const scaleY = els.stickerCanvas.height / Math.max(1, box.height);
    return { x: (event.clientX - box.left) * scaleX, y: (event.clientY - box.top) * scaleY };
  };
  const bounds = () => [els.stickerCanvas.width, els.stickerCanvas.height];

  els.stickerSource.addEventListener("pointerdown", (event) => {
    if (!stickerSource) {
      return;
    }
    const close = event.target.closest?.("[data-region-close]");
    if (close) {
      event.preventDefault();
      stickerRegions = deleteRegionAt(stickerRegions, Number(close.dataset.regionClose));
      stickerRegionPick = -1;
      renderStickerRegions();
      return;
    }
    const point = localPoint(event);
    const hit = topRegionAt(stickerRegions, point);
    try {
      els.stickerSource.setPointerCapture(event.pointerId);
    } catch {
      // optional
    }
    if (hit >= 0) {
      const handle = regionHandleAt(stickerRegions[hit], point);
      stickerRegionPick = hit;
      drag = { mode: handle ? "resize" : "move", handle, index: hit, last: point, id: event.pointerId };
      renderStickerRegions();
      return;
    }
    stickerRegionPick = -1;
    drag = { mode: "draw", rect: { x1: point.x, y1: point.y, x2: point.x, y2: point.y }, id: event.pointerId };
    renderStickerRegions();
  });

  els.stickerSource.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) {
      return;
    }
    event.preventDefault();
    const point = localPoint(event);
    const [w, h] = bounds();
    if (drag.mode === "draw") {
      drag.rect.x2 = point.x;
      drag.rect.y2 = point.y;
      renderStickerRegions(drag.rect);
      return;
    }
    const now = stickerRegions[drag.index];
    if (!now) {
      return;
    }
    stickerRegions = stickerRegions.map((rect, index) => {
      if (index !== drag.index) {
        return rect;
      }
      return drag.mode === "resize"
        ? resizeRegion(rect, drag.handle, point, w, h)
        : moveRegion(rect, point.x - drag.last.x, point.y - drag.last.y, w, h);
    });
    drag.last = point;
    renderStickerRegions();
  });

  const endRegion = (event) => {
    if (!drag || drag.id !== event.pointerId) {
      return;
    }
    const finished = drag;
    drag = null;
    if (finished.mode === "draw") {
      const rect = finished.rect;
      if (
        regionPixelRect(
          rect,
          els.stickerCanvas.width,
          els.stickerCanvas.height,
          stickerSource.width,
          stickerSource.height,
        )
      ) {
        stickerRegions = [...stickerRegions, rect];
        stickerRegionPick = stickerRegions.length - 1;
      }
    }
    renderStickerRegions();
  };
  els.stickerSource.addEventListener("pointerup", endRegion);
  els.stickerSource.addEventListener("pointercancel", () => {
    drag = null;
    renderStickerRegions();
  });
}

// 스튜디오: 투명은 탭, 지우개는 드래그.
if (els.stickerStudioCanvas) {
  let erasing = false;
  els.stickerStudioCanvas.addEventListener("pointerdown", (event) => {
    if (state.studioTool === "eraser") {
      erasing = true;
      try {
        els.stickerStudioCanvas.setPointerCapture(event.pointerId);
      } catch {
        // optional
      }
      studioErase(event);
      return;
    }
    studioTap(event);
  });
  els.stickerStudioCanvas.addEventListener("pointermove", (event) => {
    if (erasing) {
      event.preventDefault();
      studioErase(event);
    }
  });
  els.stickerStudioCanvas.addEventListener("pointerup", () => {
    erasing = false;
  });
  els.stickerStudioCanvas.addEventListener("pointercancel", () => {
    erasing = false;
  });
}

document.querySelectorAll("#page-menu [data-page-menu]").forEach((btn) => {
  btn.addEventListener("click", () => runPageMenu(btn.dataset.pageMenu));
});
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
els.previewDrawer?.addEventListener("pointerdown", (event) => {
  if (!event.target.closest(".preview-row")) {
    hidePageMenu();
  }
});
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
if (els.previewList) {
  els.previewList.addEventListener(
    "scroll",
    () => {
      paintVisiblePreviewRows();
    },
    { passive: true },
  );
}
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
if (els.selectLayer) {
  els.selectLayer.addEventListener("pointerdown", (event) => {
    if (!event.target.closest("[data-handle=\"rotate\"]")) {
      return;
    }
    beginRotateFromHandle(event);
  });
}
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
if (els.marqueeBox) {
  bindMarqueeHold(els.marqueeBox, {
    onHold: showMarqueeMenu,
    onTap: () => {
      openPendingOrHitLink();
    },
  });
}
if (els.marqueeMenu) {
  els.marqueeMenu.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  els.marqueeMenu.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-marquee]");
    if (!btn) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const action = btn.dataset.marquee;
    if (action === "copy") {
      copyRegion();
      return;
    }
    if (action === "duplicate") {
      duplicateRegion();
      return;
    }
    if (action === "delete") {
      deleteRegion();
      return;
    }
    if (action === "capture") {
      confirmCapture();
      return;
    }
    if (action === "mosaic") {
      mosaicRegion();
      return;
    }
    if (action === "link") {
      showAreaLinkPanel();
    }
  });
}
if (els.areaLinkPanel) {
  els.areaLinkPanel.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
}
if (els.areaLinkPageGo) {
  els.areaLinkPageGo.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    saveAreaLink({ kind: "page", page: clampPageTarget(els.areaLinkPage?.value, state.pageCount) });
  });
}
if (els.areaLinkUrlGo) {
  els.areaLinkUrlGo.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const href = acceptAreaUrl(els.areaLinkUrl?.value);
    if (!href) {
      showBanner("http 또는 https 주소만 연결할 수 있습니다.");
      return;
    }
    saveAreaLink({ kind: "url", href });
  });
}
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
  updateAreaHits();
  if (state.pendingCapture || state.currentRect) {
    updateMarquee();
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
  if (state.pendingCapture && !event.target.closest("#marquee-box, #marquee-menu, #area-link-panel, .area-hit, #area-layer")) {
    hideMarquee();
  }
  if (event.target.closest(".slot-panel, .toolbar, [data-tool], #eraser-btn, #more-btn, .m4-bar, .marquee, .select-hud, .float-bar, #float-bar, .select-layer, #select-layer, .preview-drawer, .shape-chips, #area-link-panel, #split-tabs, #split-pane, #area-layer")) {
    return;
  }
  closeAllPanels();
});

document.addEventListener("keydown", (event) => {
  const typing = event.target.closest?.("input, textarea, [contenteditable='true']");
  if (event.key === "Escape" && els.lockMenu && !els.lockMenu.hidden && !typing) {
    event.preventDefault();
    hideLockMenu();
    return;
  }
  if (event.key === "Escape" && els.stickerMenu && !els.stickerMenu.hidden && !typing) {
    event.preventDefault();
    hideStickerMenu();
    return;
  }
  if (event.key === "Escape" && els.stickerSheet && !els.stickerSheet.hidden && !typing) {
    event.preventDefault();
    closeStickerSheet();
    return;
  }
  if (event.key === "Escape" && els.pageMenu && !els.pageMenu.hidden && !typing) {
    event.preventDefault();
    hidePageMenu();
    return;
  }
  if (event.key === "Escape" && state.pendingCapture && !typing) {
    event.preventDefault();
    hideMarquee();
    return;
  }
  if (event.key === "Escape" && els.areaLinkPanel && !els.areaLinkPanel.hidden && !typing) {
    event.preventDefault();
    hideAreaLinkPanel();
    return;
  }
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
      updateMarquee();
    }
    if (state.split?.tabs?.length) {
      syncSplitUi();
    }
    updateAreaHits();
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
