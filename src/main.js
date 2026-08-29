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
  loadSlotIndex,
  loadSlots,
  loadToolbarPosition,
  loadViewMode,
  loadZoomLock,
  saveSlotIndex,
  saveSlots,
  saveToolbarPosition,
  saveViewMode,
  saveZoomLock,
  SLOT_COLORS,
} from "./prefs.js";
import {
  constrainPan,
  inkCanvasScale,
  pointerDistance,
  pointerMidpoint,
  scaleFromPinch,
} from "./viewport.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const LONG_PRESS_MS = 450;
const SLOT_PRESS_SLOP = 24;
const SLOT_LABELS = ["검정", "빨강", "파랑", "노랑"];

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
  prevBtn: document.querySelector("#prev-btn"),
  nextBtn: document.querySelector("#next-btn"),
  pageLabel: document.querySelector("#page-label"),
  zoomLockBtn: document.querySelector("#zoom-lock-btn"),
  settingsBtn: document.querySelector("#settings-btn"),
  settingsSheet: document.querySelector("#settings-sheet"),
  settingsBackdrop: document.querySelector("#settings-backdrop"),
  settingsDone: document.querySelector("#settings-done"),
  slotPanel: document.querySelector("#slot-panel"),
  slotWidth: document.querySelector("#slot-width"),
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
  zoomLock: loadZoomLock(),
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
let renderGen = 0;

function activeSlot() {
  return state.slots[state.slotIndex] || state.slots[0];
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
    saveStrokes(state.identity, state.pages);
  } catch {
    showBanner("필기를 저장하지 못했습니다. 브라우저 저장 공간이 부족할 수 있습니다.");
  }
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
  const key = String(pageNum);
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

function paintStroke(ctx, stroke, scale, canvas) {
  const points = stroke.points || [];
  if (!points.length) {
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
  ctx.strokeStyle = stroke.color || "#1A1A1A";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = (stroke.width || 2) * scale;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = point.x * canvas.width;
    const y = point.y * canvas.height;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  if (points.length === 1) {
    const x = points[0].x * canvas.width;
    const y = points[0].y * canvas.height;
    ctx.lineTo(x + 0.1, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawStrokesOn(view, liveStroke = null) {
  const canvas = view.inkCanvas;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const scale = strokeScale(view);
  for (const stroke of pageStrokes(view.pageNum)) {
    paintStroke(ctx, stroke, scale, canvas);
  }
  if (liveStroke?.points.length) {
    paintStroke(ctx, liveStroke, scale, canvas);
  }
}

function drawLive() {
  const view = state.pageViews.find((item) => item.pageNum === state.drawPage);
  if (view) {
    drawStrokesOn(view, state.currentStroke);
  }
}

function fitScale(page, mode = state.viewMode) {
  const viewport = page.getViewport({ scale: 1 });
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
  stage.append(pdfCanvas, inkCanvas);
  return { pageNum, stage, pdfCanvas, inkCanvas, rendered: false, token: 0 };
}

function applyPageSize(view, cssWidth, cssHeight, pixelWidth, pixelHeight) {
  view.cssWidth = cssWidth;
  view.cssHeight = cssHeight;
  view.stage.style.width = `${cssWidth}px`;
  view.stage.style.height = `${cssHeight}px`;
  for (const canvas of [view.pdfCanvas, view.inkCanvas]) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
  }
}

async function renderPageView(view) {
  if (!state.pdf) {
    return;
  }
  const token = ++view.token;
  const page = await state.pdf.getPage(view.pageNum);
  if (token !== view.token || !state.pdf) {
    return;
  }
  const dpr = window.devicePixelRatio || 1;
  const scale = fitScale(page);
  const css = page.getViewport({ scale });
  const pixel = page.getViewport({ scale: scale * dpr });
  applyPageSize(view, css.width, css.height, pixel.width, pixel.height);
  if (state.viewMode === "page" || view.pageNum === state.page) {
    state.pageCssWidth = css.width;
    state.pageCssHeight = css.height;
  }
  const ctx = view.pdfCanvas.getContext("2d");
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
    const first = await state.pdf.getPage(1);
    if (gen !== renderGen) {
      return;
    }
    const css = first.getViewport({ scale: fitScale(first, "scroll") });
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
  closeSlotPanel();
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
  const slot = activeSlot();
  return {
    points: [point],
    color: slot.color,
    width: slot.width,
    erase: state.tool === "eraser",
  };
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
  state.pageCount = pdf.numPages;
  state.page = Math.min(Math.max(1, page), pdf.numPages);
  state.pages = loadStrokes(identity).pages;
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
}

function allowsInkPointer(event) {
  return !state.penOnly || event.pointerType === "pen";
}

function shouldPan(event) {
  return state.penOnly && event.pointerType !== "pen";
}

function overlayOpen() {
  return !els.settingsSheet.hidden || !els.slotPanel.hidden;
}

function abortStroke() {
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
  if (!state.pdf || (event.button !== undefined && event.button !== 0)) {
    return;
  }
  if (!allowsInkPointer(event) || overlayOpen()) {
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
  state.drawPage = Number(stage.dataset.page) || state.page;
  state.drawCanvas = ink;
  state.drawing = true;
  state.currentStroke = newStroke(eventToNorm(event, ink));
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
  pageStrokes(state.drawPage).push(state.currentStroke);
  state.currentStroke = null;
  state.drawing = false;
  drawLive();
  persistStrokes();
}

function pickFile() {
  if (!pickerAllowed() || !dropzoneGesture) {
    return;
  }
  dropzoneGesture = false;
  els.fileInput.click();
}

function colorName(color) {
  const index = SLOT_COLORS.findIndex((item) => item.toLowerCase() === color.toLowerCase());
  return SLOT_LABELS[index] || "펜";
}

function syncSlots() {
  document.querySelectorAll("[data-slot]").forEach((btn) => {
    const index = Number(btn.dataset.slot);
    const slot = state.slots[index];
    btn.classList.toggle("is-selected", index === state.slotIndex);
    btn.style.setProperty("--slot-color", slot.color);
    btn.style.setProperty("--slot-width", String(slot.width));
    btn.setAttribute("aria-label", `${colorName(slot.color)} 슬롯, 굵기 ${slot.width}`);
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

function applyChrome() {
  els.writeScreen.dataset.toolbar = state.toolbarPos;
  els.writeScreen.dataset.view = state.viewMode;
  document.querySelectorAll("#toolbar-pos-choices [data-pos]").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.pos === state.toolbarPos);
  });
  document.querySelectorAll("#view-mode-choices [data-view]").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.view === state.viewMode);
  });
}

function closeSettings() {
  els.settingsSheet.hidden = true;
}

function openSettings() {
  closeSlotPanel();
  applyChrome();
  els.settingsSheet.hidden = false;
}

function closeSlotPanel() {
  els.slotPanel.hidden = true;
  state.editingSlot = null;
}

function placeSlotPanel(slotBtn) {
  const panel = els.slotPanel;
  panel.hidden = false;
  const bar = els.toolbar.getBoundingClientRect();
  const slot = slotBtn.getBoundingClientRect();
  const width = 240;
  const height = panel.getBoundingClientRect().height || 88;
  const gap = 8;
  let top = slot.bottom + gap;
  let left = slot.left + slot.width / 2 - width / 2;

  if (state.toolbarPos === "top") {
    top = bar.bottom + gap;
    left = slot.left + slot.width / 2 - width / 2;
  } else if (state.toolbarPos === "bottom") {
    top = bar.top - gap - height;
    left = slot.left + slot.width / 2 - width / 2;
  } else if (state.toolbarPos === "left") {
    left = bar.right + gap;
    top = slot.top + slot.height / 2 - height / 2;
  } else {
    left = bar.left - gap - width;
    top = slot.top + slot.height / 2 - height / 2;
  }

  left = Math.min(window.innerWidth - width - 8, Math.max(8, left));
  top = Math.min(window.innerHeight - height - 8, Math.max(8, top));
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

function syncSlotEditor() {
  const slot = state.slots[state.editingSlot];
  if (!slot) {
    return;
  }
  els.slotWidth.value = String(slot.width);
  document.querySelectorAll(".slot-color").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.color.toLowerCase() === slot.color.toLowerCase());
  });
}

