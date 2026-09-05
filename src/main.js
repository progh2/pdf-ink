import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { validatePdfContents, validatePdfFile } from "./validate.js";
import {
  fileIdentity,
  listDocuments,
  loadCaptures,
  loadDocument,
  loadLastSession,
  loadLinkFixes,
  loadPenOnly,
  loadStickerFolders,
  listThumbKeys,
  loadThumb,
  loadThumbEntries,
  loadStickers,
  loadStrokes,
  migrateLastIntoFiles,
  saveCaptures,
  saveDocument,
  saveLinkFixes,
  savePenOnly,
  saveStickerFolders,
  saveStickers,
  saveThumb,
  saveStrokes,
} from "./storage.js";
import {
  clearDropboxSession,
  loadDropboxSession,
  loadEraser,
  loadFreeRatio,
  loadInkTools,
  loadInteractMode,
  loadLinkHints,
  loadPenButtonErase,
  loadPenButtons,
  loadPreviewWidth,
  loadRecentColors,
  loadToolbarFloat,
  loadToolbarPosition,
  loadViewMode,
  loadZoomLock,
  saveDropboxSession,
  saveEraser,
  saveFreeRatio,
  saveInkTools,
  saveInteractMode,
  saveLinkHints,
  savePenButtonErase,
  savePenButtons,
  savePreviewWidth,
  saveRecentColors,
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
  DOUBLE_TAP_MS,
  PAN_TAP_SLOP_PX,
  VIEW_NOTICE_MS,
  VIEW_NOTICE_TEXT,
  allowsInkButton,
  appendInkPoints,
  beginInkPoints,
  canCreateInk,
  cursorForTool,
  describePenEvent,
  finishInkPoints,
  hoverShapeForTool,
  interactModeLabel,
  isDoubleTap,
  isStrokePointer,
  normFromRect,
  nudgeFor,
  penButtonAction,
  rectBigEnough,
  rectFromPoints,
  shortcutAllowed,
  shortcutFor,
  shouldNoticeViewMode,
  shouldPanPointer,
  shouldShowHover,
} from "./interact.js";
import { canRedo, canUndo, cloneItems, createHistory, extendChange, recordChange, redoChange, undoChange } from "./history.js";
import { bindUndoHold } from "./undoHold.js";
import { bindMarqueeHold, placeMarqueeMenu } from "./marqueeHold.js";
import {
  PAGE_DRAG_SLOP_PX,
  PAGE_HOLD_MS,
  canPastePage,
  copyPageLeaf,
  copyPageLeaves,
  deletePageLeaves,
  dropIndexAt,
  dropLineTop,
  duplicatePageLeaf,
  duplicatePageLeaves,
  movePageLeaf,
  pastePageLeaf,
  pastePageLeaves,
  placePageMenu,
  reorderPageLeaf,
  rotatePageLeaves,
  sortedIndexes,
} from "./pageOps.js";
import {
  HASH_COLS,
  HASH_ROWS,
  dHash,
  grayGrid,
  hamming,
  matchByHash,
  matchPages,
  matchSummary,
  mergeMatches,
  textFingerprint,
} from "./pageMatch.js";
import {
  countNewFrom,
  goneAfterChange,
  mergeGone,
  mergePages,
  newItemId,
  sanitizeGone,
} from "./inkMerge.js";
import {
  anchorLinkFixes,
  clearLinkFix,
  findLinkFix,
  linkFixForPage,
  sanitizeLinkFixes,
  linkFixTarget,
  linkGroupKey,
  linkSpotKey,
  setLinkFix,
} from "./linkFix.js";
import {
  describeLink,
  destTarget,
  destView,
  leafPositionForPdfPage,
  normalizedLinkRect,
  pagePositionForAction,
  pdfLinkCacheKey,
  pdfLinkItem,
  pdfLinkTarget,
  pdfSpaceRect,
  shortJson,
} from "./pdfLinks.js";
import {
  acceptAreaUrl,
  areaItem,
  areaLinkPage,
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
  buildThumbPack,
  packTooBig,
  parseThumbPack,
  shouldDownloadPack,
  shouldUploadPack,
  staleRatio,
  thumbPackPath,
} from "./thumbPack.js";
import {
  AUTOSAVE_MS,
  parseInkFile,
  pickNewer,
  serializeInkFile,
  sidecarName,
  sidecarPath,
} from "./inkFile.js";
import {
  applyBookmarkPages,
  bookmarkPagesFromItems,
  bookmarkPagesFromLeaves,
  flattenOutlineItems,
} from "./pdfOutline.js";
import {
  DRIVE_SCOPE,
  FILES_URL,
  FILE_FIELDS,
  GAPI_SRC,
  GIS_SRC,
  GOOGLE_API_KEY,
  GOOGLE_CLIENT_ID,
  appIdFromClientId,
  createFileBody,
  docFromPicked,
  downloadUrl as driveDownloadUrl,
  driveConfigured,
  driveIdentity,
  mediaUrl as driveMediaUrl,
  metadataUrl as driveMetadataUrl,
  pdfFromPickerResult,
  pickerViewConfig,
  remoteChanged as driveRemoteChanged,
  searchUrl as driveSearchUrl,
  sidecarQuery,
  tokenClientConfig,
  tokenRequestOptions,
  updateUrl as driveUpdateUrl,
} from "./gdrive.js";
import {
  DOWNLOAD_URL,
  LIST_MORE_URL,
  LIST_URL,
  META_URL,
  SYNC_POLL_MS,
  REVOKE_URL,
  TOKEN_URL,
  UPLOAD_URL,
  asciiHeader,
  authorizeUrl,
  challengeFor,
  docFromEntry,
  downloadArg,
  dropboxIdentity,
  isConflict,
  makeVerifier,
  copyNameFor,
  ensurePdfName,
  joinPath,
  parentPath,
  pdfEntries,
  saveAsArg,
  remoteChanged,
  refreshBody,
  sessionFromToken,
  tokenBody,
  tokenExpired,
  uploadArg,
} from "./dropbox.js";
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
import { addCapture, findCapture, sanitizeCaptures } from "./captureReg.js";
import { captureRegionPng, composePageRgba, cropRgba, encodePngRgba, readPngText, writePngClipboard } from "./capture.js";
import {
  pasteAvailability,
  pastePlacement,
  privatePasteApp,
  privatePasteMessage,
  readClipboardImage,
  readPasteEvent,
} from "./clipboardPaste.js";
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
  trueSizeOnPage,
} from "./image.js";
import { addRotation, angleDegFromCenter, imagePaintDest, normalizeRotation, rotateItems, rotateSelectedItems } from "./rotate.js";
import {
  filterLeaves,
  inkKey,
  insertOutlineAfter,
  leafAt,
  nearestPdfLeaf,
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
  inkSignature,
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
  makeOutlineEntry,
  normalizeOutline,
  flattenOutline,
  firstOutlineEntryForPage,
  firstOutlineTitleForPage,
  outlineDestPage,
  outlinePageLabel,
  outlineTitleForPage,
  renameOutlineEntry,
  setOutlineTitleText,
  tocRowAction,
} from "./outline.js";
import {
  HIGHLIGHTER_OPACITY_DEFAULT,
  HIGHLIGHTER_PALETTE,
  PENCIL_COLOR,
  PEN_PALETTE,
  STAMP_LABELS,
  addRecentColor,
  clampOpacity,
  defaultColorForKind,
  hexToHsv,
  hexToRgba,
  hsvToHex,
  isLightHex,
  normalizeHex,
  normalizeStamp,
  resizeStamp,
  slotAriaLabel,
  stampPaintLayout,
  wheelPick,
  wheelSpot,
  widthLabel,
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
  penButtonBtn: document.querySelector("#pen-button-btn"),
  shareThumbsBtn: document.querySelector("#share-thumbs-btn"),
  docTitle: document.querySelector("#doc-title"),
  workspace: document.querySelector("#workspace"),
  writeSplit: document.querySelector("#write-split"),
  splitPane: document.querySelector("#split-pane"),
  splitTabs: document.querySelector("#split-tabs"),
  splitStage: document.querySelector("#split-stage"),
  areaLayer: document.querySelector("#area-layer"),
  areaLinkPanel: document.querySelector("#area-link-panel"),
  inkMoveSheet: document.querySelector("#ink-move-sheet"),
  inkMoveBackdrop: document.querySelector("#ink-move-backdrop"),
  inkMoveHint: document.querySelector("#ink-move-hint"),
  inkMoveDocs: document.querySelector("#ink-move-docs"),
  inkMoveDone: document.querySelector("#ink-move-done"),
  inkMoveApply: document.querySelector("#ink-move-apply"),
  inkMoveMode: document.querySelector("#ink-move-mode"),
  inkMoveReplace: document.querySelector("#ink-move-replace"),
  inkMovePanes: document.querySelector("#ink-move-panes"),
  inkMoveLeft: document.querySelector("#ink-move-left"),
  inkMoveRight: document.querySelector("#ink-move-right"),
  inkMoveModebar: document.querySelector("#ink-move-modebar"),
  inkMoveModeAdd: document.querySelector("#ink-move-mode-add"),
  inkMoveModeInsert: document.querySelector("#ink-move-mode-insert"),
  inkMoveSkip: document.querySelector("#ink-move-skip"),
  penHover: document.querySelector("#pen-hover"),
  ratioBtn: document.querySelector("#ratio-btn"),
  linkFixPanel: document.querySelector("#link-fix-panel"),
  linkFixOrigin: document.querySelector("#link-fix-origin"),
  linkFixPage: document.querySelector("#link-fix-page"),

  linkFixUrl: document.querySelector("#link-fix-url"),
  linkFixSave: document.querySelector("#link-fix-save"),
  linkFixBulk: document.querySelector("#link-fix-bulk"),
  linkFixClear: document.querySelector("#link-fix-clear"),
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
  linkHintsBtn: document.querySelector("#link-hints-btn"),
  penProbe: document.querySelector("#pen-probe"),
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
  updateNote: document.querySelector("#update-note"),
  updateReload: document.querySelector("#update-reload"),
  updateDismiss: document.querySelector("#update-dismiss"),
  syncNote: document.querySelector("#sync-note"),
  syncNoteText: document.querySelector("#sync-note-text"),
  syncReload: document.querySelector("#sync-reload"),
  syncDismiss: document.querySelector("#sync-dismiss"),
  dropboxOpen: document.querySelector("#dropbox-open"),
  gdriveOpen: document.querySelector("#gdrive-open"),
  dropboxSheet: document.querySelector("#dropbox-sheet"),
  dropboxBackdrop: document.querySelector("#dropbox-backdrop"),
  dropboxClose: document.querySelector("#dropbox-close"),
  dropboxList: document.querySelector("#dropbox-list"),
  dropboxPath: document.querySelector("#dropbox-path"),
  dropboxUp: document.querySelector("#dropbox-up"),
  dropboxLogout: document.querySelector("#dropbox-logout"),
  dropboxSave: document.querySelector("#dropbox-save"),
  dropboxName: document.querySelector("#dropbox-name"),
  dropboxSaveGo: document.querySelector("#dropbox-save-go"),
  dropboxHere: document.querySelector("#dropbox-here"),
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
  tocMenu: document.querySelector("#toc-menu"),
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
  buildTag: document.querySelector("#build-tag"),
  slotPanel: document.querySelector("#slot-panel"),
  slotPalette: document.querySelector("#slot-palette"),
  colorPick: document.querySelector("#color-pick"),
  slotOpacity: document.querySelector("#slot-opacity"),
  slotOpacityRow: document.querySelector("#slot-opacity-row"),
  slotWidth: document.querySelector("#slot-width"),
  slotWidthValue: document.querySelector("#slot-width-value"),
  eyedropBtn: document.querySelector("#eyedrop-btn"),
  wheelPanel: document.querySelector("#wheel-panel"),
  wheelDisc: document.querySelector("#wheel-disc"),
  wheelValue: document.querySelector("#wheel-value"),
  wheelHex: document.querySelector("#wheel-hex"),
  wheelPreview: document.querySelector("#wheel-preview"),
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
  // #178: 파일이 들고 온 링크. 쪽·회전별로 한 번만 읽는다.
  pdfLinks: new Map(),
  // #198: 이름 목적지는 문서마다 한 번만 찾는다.
  destCache: new Map(),
  // #190: 그중 사람이 고쳐 준 것.
  linkFixes: {},
  // #83: 지운 항목의 무덤 — 병합이 부활을 막는 근거.
  inkGone: {},
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
  // #224: 끄면 비율대로, 켜면 자유롭게 늘어난다.
  freeRatio: loadFreeRatio(),
  // #230: 링크 자리를 색으로 보여 줄까. 판정과는 무관하다.
  linkHints: loadLinkHints(),
  // #206: 스포이드가 다음 탭을 기다리는 중인가.
  eyedropKind: null,
  // #240: 마지막으로 오려 낸 자리. 붙일 때 제자리를 안다.
  captureFrom: null,
  // #256: 이 브라우저의 캡처 등록부(지문→자리).
  captures: sanitizeCaptures(loadCaptures()),
  editingKind: null,
  penOnly: loadPenOnly(),
  penButtonErase: loadPenButtonErase(),
  penButtons: loadPenButtons(),
  recentColors: loadRecentColors(),
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
  previewTab: "pages",
  pageClip: null,
  fileHandle: null,
  dropbox: null,
  dropboxDoc: null,
  inkSavedAt: 0,
  shareThumbs: false,
  thumbPackKeys: null,
  driveDoc: null,
  driveSidecarId: "",
  driveToken: "",
  dropboxPath: "",
  dropboxMode: "open",
  inkCopy: "sidecar",
  stickers: [],
  stickerFolders: [],
  stickerFolder: DEFAULT_FOLDER_ID,
  stickerPick: null,
  stickerMenuAt: null,
  lockMenuAt: null,
  tocMenuAt: null,
  studioTool: "chroma",
  studioScale: 1,
  pageMenuAt: 0,
  pickMode: false,
  pickedPages: [],
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
// #171: the one pointer this stroke answers to.
let strokePointerId = null;
let strokeRect = null;
// #208: 브라우저가 내다본 펜의 다음 위치. 화면에만 그려지고 저장되지 않는다.
let predictedTail = [];
let chipMenuBox = null;
let frozenEndClient = null;
let renderGen = 0;
let paperScrollHold = null;
const pageCache = createPaintCache(PAGE_BITMAP_LIMIT);
const thumbCache = createPaintCache(THUMB_BITMAP_LIMIT);
/** Page pictures without ink: one per page, worth keeping on disk (#143). */
const pageThumbCache = createPaintCache(THUMB_BITMAP_LIMIT);
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

let strokesDirty = false;
let strokeSaveTimer = 0;

/**
 * 이 저장이 획 사이의 끊김이었다 (#208): 획 하나 끝날 때마다 **문서 전체**
 * 필기를 stringify해서, 필기가 쌓일수록 입력이 밀렸다. 이제 더럽다고 표시만
 * 하고 한가할 때 쓴다. 떠날 때(pagehide·숨김·다른 문서)는 그 자리에서 쓴다.
 */
function writeStrokesNow() {
  if (!strokesDirty || !state.identity) {
    return;
  }
  strokesDirty = false;
  try {
    saveStrokes(state.identity, state.pages, state.leaves, state.outline, state.inkGone);
  } catch {
    showBanner("필기를 저장하지 못했습니다. 브라우저 저장 공간이 부족할 수 있습니다.");
  }
}

function scheduleStrokeSave() {
  if (strokeSaveTimer) {
    return;
  }
  const idle = window.requestIdleCallback || ((fn) => window.setTimeout(fn, 250));
  strokeSaveTimer = idle(() => {
    strokeSaveTimer = 0;
    if (state.drawing) {
      // 손이 종이에 있는 동안은 절대 안 쓴다.
      scheduleStrokeSave();
      return;
    }
    writeStrokesNow();
  }, { timeout: 1500 });
}

function persistStrokes() {
  if (!state.identity) {
    return;
  }
  scheduleInkAutosave();
  strokesDirty = true;
  scheduleStrokeSave();
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
  state.inkGone = goneAfterChange(before, after, state.inkGone);
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

/**
 * The layer under the pen tip, and the only one repainted every frame (#172).
 * `willReadFrequently` would put it back on the CPU and we never read it back,
 * so it does not get that.
 *
 * It does not get `desynchronized` either (#192). A low-latency surface is the
 * shortest path from the nib to the glass, but this layer sits **over the
 * page** and has to stay transparent — on some Android GPUs that surface comes
 * up opaque, and then the whole page reads black. Speed is not worth a page
 * you cannot see.
 */
function liveCanvas2d(canvas) {
  return canvas.getContext("2d");
}

/*
 * 그리는 중인 획을 워커가 칠한다 (#208). 메인 스레드가 잠깐 막혀도 획이
 * 화면에서 끊기지 않는다. OffscreenCanvas가 없는 브라우저는 예전 경로.
 */
let liveWorker = null;
let liveCanvasSeq = 0;

function liveWorkerReady() {
  if (liveWorker !== null) {
    return liveWorker;
  }
  liveWorker = false;
  try {
    if (typeof Worker === "function" && "transferControlToOffscreen" in HTMLCanvasElement.prototype) {
      liveWorker = new Worker(new URL("./livePaint.worker.js", import.meta.url), { type: "module" });
    }
  } catch {
    liveWorker = false;
  }
  return liveWorker;
}

function adoptLiveCanvas(view) {
  const worker = liveWorkerReady();
  if (!worker) {
    return;
  }
  try {
    const off = view.liveCanvas.transferControlToOffscreen();
    liveCanvasSeq += 1;
    view.liveId = liveCanvasSeq;
    worker.postMessage({ type: "canvas", id: view.liveId, canvas: off }, [off]);
  } catch {
    view.liveId = null;
  }
}

function postLiveSize(view, width, height) {
  if (view.liveId != null && liveWorker) {
    liveWorker.postMessage({ type: "size", id: view.liveId, width, height });
  }
}

function dropLiveCanvas(view) {
  if (view?.liveId != null && liveWorker) {
    liveWorker.postMessage({ type: "drop", id: view.liveId });
    view.liveId = null;
  }
}

function clearLiveLayer(view) {
  if (view?.liveId != null && liveWorker) {
    liveWorker.postMessage({ type: "clear", id: view.liveId });
    return;
  }
  const canvas = view?.liveCanvas;
  if (canvas) {
    liveCanvas2d(canvas).clearRect(0, 0, canvas.width, canvas.height);
  }
}

/** Only the stroke in progress, on its own layer: cost does not grow with the page. */
function drawLiveLayer(view, stroke) {
  const canvas = view?.liveCanvas;
  if (!canvas) {
    return;
  }
  // #208: 브라우저가 예측한 다음 위치까지 그려 펜 끝이 손을 따라붙는다.
  // 예측 꼬리는 여기서만 보이고, 획에 저장되지는 않는다.
  const shown =
    predictedTail.length && stroke?.points?.length
      ? { ...stroke, points: [...stroke.points, ...predictedTail] }
      : stroke;
  if (view.liveId != null && liveWorker) {
    liveWorker.postMessage({
      type: "stroke",
      id: view.liveId,
      item: shown?.points?.length ? shown : null,
      scale: strokeScale(view),
    });
    return;
  }
  const ctx = liveCanvas2d(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (shown?.points?.length) {
    paintItem(ctx, shown, strokeScale(view), canvas);
  }
}

function drawStrokesOn(view, liveStroke = null) {
  clearLiveLayer(view);
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
  // #260: 이미지는 모두 잉크 아래에. 그래야 붙여넣은 그림 위에 바로 필기할 수
  // 있다. 고르기·옮기기는 좌표로 하므로 아래 있어도 잡힌다. overCanvas는 비운다.
  paintImageLayer(view.underCanvas, items, null, () => drawStrokesOn(view));
  const over = canvas2d(view.overCanvas);
  over.clearRect(0, 0, view.overCanvas.width, view.overCanvas.height);
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
    // locked === null 이면 모든 이미지 (#260).
    if (item.type !== "image" || (locked !== null && Boolean(item.locked) !== locked)) {
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

let livePaintPending = false;

/**
 * One paint per frame (#135). A plain pen/highlighter/pencil stroke only
 * repaints the live layer; the eraser and the shape chips still need the whole
 * page, because what they show depends on the committed items.
 */
function drawLive() {
  const view = state.pageViews.find((item) => item.pageNum === state.drawPage);
  if (!view) {
    return;
  }
  const stroke = state.currentStroke;
  const simple =
    stroke &&
    !isPixelErase(stroke) &&
    !isStrokeErase(stroke) &&
    !state.shapeOffer &&
    !state.stampGhost;
  if (!simple) {
    drawStrokesOn(view, stroke);
    return;
  }
  if (livePaintPending) {
    return;
  }
  livePaintPending = true;
  window.requestAnimationFrame(() => {
    livePaintPending = false;
    if (state.drawing && state.currentStroke) {
      drawLiveLayer(view, state.currentStroke);
    }
  });
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
  // #135: the stroke in progress lives here, so a page full of ink stays cheap.
  const liveCanvas = document.createElement("canvas");
  liveCanvas.className = "live-canvas";
  const maskCanvas = document.createElement("canvas");
  maskCanvas.className = "mask-canvas";
  const underCanvas = document.createElement("canvas");
  underCanvas.className = "under-canvas";
  const overCanvas = document.createElement("canvas");
  overCanvas.className = "over-canvas";
  // #180: where the file's own links are. Percent boxes, so zoom needs no redraw.
  const linkLayer = document.createElement("div");
  linkLayer.className = "pdf-link-layer";
  stage.append(pdfCanvas, underCanvas, inkCanvas, liveCanvas, overCanvas, maskCanvas, linkLayer);
  const view = {
    pageNum,
    stage,
    pdfCanvas,
    inkCanvas,
    liveCanvas,
    maskCanvas,
    underCanvas,
    overCanvas,
    linkLayer,
    rendered: false,
    token: 0,
  };
  adoptLiveCanvas(view);
  return view;
}

function applyPageSize(view, cssWidth, cssHeight, pixelWidth, pixelHeight) {
  view.cssWidth = cssWidth;
  view.cssHeight = cssHeight;
  view.stage.style.width = `${cssWidth}px`;
  view.stage.style.height = `${cssHeight}px`;
  for (const canvas of [
    view.pdfCanvas,
    view.underCanvas,
    view.inkCanvas,
    view.liveCanvas,
    view.overCanvas,
    view.maskCanvas,
  ]) {
    if (!(canvas === view.liveCanvas && view.liveId != null)) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
  }
  // #192: the layer over the page must be empty after a resize, not whatever
  // the last page left behind.
  clearLiveLayer(view);
  // #208: 넘긴 캔버스의 픽셀 크기는 워커만 만질 수 있다.
  postLiveSize(view, pixelWidth, pixelHeight);
}

/** Blank page size: the same paper as the page it was put next to (#118). */
async function blankPageCss(leaf) {
  const base = await basePageCss();
  const fallback = outlineViewport(base.width, base.height, leaf?.rotate || 0);
  if (!state.pdf) {
    return fallback;
  }
  const index = state.leaves.findIndex((item) => item.id === leaf?.id);
  const near = nearestPdfLeaf(state.leaves, index < 0 ? 0 : index);
  if (!near) {
    return fallback;
  }
  try {
    const page = await state.pdf.getPage(near.pdfPage);
    const rotation = normalizeRotation((page.rotate || 0) + (leaf?.rotate || 0));
    const viewport = page.getViewport({ scale: fitScale(page, state.viewMode, rotation), rotation });
    return { width: viewport.width, height: viewport.height };
  } catch {
    return fallback;
  }
}

/** Letterboxes the thumb in the row box, so a turned page is not stretched (#122). */
function fitThumbElement(canvas, size) {
  const w = canvas.width || 1;
  const h = canvas.height || 1;
  const scale = Math.min(size.width / w, size.height / h);
  canvas.style.width = `${Math.max(1, Math.round(w * scale))}px`;
  canvas.style.height = `${Math.max(1, Math.round(h * scale))}px`;
}

/** Thumb shape for a blank page: the neighbour page's aspect (#118). */
async function blankThumbShape(leaf, size) {
  const wide = Math.round(size.width * 2);
  const tall = Math.round(size.height * 2);
  if (!state.pdf) {
    return { width: wide, height: tall };
  }
  const index = state.leaves.findIndex((item) => item.id === leaf?.id);
  const near = nearestPdfLeaf(state.leaves, index < 0 ? 0 : index);
  if (!near) {
    return { width: wide, height: tall };
  }
  try {
    const page = await state.pdf.getPage(near.pdfPage);
    const rotation = normalizeRotation((page.rotate || 0) + (leaf?.rotate || 0));
    const base = page.getViewport({ scale: 1, rotation });
    const scale = Math.min(wide / base.width, tall / base.height);
    return {
      width: Math.max(1, Math.round(base.width * scale)),
      height: Math.max(1, Math.round(base.height * scale)),
    };
  } catch {
    return { width: wide, height: tall };
  }
}

/**
 * 한 뷰의 pdf 캔버스에는 렌더가 하나만 돈다 (#258). pdf.js는 같은 캔버스에
 * 두 render()가 겹치면 던진다. 새로 그리기 전에 진행 중인 것을 취소하고,
 * 취소로 생기는 예외는 정상 흐름이므로 삼킨다.
 */
async function renderPdfPage(view, page, ctx, viewport) {
  if (view.renderTask) {
    try {
      view.renderTask.cancel();
    } catch {
      // 이미 끝났을 수 있다.
    }
  }
  const task = page.render({ canvasContext: ctx, viewport });
  view.renderTask = task;
  try {
    await task.promise;
  } catch (error) {
    // 취소는 우리가 시킨 것 — 오류가 아니다.
    if (error?.name === "RenderingCancelledException") {
      return "cancelled";
    }
    throw error;
  } finally {
    if (view.renderTask === task) {
      view.renderTask = null;
    }
  }
  return "done";
}

async function renderPageView(view) {
  const token = ++view.token;
  const leaf = leafAt(state.leaves, view.pageNum);
  const dpr = window.devicePixelRatio || 1;
  if (!leaf || leaf.kind === "outline" || !state.pdf) {
    const css = await blankPageCss(leaf);
    if (token !== view.token) {
      return;
    }
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
    // A blank page is paper, not a sign: white, no lettering (#118).
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, view.pdfCanvas.width, view.pdfCanvas.height);
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
  // #258: 링크로 쪽을 넘기면 이전 렌더가 같은 캔버스에서 아직 돌 수 있다.
  // token은 결과만 버릴 뿐 render()를 멈추지 않아 「같은 캔버스 중복 렌더」가
  // 났다. 새 렌더 전에 진행 중인 것을 취소한다.
  if (await renderPdfPage(view, page, ctx, pixel) === "cancelled" || token !== view.token) {
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
  clearPdfLinkHints(pooled);
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
  refreshPdfLinkHints();
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
  for (const view of [...state.pageViews, ...stagePool]) {
    dropLiveCanvas(view);
  }
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
  // #182: page mode renders its one view here, so nothing else asks for hints.
  refreshPdfLinkHints();
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
    clearPdfLinkHints(view);
  }
  const cached = pageCache.get(pageViewCacheKey(view));
  if (cached && restorePageBitmap(view, cached)) {
    drawStrokesOn(view, state.drawing && state.drawPage === view.pageNum ? state.currentStroke : null);
    updateMarquee();
    updateAreaHits();
    refreshPdfLinkHints();
    return;
  }
  await renderPageView(view);
  cachePageView(view);
  updateMarquee();
  updateAreaHits();
  refreshPdfLinkHints();
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
  stopThumbWarming();
  state.thumbPackKeys = null;
  // #178: another file's links must not answer for this one.
  state.pdfLinks = new Map();
  state.destCache = new Map();
  hideLinkFixPanel();
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

function newStroke(point, forceEraser = false) {
  if (forceEraser || state.tool === "eraser") {
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
    // #83: 병합이 획을 구분하는 이름표.
    id: newItemId(),
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

/**
 * The table of contents and the stars ride inside the file (#145), so another
 * computer sees them. What the reader edited here wins: the file is only read
 * when this browser has nothing for that document.
 */
/**
 * A destination is either a name the file has to look up or an explicit array
 * whose first entry is a page reference. Used by the table of contents (#145)
 * and by the file's own links (#178).
 */
/**
 * Looking a name up walks the file's destination table, and a planner can hold
 * ten thousand links pointing at nineteen hundred names (#198). Resolve each
 * name once per document; an array needs no lookup at all.
 */
async function explicitDest(dest, pdf = state.pdf) {
  if (!pdf || dest === null || dest === undefined) {
    return null;
  }
  if (typeof dest !== "string") {
    return dest;
  }
  const mine = pdf === state.pdf;
  if (mine && state.destCache.has(dest)) {
    return state.destCache.get(dest);
  }
  let found = null;
  try {
    found = await pdf.getDestination(dest);
  } catch {
    found = null;
  }
  if (mine) {
    state.destCache.set(dest, found);
  }
  return found;
}

/**
 * Last resort when `getPageIndex` refuses a reference (#188): ask each page
 * what its own reference is. Costs one pass over the file, so it only runs
 * after the quick way failed, and only on a document small enough to scan.
 */
const PAGE_REF_SCAN_LIMIT = 600;

async function pageOfRefByScan(ref, pdf) {
  const count = Number(pdf?.numPages) || 0;
  if (!ref || !count || count > PAGE_REF_SCAN_LIMIT) {
    return 0;
  }
  for (let number = 1; number <= count; number += 1) {
    try {
      const page = await pdf.getPage(number);
      if (page?.ref && Number(page.ref.num) === Number(ref.num) && Number(page.ref.gen || 0) === Number(ref.gen || 0)) {
        return number;
      }
    } catch {
      // A page that will not load simply is not the one.
    }
  }
  return 0;
}

async function pdfPageOfDest(dest, pdf = state.pdf) {
  return pageOfExplicitDest(await explicitDest(dest, pdf), pdf);
}

async function pageOfExplicitDest(explicit, pdf = state.pdf) {
  const target = destTarget(explicit);
  if (!target) {
    return 0;
  }
  if (target.kind === "index") {
    // Already a page number; pdf.js would only refuse to look it up (#186).
    return target.page >= 1 && target.page <= (pdf?.numPages || 0) ? target.page : 0;
  }
  try {
    return (await pdf.getPageIndex(target.ref)) + 1;
  } catch {
    return pageOfRefByScan(target.ref, pdf);
  }
}

/**
 * What to write back onto a page we are baking (#184). Rectangles stay in the
 * page's own coordinates, and a destination becomes the **position that page
 * holds now**, so reordering or deleting pages cannot leave a link dangling.
 */
async function exportLinksForLeaf(leaf) {
  if (!state.pdf || !leaf || leaf.kind === "outline") {
    return [];
  }
  const out = [];
  try {
    const page = await state.pdf.getPage(leaf.pdfPage);
    for (const annotation of (await page.getAnnotations({ intent: "display" })) || []) {
      const target = pdfLinkTarget(annotation);
      const rect = target ? pdfSpaceRect(annotation.rect) : null;
      if (!rect) {
        continue;
      }
      // #190: what the reader corrected is what gets written into the PDF.
      const fix = fixFor(leaf, { rect, link: target });
      if (fix?.kind === "url") {
        out.push({ rect, url: fix.href });
        continue;
      }
      const fixedPage = linkFixTarget(fix, state.leaves);
      if (fixedPage?.kind === "fixedPage") {
        out.push({ rect, page: fixedPage.page, view: ["Fit"] });
        continue;
      }
      if (fixedPage?.kind === "goneLeaf") {
        // The page it pointed at is not in this document; write no link.
        continue;
      }
      if (target.kind === "url") {
        out.push({ rect, url: target.href });
        continue;
      }
      if (target.kind !== "dest") {
        continue;
      }
      const explicit = await explicitDest(target.dest);
      const at = leafPositionForPdfPage(state.leaves, await pageOfExplicitDest(explicit));
      if (at) {
        out.push({ rect, page: at, view: destView(explicit) });
      }
    }
  } catch {
    // A page whose annotations will not read simply keeps none.
  }
  return out;
}

async function exportLinkMap() {
  const map = new Map();
  for (const leaf of state.leaves || []) {
    map.set(leaf.id, await exportLinksForLeaf(leaf));
  }
  return map;
}

async function importPdfOutline(pdf) {
  let items = null;
  try {
    items = await pdf.getOutline();
  } catch {
    items = null;
  }
  if (!items?.length) {
    return;
  }
  const pageOfDest = (dest) => pdfPageOfDest(dest, pdf);
  if (!state.outline.length) {
    const entries = [];
    for (const item of flattenOutlineItems(items)) {
      const page = await pageOfDest(item.dest);
      if (page) {
        entries.push(makeOutlineEntry(page, { title: item.title }));
      }
    }
    if (entries.length) {
      state.outline = normalizeOutline(entries, state.leaves);
    }
  }
  const marks = bookmarkPagesFromItems(items);
  if (marks.length && !state.leaves.some((leaf) => leaf.bookmark)) {
    state.leaves = applyBookmarkPages(state.leaves, marks);
  }
}

async function openPdfBuffer(buffer, { identity, name, page = 1, handle = null }) {
  // #208: 아직 안 쓴 필기는 지금 문서 것이다 — 정체가 바뀌기 전에 쓴다.
  writeStrokesNow();
  // Always replace: a handle from the previous file must never write this one.
  state.fileHandle = handle;
  if (!String(identity || "").startsWith("dbx::")) {
    state.dropboxDoc = null;
  }
  if (!String(identity || "").startsWith("gdrive::")) {
    state.driveDoc = null;
    state.driveSidecarId = "";
  }
  state.pdfLinks = new Map();
  state.destCache = new Map();
  hideLinkFixPanel();
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
  state.inkGone = sanitizeGone(stored.gone);
  // #190: the corrections this browser knows; a sidecar may add more.
  state.linkFixes = sanitizeLinkFixes(loadLinkFixes(identity));
  state.leaves = normalizeLeaves(stored.leaves, pdf.numPages);
  state.pageCount = state.leaves.length;
  state.page = Math.min(Math.max(1, page), state.pageCount);
  state.pages = stored.pages;
  state.outline = normalizeOutline(stored.outline, state.leaves);
  anchorLinkFixesNow();
  await importPdfOutline(pdf);
  state.baseCss = { width: 0, height: 0 };
  resetEditorExtras();
  state.renderFactor = 1;
  if (!state.zoomLock) {
    state.userScale = 1;
    state.panX = 0;
    state.panY = 0;
  }
  els.docTitle.textContent = displayName(name);
  // #127: opens locked, and that moment is the sync check.
  state.interactMode = "view";
  hideSyncNote();
  showDocumentUi();
  showBanner("");
  await rebuildPages();
  await persistSession();
  startSyncWatch();
  askPersistentStorage();
  warmThumbs();
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
    !els.stickerSheet.hidden ||
    !els.wheelPanel.hidden
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
  strokePointerId = null;
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
  // #137·#139: a pen also arrives on button 1 (second), 2 (barrel), 5 (eraser).
  if (!state.pdf || !allowsInkButton({ pointerType: event.pointerType, button: event.button })) {
    return;
  }
  const penAction = penButtonAction({
    pointerType: event.pointerType,
    buttons: event.buttons,
    button: event.button,
    buttonMap: state.penButtons,
    enabled: state.penButtonErase,
  });
  if (penAction === "select") {
    // Picking needs the tool on, or the selection has no handles to work with.
    selectSelectTool();
    startSelect(event, stage);
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
  // #171: from here on, only this pointer touches this stroke.
  strokePointerId = event.pointerId ?? null;
  strokeRect = ink.getBoundingClientRect();
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
  predictedTail = [];
  // 지우개는 그 획만 지우고 도구는 그대로 (#137).
  state.currentStroke = newStroke(point, penAction === "eraser");
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
  // A palm on the toolbar is not this stroke, however close it lands (#171).
  if (!isStrokePointer(strokePointerId, event.pointerId)) {
    return;
  }
  if (!allowsInkPointer(event)) {
    return;
  }
  event.preventDefault();
  // #135: a pen reports faster than the screen refreshes, so take every sample.
  const samples = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];
  const client = { x: event.clientX, y: event.clientY };
  // #172: measure the page once per event, not once per sample.
  strokeRect = state.drawCanvas.getBoundingClientRect();
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
    const batch = [];
    for (const sample of samples.length > 1 ? samples.slice(0, -1) : []) {
      const at = { x: sample.clientX, y: sample.clientY };
      batch.push({ norm: normFromRect(strokeRect, at), client: at });
    }
    batch.push({ norm: normFromRect(strokeRect, client), client });
    state.currentStroke.points = appendInkPoints(state.currentStroke.points, batch, lastInkUpClient);
    const ahead = typeof event.getPredictedEvents === "function" ? event.getPredictedEvents() : [];
    // #210: 예측을 다 그리면 곡선에서 과예측이 물러나며 아른거린다. 두 점이면
    // 펜 끝을 따라붙는 효과는 그대로고 흔들림은 안 보인다.
    predictedTail = ahead.slice(0, 2).map((sample) => normFromRect(strokeRect, { x: sample.clientX, y: sample.clientY }));
    if (canShapeHold(state.currentStroke.type)) {
      shapeHold.rememberPoints(state.currentStroke.points);
      frozenEndClient = client;
    }
  } else if (canShapeHold(state.currentStroke.type)) {
    predictedTail = [];
    restoreFrozenStroke();
    if (!chipHit && (chipsUp || state.shapeOffer) && !shapeHold.isOffering()) {
      dismissShapeChips();
      lockedStrokePoints = null;
    }
  }
  drawLive();
}

function endStroke(event) {
  if (!isStrokePointer(strokePointerId, event.pointerId)) {
    return;
  }
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
    strokePointerId = null;
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
  // 예측은 예측일 뿐이다: 손을 뗀 획에 남으면 없는 선이 저장된다.
  predictedTail = [];
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
    strokePointerId = null;
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
  strokePointerId = null;
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
  els.shareThumbsBtn?.classList.toggle("is-on", state.shareThumbs);
  els.shareThumbsBtn?.setAttribute("aria-pressed", state.shareThumbs ? "true" : "false");
  els.penButtonBtn?.classList.toggle("is-on", state.penButtonErase);
  els.penButtonBtn?.setAttribute("aria-pressed", state.penButtonErase ? "true" : "false");
  document.querySelectorAll("#pen-barrel-choices [data-pen-barrel]").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.penBarrel === state.penButtons.barrel);
  });
  document.querySelectorAll("#pen-second-choices [data-pen-second]").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.penSecond === state.penButtons.second);
  });
}

function syncZoomLock() {
  els.zoomLockBtn.classList.toggle("is-on", state.zoomLock);
  els.zoomLockBtn.setAttribute("aria-pressed", state.zoomLock ? "true" : "false");
}

/** 제 스위치는 제 함수로 (#232). 남의 함수에 얹혀 있으면 다음에 또 엉킨다. */
/** 커서는 도구·모드·스포이드를 따라간다 (#234). */
function syncCursor() {
  els.writeScreen.dataset.cursor = cursorForTool({
    interactMode: state.interactMode,
    tool: state.tool,
    rectTool: state.rectTool,
    eyedrop: Boolean(state.eyedropKind),
  });
}

function syncLinkHints() {
  if (!els.linkHintsBtn) {
    return;
  }
  els.linkHintsBtn.classList.toggle("is-on", state.linkHints);
  els.linkHintsBtn.setAttribute("aria-pressed", state.linkHints ? "true" : "false");
  els.writeScreen.dataset.linkHints = state.linkHints ? "on" : "off";
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
  syncCursor();
}

function syncRectTool() {
  els.writeScreen.dataset.rect = state.rectTool || "";
  els.moreBtn.classList.toggle("is-selected", Boolean(state.rectTool) || !els.morePanel.hidden);
  document.querySelectorAll("#more-panel [data-more]").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.more === state.rectTool);
  });
  syncCursor();
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
  syncLinkHints();
  if (!usesStamp()) {
    state.pendingStamp = null;
    clearStampGhost();
  }
  syncCursor();
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
  hideTocMenu();
  clearPagePick();
  if (!els.previewDrawer) {
    return;
  }
  els.previewDrawer.hidden = true;
  els.writeScreen.dataset.preview = "";
  syncPreviewButton();
  refitPages();
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
  closeWheelPanel();
  hideLinkFixPanel();
  closeSlotPanel();
  closeEraserPanel();
  closeMorePanel();
  hidePageMenu();
  hideTocMenu();
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

