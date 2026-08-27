/** Maximum accepted upload size. Kept modest so the browser stays usable. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

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
  if (file.size > MAX_PDF_BYTES) {
    return {
      ok: false,
      message: "파일이 너무 큽니다. 20MB 이하만 올릴 수 있습니다.",
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