function openSlotEditor(index, slotBtn) {
  state.slotIndex = index;
  state.editingSlot = index;
  state.tool = "pen";
  saveSlotIndex(index);
  syncToolSelection();
  syncSlotEditor();
  placeSlotPanel(slotBtn);
}

function persistSlotChange() {
  saveSlots(state.slots);
  syncSlots();
  syncSlotEditor();
}

function selectSlot(index) {
  state.slotIndex = index;
  state.tool = "pen";
  saveSlotIndex(index);
  closeSlotPanel();
  syncToolSelection();
}

async function setToolbarPosition(position) {
  state.toolbarPos = position;
  saveToolbarPosition(position);
  applyChrome();
  closeSlotPanel();
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
  if (overlayOpen()) {
    if (!event.target.closest(".slot-panel, .sheet-card, .toolbar, .write-top")) {
      closeSlotPanel();
    }
    return;
  }
  if (event.target.closest(".toolbar, .write-top, .sheet, .slot-panel")) {
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
  if (shouldPan(event)) {
    event.preventDefault();
    startPan(event);
    return;
  }
  const stage = event.target.closest(".page-stage");
  if (stage && allowsInkPointer(event)) {
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
  endStroke(event);
  if (pointers.size === 0) {
    ignoreAfterPinch = false;
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

document.querySelectorAll("[data-slot]").forEach(bindSlot);
document.querySelectorAll("[data-tool]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.tool = btn.dataset.tool;
    closeSlotPanel();
    syncToolSelection();
  });
});
document.querySelectorAll(".slot-color").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (state.editingSlot == null) {
      return;
    }
    state.slots[state.editingSlot].color = btn.dataset.color;
    persistSlotChange();
  });
});
els.slotWidth.addEventListener("input", () => {
  if (state.editingSlot == null) {
    return;
  }
  state.slots[state.editingSlot].width = Number(els.slotWidth.value);
  persistSlotChange();
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
    if (event.target.closest(".sheet-card, .slot-panel, .toolbar, .write-top")) {
      return;
    }
    event.preventDefault();
  },
  { passive: false },
);

document.addEventListener("pointerdown", (event) => {
  if (!els.slotPanel.hidden && !event.target.closest(".slot-panel, [data-slot]")) {
    closeSlotPanel();
  }
});

let resizeTimer = 0;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (!els.slotPanel.hidden && state.editingSlot != null) {
      const btn = document.querySelector(`[data-slot="${state.editingSlot}"]`);
      if (btn) {
        placeSlotPanel(btn);
      }
    }
    if (state.pdf && !state.drawing) {
      rebuildPages();
    }
  }, 120);
});

applyChrome();
syncToolSelection();

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