/** A hold on the swatch opens the picker; a tap still just takes that colour. */
function bindColorHold(btn, hex) {
  let timer = 0;
  let fired = false;
  const stop = () => {
    window.clearTimeout(timer);
    timer = 0;
  };
  btn.addEventListener("pointerdown", () => {
    fired = false;
    timer = window.setTimeout(() => {
      timer = 0;
      fired = true;
      openColorPicker(hex);
    }, PAGE_HOLD_MS);
  });
  btn.addEventListener("pointermove", stop);
  btn.addEventListener("pointerup", () => {
    stop();
    if (fired) {
      // The picker is open: the tap must not also pick this swatch.
      window.setTimeout(() => {
        fired = false;
      }, 0);
    }
  });
  btn.addEventListener("pointercancel", stop);
  btn.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    stop();
    openColorPicker(hex);
  });
  btn.addEventListener("click", (event) => {
    if (fired) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
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

/* ---- 색상환·스포이드 (#206) ------------------------------------------- */

let wheelHsv = { h: 0, s: 0, v: 0 };
let wheelDot = null;

function closeWheelPanel() {
  if (els.wheelPanel) {
    els.wheelPanel.hidden = true;
  }
}

/** 원판은 밝기가 바뀔 때만 다시 그린다. 220px이면 픽셀 4만 개, 한 번은 싸다. */
function drawWheelDisc() {
  const canvas = els.wheelDisc;
  if (!canvas) {
    return;
  }
  const size = canvas.width;
  const radius = size / 2;
  const ctx = canvas.getContext("2d");
  const shot = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const at = (y * size + x) * 4;
      const { h, s } = wheelPick(x, y, radius, radius, radius);
      const dist = Math.hypot(x - radius, y - radius);
      if (dist > radius) {
        shot.data[at + 3] = 0;
        continue;
      }
      const hex = hsvToHex(h, s, wheelHsv.v);
      shot.data[at] = Number.parseInt(hex.slice(1, 3), 16);
      shot.data[at + 1] = Number.parseInt(hex.slice(3, 5), 16);
      shot.data[at + 2] = Number.parseInt(hex.slice(5, 7), 16);
      // 가장자리 한 픽셀만 부드럽게.
      shot.data[at + 3] = dist > radius - 1 ? Math.round((radius - dist) * 255) : 255;
    }
  }
  ctx.putImageData(shot, 0, 0);
  const spot = wheelSpot(wheelHsv.h, wheelHsv.s, radius, radius, radius);
  ctx.beginPath();
  ctx.arc(spot.x, spot.y, 6, 0, Math.PI * 2);
  ctx.strokeStyle = wheelHsv.v > 0.6 ? "#1A1A1A" : "#FFFFFF";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function syncWheelReadout() {
  const hex = hsvToHex(wheelHsv.h, wheelHsv.s, wheelHsv.v);
  els.wheelHex.textContent = hex;
  els.wheelPreview.style.setProperty("--swatch", hex);
  return hex;
}

/**
 * 옛 페인터의 색상환 (#206): 원판에서 각도가 색·거리가 채도, 미끄럼대가
 * 밝기. 손을 떼는 순간 적용되고 최근 색에 남는다(#158과 같은 경로).
 */
function openColorPicker(startHex) {
  if (!els.wheelPanel || !state.editingKind) {
    return;
  }
  wheelHsv = hexToHsv(normalizeHex(startHex, "#1A1A1A"));
  els.wheelValue.value = String(Math.round(wheelHsv.v * 100));
  els.wheelPanel.hidden = false;
  const slot = els.slotPanel.getBoundingClientRect();
  const box = els.wheelPanel.getBoundingClientRect();
  const left = Math.min(Math.max(8, slot.left), window.innerWidth - box.width - 8);
  const top = Math.min(Math.max(8, slot.top - box.height - 8), window.innerHeight - box.height - 8);
  els.wheelPanel.style.left = `${left}px`;
  els.wheelPanel.style.top = `${top < 8 ? slot.bottom + 8 : top}px`;
  drawWheelDisc();
  syncWheelReadout();
}

function wheelPointFrom(event) {
  const box = els.wheelDisc.getBoundingClientRect();
  const scale = els.wheelDisc.width / (box.width || 1);
  return { x: (event.clientX - box.left) * scale, y: (event.clientY - box.top) * scale };
}

function bindWheelPanel() {
  if (!els.wheelDisc) {
    return;
  }
  els.wheelPanel.addEventListener("pointerdown", (event) => event.stopPropagation());
  const moveTo = (event) => {
    const point = wheelPointFrom(event);
    const radius = els.wheelDisc.width / 2;
    const picked = wheelPick(point.x, point.y, radius, radius, radius);
    wheelHsv = { ...wheelHsv, h: picked.h, s: picked.s };
    drawWheelDisc();
    syncWheelReadout();
  };
  els.wheelDisc.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    wheelDot = event.pointerId;
    try {
      els.wheelDisc.setPointerCapture(event.pointerId);
    } catch {
      // optional
    }
    moveTo(event);
  });
  els.wheelDisc.addEventListener("pointermove", (event) => {
    if (wheelDot === event.pointerId) {
      moveTo(event);
    }
  });
  const settle = (event) => {
    if (wheelDot !== event.pointerId) {
      return;
    }
    wheelDot = null;
    applyPickedColor(syncWheelReadout());
  };
  els.wheelDisc.addEventListener("pointerup", settle);
  els.wheelDisc.addEventListener("pointercancel", (event) => {
    wheelDot = null;
  });
  els.wheelValue.addEventListener("input", () => {
    wheelHsv = { ...wheelHsv, v: Number(els.wheelValue.value) / 100 };
    drawWheelDisc();
    syncWheelReadout();
  });
  els.wheelValue.addEventListener("change", () => {
    applyPickedColor(syncWheelReadout());
  });
}

