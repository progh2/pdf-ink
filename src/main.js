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

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const COLORS = ["#1A1A1A", "#D64545", "#2F6FED", "#E6C200"];
const WIDTHS = [2, 4, 8];

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
  stage: document.querySelector("#page-stage"),
  pdfCanvas: document.querySelector("#pdf-canvas"),
  inkCanvas: document.querySelector("#ink-canvas"),
  prevBtn: document.querySelector("#prev-btn"),
  nextBtn: document.querySelector("#next-btn"),
  pageLabel: document.querySelector("#page-label"),
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
  tool: "pen",
  color: COLORS[0],
  width: WIDTHS[0],
  penOnly: loadPenOnly(),
};

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

function pageStrokes() {
  const key = String(state.page);
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

function canvasScale() {
  const cssWidth = els.inkCanvas.getBoundingClientRect().width || els.inkCanvas.width;
  return els.inkCanvas.width / cssWidth;
}

function drawStrokes() {
  const canvas = els.inkCanvas;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const scale = canvasScale();

  for (const stroke of pageStrokes()) {
    paintStroke(ctx, stroke, scale);
  }
  if (state.currentStroke?.points.length) {
    paintStroke(ctx, state.currentStroke, scale);
  }
}

function paintStroke(ctx, stroke, scale) {
  const points = stroke.points || [];
  if (!points.length) {
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
  ctx.strokeStyle = stroke.color || COLORS[0];
  ctx.lineWidth = (stroke.width || WIDTHS[0]) * scale;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = point.x * els.inkCanvas.width;
    const y = point.y * els.inkCanvas.height;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  if (points.length === 1) {
    const x = points[0].x * els.inkCanvas.width;
    const y = points[0].y * els.inkCanvas.height;
    ctx.lineTo(x + 0.1, y);
  }
  ctx.stroke();
  ctx.restore();
}

function fitScale(page) {
  const viewport = page.getViewport({ scale: 1 });
  const workspace = document.querySelector(".workspace");
  const maxWidth = Math.max(240, (workspace?.clientWidth || 800) - 32);
  const maxHeight = Math.max(240, window.innerHeight - 180);
  return Math.min(maxWidth / viewport.width, maxHeight / viewport.height);
}

async function renderPage() {
  if (!state.pdf) {
    return;
  }
  const page = await state.pdf.getPage(state.page);
  const dpr = window.devicePixelRatio || 1;
  const scale = fitScale(page);
  const viewport = page.getViewport({ scale: scale * dpr });

  for (const canvas of [els.pdfCanvas, els.inkCanvas]) {
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width / dpr}px`;
    canvas.style.height = `${viewport.height / dpr}px`;
  }

  const ctx = els.pdfCanvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, els.pdfCanvas.width, els.pdfCanvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  drawStrokes();
  updatePager();
}

function updatePager() {
  els.pageLabel.textContent = `${state.page} / ${state.pageCount}`;
  els.prevBtn.disabled = state.page <= 1;
  els.nextBtn.disabled = state.page >= state.pageCount;
}

function showDocumentUi() {
  els.uploadScreen.hidden = true;
  els.writeScreen.hidden = false;
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
  state.drawing = false;
  state.currentStroke = null;
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
  return {
    points: [point],
    color: state.color,
    width: state.width,
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
  els.docTitle.textContent = displayName(name);
  showDocumentUi();
  showBanner("");
  await renderPage();
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
  state.currentStroke = null;
  state.drawing = false;
  await renderPage();
  await persistSession();
}

function allowsInkPointer(event) {
  return !state.penOnly || event.pointerType === "pen";
}

function abortStroke() {
  if (!state.drawing && !state.currentStroke) {
    return;
  }
  state.currentStroke = null;
  state.drawing = false;
  drawStrokes();
}

function startStroke(event) {
  if (!state.pdf || (event.button !== undefined && event.button !== 0)) {
    return;
  }
  if (!allowsInkPointer(event)) {
    return;
  }
  event.preventDefault();
  try {
    els.inkCanvas.setPointerCapture(event.pointerId);
  } catch {
    // Capture is optional; some synthetic/test pointers reject it.
  }
  state.drawing = true;
  state.currentStroke = newStroke(eventToNorm(event, els.inkCanvas));
  drawStrokes();
}

function moveStroke(event) {
  if (!state.drawing || !state.currentStroke) {
    return;
  }
  if (!allowsInkPointer(event)) {
    return;
  }
  event.preventDefault();
  state.currentStroke.points.push(eventToNorm(event, els.inkCanvas));
  drawStrokes();
}

function endStroke(event) {
  if (!state.drawing || !state.currentStroke) {
    return;
  }
  if (!allowsInkPointer(event)) {
    return;
  }
  event.preventDefault();
  if (event.pointerId != null) {
    try {
      els.inkCanvas.releasePointerCapture(event.pointerId);
    } catch {
      // Capture may already be released.
    }
  }
  pageStrokes().push(state.currentStroke);
  state.currentStroke = null;
  state.drawing = false;
  drawStrokes();
  persistStrokes();
}

function pickFile() {
  if (!pickerAllowed() || !dropzoneGesture) {
    return;
  }
  dropzoneGesture = false;
  els.fileInput.click();
}

function syncToolSelection() {
  document.querySelectorAll("[data-tool]").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.tool === state.tool);
  });
  document.querySelectorAll("[data-color]").forEach((btn) => {
    btn.classList.toggle("is-selected", btn.dataset.color === state.color);
  });
  document.querySelectorAll("[data-width]").forEach((btn) => {
    btn.classList.toggle("is-selected", Number(btn.dataset.width) === state.width);
  });
  syncPenOnly();
}

function syncPenOnly() {
  els.penOnlyBtn.classList.toggle("is-selected", state.penOnly);
  els.penOnlyBtn.setAttribute("aria-pressed", state.penOnly ? "true" : "false");
}

function setPenOnly(on) {
  state.penOnly = Boolean(on);
  savePenOnly(state.penOnly);
  syncPenOnly();
  abortStroke();
}

document.querySelectorAll("[data-tool]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.tool = btn.dataset.tool;
    syncToolSelection();
  });
});
document.querySelectorAll("[data-color]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.color = btn.dataset.color;
    state.tool = "pen";
    syncToolSelection();
  });
});
document.querySelectorAll("[data-width]").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.width = Number(btn.dataset.width);
    syncToolSelection();
  });
});
els.penOnlyBtn.addEventListener("click", () => {
  setPenOnly(!state.penOnly);
});

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
els.inkCanvas.addEventListener("pointerdown", startStroke);
els.inkCanvas.addEventListener("pointermove", moveStroke);
els.inkCanvas.addEventListener("pointerup", endStroke);
els.inkCanvas.addEventListener("pointercancel", endStroke);
els.writeScreen.addEventListener(
  "touchmove",
  (event) => {
    event.preventDefault();
  },
  { passive: false },
);

let resizeTimer = 0;
window.addEventListener("resize", () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (state.pdf) {
      renderPage();
    }
  }, 120);
});

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
