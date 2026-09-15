/** Maximum accepted upload size. */
/**
 * #418: 20MB는 쪽 넘길 때마다 본문을 다시 쓰던 시절의 한계였다. 그 병목을
 * 걷어내 상한을 크게 올리되, 무작정 열면 폰이 죽는다 — pdf.js가 워커로 사본을
 * 가져가므로 여는 순간 **파일 크기의 두 배**가 필요하고, 여기에 페이지 캔버스가
 * 더해진다(#308·#310에서 탭이 죽던 그 벽). 그래서 기기 메모리를 보고 정한다.
 */
export const MAX_PDF_BYTES = 200 * 1024 * 1024;
export const MAX_PDF_BYTES_MID = 120 * 1024 * 1024;
export const MAX_PDF_BYTES_SMALL = 80 * 1024 * 1024;

export function maxPdfBytes(deviceMemoryGb) {
  const gb = Number(deviceMemoryGb);
  if (Number.isFinite(gb) && gb >= 8) {
    return MAX_PDF_BYTES;
  }
  if (Number.isFinite(gb) && gb >= 4) {
    return MAX_PDF_BYTES_MID;
  }
  // 모르는 기기(사파리는 알려 주지 않는다)는 가장 조심스럽게.
  return MAX_PDF_BYTES_SMALL;
}

export function sizeLimitLabel(bytes) {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF
const ALLOWED_TYPES = new Set(["", "application/pdf", "application/x-pdf"]);

/**
 * Reject non-PDF and oversized files before any parse work.
 * Defense only: no attack examples or bypass notes.
 */
export function validatePdfFile(file) {
  if (!file) {
    return { ok: false, message: "파일을 선택해 주세요." };
  }
  if (file.size === 0) {
    return { ok: false, message: "빈 파일은 열 수 없습니다." };
  }
  const limit = maxPdfBytes(globalThis.navigator?.deviceMemory);
  if (file.size > limit) {
    return {
      ok: false,
      message: `파일이 너무 큽니다. ${sizeLimitLabel(limit)} 이하만 올릴 수 있습니다.`,
    };
  }

  const name = file.name || "";
  if (!/\.pdf$/i.test(name)) {
    return { ok: false, message: "PDF 파일만 열 수 있습니다." };
  }

  const type = (file.type || "").toLowerCase();
  if (!ALLOWED_TYPES.has(type)) {
    return { ok: false, message: "PDF 파일만 열 수 있습니다." };
  }

  return { ok: true };
}

export async function validatePdfContents(file) {
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (header.length < 4) {
    return { ok: false, message: "파일 내용이 PDF가 아닙니다." };
  }
  for (let i = 0; i < 4; i += 1) {
    if (header[i] !== PDF_MAGIC[i]) {
      return { ok: false, message: "파일 내용이 PDF가 아닙니다." };
    }
  }
  return { ok: true };
}