/**
 * 스포이드 (#206): 종이 위의 색을 그대로 가져온다. PDF 잉크·필기·이미지가
 * 겹친 자리라면 눈에 보이는 그 색이다 — 층을 흰 바탕 위에 차례로 얹어 읽는다.
 */
function samplePaperColor(view, clientX, clientY) {
  const box = view.stage.getBoundingClientRect();
  const probe = offscreenCanvas(1, 1);
  const ctx = canvas2d(probe);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, 1, 1);
  for (const layer of [view.pdfCanvas, view.underCanvas, view.inkCanvas, view.overCanvas, view.maskCanvas]) {
    if (!layer?.width) {
      continue;
    }
    const x = ((clientX - box.left) / (box.width || 1)) * layer.width;
    const y = ((clientY - box.top) / (box.height || 1)) * layer.height;
    ctx.drawImage(layer, -x + 0.5, -y + 0.5);
  }
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function pickPaperColor(stage, clientX, clientY) {
  const view = state.pageViews.find((item) => item.stage === stage);
  const kind = state.eyedropKind;
  state.eyedropKind = null;
  if (!view || !kind) {
    return;
  }
  const hex = samplePaperColor(view, clientX, clientY);
  state.editingKind = state.editingKind || kind;
  state.inkTools[kind].color = hex;
  state.recentColors = addRecentColor(state.recentColors, hex);
  saveRecentColors(state.recentColors);
  persistSlotChange();
  flashBanner(`가져온 색 ${hex}`);
}

function armEyedropper() {
  if (!state.editingKind) {
    return;
  }
  state.eyedropKind = state.editingKind;
  closeSlotPanel();
  closeWheelPanel();
  flashBanner("종이를 탭하면 그 색을 가져옵니다", 3000);
}

function applyPickedColor(hex) {
  const value = normalizeHex(hex, "");
  if (!value || !state.editingKind) {
    return;
  }
  state.inkTools[state.editingKind].color = value;
  state.recentColors = addRecentColor(state.recentColors, value);
  saveRecentColors(state.recentColors);
  persistSlotChange();
  renderPalette(state.inkTools[state.editingKind]);
}

function paletteWithRecents(kind) {
  const base = paletteFor(kind);
  if (kind === "pencil") {
    return base;
  }
  const known = new Set(base.map((item) => item.hex.toLowerCase()));
  const extra = state.recentColors
    .filter((hex) => !known.has(String(hex).toLowerCase()))
    .map((hex) => ({ label: `색 ${hex}`, hex }));
  return [...base, ...extra];
}

function renderPalette(slot) {
  const root = els.slotPalette;
  root.replaceChildren();
  root.dataset.kind = slot.type;
  const colors = paletteWithRecents(slot.type);
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
    if (isLightHex(item.hex)) {
      btn.dataset.light = "1";
    }
    btn.classList.toggle("is-selected", item.hex.toLowerCase() === slot.color.toLowerCase());
    bindColorHold(btn, item.hex);
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
    // #206: 눈금만으로는 지금 몇인지 모른다.
    els.slotWidthValue.textContent = widthLabel(slot.width);
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

/**
 * 짧은 탭은 지우개를 켤 뿐, 모드는 쓰던 그대로다 (#210). 예전에는 탭마다
 * 픽셀 모드를 강제하고 저장까지 해서, 획 지우개로 정해 둔 것이 소리 없이
 * 뒤집혔다. 모드는 길게 눌러 여는 패널에서만 바꾼다.
 */
function selectEraser() {
  state.tool = "eraser";
  state.rectTool = null;
  clearSelection();
  hideMarquee();
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
  syncLinkHints();
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
  // 안쪽에 놓일 때는 반투명으로 — 가린 것이 비쳐야 무엇을 다루는지 보인다.
  els.floatBar.classList.toggle("is-inside", spot.placement === "inside");
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
  // #224: 비율 토글은 크기를 조절할 것이 있을 때만 뜬다(도장도 모서리로 늘린다).
  const sizable = Boolean(image) || selectedStampItem();
  els.ratioBtn.hidden = !sizable || cropping;
  els.ratioBtn.classList.toggle("is-on", state.freeRatio);
  els.ratioBtn.setAttribute("aria-pressed", state.freeRatio ? "true" : "false");
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
    restoreMarqueeCells();
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
  // #194: a page link means that sheet of paper, wherever it sits now.
  const at = areaLinkPage(link, state.leaves);
  const tab = splitTabFromLink(at ? { ...link, page: at } : link);
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

/**
 * The links the file came with, read once per page and rotation (#178).
 * They are not ours to edit, so they live beside the ink, not in it.
 */
async function loadPdfLinks(leaf) {
  if (!state.pdf || !leaf || leaf.kind === "outline") {
    return [];
  }
  const key = pdfLinkCacheKey(leaf.pdfPage, leaf.rotate);
  const cached = state.pdfLinks.get(key);
  if (cached) {
    return cached;
  }
  let items = [];
  try {
    const page = await state.pdf.getPage(leaf.pdfPage);
    const rotation = ((page.rotate || 0) + (leaf.rotate || 0)) % 360;
    const viewport = page.getViewport({ scale: 1, rotation });
    const annotations = await page.getAnnotations({ intent: "display" });
    for (const annotation of annotations || []) {
      const target = pdfLinkTarget(annotation);
      if (!target) {
        continue;
      }
      const box = normalizedLinkRect(
        viewport.convertToViewportRectangle(annotation.rect),
        viewport.width,
        viewport.height,
      );
      const item = pdfLinkItem(box, target, annotation.rect);
      if (item) {
        items.push(item);
      }
    }
  } catch {
    // A file with broken annotations still reads fine; it just has no links.
    items = [];
  }
  state.pdfLinks.set(key, items);
  return items;
}

/** Which link, if any, sits under a tap on this page. Smallest wins if they overlap. */
function pdfLinkAt(pageNum, x, y) {
  const leaf = leafAt(state.leaves, pageNum);
  if (!leaf) {
    return null;
  }
  const items = state.pdfLinks.get(pdfLinkCacheKey(leaf.pdfPage, leaf.rotate));
  if (!items?.length) {
    return null;
  }
  let best = null;
  for (const item of items) {
    if (x < item.x || x > item.x + item.w || y < item.y || y > item.y + item.h) {
      continue;
    }
    if (!best || item.w * item.h < best.w * best.h) {
      best = item;
    }
  }
  return best;
}

/**
 * Shows where the file's links are (#180). Without this you had to guess.
 * CSS reveals them only in 보기, because that is the only mode a tap follows
 * them in. Boxes are in percent, so zoom and page resize cost nothing.
 */
async function paintPdfLinkHints(view, force = false) {
  const layer = view?.linkLayer;
  if (!layer) {
    return;
  }
  const leaf = leafAt(state.leaves, view.pageNum);
  const key = leaf && leaf.kind !== "outline" && state.pdf ? pdfLinkCacheKey(leaf.pdfPage, leaf.rotate) : "";
  if (layer.dataset.key === key && !force) {
    return;
  }
  if (!key) {
    layer.dataset.key = "";
    layer.replaceChildren();
    return;
  }
  const items = await loadPdfLinks(leaf);
  // The view may have been handed another page while we waited.
  const stillHere = leafAt(state.leaves, view.pageNum);
  if (!stillHere || pdfLinkCacheKey(stillHere.pdfPage, stillHere.rotate) !== key) {
    return;
  }
  layer.dataset.key = key;
  layer.replaceChildren(
    ...items.map((item) => {
      const box = document.createElement("span");
      // #190: a link someone corrected reads differently, so it is marked.
      box.className = fixFor(leaf, item) ? "pdf-link-hint is-fixed" : "pdf-link-hint";
      box.style.left = `${item.x * 100}%`;
      box.style.top = `${item.y * 100}%`;
      box.style.width = `${item.w * 100}%`;
      box.style.height = `${item.h * 100}%`;
      return box;
    }),
  );
}

/** A pooled stage must not show the last page's links while the new one draws. */
function clearPdfLinkHints(view) {
  if (view?.linkLayer) {
    view.linkLayer.dataset.key = "";
    view.linkLayer.replaceChildren();
  }
}

function refreshPdfLinkHints(force = false) {
  for (const view of state.pageViews || []) {
    paintPdfLinkHints(view, force);
  }
}

/**
 * Opening a tab is only allowed while the tap is still "live", so this runs
 * with no await in front of it (#182). If the browser blocks it anyway, say so
 * instead of doing nothing at all.
 */
function openLinkTab(href) {
  let opened = null;
  try {
    opened = window.open(href, "_blank", "noopener,noreferrer");
  } catch {
    opened = null;
  }
  if (opened) {
    return;
  }
  // Some browsers only follow a real anchor.
  try {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.append(a);
    a.click();
    a.remove();
    return;
  } catch {
    // fall through
  }
  flashBanner(`링크를 열지 못했습니다: ${href}`, 3200);
}

/** Every tap says what the link actually was, so a bad one can be read (#188). */
async function followPdfLink(link, fromPage) {
  if (link?.kind === "url") {
    flashBanner(describeLink({ link }));
    // A document does not get to decide what our tab does.
    openLinkTab(link.href);
    return true;
  }
  if (link?.kind === "goneLeaf") {
    flashBanner("고쳐 둔 쪽이 문서에서 지워졌습니다");
    return true;
  }
  if (link?.kind === "fixedPage") {
    // Set by hand (#190), so it is already a position in this document.
    const at = Math.min(Math.max(1, link.page), state.pageCount || 1);
    flashBanner(`고친 링크: ${at}쪽으로`);
    if (at !== fromPage) {
      await goToPage(at);
    }
    return true;
  }
  if (link?.kind === "action") {
    flashBanner(describeLink({ link }));
    const at = pagePositionForAction(link.action, fromPage, state.pageCount);
    if (at && at !== fromPage) {
      await goToPage(at);
    }
    return true;
  }
  if (link?.kind !== "dest") {
    return false;
  }
  const explicit = await explicitDest(link.dest);
  const pdfPage = await pdfPageOfDest(link.dest);
  const at = leafPositionForPdfPage(state.leaves, pdfPage);
  const said = describeLink({
    link,
    explicit,
    pdfPage,
    position: at,
    pageCount: state.leaves.length,
  });
  flashBanner(said, at ? 1800 : 7000);
  if (!at) {
    return true;
  }
  if (at !== fromPage) {
    await goToPage(at);
  }
  return true;
}

/* ---- 필기 옮기기 (#200) ---------------------------------------------- */

/** 견줄 때 쓰는 쪽 그림 크기. 작아도 되고, 작아야 빠르다. */
const MATCH_SHOT_PX = 96;
/** 양쪽 창에 보여 줄 그림 폭(px). 알아볼 수 있어야 하므로 견줄 때보다 크다. */
const MATCH_PANE_PX = 220;

/**
 * 이 브라우저가 들고 있는 그 PDF에서 쪽마다 지문을 뜬다 (#200·#202).
 * 글자가 있으면 글자로, 구워진 문서라 글자가 없으면 **쪽 그림**으로 알아본다.
 */
async function fingerprintsOf(buffer, pages = null, onStep = null) {
  const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
  const prints = {};
  const hashes = {};
  const list = pages || Array.from({ length: pdf.numPages }, (_, at) => at + 1);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let done = 0;
  for (const number of list) {
    if (number < 1 || number > pdf.numPages) {
      continue;
    }
    try {
      const page = await pdf.getPage(number);
      const text = (await page.getTextContent()).items.map((item) => item.str).join("");
      prints[number] = textFingerprint(text);
      const base = page.getViewport({ scale: 1 });
      const scale = MATCH_SHOT_PX / Math.max(1, base.width);
      const viewport = page.getViewport({ scale });
      canvas.width = Math.max(HASH_COLS, Math.round(viewport.width));
      canvas.height = Math.max(HASH_ROWS, Math.round(viewport.height));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // 구워진 쪽은 제 흰 바탕을 그리지만, 아닌 쪽은 종이를 깔아 줘야 한다.
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const shot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      hashes[number] = dHash(grayGrid(shot.data, canvas.width, canvas.height));
    } catch {
      prints[number] = "";
      hashes[number] = "";
    }
    done += 1;
    onStep?.(done, list.length);
    // 화면이 멈추지 않게 한 숨 돌린다.
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }
  const count = pdf.numPages;
  await pdf.destroy();
  return { prints, hashes, count };
}

/** 옛 문서에서 필기가 있는 쪽. 손댄 쪽만 맞추면 되므로 여기서 추린다. */
function inkedPagesOf(record) {
  const leaves = Array.isArray(record?.leaves) ? record.leaves : [];
  const pages = new Set();
  for (const [key, items] of Object.entries(record?.pages || {})) {
    if (!Array.isArray(items) || !items.length) {
      continue;
    }
    const leaf = leaves.find((row) => String(inkKey(row)) === String(key));
    const at = leaf ? Number(leaf.pdfPage) : Number(key);
    if (leaf?.kind === "outline") {
      continue;
    }
    if (Number.isFinite(at) && at >= 1) {
      pages.add(at);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

function inkItemsForPage(record, pdfPage) {
  const leaves = Array.isArray(record?.leaves) ? record.leaves : [];
  const out = [];
  for (const [key, items] of Object.entries(record?.pages || {})) {
    if (!Array.isArray(items) || !items.length) {
      continue;
    }
    const leaf = leaves.find((row) => String(inkKey(row)) === String(key));
    const at = leaf ? Number(leaf.pdfPage) : Number(key);
    if (leaf?.kind !== "outline" && at === pdfPage) {
      out.push(...cloneItems(items));
    }
  }
  return out;
}

function closeInkMove() {
  for (const watcher of inkMoveObservers) {
    watcher.disconnect();
  }
  inkMoveObservers = [];
  if (inkMovePlan?.oldPdf) {
    inkMovePlan.oldPdf.destroy();
  }
  inkMovePlan = null;
  if (els.inkMoveSheet) {
    els.inkMoveSheet.hidden = true;
  }
  for (const part of [els.inkMoveApply, els.inkMoveMode, els.inkMovePanes, els.inkMoveModebar]) {
    if (part) {
      part.hidden = true;
    }
  }
  els.inkMoveLeft?.replaceChildren();
  els.inkMoveRight?.replaceChildren();
}

async function openInkMove() {
  if (!els.inkMoveSheet || !state.pdf) {
    flashBanner("먼저 PDF를 여세요.");
    return;
  }
  els.inkMoveDocs.replaceChildren();
  els.inkMoveSheet.hidden = false;
  els.inkMoveHint.textContent = "같은 자료의 다른 판에서 필기를 가져옵니다. 쪽에 적힌 글자로 같은 쪽을 찾습니다.";
  let rows = [];
  try {
    rows = await listDocuments();
  } catch {
    rows = [];
  }
  const others = rows.filter((row) => row.identity !== state.identity);
  if (!others.length) {
    els.inkMoveHint.textContent = "이 브라우저가 아는 다른 문서가 없습니다.";
    return;
  }
  for (const row of others) {
    const record = loadStrokes(row.identity);
    const inked = inkedPagesOf(record);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ink-move-doc";
    button.disabled = !inked.length;
    button.append(row.name || "문서.pdf");
    const note = document.createElement("small");
    note.textContent = inked.length ? `필기가 있는 쪽 ${inked.length}개` : "옮길 필기가 없습니다";
    button.append(note);
    button.addEventListener("click", () => moveInkFrom(row, record, inked));
    els.inkMoveDocs.append(button);
  }
}

let inkMovePlan = null;
let inkMoveObservers = [];

/**
 * 옛 문서의 필기를 지금 문서로 옮긴다 (#200·#202·#204). 짝은 글자·그림
 * 지문으로 먼저 제안하고, 마지막 말은 사람이 한다 — 양쪽 문서를 나란히
 * 놓고 왼쪽에서 쪽을 고른 뒤 오른쪽에서 갈 곳을 탭한다.
 */
async function moveInkFrom(row, record, inked) {
  els.inkMoveDocs.replaceChildren();
  const say = (text) => {
    els.inkMoveHint.textContent = text;
  };
  say("옛 문서를 읽는 중…");
  let from;
  let to;
  let oldPdf;
  try {
    from = await fingerprintsOf(row.buffer, inked, (at, all) => say(`옛 문서 ${at}/${all}쪽…`));
    to = await fingerprintsOf(state.buffer, null, (at, all) => say(`지금 문서 ${at}/${all}쪽…`));
    // 창에 크게 그릴 때 다시 쓰므로 열어 둔다. 닫을 때 destroy.
    oldPdf = await pdfjsLib.getDocument({ data: row.buffer.slice(0) }).promise;
  } catch {
    say("그 문서를 읽지 못했습니다.");
    return;
  }
  const byText = matchPages({
    fromPrints: from.prints,
    toPrints: to.prints,
    wanted: inked,
    fromCount: from.count,
    toCount: to.count,
  });
  const stillOpen = [...byText.blank, ...byText.missing];
  const byImage = matchByHash({
    fromHashes: from.hashes,
    toHashes: to.hashes,
    wanted: stillOpen,
    fromCount: from.count,
    toCount: to.count,
  });
  const plan = mergeMatches(byText, byImage);
  const rows = [
    ...plan.pairs.map((pair) => ({ from: pair.from, to: pair.to, mode: "add", sure: pair.sure })),
    ...plan.missing.map((page) => ({ from: page, to: 0, mode: "skip", sure: false })),
  ].sort((a, b) => a.from - b.from);
  inkMovePlan = { record, oldPdf, rows, name: row.name || "문서.pdf", summary: matchSummary(plan), selected: null };
  openInkMovePanes();
}

/** 옛 쪽을 창에 그린다: 종이 위에 그때의 필기까지 (#204). */
async function renderOldMoveThumb(canvas, pageNum) {
  const pdf = inkMovePlan?.oldPdf;
  if (!pdf) {
    return;
  }
  try {
    const page = await pdf.getPage(pageNum);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: MATCH_PANE_PX / Math.max(1, base.width) });
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const items = inkItemsForPage(inkMovePlan.record, pageNum);
    if (items.length) {
      const layers = await exportInkCanvas(items, { width: canvas.width, height: canvas.height }, base.width);
      ctx.drawImage(layers, 0, 0);
    }
  } catch {
    // 못 그린 쪽은 빈 채로 둔다. 번호는 남는다.
  }
}

/** 지금 문서 쪽도 필기까지 (preview 서랍과 같은 경로). */
async function renderNewMoveThumb(canvas, position) {
  const leaf = leafAt(state.leaves, position);
  if (!leaf) {
    return;
  }
  await renderThumbPage(canvas, leaf, { width: MATCH_PANE_PX / 2, height: MATCH_PANE_PX * 0.7 });
  await paintThumbInk(canvas, leaf);
}

/** 창 안에 실제로 보이는 그림만 그린다 — 277쪽을 미리 다 그리면 폰이 죽는다. */
function watchMoveThumbs(pane, render) {
  const watcher = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) {
        continue;
      }
      const canvas = entry.target;
      watcher.unobserve(canvas);
      render(canvas, Number(canvas.dataset.page));
    }
  }, { root: pane, rootMargin: "160px" });
  inkMoveObservers.push(watcher);
  return watcher;
}

