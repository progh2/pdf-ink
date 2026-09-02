/**
 * 구글 드라이브 (#133). No secret in the bundle: the browser gets an access
 * token from Google Identity Services and nothing else. `drive.file` only, so
 * we see the files the reader picked, never the whole drive.
 */

export const GOOGLE_CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID || "";
export const GOOGLE_API_KEY = import.meta.env?.VITE_GOOGLE_API_KEY || "";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const GIS_SRC = "https://accounts.google.com/gsi/client";
export const GAPI_SRC = "https://apis.google.com/js/api.js";
export const FILES_URL = "https://www.googleapis.com/drive/v3/files";
export const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
/** What we ask Drive to tell us about a file. Small on purpose. */
export const FILE_FIELDS = "id,name,version,modifiedTime,mimeType,size";

export function driveConfigured(clientId = GOOGLE_CLIENT_ID, apiKey = GOOGLE_API_KEY) {
  return Boolean(clientId && apiKey);
}

export function tokenClientConfig(callback, clientId = GOOGLE_CLIENT_ID) {
  return { client_id: clientId, scope: DRIVE_SCOPE, callback };
}

/** Silent when Google still remembers the grant, a prompt only the first time. */
export function tokenRequestOptions(hasToken) {
  return hasToken ? { prompt: "" } : { prompt: "consent" };
}

export function metadataUrl(id, fields = FILE_FIELDS) {
  return `${FILES_URL}/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}`;
}

export function downloadUrl(id) {
  return `${FILES_URL}/${encodeURIComponent(id)}?alt=media`;
}

export function updateUrl(id, fields = FILE_FIELDS) {
  return `${UPLOAD_URL}/${encodeURIComponent(id)}?uploadType=media&fields=${encodeURIComponent(fields)}`;
}

export function docFromPicked(picked) {
  if (!picked?.id) {
    return null;
  }
  return {
    id: String(picked.id),
    name: picked.name || "문서.pdf",
    version: picked.version ? String(picked.version) : "",
  };
}

export function driveIdentity(doc) {
  return `gdrive::${doc?.id || ""}`;
}

/**
 * Drive has no If-Match for a binary update, so we look before writing. Not
 * atomic like Dropbox's rev, but it still refuses to bury someone's work.
 */
export function remoteChanged(doc, meta) {
  const version = meta?.version ? String(meta.version) : "";
  return Boolean(doc?.version && version && version !== doc.version);
}

export function pickerViewConfig() {
  return { mimeTypes: "application/pdf", includeFolders: true, selectFolderEnabled: false, parent: "root" };
}

/**
 * The picker needs the Cloud project number so that `drive.file` access is
 * granted for what the reader picked (#165). It is the digits in front of the
 * client id, so we do not ask for another value.
 */
export function appIdFromClientId(clientId = GOOGLE_CLIENT_ID) {
  const match = /^(\d+)-/.exec(String(clientId || ""));
  return match ? match[1] : "";
}

/** Only PDFs come back, whatever the reader clicks in the picker. */
export function pdfFromPickerResult(result) {
  if (result?.action !== "picked") {
    return null;
  }
  const doc = (result.docs || []).find((entry) => entry?.mimeType === "application/pdf");
  return doc ? docFromPicked(doc) : null;
}