function moveRowLabel(row) {
  if (row.mode === "insert" && row.to) {
    return `→ ${row.to}쪽 뒤에 새 쪽`;
  }
  if (row.mode === "add" && row.to) {
    return `→ ${row.to}쪽`;
  }
  return "안 옮김";
}

function refreshMoveRowCard(row) {
  const card = els.inkMoveLeft?.querySelector(`[data-from="${row.from}"]`);
  if (!card) {
    return;
  }
  card.querySelector(".ink-move-target").textContent = moveRowLabel(row);
  card.classList.toggle("is-guess", row.sure === false && row.mode !== "skip" && Boolean(row.to));
  card.classList.toggle("is-off", row.mode === "skip" || !row.to);
}

function selectMoveRow(row) {
  inkMovePlan.selected = row;
  for (const card of els.inkMoveLeft.querySelectorAll(".ink-move-card")) {
    card.classList.toggle("is-selected", Number(card.dataset.from) === row.from);
  }
  // 순서가 크게 다르지 않으니, 제안한 자리(없으면 같은 번호)로 오른쪽을 데려간다.
  const near = Math.min(state.leaves.length, Math.max(1, row.to || row.from));
  els.inkMoveRight.querySelector(`[data-page="${near}"]`)?.scrollIntoView({ block: "center" });
}

/** 오른쪽 쪽을 탭하면, 고른 옛 쪽이 그리로 간다. 모드가 「새 쪽」이면 그 뒤에 끼운다. */
function assignMoveTarget(position) {
  const row = inkMovePlan?.selected;
  if (!row) {
    flashBanner("먼저 왼쪽에서 옮길 쪽을 고르세요.");
    return;
  }
  row.to = position;
  row.mode = inkMoveAssignMode;
  row.sure = true;
  refreshMoveRowCard(row);
  // 다음 확인거리로 넘어간다: 아직 짝 없는 첫 쪽.
  const next = inkMovePlan.rows.find((one) => one.mode === "skip" || !one.to);
  if (next) {
    selectMoveRow(next);
  }
}

let inkMoveAssignMode = "add";

function setInkMoveAssignMode(mode) {
  inkMoveAssignMode = mode;
  els.inkMoveModeAdd?.classList.toggle("is-selected", mode === "add");
  els.inkMoveModeInsert?.classList.toggle("is-selected", mode === "insert");
}

function openInkMovePanes() {
  const { rows, name, summary } = inkMovePlan;
  els.inkMoveHint.textContent = `${name} · ${summary} · 왼쪽에서 쪽을 고르고 오른쪽에서 갈 곳을 탭하세요.`;
  els.inkMoveDocs.replaceChildren();
  els.inkMovePanes.hidden = false;
  els.inkMoveModebar.hidden = false;
  els.inkMoveApply.hidden = false;
  els.inkMoveMode.hidden = false;
  setInkMoveAssignMode("add");

  els.inkMoveLeft.replaceChildren();
  const leftWatch = watchMoveThumbs(els.inkMoveLeft, renderOldMoveThumb);
  for (const row of rows) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "ink-move-card";
    card.dataset.from = String(row.from);
    const shot = document.createElement("canvas");
    shot.className = "ink-move-shot";
    shot.dataset.page = String(row.from);
    const label = document.createElement("span");
    label.className = "ink-move-label";
    label.textContent = `${row.from}쪽`;
    const target = document.createElement("span");
    target.className = "ink-move-target";
    target.textContent = moveRowLabel(row);
    card.append(shot, label, target);
    card.addEventListener("click", () => selectMoveRow(row));
    els.inkMoveLeft.append(card);
    leftWatch.observe(shot);
    refreshMoveRowCard(row);
  }

  els.inkMoveRight.replaceChildren();
  const rightWatch = watchMoveThumbs(els.inkMoveRight, renderNewMoveThumb);
  for (let position = 1; position <= state.leaves.length; position += 1) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "ink-move-card";
    card.dataset.page = String(position);
    const shot = document.createElement("canvas");
    shot.className = "ink-move-shot";
    shot.dataset.page = String(position);
    const label = document.createElement("span");
    label.className = "ink-move-label";
    label.textContent = `${position}쪽`;
    card.append(shot, label);
    card.addEventListener("click", () => assignMoveTarget(position));
    els.inkMoveRight.append(card);
    rightWatch.observe(shot);
  }

  const first = rows.find((one) => !one.sure) || rows[0];
  if (first) {
    selectMoveRow(first);
  }
}

/** 굿노트에서 새로 만든 쪽: 그 쪽 그림을 통째로 깔고 필기를 얹은 빈 쪽이 된다 (#204). */
async function insertPayloadFor(row) {
  const pdf = inkMovePlan.oldPdf;
  const page = await pdf.getPage(row.from);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 1000 / Math.max(1, base.width) });
  const canvas = offscreenCanvas(Math.round(viewport.width), Math.round(viewport.height));
  const ctx = canvas2d(canvas);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return {
    row,
    image: imageItem({
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      src: canvas.toDataURL("image/jpeg", 0.82),
      locked: true,
    }),
    items: inkItemsForPage(inkMovePlan.record, row.from),
  };
}

async function applyInkMove() {
  if (!inkMovePlan?.rows) {
    return;
  }
  const { record, rows } = inkMovePlan;
  const replace = els.inkMoveReplace?.checked;
  const merges = rows.filter((row) => row.mode === "add" && row.to);
  const inserts = rows.filter((row) => row.mode === "insert" && row.to);
  els.inkMoveApply.disabled = true;
  let payloads = [];
  try {
    payloads = [];
    for (const row of inserts) {
      payloads.push(await insertPayloadFor(row));
    }
  } catch {
    els.inkMoveApply.disabled = false;
    flashBanner("가져올 쪽을 그리지 못했습니다.");
    return;
  }
  let moved = 0;
  commitBulkChange(() => {
    for (const row of merges) {
      const items = inkItemsForPage(record, row.from);
      const leaf = leafAt(state.leaves, row.to);
      if (!items.length || !leaf) {
        continue;
      }
      const key = inkKey(leaf);
      state.pages[key] = replace ? items : [...(state.pages[key] || []), ...items];
      moved += 1;
    }
    // 뒤에서부터 끼워야 앞 자리 번호가 흔들리지 않는다.
    for (const payload of payloads.sort((a, b) => b.row.to - a.row.to)) {
      const id = `o:mv-${Date.now().toString(36)}-${payload.row.from}`;
      state.leaves = insertOutlineAfter(state.leaves, payload.row.to - 1, id);
      state.pages[id] = [payload.image, ...payload.items];
      moved += 1;
    }
  });
  persistStrokes();
  els.inkMoveApply.disabled = false;
  closeInkMove();
  rebuildPages();
  flashBanner(`${moved}쪽을 옮겼습니다. 마음에 안 들면 되돌리기 한 번.`, 5200);
}

/* ---- 링크 고치기 (#190) ---------------------------------------------- */

let linkFixHoldTimer = 0;
let editingLink = null;

function hideLinkFixPanel() {
  editingLink = null;
  if (els.linkFixPanel) {
    els.linkFixPanel.hidden = true;
  }
}

function cancelLinkFixHold() {
  window.clearTimeout(linkFixHoldTimer);
  linkFixHoldTimer = 0;
}

function describeOriginalLink(item) {
  if (item?.link?.kind === "url") {
    return `원래: ${shortJson(item.link.href, 60)}`;
  }
  if (item?.link?.kind === "dest") {
    return `원래: ${shortJson(item.link.dest, 46)}`;
  }
  return "원래: 가리키는 곳 없음";
}

/**
 * Opens the editor over a link. Some files — GoodNotes exports among them —
 * carry destinations that are already dangling inside the PDF, and no amount
 * of reading fixes those. So the reader says where it should go (#190).
 */
function openLinkFixPanel(spot, item, index) {
  if (!els.linkFixPanel || !item) {
    return;
  }
  const keys = linkKeysFor(spot.leaf, item);
  editingLink = { ...keys, pageNum: spot.pageNum, leaf: spot.leaf, item, index };
  const current = findLinkFix(state.linkFixes, keys.spotKey, keys.groupKey);
  els.linkFixOrigin.textContent = describeOriginalLink(item);
  const now = linkFixTarget(current, state.leaves);
  els.linkFixPage.value = now?.kind === "fixedPage" ? String(now.page) : "";
  els.linkFixUrl.value = current?.kind === "url" ? current.href : "";
  els.linkFixBulk.checked = false;
  els.linkFixClear.hidden = !current;
  els.linkFixPanel.style.visibility = "hidden";
  els.linkFixPanel.hidden = false;
  const box = els.linkFixPanel.getBoundingClientRect();
  // #192: on a pinched phone the visible area is not the layout viewport, and
  // a panel placed against the wrong one puts its buttons off screen.
  const view = window.visualViewport;
  const viewLeft = view?.offsetLeft || 0;
  const viewTop = view?.offsetTop || 0;
  const viewWidth = view?.width || window.innerWidth;
  const viewHeight = view?.height || window.innerHeight;
  const fit = (want, start, size, room) =>
    Math.min(Math.max(start + 8, want), start + Math.max(8, room - size - 8));
  els.linkFixPanel.style.left = `${fit(spot.client.x - box.width / 2, viewLeft, box.width, viewWidth)}px`;
  els.linkFixPanel.style.top = `${fit(spot.client.y + 16, viewTop, box.height, viewHeight)}px`;
  els.linkFixPanel.style.visibility = "";
  flashPdfLinkHint(spot.pageNum, index);
}

/**
 * Ties every correction to the page it means, once the leaves are known (#194).
 * Anything saved as a bare slot number would drift the moment a page is added.
 */
function anchorLinkFixesNow() {
  const result = anchorLinkFixes(state.linkFixes, state.leaves);
  state.linkFixes = result.fixes;
  if (result.changed && state.identity) {
    saveLinkFixes(state.identity, state.linkFixes);
  }
}

function persistLinkFixes() {
  if (state.identity) {
    saveLinkFixes(state.identity, state.linkFixes);
  }
  scheduleInkAutosave();
  refreshPdfLinkHints(true);
}

function applyLinkFix(fix) {
  if (!editingLink) {
    return;
  }
  const bulk = Boolean(els.linkFixBulk?.checked);
  state.linkFixes = setLinkFix(state.linkFixes, { ...editingLink, bulk, fix });
  const where = fix?.kind === "page" ? `${fix.page}쪽` : shortJson(fix?.href, 40);
  flashBanner(bulk ? `같은 링크 전부 → ${where}` : `이 링크 → ${where}`);
  hideLinkFixPanel();
  persistLinkFixes();
}

function undoLinkFix() {
  if (!editingLink) {
    return;
  }
  const bulk = Boolean(els.linkFixBulk?.checked);
  state.linkFixes = clearLinkFix(state.linkFixes, { ...editingLink, bulk });
  flashBanner("원래대로 되돌렸습니다");
  hideLinkFixPanel();
  persistLinkFixes();
}

/** 쪽이든 주소든 하나만 채운다. 그래야 「저장」이 무엇을 뜻하는지 분명하다. */
function saveLinkFixFromPanel() {
  const href = String(els.linkFixUrl?.value || "").trim();
  const page = Number(els.linkFixPage?.value);
  if (href) {
    applyLinkFix({ kind: "url", href });
    return;
  }
  if (page >= 1) {
    // #194: the paper, not the slot number — inserting a page must not move it.
    applyLinkFix(linkFixForPage(page, state.leaves));
    return;
  }
  flashBanner("갈 쪽이나 주소를 넣어 주세요");
}

function bindLinkFixPanel() {
  if (!els.linkFixPanel) {
    return;
  }
  els.linkFixPanel.addEventListener("pointerdown", (event) => event.stopPropagation());
  els.linkFixSave?.addEventListener("click", saveLinkFixFromPanel);
  els.linkFixClear?.addEventListener("click", undoLinkFix);
  // Filling one empties the other: a link goes to one place.
  els.linkFixPage?.addEventListener("input", () => {
    if (els.linkFixPage.value) {
      els.linkFixUrl.value = "";
    }
  });
  els.linkFixUrl?.addEventListener("input", () => {
    if (els.linkFixUrl.value) {
      els.linkFixPage.value = "";
    }
  });
  for (const input of [els.linkFixPage, els.linkFixUrl]) {
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveLinkFixFromPanel();
      }
    });
  }
}

/** Blinks the box that was hit, so a tap always shows it landed (#182). */
function flashPdfLinkHint(pageNum, index) {
  const view = (state.pageViews || []).find((item) => item.pageNum === pageNum);
  const box = view?.linkLayer?.children?.[index];
  if (!box) {
    return;
  }
  box.classList.add("is-hit");
  window.setTimeout(() => box.classList.remove("is-hit"), 320);
}

/** Where a tap landed on this page, in page coordinates. */
function pdfLinkSpotAtClient(client) {
  if (state.interactMode !== "view" || !state.pdf) {
    return null;
  }
  const stage = document.elementFromPoint(client.x, client.y)?.closest?.(".page-stage");
  if (!stage) {
    return null;
  }
  const pageNum = Number(stage.dataset.page) || 0;
  const leaf = leafAt(state.leaves, pageNum);
  if (!pageNum || !leaf) {
    return null;
  }
  const box = stage.getBoundingClientRect();
  return {
    pageNum,
    leaf,
    client,
    x: (client.x - box.left) / (box.width || 1),
    y: (client.y - box.top) / (box.height || 1),
  };
}

/** The two keys this link answers to: this one, and everything like it (#190). */
function linkKeysFor(leaf, item) {
  return {
    spotKey: linkSpotKey(leaf?.pdfPage, item?.rect),
    groupKey: linkGroupKey(item?.link),
  };
}

function fixFor(leaf, item) {
  const keys = linkKeysFor(leaf, item);
  return findLinkFix(state.linkFixes, keys.spotKey, keys.groupKey);
}

function actOnPdfLink(spot) {
  const items = state.pdfLinks.get(pdfLinkCacheKey(spot.leaf.pdfPage, spot.leaf.rotate)) || [];
  const hit = pdfLinkAt(spot.pageNum, spot.x, spot.y);
  if (!hit) {
    return false;
  }
  flashPdfLinkHint(spot.pageNum, items.indexOf(hit));
  const fixed = linkFixTarget(fixFor(spot.leaf, hit), state.leaves);
  followPdfLink(fixed || hit.link, spot.pageNum);
  return true;
}

/**
 * A tap in 보기 mode follows the file's own links. In 편집 mode the same tap
 * is a pen mark, so links stay out of the way while writing.
 *
 * Deliberately not async: a browser only lets us open a tab while the tap is
 * still fresh, and an await in front of `window.open` loses that (#182). The
 * links are already in hand — the hints read them when the page drew.
 */
function followPdfLinkAtClient(client) {
  const spot = pdfLinkSpotAtClient(client);
  if (!spot) {
    return false;
  }
  if (state.pdfLinks.has(pdfLinkCacheKey(spot.leaf.pdfPage, spot.leaf.rotate))) {
    return actOnPdfLink(spot);
  }
  // Only if a page was tapped before it had ever been drawn.
  loadPdfLinks(spot.leaf).then(() => actOnPdfLink(spot));
  return false;
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

/**
 * 붙여넣을 것이 있는지 보고 칸을 흐리게 한다 (#219). 시스템 클립보드는
 * 물어봐야 알 수 있어 비동기다 — 먼저 내 것으로 판단해 놓고, 답이 오면 고친다.
 */
function refreshPasteCell() {
  const cell = els.marqueeMenu?.querySelector('[data-marquee="paste"]');
  if (!cell) {
    return;
  }
  const mine = state.inkClipboard.length > 0;
  cell.disabled = !mine;
  pasteAvailability(state.inkClipboard, navigator.clipboard).then((found) => {
    if (!els.marqueeMenu?.hidden) {
      cell.disabled = !found.ready;
    }
  });
}

function showMarqueeMenu() {
  if (!state.pendingCapture || !els.marqueeMenu) {
    return;
  }
  els.marqueeMenu.hidden = false;
  refreshPasteCell();
  placeMarqueeMenuUi();
}

/**
 * 영역 도구로 **끌지 않고 오래 누르면** 그 자리에 붙여넣기 메뉴가 열린다
 * (#219). 끌어서 만든 영역의 메뉴와 같은 메뉴라, 칸이 두 벌이 되지 않는다.
 */
function showPasteMenuAt(page, point) {
  state.pendingCapture = { page, rect: { x: point.x, y: point.y, w: 0, h: 0 }, pasteOnly: true };
  els.marqueeMenu.hidden = false;
  for (const cell of els.marqueeMenu.querySelectorAll("[data-marquee]")) {
    // 영역이 없으니 영역을 다루는 칸은 숨긴다.
    cell.hidden = cell.dataset.marquee !== "paste";
  }
  refreshPasteCell();
  placeMarqueeMenuUi();
}

function restoreMarqueeCells() {
  for (const cell of els.marqueeMenu?.querySelectorAll("[data-marquee]") || []) {
    cell.hidden = false;
  }
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
  // The area box and its menu own their own presses (#121).
  if (event.target.closest?.("#marquee, #area-layer, #area-link-panel")) {
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
  state.currentRect = { page: state.drawPage, a: point, b: point, at: { x: event.clientX, y: event.clientY } };
  updateMarquee();
  // #219: 끌지 않고 400ms 누르고 있으면 붙여넣기 메뉴.
  window.clearTimeout(rectHoldTimer);
  rectHoldTimer = window.setTimeout(() => {
    rectHoldTimer = 0;
    const live = state.currentRect;
    if (!live || rectBigEnough(rectFromPoints(live.a, live.b))) {
      return;
    }
    state.currentRect = null;
    hideMarquee();
    showPasteMenuAt(live.page, live.a);
  }, PAGE_HOLD_MS);
}

let rectHoldTimer = 0;

function moveRect(event) {
  if (!state.currentRect || !state.drawCanvas) {
    return;
  }
  event.preventDefault();
  state.currentRect.b = eventToNorm(event, state.drawCanvas);
  if (rectHoldTimer && rectBigEnough(rectFromPoints(state.currentRect.a, state.currentRect.b))) {
    // 끌기 시작 — 이건 영역 만들기지 붙여넣기가 아니다.
    window.clearTimeout(rectHoldTimer);
    rectHoldTimer = 0;
  }
  updateMarquee();
}

function endRect(event) {
  window.clearTimeout(rectHoldTimer);
  rectHoldTimer = 0;
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
let lockHoldFrom = null;

function hideLockMenu() {
  if (els.lockMenu) {
    els.lockMenu.hidden = true;
  }
  state.lockMenuAt = null;
}

function cancelLockHold() {
  window.clearTimeout(lockHoldTimer);
  lockHoldTimer = 0;
  lockHoldFrom = null;
}

/**
 * A finger that stays put still emits pointermove, so the hold may only die
 * once it has really travelled (#109).
 */
function cancelLockHoldIfMoved(event, slopPx = PAGE_DRAG_SLOP_PX) {
  if (!lockHoldTimer || !lockHoldFrom) {
    return;
  }
  if (Math.hypot(event.clientX - lockHoldFrom.x, event.clientY - lockHoldFrom.y) > slopPx) {
    cancelLockHold();
  }
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
  lockHoldFrom = at;
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
  // The area box and its menu own their own presses (#121).
  if (event.target.closest?.("#marquee, #area-layer, #area-link-panel")) {
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
  cancelLockHoldIfMoved(event);
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
        : resizeImage(origin, drag.handle, point, {
            freeRatio: state.freeRatio,
            cssWidth: cssW,
            cssHeight: cssH,
          });
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
  const lockPick = menuActionAtPoint(els.lockMenu, event, "lockMenu");
  cancelLockHold();
  if (lockPick) {
    unlockFromMenu();
    return;
  }
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
    const boxed = rectBigEnough(rect);
    if (boxed) {
      state.selectIndices = pickItemsInRect(pageStrokes(drag.page), rect, cssW, cssH);
    } else {
      state.selectIndices = pickItemsAt(pageStrokes(drag.page), drag.a, cssW, cssH);
    }
    state.selectDrag = null;
    // #110: a box that caught nothing becomes an area, so the one select cell
    // does area capture too. A box that caught something is a selection.
    if (boxed && !state.selectIndices.length && view) {
      // #121: the drag is over, the area stays until it is dismissed.
      state.currentRect = null;
      state.pendingCapture = { page: drag.page, rect };
      hideMarqueeMenu();
      updateMarquee();
      updateAreaHits();
      syncSelectHud();
      return;
    }
    hideMarquee();
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

/**
 * 메뉴에서 부르는 붙여넣기 (#219). 내 것이 있으면 그것을, 없으면 시스템
 * 클립보드의 그림을 — 굿노트 웹은 고른 필기를 그림으로 올려 준다.
 * 누른 자리를 가운데로 놓는다.
 */
/**
 * 지금 화면에 보이는 그 쪽 부분의 한가운데 (#251). 외부 그림은 「원래 자리」를
 * 알 수 없으니, 하드코딩된 왼쪽 위가 아니라 **보고 있는 곳**에 놓아야 한다.
 * 확대·스크롤은 DOM 사각형으로 그대로 되받는다.
 */
function visiblePasteSpot(page) {
  const view = state.pageViews.find((item) => item.pageNum === page);
  if (!view?.stage) {
    return null;
  }
  const box = view.stage.getBoundingClientRect();
  if (!(box.width > 0) || !(box.height > 0)) {
    return null;
  }
  const wrap = els.workspace.getBoundingClientRect();
  const left = Math.max(box.left, wrap.left);
  const right = Math.min(box.right, wrap.right);
  const top = Math.max(box.top, wrap.top);
  const bottom = Math.min(box.bottom, wrap.bottom);
  if (right <= left || bottom <= top) {
    return null;
  }
  return {
    x: ((left + right) / 2 - box.left) / box.width,
    y: ((top + bottom) / 2 - box.top) / box.height,
  };
}

async function pasteHere() {
  const spot = state.pendingCapture;
  const page = spot?.page || state.page;
  const at = spot?.rect ? { x: spot.rect.x + spot.rect.w / 2, y: spot.rect.y + spot.rect.h / 2 } : null;
  hideMarqueeMenu();
  if (state.interactMode === "view") {
    flashBanner("보기 중입니다. 자물쇠를 풀면 붙일 수 있습니다.");
    return;
  }
  if (state.inkClipboard.length) {
    pasteInkAt(page, at);
    return;
  }
  const found = await readClipboardImage(navigator.clipboard, readBlobDataUrl, readBlobText);
  if (!found.src) {
    // 무엇이 들어 있었는지 말해 준다 — 안 되는 이유를 짐작하지 않게 (#224).
    // #226: 비동기 클립보드는 형식 몇 가지만 내준다. 키보드가 있으면 그쪽이 낫다.
    const hint = window.matchMedia?.("(pointer: fine)")?.matches ? " · Ctrl+V로 해 보세요" : "";
    flashBanner(
      found.saw ? `붙일 수 있는 그림이 없습니다 · 클립보드: ${found.saw}${hint}` : "붙여넣을 것이 없습니다.",
      5200,
    );
    return;
  }
  await pasteImageAt(page, at, found.src);
}

/**
 * 진짜 붙여넣기 (#226). 크롬의 비동기 클립보드는 형식 몇 가지만 내주지만,
 * 이 이벤트는 원본 앱이 넣은 것을 그대로 들고 온다 — 굿노트가 필기를 벡터로
 * 올려도 여기서는 보인다.
 */
async function onNativePaste(event) {
  if (!state.pdf || els.writeScreen.hidden || overlayOpen()) {
    return;
  }
  if (event.target.closest?.("input, textarea, [contenteditable='true']")) {
    return;
  }
  if (state.interactMode === "view") {
    flashBanner("보기 중입니다. 자물쇠를 풀면 붙일 수 있습니다.");
    return;
  }
  const page = state.page;
  const at = state.pendingCapture?.rect
    ? { x: state.pendingCapture.rect.x + state.pendingCapture.rect.w / 2, y: state.pendingCapture.rect.y + state.pendingCapture.rect.h / 2 }
    : null;
  const found = readPasteEvent(event.clipboardData);
  if (found.file) {
    event.preventDefault();
    hideMarqueeMenu();
    const bytes = new Uint8Array(await found.file.arrayBuffer());
    await pasteImageAt(page, at, await readBlobDataUrl(found.file), pngMetaRect(bytes));
    return;
  }
  if (found.src) {
    event.preventDefault();
    hideMarqueeMenu();
    await pasteImageAt(page, at, found.src);
    return;
  }
  if (state.inkClipboard.length) {
    event.preventDefault();
    hideMarqueeMenu();
    pasteInkAt(page, at);
    return;
  }
  // 앱 안에만 있는 것이면 왜 안 되는지를 말한다 — 형식 얘기는 도움이 안 된다.
  const locked = privatePasteApp(found.text);
  if (locked) {
    flashBanner(privatePasteMessage(locked), 7000);
    return;
  }
  flashBanner(`붙일 수 있는 그림이 없습니다 · 클립보드: ${found.saw}${found.text ? ` · "${found.text}"` : ""}`, 6000);
}

/**
 * 종이에 그림 파일을 끌어다 놓기 (#228). 붙여넣기가 막힌 앱에서도 「이미지로
 * 내보내서 끌어다 놓기」는 늘 통한다 — 파일은 앱 밖으로 나오기 때문이다.
 * 놓은 자리가 가운데가 된다.
 */
function pageUnderPointer(event) {
  const stage = event.target.closest?.(".page-stage") || document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".page-stage");
  if (!stage) {
    return null;
  }
  const page = Number(stage.dataset.page) || 0;
  const box = stage.getBoundingClientRect();
  return page
    ? {
        page,
        at: { x: (event.clientX - box.left) / (box.width || 1), y: (event.clientY - box.top) / (box.height || 1) },
      }
    : null;
}

function onPaperDragOver(event) {
  if (!state.pdf || els.writeScreen.hidden || state.interactMode === "view") {
    return;
  }
  if (!pageUnderPointer(event) || !(event.dataTransfer?.types || []).includes("Files")) {
    return;
  }
  // 막지 않으면 브라우저가 그 파일을 열어 버려 문서가 사라진다.
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
  els.workspace.classList.add("is-dropping");
}

function onPaperDragLeave() {
  els.workspace.classList.remove("is-dropping");
}

async function onPaperDrop(event) {
  els.workspace.classList.remove("is-dropping");
  if (!state.pdf || els.writeScreen.hidden) {
    return;
  }
  const spot = pageUnderPointer(event);
  const file = [...(event.dataTransfer?.files || [])].find((one) => acceptImageFile(one).ok);
  if (!spot || !file) {
    return;
  }
  event.preventDefault();
  if (state.interactMode === "view") {
    flashBanner("보기 중입니다. 자물쇠를 풀면 놓을 수 있습니다.");
    return;
  }
  await pasteImageAt(spot.page, spot.at, await readBlobDataUrl(file));
}

function readBlobText(blob) {
  return typeof blob?.text === "function" ? blob.text() : Promise.resolve("");
}

/** 우리가 캡처한 PNG면 심어 둔 원래 자리를 돌려준다 (#253). 아니면 null. */
function pngMetaRect(bytes) {
  const meta = readPngText(bytes);
  const rect = meta?.app === "pdf-ink" ? meta.rect : null;
  return rect && [rect.x, rect.y, rect.w, rect.h].every((n) => Number.isFinite(Number(n))) ? rect : null;
}

/**
 * 바깥 주소(SVG 데이터·blob·http)를 캔버스에 구워 우리 데이터 URL로 (#224).
 * `<img>`는 SVG 안의 스크립트를 돌리지 않으므로 이 길이 안전하다.
 */
async function bakeForeignImage(src) {
  try {
    const img = await loadHtmlImage(src);
    const width = Math.max(1, img.naturalWidth || img.width || 0);
    const height = Math.max(1, img.naturalHeight || img.height || 0);
    if (width < 2 || height < 2) {
      return "";
    }
    const canvas = offscreenCanvas(width, height);
    const ctx = canvas2d(canvas);
    // 필기를 오려 온 것은 배경이 비어 있다. 흰 종이를 깔지 않아야 겹쳐 쓸 수 있다.
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

/** 붙이는 그림의 지문. 등록부(#256)와 맞춰 보려고 작은 캔버스에 그려 뜬다. */
function hashOfImage(img) {
  try {
    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    if (w < 2 || h < 2) {
      return "";
    }
    const canvas = offscreenCanvas(64, Math.max(1, Math.round((64 * h) / w)));
    const ctx = canvas2d(canvas);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const shot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return dHash(grayGrid(shot.data, canvas.width, canvas.height));
  } catch {
    return "";
  }
}

function readBlobDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** 앱 안에서 복사한 항목을 누른 자리에. */
function pasteInkAt(page, at) {
  const view = state.pageViews.find((item) => item.pageNum === page);
  const bounds = selectedBounds(
    state.inkClipboard,
    state.inkClipboard.map((_, index) => index),
    view?.cssWidth || 400,
    view?.cssHeight || 600,
  );
  // 누른 자리로, 없으면 지금 보이는 화면 한가운데로 (#251). 옛날엔 있던
  // 자리 그대로였는데, 다른 쪽으로 복사하면 화면 밖에 떨어지기도 했다.
  const target = at || visiblePasteSpot(page);
  const shift =
    target && bounds
      ? { x: target.x - (bounds.x + bounds.w / 2), y: target.y - (bounds.y + bounds.h / 2) }
      : { x: 0, y: 0 };
  const pasted = offsetItems(state.inkClipboard, shift.x, shift.y);
  commitPageChange(page, () => {
    const list = pageStrokes(page);
    const start = list.length;
    list.push(...pasted);
    state.selectIndices = pasted.map((_, index) => start + index);
    state.selectPage = page;
  });
  selectSelectTool();
  redrawRegionPage(page);
  syncSelectHud();
}

/** 바깥에서 온 그림을 누른 자리에. 크기는 이미지 넣기(#25)와 같은 규칙. */
async function pasteImageAt(page, at, src, metaRect = null) {
  try {
    // #224: SVG·blob·원격 주소로 온 것도 `<img>`로만 읽어 캔버스에 굽는다.
    // 종이에 남는 것은 언제나 우리가 만든 PNG/JPEG이고, 원본 주소는 안 남는다.
    const raw = acceptImageSrc(src) ? src : await bakeForeignImage(src);
    if (!raw) {
      flashBanner("그 그림은 붙일 수 없습니다.");
      return;
    }
    const img = await loadHtmlImage(raw);
    const scaled = await downscaleImage(img);
    const view = state.pageViews.find((item) => item.pageNum === page);
    // #256: 이 그림이 우리가 캡처한 것이면(지문 일치) 원래 자리·크기로.
    const known = metaRect ? { rect: metaRect } : findCapture(state.captures, hashOfImage(img), hamming);
    // #238: 붙여넣기는 보던 크기 그대로. 기기 배율과 지금 쪽 배율을 되돌린다.
    const size = trueSizeOnPage({
      imgWidth: img.naturalWidth || scaled.width,
      imgHeight: img.naturalHeight || scaled.height,
      cssWidth: view?.cssWidth || 400,
      cssHeight: view?.cssHeight || 600,
      devicePixelRatio: window.devicePixelRatio || 1,
      pageScale: state.userScale || 1,
      // #242: 92%로 줄이면 붙인 그림이 원래보다 작아진다. 쪽에 꽉 차는 데까지.
      maxShare: 1,
    });
    // 자리 우선순위 (#256): ①지문으로 찾은 원래 자리(다른 문서·세션도!) ②이 세션
    // 캡처 ③누른 자리 ④보이는 화면 한가운데. 원래 자리를 알면 누른 자리보다 앞선다.
    const home = known?.rect || state.captureFrom?.rect || null;
    const spot = home
      ? { x: home.x, y: home.y, w: home.w || size.w, h: home.h || size.h }
      : pastePlacement(at || visiblePasteSpot(page), size);
    const item = imageItem({ src: scaled.src, x: spot.x, y: spot.y, w: spot.w, h: spot.h });
    commitPageChange(page, () => {
      pageStrokes(page).push(item);
      state.selectIndices = [pageStrokes(page).length - 1];
      state.selectPage = page;
    });
    selectSelectTool();
    redrawRegionPage(page);
    syncSelectHud();
    flashBanner("붙여넣었습니다.");
  } catch {
    flashBanner("그림을 붙이지 못했습니다.");
  }
}

/** 이 사이에 이어 누르면 같은 밀기로 본다. */
const NUDGE_RUN_MS = 900;
let nudgeRun = null;

/**
 * 화살표로 민다 (#236). 손으로는 이만큼 정확히 못 옮긴다. 연달아 누른 것은
 * **되돌리기 한 벌**로 묶는다 — 스무 번 눌렀다고 스무 번 되돌리면 못 쓴다.
 */
function nudgeSelection(pageNum, nudge) {
  const key = inkKey(leafAt(state.leaves, pageNum));
  const before = cloneItems(pageStrokes(pageNum));
  state.pages[key] = translateItems(pageStrokes(pageNum), state.selectIndices, nudge.dx, nudge.dy);
  const after = cloneItems(state.pages[key]);
  // 잠깐 사이에 이어 누른 것은 한 벌 — 스무 번 눌렀다고 스무 번 되돌리면 못 쓴다.
  const sameRun = nudgeRun && nudgeRun.key === key && Date.now() - nudgeRun.at <= NUDGE_RUN_MS;
  if (!sameRun || !extendChange(state.history, { page: key, after })) {
    recordChange(state.history, { page: key, before, after });
  }
  nudgeRun = { key, at: Date.now() };
  persistStrokes();
  syncHistoryButtons();
  redrawRegionPage(pageNum);
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
  warmThumbs();
}

/* ---- 서랍 폭 (#106) ---- */

/** The workspace changed size, so the page fit has to be recomputed (#155). */
function refitPages() {
  if (!state.pdf) {
    return;
  }
  state.baseCss = { width: 0, height: 0 };
  rebuildPages();
}

function applyPreviewWidth() {
  if (!els.previewDrawer) {
    return;
  }
  const width = clampPreviewWidth(state.previewWidth);
  state.previewWidth = width;
  els.previewDrawer.style.setProperty("--preview-w", `${width}px`);
  // The screen is pushed by the same width, so the paper re-fits (#155).
  els.writeScreen.style.setProperty("--preview-w", `${width}px`);
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
    // Re-fit only on release: not once per frame while dragging (#155).
    refitPages();
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
  els.writeScreen.dataset.preview = "open";
  applyPreviewWidth();
  renderPreview();
  syncPreviewButton();
  refitPages();
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
  hidePageMenu();
  hideTocMenu();
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
  state.outline = addOutlineEntry(state.outline, state.page, state.leaves);
  persistStrokes();
  renderTocList();
}

function saveTocTitle(id, title) {
  state.outline = renameOutlineEntry(state.outline, id, title);
  persistStrokes();
  renderTocList();
  syncPreviewOutlineCaptions();
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

function hideTocMenu() {
  if (els.tocMenu) {
    els.tocMenu.hidden = true;
  }
  state.tocMenuAt = null;
}

function openTocMenu(id, rect) {
  if (!els.tocMenu) {
    return;
  }
  state.tocMenuAt = id;
  els.tocMenu.hidden = false;
  const spot = placePageMenu(rect.top, rect.right, window.innerHeight, 2);
  els.tocMenu.style.left = `${Math.min(window.innerWidth - 148, spot.left)}px`;
  els.tocMenu.style.top = `${spot.top}px`;
}

/** Opens the in-place editor for that row (#114·#155). */
function renameTocRow(row, entry) {
  hideTocMenu();
  const title = row?.querySelector(".preview-toc-title");
  if (title && entry) {
    beginTocTitleEdit(title, entry);
  }
}

function ensurePreviewTocCaption(row, title) {
  const meta = row?.querySelector(".preview-meta");
  if (!meta) {
    return null;
  }
  let caption = meta.querySelector(".preview-toc-caption");
  if (!caption) {
    caption = document.createElement("span");
    caption.className = "preview-toc-caption";
    meta.append(caption);
  }
  setOutlineTitleText(caption, title);
  caption.title = title;
  return caption;
}

/** After a rename, put the caption back (or drop it) without remaking rows. */
function syncPreviewOutlineCaptions() {
  if (!els.previewList || els.previewDrawer?.hidden || state.previewTab === "toc") {
    return;
  }
  els.previewList.querySelectorAll(".preview-row").forEach((row) => {
    const pageNum = Number(row.dataset.page);
    const tocTitle = firstOutlineTitleForPage(state.outline, pageNum, state.leaves);
    const meta = row.querySelector(".preview-meta");
    if (!meta) {
      return;
    }
    meta.querySelector(".preview-toc-edit")?.remove();
    const caption = meta.querySelector(".preview-toc-caption");
    if (tocTitle) {
      ensurePreviewTocCaption(row, tocTitle);
    } else if (caption) {
      caption.remove();
    }
  });
}

/**
 * Double-tap on a preview row edits that page's outline title (#217).
 * No entry yet: add one for the page, then open the same rename field.
 */
function beginPreviewOutlineEdit(row, pageNum) {
  if (!row || row.querySelector(".preview-toc-edit")) {
    return;
  }
  let entry = firstOutlineEntryForPage(state.outline, pageNum, state.leaves);
  if (!entry) {
    state.outline = addOutlineEntry(state.outline, pageNum, state.leaves);
    persistStrokes();
    entry = firstOutlineEntryForPage(state.outline, pageNum, state.leaves);
  }
  if (!entry) {
    return;
  }
  const caption = ensurePreviewTocCaption(row, entry.title || outlineTitleForPage(pageNum));
  if (caption) {
    beginTocTitleEdit(caption, entry);
  }
}

function runTocMenu(action) {
  const id = state.tocMenuAt;
  hideTocMenu();
  if (!id) {
    return;
  }
  if (action === "delete") {
    removeTocEntry(id);
    return;
  }
  if (action === "rename") {
    renameTocRow(els.tocList?.querySelector(`[data-entry="${id}"]`), state.outline.find((item) => item.id === id));
  }
}

/** Tap jumps, hold opens 이름 변경·삭제. No stray x on the row (#114). */
function bindTocRowGestures(row, entry, dest) {
  let timer = 0;
  let start = null;
  let held = false;
  let lastTapAt = 0;
  let lastTapX = 0;
  let lastTapY = 0;

  const stop = () => {
    window.clearTimeout(timer);
    timer = 0;
  };

  const open = () => {
    held = true;
    openTocMenu(entry.id, row.getBoundingClientRect());
  };

  row.addEventListener("pointerdown", (event) => {
    if (event.target.closest("input")) {
      return;
    }
    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    held = false;
    timer = window.setTimeout(() => {
      timer = 0;
      open();
    }, PAGE_HOLD_MS);
  });

  row.addEventListener("pointermove", (event) => {
    if (!start || start.id !== event.pointerId || held) {
      return;
    }
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > PAGE_DRAG_SLOP_PX) {
      stop();
      start = null;
    }
  });

  row.addEventListener("pointerup", (event) => {
    if (!start || start.id !== event.pointerId) {
      return;
    }
    stop();
    const wasHeld = held;
    const item = wasHeld ? menuActionAtPoint(els.tocMenu, event, "tocMenu") : null;
    start = null;
    if (item) {
      runTocMenu(item);
      return;
    }
    if (wasHeld) {
      return;
    }
    // #155: a second tap in the same spot renames, one tap still jumps.
    const now = performance.now();
    const away = Math.hypot(event.clientX - lastTapX, event.clientY - lastTapY);
    if (isDoubleTap(now, lastTapAt, away)) {
      lastTapAt = 0;
      renameTocRow(row, entry);
      return;
    }
    lastTapAt = now;
    lastTapX = event.clientX;
    lastTapY = event.clientY;
    goToPage(dest);
  });

  row.addEventListener("dblclick", (event) => {
    event.preventDefault();
    renameTocRow(row, entry);
  });

  row.addEventListener("pointercancel", () => {
    stop();
    start = null;
  });

  row.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    stop();
    open();
  });
}

function renderTocList() {
  if (!els.tocList) {
    return;
  }
  els.tocList.replaceChildren();
  for (const entry of state.outline) {
    const dest = outlineDestPage(entry, state.leaves);
    const row = document.createElement("div");
    row.className = "preview-toc-row";
    row.dataset.entry = entry.id;
    if (dest === state.page) {
      row.classList.add("is-current");
    }
    const page = document.createElement("span");
    page.className = "preview-toc-page";
    page.textContent = outlinePageLabel(dest);
    const title = document.createElement("button");
    title.type = "button";
    title.className = "preview-toc-title";
    setOutlineTitleText(title, entry.title || outlineTitleForPage(dest));
    const jump = document.createElement("span");
    jump.className = "preview-toc-jump";
    jump.setAttribute("aria-hidden", "true");
    row.dataset.dest = String(dest);
    row.append(page, title, jump);
    bindTocRowGestures(row, entry, dest);
    els.tocList.append(row);
  }
}

/** Bulk page work: leaves and every page's ink in one undo step (#159). */
function commitBulkChange(apply) {
  const key = inkKey(leafAt(state.leaves, state.page)) || "1";
  const leavesBefore = cloneItems(state.leaves);
  const pagesBefore = cloneItems(state.pages);
  apply();
  // #83: 일괄 삭제(여러 쪽 지우기)도 무덤에 남아야 다른 기기에서 안 살아난다.
  for (const pageKey of new Set([...Object.keys(pagesBefore), ...Object.keys(state.pages)])) {
    state.inkGone = goneAfterChange(pagesBefore[pageKey], state.pages[pageKey], state.inkGone);
  }
  recordChange(state.history, {
    page: key,
    before: cloneItems(state.pages[key] || []),
    after: cloneItems(state.pages[key] || []),
    extra: {
      leavesBefore,
      leavesAfter: cloneItems(state.leaves),
      pagesBefore,
      pagesAfter: cloneItems(state.pages),
    },
  });
  persistStrokes();
  syncHistoryButtons();
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
  // A deleted page takes its 목차 entry with it (#107).
  state.outline = normalizeOutline(state.outline, state.leaves);
  state.page = Math.min(Math.max(1, nextPage), state.pageCount);
  state.selectIndices = [];
  rebuildPages();
  warmThumbs();
  if (!els.previewDrawer.hidden) {
    renderPreview();
  }
}

/**
 * Which menu row the pointer was released over. A hold-then-slide release never
 * produces a click on the item, so the menus read the release point (#113).
 */
function menuActionAtPoint(menu, event, key) {
  if (!menu || menu.hidden) {
    return null;
  }
  const node = document.elementFromPoint(event.clientX, event.clientY);
  const button = node?.closest?.("button");
  if (!button || button.disabled || !menu.contains(button)) {
    return null;
  }
  return button.dataset[key] || null;
}

/** Menus fire on release, so both a slide-release and a plain tap work. */
function bindMenuRelease(menu, key, run) {
  if (!menu) {
    return;
  }
  menu.addEventListener("pointerdown", (event) => event.stopPropagation());
  menu.addEventListener("pointerup", (event) => {
    const action = menuActionAtPoint(menu, event, key);
    if (action) {
      event.preventDefault();
      run(action);
    }
  });
}

/* ---- 여러 쪽 고르기 (#159) ---- */

function pickedIndexes() {
  return sortedIndexes(
    state.pickedPages.map((id) => state.leaves.findIndex((leaf) => leaf.id === id)),
    state.leaves,
  );
}

function clearPagePick() {
  state.pickMode = false;
  state.pickedPages = [];
  els.previewList?.querySelectorAll(".preview-row.is-picked").forEach((row) => {
    row.classList.remove("is-picked");
  });
}

function togglePagePick(leafId) {
  const at = state.pickedPages.indexOf(leafId);
  if (at >= 0) {
    state.pickedPages.splice(at, 1);
  } else {
    state.pickedPages.push(leafId);
  }
  const row = els.previewList?.querySelector(`[data-leaf="${leafId}"]`);
  row?.classList.toggle("is-picked", at < 0);
}

/** Runs the menu over every chosen page, in one undo step. */
function runPickedMenu(action) {
  const indexes = pickedIndexes();
  if (!indexes.length) {
    return false;
  }
  const last = indexes.at(-1);
  if (action === "copy") {
    state.pageClip = copyPageLeaves(state.leaves, state.pages, indexes);
    flashBanner(`${indexes.length}쪽을 복사했습니다.`);
    return true;
  }
  if (action === "left" || action === "right") {
    const delta = action === "left" ? -90 : 90;
    commitBulkChange(() => {
      state.pages = { ...state.pages };
      for (const at of indexes) {
        const leaf = state.leaves[at];
        state.pages[inkKey(leaf)] = rotateItems(state.pages[inkKey(leaf)] || [], delta);
      }
      state.leaves = rotatePageLeaves(state.leaves, indexes, delta);
    });
    afterPageOp(state.page);
    return true;
  }
  if (action === "delete") {
    const out = deletePageLeaves(state.leaves, state.pages, indexes);
    if (!out.removed) {
      flashBanner("마지막 한 장은 지울 수 없습니다.");
      return true;
    }
    commitBulkChange(() => {
      state.leaves = out.leaves;
      state.pages = out.pages;
    });
    clearPagePick();
    afterPageOp(Math.min(state.page, out.leaves.length));
    return true;
  }
  if (action === "duplicate" || action === "paste") {
    const clips = action === "duplicate" ? copyPageLeaves(state.leaves, state.pages, indexes) : state.pageClip;
    const list = Array.isArray(clips) ? clips : [clips].filter(Boolean);
    if (!list.length) {
      return true;
    }
    const out = pastePageLeaves(state.leaves, state.pages, last, list);
    commitBulkChange(() => {
      state.leaves = out.leaves;
      state.pages = out.pages;
    });
    clearPagePick();
    afterPageOp(out.at + 1);
    return true;
  }
  return false;
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
  if (action === "pick") {
    hidePageMenu();
    state.pickMode = true;
    const leaf = leafAt(state.leaves, state.pageMenuAt);
    if (leaf && !state.pickedPages.includes(leaf.id)) {
      togglePagePick(leaf.id);
    }
    flashBanner("고를 쪽을 탭하세요. 길게 누르면 메뉴.", 2200);
    return;
  }
  if (state.pickMode) {
    hidePageMenu();
    if (runPickedMenu(action)) {
      return;
    }
  }
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
  let lastTapAt = 0;
  let lastTapX = 0;
  let lastTapY = 0;

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

  const grab = () => {
    held = true;
    row.classList.add("is-grabbed");
    // No pointer capture here (#113): with capture the click after a hold goes
    // to a common ancestor, so the menu button never hears it. is-grabbed's
    // touch-action already keeps the drawer from scrolling.
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
      grab();
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
      try {
        row.setPointerCapture(event.pointerId);
      } catch {
        // optional
      }
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
    // Held, slid onto an item and released: run it (#113).
    const item = wasHeld && !wasDragging ? menuActionAtPoint(els.pageMenu, event, "pageMenu") : null;
    release();
    if (wasDragging) {
      movePageByDrag(from, to);
      return;
    }
    if (item) {
      runPageMenu(item);
      return;
    }
    if (!wasHeld) {
      if (state.pickMode) {
        togglePagePick(row.dataset.leaf);
        return;
      }
      const now = performance.now();
      const away = Math.hypot(event.clientX - lastTapX, event.clientY - lastTapY);
      if (isDoubleTap(now, lastTapAt, away)) {
        lastTapAt = 0;
        beginPreviewOutlineEdit(row, pageOf());
        return;
      }
      lastTapAt = now;
      lastTapX = event.clientX;
      lastTapY = event.clientY;
      goToPage(pageOf());
    }
  };

  row.addEventListener("pointerup", end);
  row.addEventListener("dblclick", (event) => {
    event.preventDefault();
    if (state.pickMode) {
      return;
    }
    beginPreviewOutlineEdit(row, pageOf());
  });
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
  const wrap = document.createElement("div");
  wrap.className = "preview-thumb-wrap";
  const meta = document.createElement("div");
  meta.className = "preview-meta";
  const label = document.createElement("span");
  label.className = "preview-page-label";
  label.textContent = leaf.kind === "outline" ? leaf.title : `${pageNum}`;
  const star = document.createElement("button");
  star.type = "button";
  star.className = "preview-bookmark";
  star.classList.toggle("is-on", leaf.bookmark);
  star.textContent = leaf.bookmark ? "★" : "☆";
  star.setAttribute("aria-label", "책갈피");
  star.addEventListener("pointerdown", (event) => event.stopPropagation());
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
  wrap.append(thumb, star);
  const tocTitle = firstOutlineTitleForPage(state.outline, pageNum, state.leaves);
  if (tocTitle) {
    const caption = document.createElement("span");
    caption.className = "preview-toc-caption";
    setOutlineTitleText(caption, tocTitle);
    caption.title = tocTitle;
    meta.append(label, caption);
  } else {
    meta.append(label);
  }
  row.append(wrap, meta);
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
    drawerWidth: state.previewWidth,
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
    row.classList.toggle("is-picked", state.pickedPages.includes(leaf.id));
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

/**
 * Thumbs are made of two parts (#143): the page picture, which never changes
 * and is worth storing, and the ink on top, which is cheap to redraw. Storing
 * only the page keeps one entry per page instead of one per edit.
 */
function pageThumbKey(leaf, width) {
  return thumbCacheKey(leaf, width, "page");
}

function storeThumb(canvas, key) {
  if (!state.identity || typeof canvas.toBlob !== "function") {
    return;
  }
  canvas.toBlob((blob) => {
    if (blob) {
      saveThumb(state.identity, key, blob);
    }
  }, "image/png");
}

async function drawStoredPage(canvas, key) {
  const cached = pageThumbCache.get(key);
  if (cached?.bitmap) {
    canvas.width = cached.width;
    canvas.height = cached.height;
    canvas.getContext("2d").drawImage(cached.bitmap, 0, 0);
    return true;
  }
  const blob = await loadThumb(state.identity, key);
  if (!blob) {
    return false;
  }
  try {
    const bitmap = await createImageBitmap(blob);
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0);
    pageThumbCache.set(key, { width: bitmap.width, height: bitmap.height, bitmap });
    return true;
  } catch {
    return false;
  }
}

/** Thumb ink: the same layers as the page, scaled down. */
async function paintThumbInk(canvas, leaf) {
  const items = state.pages[inkKey(leaf)] || [];
  if (!items.length) {
    return;
  }
  const base = await basePageCss();
  const layers = await exportInkCanvas(items, { width: canvas.width, height: canvas.height }, base.width);
  canvas.getContext("2d").drawImage(layers, 0, 0);
}

async function renderThumbPage(canvas, leaf, size) {
  const ctx = canvas.getContext("2d");
  canvas.width = Math.round(size.width * 2);
  canvas.height = Math.round(size.height * 2);
  if (leaf.kind === "outline" || !state.pdf) {
    const shape = await blankThumbShape(leaf, size);
    canvas.width = shape.width;
    canvas.height = shape.height;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  ctx.fillStyle = "#F7F4EC";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  try {
    const page = await state.pdf.getPage(leaf.pdfPage);
    const rotation = ((page.rotate || 0) + (leaf.rotate || 0)) % 360;
    const base = page.getViewport({ scale: 1, rotation });
    const scale = Math.min((size.width * 2) / base.width, (size.height * 2) / base.height);
    canvas.width = Math.max(1, Math.round(base.width * scale));
    canvas.height = Math.max(1, Math.round(base.height * scale));
    const viewport = page.getViewport({ scale, rotation });
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
  } catch {
    // cream placeholder
  }
}

async function paintPreviewThumb(canvas, leaf) {
  const size = previewThumbSize(state.previewWidth);
  const items = state.pages[inkKey(leaf)] || [];
  const key = thumbCacheKey(leaf, size.width, inkSignature(items));
  if (canvas.dataset.painted === key) {
    return;
  }
  const hit = thumbCache.get(key);
  if (hit?.bitmap) {
    canvas.width = hit.width;
    canvas.height = hit.height;
    canvas.getContext("2d").drawImage(hit.bitmap, 0, 0);
    fitThumbElement(canvas, size);
    canvas.dataset.painted = key;
    return;
  }
  const pageKey = pageThumbKey(leaf, size.width);
  if (!(await drawStoredPage(canvas, pageKey))) {
    await renderThumbPage(canvas, leaf, size);
    const pageBitmap = snapshotCanvas(canvas);
    if (pageBitmap) {
      pageThumbCache.set(pageKey, { width: canvas.width, height: canvas.height, bitmap: pageBitmap });
    }
    storeThumb(canvas, pageKey);
  }
  await paintThumbInk(canvas, leaf);
  const bitmap = snapshotCanvas(canvas);
  if (bitmap) {
    thumbCache.set(key, { width: canvas.width, height: canvas.height, bitmap });
  }
  fitThumbElement(canvas, size);
  canvas.dataset.painted = key;
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
  // #240: 어디서 오려 왔는지 적어 둔다. 되붙일 때 제자리로 가도록.
  state.captureFrom = { rect: { ...pending.rect }, page: pending.page };
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
    // #253: 어디서 오려 냈는지 그림 안에도 심고(클립보드가 살려 주면 빠른 길),
    const meta = { app: "pdf-ink", v: 1, rect: { ...pending.rect } };
    const result = captureRegionPng(pdf.data, ink.data, view.pdfCanvas.width, view.pdfCanvas.height, boxes, crop, meta);
    // #256: 지문→자리를 등록부에도 남긴다. 클립보드가 PNG 메타를 지워도 붙일 때
    // 이 지문으로 원래 자리를 찾는다(재인코딩돼도 픽셀은 그대로).
    try {
      const hash = dHash(grayGrid(result.pixels, result.width, result.height));
      state.captures = addCapture(state.captures, { hash, rect: { ...pending.rect } });
      saveCaptures(state.captures);
    } catch {
      // 등록 실패해도 붙여넣기 자체는 된다.
    }
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
  // #159: a bulk page op carries every page's ink, so one undo puts it all back.
  const pages = side === "undo" ? entry?.extra?.pagesBefore : entry?.extra?.pagesAfter;
  if (pages) {
    state.pages = cloneItems(pages);
  }
  const next = side === "undo" ? entry?.extra?.leavesBefore : entry?.extra?.leavesAfter;
  if (!next) {
    return Boolean(pages);
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
  const links = await exportLinkMap();
  const bytes = await buildAnnotatedPdf({
    buffer: state.buffer,
    leaves: state.leaves,
    linksOf: (leaf) => links.get(leaf.id) || [],
    outline: state.outline.map((entry) => ({
      title: entry.title,
      page: outlineDestPage(entry, state.leaves),
    })),
    bookmarkPages: bookmarkPagesFromLeaves(state.leaves),
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

/* ---- 드롭박스 (#82) : 토큰은 이 브라우저에만 ---- */

const DROPBOX_VERIFIER_KEY = "pdf-ink:dropbox-verifier";

function dropboxConnected() {
  return Boolean(state.dropbox?.refreshToken);
}

async function startDropboxLogin() {
  const verifier = makeVerifier();
  try {
    sessionStorage.setItem(DROPBOX_VERIFIER_KEY, verifier);
  } catch {
    flashBanner("브라우저 저장을 쓸 수 없어 연결하지 못합니다.");
    return;
  }
  const challenge = await challengeFor(verifier);
  window.location.href = authorizeUrl({ challenge, origin: window.location.origin });
}

/** Runs on load: turns ?code=... into a session, then cleans the address bar. */
async function finishDropboxLogin() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code) {
    return;
  }
  let verifier = "";
  try {
    verifier = sessionStorage.getItem(DROPBOX_VERIFIER_KEY) || "";
    sessionStorage.removeItem(DROPBOX_VERIFIER_KEY);
  } catch {
    verifier = "";
  }
  window.history.replaceState({}, "", window.location.pathname);
  if (!verifier) {
    return;
  }
  try {
    const reply = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody({ code, verifier, origin: window.location.origin }),
    });
    if (!reply.ok) {
      throw new Error("token");
    }
    const session = sessionFromToken(await reply.json());
    if (!session) {
      throw new Error("token");
    }
    state.dropbox = session;
    saveDropboxSession(session);
    flashBanner("드롭박스에 연결했습니다.");
    openDropboxSheet();
  } catch {
    flashBanner("드롭박스 연결에 실패했습니다.");
  }
}

async function dropboxToken() {
  if (!dropboxConnected()) {
    return "";
  }
  if (!tokenExpired(state.dropbox)) {
    return state.dropbox.accessToken;
  }
  const reply = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: refreshBody({ refreshToken: state.dropbox.refreshToken }),
  });
  if (!reply.ok) {
    throw new Error("refresh");
  }
  const next = sessionFromToken(await reply.json(), Date.now(), state.dropbox);
  if (!next) {
    throw new Error("refresh");
  }
  state.dropbox = next;
  saveDropboxSession(next);
  return next.accessToken;
}

async function dropboxRpc(url, body) {
  const token = await dropboxToken();
  const reply = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!reply.ok) {
    throw new Error(`rpc ${reply.status}`);
  }
  return reply.json();
}

async function openDropboxSheet() {
  if (!els.dropboxSheet) {
    return;
  }
  if (!dropboxConnected()) {
    await startDropboxLogin();
    return;
  }
  state.dropboxMode = "open";
  els.dropboxSave.hidden = true;
  els.dropboxSheet.hidden = false;
  els.dropboxBackdrop.hidden = false;
  await showDropboxFolder(state.dropboxPath || "");
}

function closeDropboxSheet() {
  if (!els.dropboxSheet) {
    return;
  }
  els.dropboxSheet.hidden = true;
  els.dropboxBackdrop.hidden = true;
}

async function showDropboxFolder(path) {
  state.dropboxPath = path;
  els.dropboxPath.textContent = path || "드롭박스";
  if (els.dropboxHere) {
    // #167: which folder the copy lands in, right next to the name box.
    els.dropboxHere.textContent = `여기에 저장: ${path || "내 드롭박스"}`;
  }
  els.dropboxUp.hidden = !path;
  els.dropboxList.replaceChildren(loadingRow("여는 중…"));
  try {
    let data = await dropboxRpc(LIST_URL, { path, recursive: false, limit: 500 });
    let entries = data.entries || [];
    while (data.has_more) {
      data = await dropboxRpc(LIST_MORE_URL, { cursor: data.cursor });
      entries = entries.concat(data.entries || []);
    }
    renderDropboxList(pdfEntries(entries));
  } catch {
    els.dropboxList.replaceChildren(loadingRow("목록을 불러오지 못했습니다."));
  }
}

function loadingRow(text) {
  const note = document.createElement("p");
  note.className = "dropbox-empty";
  note.textContent = text;
  return note;
}

function renderDropboxList(entries) {
  if (!entries.length) {
    els.dropboxList.replaceChildren(loadingRow("이 폴더에 PDF가 없습니다."));
    return;
  }
  els.dropboxList.replaceChildren(
    ...entries.map((entry) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "dropbox-row";
      const name = document.createElement("span");
      name.textContent = entry.name;
      const kind = document.createElement("span");
      kind.className = "dropbox-row-kind";
      kind.textContent = entry[".tag"] === "folder" ? "폴더" : "PDF";
      row.append(name, kind);
      row.addEventListener("click", () => {
        if (entry[".tag"] === "folder") {
          showDropboxFolder(entry.path_lower || entry.path_display || "");
          return;
        }
        if (state.dropboxMode === "save") {
          // Picking a file here just borrows its name; we never overwrite it.
          els.dropboxName.value = entry.name;
          return;
        }
        openDropboxFile(entry);
      });
      return row;
    }),
  );
}

async function openDropboxFile(entry) {
  const doc = docFromEntry(entry);
  if (!doc) {
    return;
  }
  showBanner("드롭박스에서 여는 중…");
  try {
    const token = await dropboxToken();
    const reply = await fetch(DOWNLOAD_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Dropbox-API-Arg": asciiHeader(downloadArg(doc.path)) },
    });
    if (!reply.ok) {
      throw new Error("download");
    }
    const buffer = await reply.arrayBuffer();
    const check = await validatePdfContents(new Blob([buffer]));
    if (!check.ok) {
      flashBanner(check.message);
      return;
    }
    closeDropboxSheet();
    state.dropboxDoc = doc;
    showBanner("");
    await openPdfBuffer(buffer, { identity: dropboxIdentity(doc), name: doc.name });
    await loadInkSidecar(doc);
    await rebuildPages();
    await downloadThumbPack(doc);
  } catch {
    flashBanner("드롭박스에서 열지 못했습니다.");
  }
}

/** Writes the annotated PDF back to the same Dropbox file (#82). */
async function saveToDropbox(blob) {
  const doc = state.dropboxDoc;
  const token = await dropboxToken();
  const reply = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": asciiHeader(uploadArg(doc.path, doc.rev)),
    },
    body: blob,
  });
  if (reply.ok) {
    const meta = await reply.json();
    state.dropboxDoc = { ...doc, rev: meta.rev || doc.rev };
    return "saved";
  }
  let payload = null;
  try {
    payload = await reply.json();
  } catch {
    payload = null;
  }
  if (isConflict(payload)) {
    // Someone else changed it: never win silently. Next save overwrites.
    state.dropboxDoc = { ...doc, rev: "" };
    return "conflict";
  }
  throw new Error("upload");
}

function disconnectDropbox() {
  const token = state.dropbox?.accessToken;
  state.dropbox = null;
  state.dropboxDoc = null;
  clearDropboxSession();
  closeDropboxSheet();
  flashBanner("드롭박스 연결을 끊었습니다.");
  if (token) {
    fetch(REVOKE_URL, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  }
}

/**
 * Draws the thumbs quietly while the reader is looking at page one, so the
 * drawer is already full when they open it (#141). Stops the moment the
 * document changes, and never fights the pen for a frame.
 */
let warmToken = 0;

function stopThumbWarming() {
  warmToken += 1;
}

function idle(fn) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(fn, { timeout: 500 });
    return;
  }
  window.setTimeout(fn, 32);
}

/**
 * Draws what is missing, in page order, while the reader is busy (#141·#151).
 * The stored key list is the record of what is already done: a rotated page
 * gets a new key, so it simply reads as missing and is drawn again.
 */
async function warmThumbs() {
  stopThumbWarming();
  const token = warmToken;
  const identity = state.identity;
  if (!state.pdf || !identity) {
    return;
  }
  const size = previewThumbSize(state.previewWidth);
  const done = await listThumbKeys(identity);
  if (token !== warmToken || identity !== state.identity) {
    return;
  }
  const pending = state.leaves
    .map((leaf) => ({ leaf, key: pageThumbKey(leaf, size.width) }))
    .filter(({ key }) => !done.has(key) && !pageThumbCache.get(key));
  if (!pending.length) {
    return;
  }
  const canvas = document.createElement("canvas");
  let index = 0;
  const step = () => {
    if (token !== warmToken || identity !== state.identity) {
      return;
    }
    const next = pending[index];
    index += 1;
    if (!next) {
      uploadThumbPack();
      return;
    }
    if (state.drawing) {
      // The pen comes first; try this one again in a moment.
      index -= 1;
      idle(step);
      return;
    }
    paintPreviewThumb(canvas, next.leaf)
      .catch(() => null)
      .finally(() => {
        if (token === warmToken) {
          idle(step);
        }
      });
  };
  idle(step);
}

/* ---- PWA (#131) ---- */

/**
 * A service worker can keep serving yesterday's bundle, so the reader is told
 * and refreshes on their own. Never silently.
 */
async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  try {
    const { registerSW } = await import("virtual:pwa-register");
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        if (!els.updateNote) {
          return;
        }
        els.updateNote.hidden = false;
        els.updateReload?.addEventListener("click", () => updateSW(true), { once: true });
      },
    });
  } catch {
    // dev server without the plugin, or a browser that refuses: keep going
  }
}

/**
 * Ink lives in this browser only, and browsers evict "temporary" storage.
 * Asked once, when a document is actually open (#131).
 */
let persistAsked = false;

async function askPersistentStorage() {
  if (persistAsked || !navigator.storage?.persist) {
    return;
  }
  persistAsked = true;
  try {
    if (await navigator.storage.persisted()) {
      return;
    }
    await navigator.storage.persist();
  } catch {
    // best effort
  }
}

/* ---- 구글 드라이브 (#133) : 시크릿 없음, drive.file만 ---- */

let driveTokenClient = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const found = document.querySelector(`script[src="${src}"]`);
    if (found) {
      if (found.dataset.loaded === "1") {
        resolve();
        return;
      }
      found.addEventListener("load", () => resolve(), { once: true });
      found.addEventListener("error", () => reject(new Error(src)), { once: true });
      return;
    }
    const tag = document.createElement("script");
    tag.src = src;
    tag.async = true;
    tag.addEventListener("load", () => {
      tag.dataset.loaded = "1";
      resolve();
    });
    tag.addEventListener("error", () => reject(new Error(src)));
    document.head.append(tag);
  });
}

/** A token, not a secret. Google keeps the grant, we keep it in memory only. */
function requestDriveToken() {
  return new Promise((resolve, reject) => {
    if (!driveTokenClient) {
      reject(new Error("gis"));
      return;
    }
    driveTokenClient.callback = (reply) => {
      if (reply?.access_token) {
        state.driveToken = reply.access_token;
        resolve(reply.access_token);
        return;
      }
      reject(new Error("token"));
    };
    driveTokenClient.requestAccessToken(tokenRequestOptions(Boolean(state.driveToken)));
  });
}

async function driveToken() {
  if (!driveTokenClient) {
    await loadScript(GIS_SRC);
    driveTokenClient = window.google?.accounts?.oauth2?.initTokenClient(
      tokenClientConfig(() => {}, GOOGLE_CLIENT_ID),
    );
  }
  return state.driveToken || requestDriveToken();
}

/** drive.file only shows what the reader picks, so the picker is the list. */
async function openDrivePicker() {
  if (!driveConfigured()) {
    return;
  }
  showBanner("구글 드라이브를 여는 중…");
  try {
    const token = await driveToken();
    await loadScript(GAPI_SRC);
    await new Promise((resolve) => window.gapi.load("picker", resolve));
    showBanner("");
    // #165: My Drive with folders, not the PDF search box.
    const config = pickerViewConfig();
    const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS);
    view.setMimeTypes(config.mimeTypes);
    view.setIncludeFolders(config.includeFolders);
    view.setSelectFolderEnabled(config.selectFolderEnabled);
    view.setParent(config.parent);
    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      // Without the app id, drive.file never grants us the picked file.
      .setAppId(appIdFromClientId())
      .setCallback((result) => {
        const doc = pdfFromPickerResult(result);
        if (doc) {
          openDriveFile(doc);
        }
      })
      .build();
    picker.setVisible(true);
  } catch {
    flashBanner("구글 드라이브를 열지 못했습니다.");
  }
}

async function driveFetch(url, options = {}) {
  const token = await driveToken();
  const reply = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (reply.status === 401) {
    // The hour is up: ask Google again, silently if it still remembers us.
    state.driveToken = "";
    const fresh = await driveToken();
    return fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${fresh}` },
    });
  }
  return reply;
}

async function openDriveFile(picked) {
  showBanner("구글 드라이브에서 여는 중…");
  try {
    const metaReply = await driveFetch(driveMetadataUrl(picked.id));
    if (!metaReply.ok) {
      throw new Error(String(metaReply.status));
    }
    const meta = await metaReply.json();
    const doc = docFromPicked({ ...picked, ...meta });
    const reply = await driveFetch(driveDownloadUrl(doc.id));
    if (!reply.ok) {
      throw new Error(String(reply.status));
    }
    const buffer = await reply.arrayBuffer();
    const check = await validatePdfContents(new Blob([buffer]));
    if (!check.ok) {
      flashBanner(check.message);
      return;
    }
    state.driveDoc = doc;
    state.driveSidecarId = "";
    showBanner("");
    await openPdfBuffer(buffer, { identity: driveIdentity(doc), name: doc.name });
    await loadDriveSidecar(doc);
    await rebuildPages();
  } catch (error) {
    // The status tells us whether it was the grant, the scope or the network.
    const why = error?.message ? ` (${error.message})` : "";
    flashBanner(`구글 드라이브에서 열지 못했습니다.${why}`, 3200);
  }
}

/**
 * Drive has no If-Match for a binary update, so we look before writing (#133).
 * Not atomic like Dropbox's rev, but it will not bury someone else's work.
 */
async function saveToDrive(blob) {
  const doc = state.driveDoc;
  const meta = await (await driveFetch(driveMetadataUrl(doc.id))).json();
  if (driveRemoteChanged(doc, meta)) {
    state.driveDoc = { ...doc, version: "" };
    return "conflict";
  }
  const reply = await driveFetch(driveUpdateUrl(doc.id, FILE_FIELDS), {
    method: "PATCH",
    headers: { "Content-Type": "application/pdf" },
    body: blob,
  });
  if (!reply.ok) {
    throw new Error("upload");
  }
  const saved = await reply.json();
  state.driveDoc = { ...doc, version: saved.version ? String(saved.version) : "" };
  return "saved";
}

/** Takes the newer file, keeps the ink this browser has not saved yet. */
async function reloadFromDrive() {
  const doc = state.driveDoc;
  hideSyncNote();
  if (!doc) {
    return;
  }
  showBanner("새로 불러오는 중…");
  try {
    const meta = await (await driveFetch(driveMetadataUrl(doc.id))).json();
    const reply = await driveFetch(driveDownloadUrl(doc.id));
    if (!reply.ok) {
      throw new Error("download");
    }
    const buffer = await reply.arrayBuffer();
    state.driveDoc = { ...doc, version: meta.version ? String(meta.version) : doc.version };
    showBanner("");
    await openPdfBuffer(buffer, { identity: driveIdentity(doc), name: doc.name, page: state.page });
    flashBanner("새로 불러왔습니다.");
  } catch {
    flashBanner("새로 불러오지 못했습니다.");
  }
}

async function checkDriveRemote() {
  if (!state.driveDoc || els.writeScreen.hidden || !state.driveToken) {
    return;
  }
  try {
    const meta = await (await driveFetch(driveMetadataUrl(state.driveDoc.id))).json();
    if (driveRemoteChanged(state.driveDoc, meta)) {
      showSyncNote(Object.keys(state.pages || {}).length > 0);
    }
  } catch {
    // offline or the token lapsed: the save path will say so
  }
}

/* ---- 다른 이름으로 드롭박스에 저장 (#149) ---- */

async function openDropboxSaveAs() {
  if (!els.dropboxSheet) {
    return;
  }
  if (!state.pdf) {
    flashBanner("먼저 PDF를 여세요.");
    return;
  }
  if (!dropboxConnected()) {
    await startDropboxLogin();
    return;
  }
  state.dropboxMode = "save";
  els.dropboxName.value = copyNameFor(state.fileName);
  syncInkCopyChoices();
  els.dropboxSheet.hidden = false;
  els.dropboxBackdrop.hidden = false;
  els.dropboxSave.hidden = false;
  await showDropboxFolder(state.dropboxPath || "");
}

function syncInkCopyChoices() {
  document.querySelectorAll("#dropbox-ink-choices [data-ink-copy]").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.inkCopy === state.inkCopy);
  });
}

async function bytesForCopy() {
  if (state.inkCopy !== "baked") {
    return new Blob([state.buffer], { type: "application/pdf" });
  }
  return annotatedPdfBlob();
}

/** Uploads a copy, never over someone else's file (#149). */
async function saveCopyToDropbox() {
  const folder = state.dropboxPath || "";
  const name = ensurePdfName(els.dropboxName?.value);
  const path = joinPath(folder, name);
  showBanner("드롭박스에 저장하는 중…");
  try {
    const blob = await bytesForCopy();
    const token = await dropboxToken();
    const reply = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": asciiHeader(saveAsArg(path)),
      },
      body: blob,
    });
    if (!reply.ok) {
      throw new Error("upload");
    }
    const meta = await reply.json();
    if (state.inkCopy === "sidecar") {
      await fetch(UPLOAD_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": asciiHeader(saveAsArg(sidecarPath(meta.path_lower || path))),
        },
        body: new Blob([
          serializeInkFile({
            pages: state.pages,
            leaves: state.leaves,
            outline: state.outline,
            linkFixes: state.linkFixes,
    gone: state.inkGone,
            name: meta.name || name,
            savedAt: Date.now(),
          }),
        ]),
      });
    }
    closeDropboxSheet();
    // The reader stays on the document they were reading (#149 lock).
    flashBanner(`드롭박스에 저장했습니다. ${meta.name || name}`, 2600);
  } catch {
    flashBanner("드롭박스에 저장하지 못했습니다.");
  }
}

/* ---- 드라이브 사이드카 (#169) ---- */

async function findDriveSidecar(doc) {
  if (state.driveSidecarId) {
    return state.driveSidecarId;
  }
  const query = sidecarQuery(sidecarName(doc.name), doc.parent);
  const reply = await driveFetch(driveSearchUrl(query));
  if (!reply.ok) {
    return "";
  }
  const found = (await reply.json()).files || [];
  state.driveSidecarId = found[0]?.id || "";
  return state.driveSidecarId;
}

/** Same shape as the Dropbox one: a few KB beside the document (#147·#169). */
async function saveDriveSidecar() {
  const doc = state.driveDoc;
  if (!doc) {
    return false;
  }
  const text = serializeInkFile({
    pages: state.pages,
    leaves: state.leaves,
    outline: state.outline,
    linkFixes: state.linkFixes,
    gone: state.inkGone,
    name: state.fileName,
    shareThumbs: state.shareThumbs,
    savedAt: Date.now(),
  });
  let id = await findDriveSidecar(doc);
  if (!id) {
    // We create it, so drive.file keeps letting us write it later.
    const made = await driveFetch(`${FILES_URL}?fields=id`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createFileBody(sidecarName(doc.name), doc.parent)),
    });
    if (!made.ok) {
      throw new Error(String(made.status));
    }
    id = (await made.json()).id;
    state.driveSidecarId = id;
  }
  const put = await driveFetch(driveMediaUrl(id), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: text,
  });
  if (!put.ok) {
    throw new Error(String(put.status));
  }
  state.inkSavedAt = Date.now();
  return true;
}

async function loadDriveSidecar(doc) {
  if (!doc) {
    return;
  }
  let remote = null;
  try {
    const id = await findDriveSidecar(doc);
    if (!id) {
      return;
    }
    const reply = await driveFetch(driveDownloadUrl(id));
    if (!reply.ok) {
      return;
    }
    remote = parseInkFile(await reply.text());
  } catch {
    return;
  }
  if (!remote) {
    return;
  }
  // #83: 더 최근 쪽이 문서 구조(잎·목차)를 정하고, **필기는 합집합**이다.
  // 두 기기가 서로 다른 쪽에 쓴 것이 어느 쪽도 지워지지 않는다.
  const local = { savedAt: state.inkSavedAt || 0, pages: state.pages };
  const takeStructure = pickNewer(local, remote) === "remote";
  state.inkGone = mergeGone(state.inkGone, remote.gone);
  const added = countNewFrom(remote.pages, state.pages, state.inkGone);
  state.pages = mergePages(state.pages, remote.pages, state.inkGone);
  if (takeStructure) {
    state.leaves = normalizeLeaves(remote.leaves, state.pageCount || remote.leaves.length);
    state.pageCount = state.leaves.length;
    state.outline = normalizeOutline(remote.outline, state.leaves);
    state.inkSavedAt = remote.savedAt;
    state.shareThumbs = Boolean(remote.shareThumbs);
    if (remote.linkFixes && Object.keys(remote.linkFixes).length) {
      state.linkFixes = remote.linkFixes;
      anchorLinkFixesNow();
      saveLinkFixes(state.identity, state.linkFixes);
    }
  }
  persistStrokes();
  return added;
}

/* ---- 자동 저장 (#167) ---- */

let autosaveTimer = 0;
let autosaveRunning = false;

/** Called on every change: the upload is a few KB, so it can be quiet. */
function cloudDocOpen() {
  return Boolean(state.driveDoc || (state.dropboxDoc && dropboxConnected()));
}

function scheduleInkAutosave() {
  if (!cloudDocOpen()) {
    return;
  }
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    autosaveTimer = 0;
    runInkAutosave();
  }, AUTOSAVE_MS);
}

async function runInkAutosave() {
  if (autosaveRunning || !cloudDocOpen()) {
    return;
  }
  if (state.drawing) {
    // Mid-stroke: come back when the hand is off the paper.
    scheduleInkAutosave();
    return;
  }
  autosaveRunning = true;
  try {
    await (state.driveDoc ? saveDriveSidecar() : saveInkSidecar());
  } catch {
    flashBanner("필기를 자동으로 저장하지 못했습니다.", 2400);
  } finally {
    autosaveRunning = false;
  }
}

/** Leaving the page must not lose the last stroke. */
function flushInkAutosave() {
  if (!autosaveTimer) {
    return;
  }
  window.clearTimeout(autosaveTimer);
  autosaveTimer = 0;
  runInkAutosave();
}

/* ---- 썸네일 묶음 (#153) : 기본 꺼짐, 문서마다 ---- */

async function blobToBase64(blob) {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let text = "";
  for (const byte of buffer) {
    text += String.fromCharCode(byte);
  }
  return btoa(text);
}

function base64ToBlob(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: "image/png" });
}

function wantedThumbKeys() {
  const size = previewThumbSize(state.previewWidth);
  return state.leaves.map((leaf) => pageThumbKey(leaf, size.width));
}

/** Uploaded only when the document asked for it and every thumb is drawn. */
async function uploadThumbPack() {
  const doc = state.dropboxDoc;
  if (!state.shareThumbs || !doc || !dropboxConnected()) {
    return;
  }
  const wanted = wantedThumbKeys();
  const done = await listThumbKeys(state.identity);
  const ready = wanted.every((key) => done.has(key));
  const remote = state.thumbPackKeys;
  if (!shouldUploadPack({ hasPack: Boolean(remote), ratio: staleRatio(remote || [], wanted), ready })) {
    return;
  }
  const blobs = await loadThumbEntries(state.identity, wanted);
  const entries = {};
  for (const [key, blob] of Object.entries(blobs)) {
    entries[key] = await blobToBase64(blob);
  }
  const text = JSON.stringify(buildThumbPack(entries));
  if (packTooBig(text)) {
    flashBanner("썸네일이 너무 커서 올리지 않았습니다.", 2400);
    return;
  }
  try {
    const token = await dropboxToken();
    await fetch(UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": asciiHeader(uploadArg(thumbPackPath(doc.path), "")),
      },
      body: new Blob([text]),
    });
    state.thumbPackKeys = Object.keys(entries);
  } catch {
    // a pack is a nicety: failing to upload one changes nothing
  }
}

/** Downloaded once, when this machine would otherwise draw most of them. */
async function downloadThumbPack(doc) {
  if (!state.shareThumbs || !doc || !dropboxConnected()) {
    return;
  }
  const wanted = wantedThumbKeys();
  const done = await listThumbKeys(state.identity);
  const missing = wanted.filter((key) => !done.has(key)).length;
  if (!wanted.length || !shouldDownloadPack(missing / wanted.length)) {
    state.thumbPackKeys = [...done];
    return;
  }
  try {
    const token = await dropboxToken();
    const reply = await fetch(DOWNLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": asciiHeader(downloadArg(thumbPackPath(doc.path))),
      },
    });
    if (!reply.ok) {
      return;
    }
    const pack = parseThumbPack(await reply.text());
    if (!pack) {
      return;
    }
    for (const [key, base64] of Object.entries(pack.thumbs)) {
      await saveThumb(state.identity, key, base64ToBlob(base64));
    }
    state.thumbPackKeys = Object.keys(pack.thumbs);
    renderPreview();
  } catch {
    // no pack, or offline: draw them the usual way
  }
}

/* ---- 필기 사이드카 (#147) ---- */

/** Uploads just the ink: kilobytes, and the PDF is left untouched. */
async function saveInkSidecar() {
  const doc = state.dropboxDoc;
  if (!doc || !dropboxConnected()) {
    return false;
  }
  const text = serializeInkFile({
    pages: state.pages,
    leaves: state.leaves,
    outline: state.outline,
    linkFixes: state.linkFixes,
    gone: state.inkGone,
    name: state.fileName,
    shareThumbs: state.shareThumbs,
    savedAt: Date.now(),
  });
  const token = await dropboxToken();
  const reply = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      // The sidecar is ours alone, so last write wins is fine here.
      "Dropbox-API-Arg": asciiHeader(uploadArg(sidecarPath(doc.path), "")),
    },
    body: new Blob([text], { type: "application/json" }),
  });
  if (!reply.ok) {
    throw new Error("sidecar");
  }
  state.inkSavedAt = Date.now();
  return true;
}

/** Reads the sidecar beside the document and takes whichever save is newer. */
async function loadInkSidecar(doc) {
  if (!doc || !dropboxConnected()) {
    return;
  }
  let remote = null;
  try {
    const token = await dropboxToken();
    const reply = await fetch(DOWNLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Dropbox-API-Arg": asciiHeader(downloadArg(sidecarPath(doc.path))),
      },
    });
    if (!reply.ok) {
      return;
    }
    remote = parseInkFile(await reply.text());
  } catch {
    return;
  }
  if (!remote) {
    return;
  }
  // #83: 더 최근 쪽이 문서 구조(잎·목차)를 정하고, **필기는 합집합**이다.
  // 두 기기가 서로 다른 쪽에 쓴 것이 어느 쪽도 지워지지 않는다.
  const local = { savedAt: state.inkSavedAt || 0, pages: state.pages };
  const takeStructure = pickNewer(local, remote) === "remote";
  state.inkGone = mergeGone(state.inkGone, remote.gone);
  const added = countNewFrom(remote.pages, state.pages, state.inkGone);
  state.pages = mergePages(state.pages, remote.pages, state.inkGone);
  if (takeStructure) {
    state.leaves = normalizeLeaves(remote.leaves, state.pageCount || remote.leaves.length);
    state.pageCount = state.leaves.length;
    state.outline = normalizeOutline(remote.outline, state.leaves);
    state.inkSavedAt = remote.savedAt;
    state.shareThumbs = Boolean(remote.shareThumbs);
    if (remote.linkFixes && Object.keys(remote.linkFixes).length) {
      state.linkFixes = remote.linkFixes;
      anchorLinkFixesNow();
      saveLinkFixes(state.identity, state.linkFixes);
    }
  }
  persistStrokes();
  return added;
}

/* ---- 다른 기기의 변경 알아채기 (#127) ---- */

let syncTimer = 0;

function hideSyncNote() {
  if (els.syncNote) {
    els.syncNote.hidden = true;
  }
}

function showSyncNote(dirty) {
  if (!els.syncNote) {
    return;
  }
  els.syncNoteText.textContent = dirty
    ? "다른 기기에서 바뀌었습니다. 내 필기는 그대로 남습니다."
    : "다른 기기에서 바뀌었습니다.";
  els.syncNote.hidden = false;
}

/** Metadata only: a check costs a few hundred bytes, never the whole file. */
async function checkDropboxRemote() {
  if (!state.dropboxDoc || !dropboxConnected() || els.writeScreen.hidden) {
    return;
  }
  try {
    const meta = await dropboxRpc(META_URL, { path: state.dropboxDoc.path });
    if (remoteChanged(state.dropboxDoc, meta)) {
      showSyncNote(Object.keys(state.pages || {}).length > 0);
    }
  } catch {
    // offline or token trouble: stay quiet, the save path will report it
  }
}

function checkRemote() {
  checkDropboxRemote();
  checkDriveRemote();
  pullRemoteInk();
}

let pullingInk = false;

/**
 * 다른 기기의 필기를 알아서 받아 합친다 (#83). 병합은 안전하므로 묻지 않고,
 * 실제로 새 항목이 왔을 때만 알리고 다시 그린다. 사이드카는 몇 KB다.
 */
async function pullRemoteInk() {
  if (pullingInk || state.drawing || !cloudDocOpen() || els.writeScreen.hidden) {
    return;
  }
  pullingInk = true;
  try {
    const added = await (state.driveDoc ? loadDriveSidecar(state.driveDoc) : loadInkSidecar(state.dropboxDoc));
    if (added > 0) {
      for (const view of state.pageViews || []) {
        drawStrokesOn(view);
      }
      refreshPdfLinkHints(true);
      flashBanner(`다른 기기의 필기 ${added}개를 받았습니다`, 2400);
    }
  } catch {
    // 다음 바퀴에 다시
  } finally {
    pullingInk = false;
  }
}

function startSyncWatch() {
  window.clearInterval(syncTimer);
  syncTimer = 0;
  hideSyncNote();
  if (!state.dropboxDoc && !state.driveDoc) {
    return;
  }
  checkRemote();
  syncTimer = window.setInterval(checkRemote, SYNC_POLL_MS);
}

/** Takes the newer file, keeps the ink this browser has not saved yet. */
async function reloadFromDropbox() {
  const doc = state.dropboxDoc;
  hideSyncNote();
  if (!doc) {
    return;
  }
  showBanner("새로 불러오는 중…");
  try {
    const token = await dropboxToken();
    const reply = await fetch(DOWNLOAD_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Dropbox-API-Arg": asciiHeader(downloadArg(doc.path)) },
    });
    if (!reply.ok) {
      throw new Error("download");
    }
    const meta = JSON.parse(reply.headers.get("Dropbox-API-Result") || "{}");
    const buffer = await reply.arrayBuffer();
    state.dropboxDoc = { ...doc, rev: meta.rev || doc.rev };
    showBanner("");
    await openPdfBuffer(buffer, { identity: dropboxIdentity(doc), name: doc.name, page: state.page });
    flashBanner("새로 불러왔습니다.");
  } catch {
    flashBanner("새로 불러오지 못했습니다.");
  }
}

/**
 * The ink is in the file now, so the browser must not draw it a second time
 * when this document is opened again (#126). Only for a write-back, never for
 * a downloaded copy.
 */
async function flattenAfterWriteBack(blob) {
  if (!state.identity) {
    return;
  }
  const buffer = await blob.arrayBuffer();
  // Rotation, duplicates and blank pages are baked in: the leaves start over.
  const outline = flattenOutline(state.outline, state.leaves);
  try {
    saveStrokes(state.identity, {}, null, outline);
  } catch {
    // storage is best effort
  }
  state.pages = {};
  state.outline = outline;
  state.leaves = [];
  await openPdfBuffer(buffer, {
    identity: state.identity,
    name: state.fileName,
    page: state.page,
    handle: state.fileHandle,
  });
}

/**
 * 저장 (#147): the ink goes beside the document as a small file, so it stays
 * editable and a big PDF is not rewritten for one stroke. Baking it into the
 * PDF is its own ⋯ action.
 */
async function saveDocumentNow() {
  persistStrokes();
  persistSession();
  if (cloudDocOpen()) {
    showBanner("저장하는 중…");
    try {
      await (state.driveDoc ? saveDriveSidecar() : saveInkSidecar());
      flashBanner(`저장했습니다. ${(state.driveDoc || state.dropboxDoc).name} (필기는 옆 파일에)`, 2400);
    } catch {
      flashBanner("필기를 저장하지 못했습니다.");
    }
    return;
  }
  await bakeIntoPdf();
}

/** Writes the annotated PDF itself. Slower, and the ink hardens (#126). */
async function bakeIntoPdf() {
  persistStrokes();
  persistSession();
  await withAnnotatedPdf(async (blob, fileName) => {
    // #82: the file the reader opened, not another copy in Downloads.
    if (state.driveDoc) {
      const result = await saveToDrive(blob);
      if (result === "conflict") {
        flashBanner("드라이브에서 파일이 바뀌었습니다. 다시 저장하면 덮어씁니다.", 2600);
        return;
      }
      const name = state.driveDoc.name;
      await flattenAfterWriteBack(blob);
      flashBanner(`드라이브에 저장했습니다. ${name}`, 2600);
      return;
    }
    if (state.dropboxDoc && dropboxConnected()) {
      const result = await saveToDropbox(blob);
      if (result === "conflict") {
        flashBanner("드롭박스에서 파일이 바뀌었습니다. 다시 저장하면 덮어씁니다.", 2600);
        return;
      }
      const name = state.dropboxDoc.name;
      await flattenAfterWriteBack(blob);
      flashBanner(`드롭박스에 저장했습니다. ${name}`, 2600);
      return;
    }
    if (await ensureWritePermission(state.fileHandle)) {
      try {
        await writeHandle(state.fileHandle, blob);
        const name = state.fileHandle.name || fileName;
        await flattenAfterWriteBack(blob);
        flashBanner(`원본에 저장했습니다. ${name}`, 2200);
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
      // Capture waits for the drag, or the menu never gets the release (#113).
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
      }
      try {
        cell.setPointerCapture(event.pointerId);
      } catch {
        // optional
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
    const item = wasHeld && !wasDragging ? menuActionAtPoint(els.stickerMenu, event, "stickerMenu") : null;
    cell.classList.remove("is-dragging");
    release();
    if (item) {
      runStickerMenu(item);
      return;
    }
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
  if (action === "bake") {
    closeMorePanel();
    ignoreAfterPanel = true;
    bakeIntoPdf();
    return;
  }
  if (action === "saveas") {
    closeMorePanel();
    ignoreAfterPanel = true;
    openDropboxSaveAs();
    return;
  }
  if (action === "export") {
    closeMorePanel();
    ignoreAfterPanel = true;
    exportDocument();
    return;
  }
  if (action === "inkmove") {
    closeMorePanel();
    ignoreAfterPanel = true;
    openInkMove();
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
  cancelLinkFixHold();
  if (state.interactMode === "view") {
    const at = { x: event.clientX, y: event.clientY };
    linkFixHoldTimer = window.setTimeout(() => {
      linkFixHoldTimer = 0;
      const spot = pdfLinkSpotAtClient(at);
      const items = spot ? state.pdfLinks.get(pdfLinkCacheKey(spot.leaf.pdfPage, spot.leaf.rotate)) : null;
      const hit = spot && items ? pdfLinkAt(spot.pageNum, spot.x, spot.y) : null;
      if (hit) {
        // The tap that follows must not also open the link (#190).
        if (gesture?.type === "pan") {
          gesture.held = true;
        }
        openLinkFixPanel(spot, hit, items.indexOf(hit));
      }
    }, PAGE_HOLD_MS);
  }
  gesture = {
    type: "pan",
    lastX: event.clientX,
    lastY: event.clientY,
    // #178: a pan that never really moved was a tap, and a tap may be a link.
    downX: event.clientX,
    downY: event.clientY,
    moved: 0,
    target: event.target,
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
  gesture.moved = Math.max(
    gesture.moved || 0,
    Math.hypot(event.clientX - (gesture.downX ?? event.clientX), event.clientY - (gesture.downY ?? event.clientY)),
  );
  if (gesture.moved > PAGE_DRAG_SLOP_PX) {
    cancelLinkFixHold();
  }
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
    if (!event.target.closest(".slot-panel, .sheet-card, .toolbar, .write-top, .m4-bar, .more-panel, .preview-drawer, .select-hud, .float-bar, #float-bar, .select-layer, #select-layer, .shape-chips, .wheel-panel")) {
      closeAllPanels();
      ignoreAfterPanel = true;
    }
    return;
  }
  if (event.target.closest(".toolbar, .write-top, .sheet, .slot-panel, .m4-bar, .more-panel, .marquee, .preview-drawer, .select-hud, .float-bar, #float-bar, .select-layer, #select-layer, .shape-chips, .wheel-panel")) {
    return;
  }
  if (els.linkFixPanel && !els.linkFixPanel.hidden) {
    // A tap anywhere else puts the link editor away (#190).
    hideLinkFixPanel();
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
  if (state.eyedropKind) {
    // 스포이드가 기다리는 탭 (#206). 종이 밖이면 그냥 접는다.
    event.preventDefault();
    if (stage) {
      pickPaperColor(stage, event.clientX, event.clientY);
    } else {
      state.eyedropKind = null;
    }
    return;
  }
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

/**
 * S펜이 종이 위를 떠 있을 때 닿을 자리를 보여 준다 (#210). 펜만 —
 * 손가락 호버는 없고, 마우스는 이미 제 커서가 있다.
 */
function trackPenHover(event) {
  const dot = els.penHover;
  if (!dot) {
    return;
  }
  const show = shouldShowHover({
    pointerType: event.pointerType,
    buttons: event.buttons,
    interactMode: state.interactMode,
    overlay: overlayOpen(),
    onPaper: Boolean(event.target.closest?.(".page-stage")),
    tool: state.rectTool ? "select" : state.tool,
  });
  dot.hidden = !show;
  if (!show) {
    return;
  }
  // #234: 도구마다 다른 모양 — 지우개는 점선 원, 형광은 모난 자국.
  dot.dataset.shape = hoverShapeForTool(state.rectTool ? "select" : state.tool);
  const slot = state.tool === "eraser" ? { width: state.eraserWidth, color: "#8B8378" } : activeSlot();
  const view = state.pageViews.find((item) => item.stage === event.target.closest(".page-stage"));
  const cssWidth = view?.cssWidth || 1;
  const box = view?.stage?.getBoundingClientRect();
  const px = Math.max(4, (Number(slot.width) || 2) * ((box?.width || cssWidth) / cssWidth));
  dot.style.width = `${px}px`;
  dot.style.height = `${px}px`;
  dot.style.transform = `translate(${event.clientX - px / 2}px, ${event.clientY - px / 2}px)`;
  dot.style.setProperty("--swatch", slot.color || "#1A1A1A");
}

function hidePenHover() {
  if (els.penHover) {
    els.penHover.hidden = true;
  }
}

function onWorkspacePointerMove(event) {
  trackPenHover(event);
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
    cancelLinkFixHold();
    const tapped = !gesture.held && (gesture.moved || 0) <= PAN_TAP_SLOP_PX && event.type !== "pointercancel";
    gesture = null;
    if (event.pointerId != null) {
      try {
        els.workspace.releasePointerCapture(event.pointerId);
      } catch {
        // already released
      }
    }
    if (tapped) {
      followPdfLinkAtClient({ x: event.clientX, y: event.clientY });
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
  onShort: selectEraser,
  onLong: openEraserEditor,
});
els.ratioBtn?.addEventListener("click", () => {
  state.freeRatio = !state.freeRatio;
  saveFreeRatio(state.freeRatio);
  flashBanner(state.freeRatio ? "자유비율로 늘립니다" : "비율을 지키며 늘립니다", 1600);
  syncSelectHud();
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
  els.slotWidthValue.textContent = widthLabel(els.slotWidth.value);
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

els.updateDismiss?.addEventListener("click", () => {
  if (els.updateNote) {
    els.updateNote.hidden = true;
  }
});
registerServiceWorker();
els.syncReload?.addEventListener("click", () => (state.driveDoc ? reloadFromDrive() : reloadFromDropbox()));
els.gdriveOpen?.addEventListener("click", openDrivePicker);
if (els.gdriveOpen && driveConfigured()) {
  els.gdriveOpen.hidden = false;
}
els.syncDismiss?.addEventListener("click", hideSyncNote);
window.addEventListener("focus", () => checkRemote());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    writeStrokesNow();
    flushInkAutosave();
    return;
  }
  checkRemote();
});
window.addEventListener("pagehide", () => {
  writeStrokesNow();
  flushInkAutosave();
});
els.dropboxOpen?.addEventListener("click", openDropboxSheet);
els.dropboxSaveGo?.addEventListener("click", saveCopyToDropbox);
document.querySelectorAll("#dropbox-ink-choices [data-ink-copy]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.inkCopy = btn.dataset.inkCopy;
    syncInkCopyChoices();
  });
});
els.dropboxClose?.addEventListener("click", closeDropboxSheet);
els.dropboxBackdrop?.addEventListener("click", closeDropboxSheet);
els.dropboxUp?.addEventListener("click", () => showDropboxFolder(parentPath(state.dropboxPath)));
els.dropboxLogout?.addEventListener("click", disconnectDropbox);
state.dropbox = loadDropboxSession();
finishDropboxLogin();
bindPreviewGrip(els.previewGrip);
applyPreviewWidth();
els.previewBtn?.addEventListener("click", () => {
  closeAllPanels();
  togglePreview();
});
bindMenuRelease(els.lockMenu, "lockMenu", unlockFromMenu);
bindMenuRelease(els.stickerMenu, "stickerMenu", runStickerMenu);
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

bindMenuRelease(els.pageMenu, "pageMenu", runPageMenu);
bindMenuRelease(els.tocMenu, "tocMenu", runTocMenu);
document.querySelectorAll("#toolbar-pos-choices [data-pos]").forEach((btn) => {
  btn.addEventListener("click", () => setToolbarPosition(btn.dataset.pos));
});
document.querySelectorAll("#view-mode-choices [data-view]").forEach((btn) => {
  btn.addEventListener("click", () => setViewMode(btn.dataset.view));
});

document.querySelectorAll("#pen-barrel-choices [data-pen-barrel]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.penButtons = { ...state.penButtons, barrel: btn.dataset.penBarrel };
    savePenButtons(state.penButtons);
    applyChrome();
  });
});
document.querySelectorAll("#pen-second-choices [data-pen-second]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.penButtons = { ...state.penButtons, second: btn.dataset.penSecond };
    savePenButtons(state.penButtons);
    applyChrome();
  });
});
els.shareThumbsBtn?.addEventListener("click", () => {
  state.shareThumbs = !state.shareThumbs;
  applyChrome();
  // The choice rides in the sidecar, so the other machine honours it too.
  if (state.dropboxDoc && dropboxConnected()) {
    saveInkSidecar().catch(() => null);
  }
  if (state.shareThumbs) {
    uploadThumbPack();
  }
});
els.colorPick?.addEventListener("input", () => applyPickedColor(els.colorPick.value));
els.colorPick?.addEventListener("change", () => applyPickedColor(els.colorPick.value));
els.penButtonBtn?.addEventListener("click", () => {
  state.penButtonErase = !state.penButtonErase;
  savePenButtonErase(state.penButtonErase);
  applyChrome();
});
els.penOnlyBtn.addEventListener("click", () => {
  setPenOnly(!state.penOnly);
});
/**
 * 펜 버튼 시험 (#234). 「S펜 버튼이 안 된다」를 확인하려면 기기가 실제로
 * 무엇을 보내는지 봐야 한다 — 안 보내는 것과 잘못 읽는 것은 고칠 곳이 다르다.
 */
for (const kind of ["pointerdown", "pointermove", "pointerup"]) {
  els.penProbe?.addEventListener(kind, (event) => {
    if (event.pointerType !== "pen" && event.pointerType !== "mouse") {
      return;
    }
    event.preventDefault();
    els.penProbe.classList.add("is-live");
    els.penProbe.textContent = `${kind} · ${describePenEvent(event, state.penButtons)}`;
  });
}

els.linkHintsBtn?.addEventListener("click", () => {
  state.linkHints = !state.linkHints;
  saveLinkHints(state.linkHints);
  flashBanner(state.linkHints ? "링크 자리를 보여 줍니다" : "링크 자리를 감춥니다. 탭하면 그대로 따라갑니다", 2400);
  syncLinkHints();
});
els.zoomLockBtn.addEventListener("click", () => {
  setZoomLock(!state.zoomLock);
});
els.interactBtn.addEventListener("click", () => {
  setInteractMode(state.interactMode === "view" ? "edit" : "view");
});
bindUndoHold(els.undoBtn, { onUndo: undoInk, onRedo: redoInk });
bindLinkFixPanel();
bindWheelPanel();
els.eyedropBtn?.addEventListener("click", armEyedropper);
els.inkMoveDone?.addEventListener("click", closeInkMove);
els.inkMoveApply?.addEventListener("click", applyInkMove);
els.inkMoveModeAdd?.addEventListener("click", () => setInkMoveAssignMode("add"));
els.inkMoveModeInsert?.addEventListener("click", () => setInkMoveAssignMode("insert"));
els.inkMoveSkip?.addEventListener("click", () => {
  const row = inkMovePlan?.selected;
  if (row) {
    row.to = 0;
    row.mode = "skip";
    refreshMoveRowCard(row);
  }
});
els.inkMoveBackdrop?.addEventListener("click", closeInkMove);
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
  bindMenuRelease(els.marqueeMenu, "marquee", runMarqueeAction);
}

function runMarqueeAction(action) {
  if (!action) {
    return;
  }
  {
    if (action === "paste") {
      pasteHere();
      return;
    }
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
  }
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
    const at = clampPageTarget(els.areaLinkPage?.value, state.pageCount);
    saveAreaLink({ kind: "page", page: at, leafId: state.leaves[at - 1]?.id });
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

// #137: the pen barrel often fires a context menu; the paper never wants one.
els.workspace.addEventListener("contextmenu", (event) => {
  const stage = event.target.closest(".page-stage");
  if (!stage) {
    return;
  }
  event.preventDefault();
  // #260: 키보드·마우스 환경에서 우클릭은 롱클릭과 같다. 선택 도구면 그 자리에
  // 영역 메뉴(붙여넣기 포함)를 연다. 보기 중이면 아무 것도 안 연다.
  if (state.interactMode === "view" || overlayOpen()) {
    return;
  }
  const ink = stage.querySelector(".ink-canvas");
  if (!ink) {
    return;
  }
  const point = eventToNorm(event, ink);
  state.drawPage = Number(stage.dataset.page) || state.page;
  const hit = pickAreaAt(pageStrokes(state.drawPage), point.x, point.y);
  if (hit) {
    state.pendingCapture = { page: state.drawPage, rect: { x: hit.x, y: hit.y, w: hit.w, h: hit.h }, link: hit.link };
    updateMarquee();
    showMarqueeMenu();
    return;
  }
  // 빈 곳 우클릭 → 붙여넣기만 (선택툴 드래그 없이 롱클릭과 같은 경로).
  showPasteMenuAt(state.drawPage, point);
});
els.workspace.addEventListener("pointerdown", onWorkspacePointerDown);
els.workspace.addEventListener("pointermove", onWorkspacePointerMove);
els.workspace.addEventListener("pointerup", onWorkspacePointerUp);
els.workspace.addEventListener("pointercancel", onWorkspacePointerUp);
els.workspace.addEventListener("pointerleave", hidePenHover);
els.workspace.addEventListener("pointerdown", hidePenHover);
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

document.addEventListener("paste", onNativePaste);
els.workspace.addEventListener("dragover", onPaperDragOver);
els.workspace.addEventListener("dragleave", onPaperDragLeave);
els.workspace.addEventListener("drop", onPaperDrop);
document.addEventListener("keydown", (event) => {
  const typing = event.target.closest?.("input, textarea, [contenteditable='true']");
  // #225: PC에서 손이 키보드에 있을 때. 칸에 글씨를 치는 중이면 브라우저 몫이다.
  const shortcut = shortcutFor(event);
  if (shortcutAllowed({ typing: Boolean(typing), overlay: overlayOpen(), action: shortcut })) {
    if (!state.pdf || els.writeScreen.hidden) {
      return;
    }
    if (shortcut === "undo") {
      event.preventDefault();
      undoInk();
      return;
    }
    if (shortcut === "redo") {
      event.preventDefault();
      redoInk();
      return;
    }
    if (state.interactMode === "view") {
      return;
    }
    if (shortcut === "copy" || shortcut === "cut") {
      if (!state.selectIndices.length) {
        return;
      }
      event.preventDefault();
      copySelection();
      if (shortcut === "cut") {
        deleteSelection();
      }
      flashBanner(shortcut === "cut" ? "잘라냈습니다" : "복사했습니다", 1400);
      return;
    }
    if (shortcut === "paste") {
      // #226: 막지 않는다. 진짜 paste 이벤트가 클립보드를 훨씬 많이 보여 준다.
      return;
    }
  }
  // #236: 고른 것이 있으면 화살표로 조금씩 민다. 손으로는 이만큼 정확히 못 옮긴다.
  if (!typing && !overlayOpen() && state.selectIndices.length && state.interactMode !== "view") {
    const pageNum = state.selectPage || state.page;
    const view = state.pageViews.find((item) => item.pageNum === pageNum);
    const nudge = nudgeFor(event, view?.cssWidth, view?.cssHeight);
    if (nudge) {
      event.preventDefault();
      nudgeSelection(pageNum, nudge);
      return;
    }
  }
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
  if (event.key === "Escape" && els.tocMenu && !els.tocMenu.hidden && !typing) {
    event.preventDefault();
    hideTocMenu();
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

// #248: 이 앱의 버그 절반은 조용한 예외였다 — 없는 함수를 부르면 화면엔
// 아무 표시도 없이 스위치만 죽었다. 잡히지 않은 예외·거부를 배너로 띄워
// "안 된다"를 "무슨 예외가 났다"로 바꾼다. console은 그대로 두어(콘솔 지우지
// 않음) 개발자 도구로 원인을 더 볼 수 있게 한다.
let lastErrorBannerMessage = "";
let lastErrorBannerAt = 0;

function reportAppError(rawMessage) {
  const message = String(rawMessage ?? "알 수 없는 오류").slice(0, 80);
  const now = Date.now();
  if (message === lastErrorBannerMessage && now - lastErrorBannerAt < 10000) {
    // 같은 메시지가 짧은 시간에 반복되면(예: 매 프레임 실패) 배너를 도배하지 않는다.
    return;
  }
  lastErrorBannerMessage = message;
  lastErrorBannerAt = now;
  flashBanner(`앱 오류: ${message}`, 6000);
}

window.addEventListener("error", (event) => {
  reportAppError(event.message || event.error?.message);
});

window.addEventListener("unhandledrejection", (event) => {
  reportAppError(event.reason?.message || String(event.reason));
});

applyChrome();
syncToolSelection();
syncHistoryButtons();
syncRectTool();

// #248: 새로고침한 화면이 새 버전인지 알 수 있게, 설정 시트에 빌드 표식을 찍는다.
// typeof 가드는 이 파일을 텍스트로만 읽는 계약 테스트·정적 분석에서 정의되지
// 않은 전역이라도 안전하게 지나가도록 하기 위함이다.
els.buildTag.textContent = typeof __BUILD_TAG__ === "string" ? __BUILD_TAG__ : "dev";

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
