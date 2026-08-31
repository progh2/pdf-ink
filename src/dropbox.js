/**
 * Dropbox 연동 (#82). PKCE only: the app key is public, there is no app secret
 * in the bundle, and the token lives in this browser. No ink ever goes to our
 * own server, because we do not have one.
 */

export const DROPBOX_APP_KEY = import.meta.env?.VITE_DROPBOX_APP_KEY || "t79w50u4sds83dm";
export const AUTH_URL = "https://www.dropbox.com/oauth2/authorize";
export const TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
export const REVOKE_URL = "https://api.dropboxapi.com/2/auth/token/revoke";
export const LIST_URL = "https://api.dropboxapi.com/2/files/list_folder";
export const LIST_MORE_URL = "https://api.dropboxapi.com/2/files/list_folder/continue";
export const META_URL = "https://api.dropboxapi.com/2/files/get_metadata";
export const DOWNLOAD_URL = "https://content.dropboxapi.com/2/files/download";
export const UPLOAD_URL = "https://content.dropboxapi.com/2/files/upload";

export const VERIFIER_BYTES = 64;
/** Refresh a little early, so a long save does not die mid-upload. */
export const TOKEN_SKEW_MS = 60_000;

function base64url(bytes) {
  let text = "";
  for (const byte of bytes) {
    text += String.fromCharCode(byte);
  }
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function makeVerifier(random = (size) => crypto.getRandomValues(new Uint8Array(size))) {
  return base64url(random(VERIFIER_BYTES));
}

export async function challengeFor(verifier, subtle = crypto.subtle) {
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/** The redirect must match one registered in the App Console. */
export function redirectUri(origin) {
  return String(origin || "").replace(/\/$/, "") + "/";
}

export function authorizeUrl({ appKey = DROPBOX_APP_KEY, challenge, origin, state } = {}) {
  const params = new URLSearchParams({
    client_id: appKey,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: redirectUri(origin),
    // offline: a refresh token, so the reader logs in once.
    token_access_type: "offline",
  });
  if (state) {
    params.set("state", state);
  }
  return `${AUTH_URL}?${params.toString()}`;
}

export function tokenBody({ code, verifier, origin, appKey = DROPBOX_APP_KEY }) {
  return new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: appKey,
    code_verifier: verifier,
    redirect_uri: redirectUri(origin),
  });
}

export function refreshBody({ refreshToken, appKey = DROPBOX_APP_KEY }) {
  return new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: appKey,
  });
}

export function sessionFromToken(payload, now = Date.now(), previous = null) {
  if (!payload?.access_token) {
    return null;
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || previous?.refreshToken || "",
    expiresAt: now + Math.max(0, Number(payload.expires_in) || 0) * 1000,
    accountId: payload.account_id || previous?.accountId || "",
  };
}

export function tokenExpired(session, now = Date.now(), skewMs = TOKEN_SKEW_MS) {
  if (!session?.accessToken) {
    return true;
  }
  return Number(session.expiresAt || 0) - skewMs <= now;
}

/** Only PDFs, newest first, folders first so browsing reads naturally. */
export function pdfEntries(entries) {
  const list = (entries || []).filter((entry) => {
    if (entry?.[".tag"] === "folder") {
      return true;
    }
    return entry?.[".tag"] === "file" && /\.pdf$/i.test(entry.name || "");
  });
  return list.sort((a, b) => {
    const aFolder = a[".tag"] === "folder";
    const bFolder = b[".tag"] === "folder";
    if (aFolder !== bFolder) {
      return aFolder ? -1 : 1;
    }
    return String(a.name || "").localeCompare(String(b.name || ""), "ko");
  });
}

export function parentPath(path) {
  const clean = String(path || "").replace(/\/$/, "");
  if (!clean) {
    return "";
  }
  const at = clean.lastIndexOf("/");
  return at <= 0 ? "" : clean.slice(0, at);
}

export function downloadArg(path) {
  return JSON.stringify({ path });
}

/**
 * Writes back to the same file. `update` with the rev we opened refuses when
 * someone else changed it meanwhile, instead of silently winning (#82).
 */
export function uploadArg(path, rev) {
  return JSON.stringify({
    path,
    mode: rev ? { ".tag": "update", update: rev } : { ".tag": "overwrite" },
    autorename: false,
    mute: true,
  });
}

/** Dropbox headers must be plain ASCII, so a Korean file name is escaped. */
export function asciiHeader(value) {
  return String(value).replace(/[^\x20-\x7e]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

export function isConflict(error) {
  const tag = error?.error?.[".tag"] === "path" ? error.error.reason?.[".tag"] : null;
  return tag === "conflict";
}

export function docFromEntry(entry) {
  if (!entry || entry[".tag"] !== "file") {
    return null;
  }
  return {
    path: entry.path_lower || entry.path_display || "",
    name: entry.name || "문서.pdf",
    rev: entry.rev || "",
    size: Number(entry.size) || 0,
  };
}

/** How often we ask whether someone else changed the file (#127). */
export const SYNC_POLL_MS = 20_000;

/** True when the file in Dropbox is not the one we opened. */
export function remoteChanged(doc, meta) {
  const rev = meta?.rev;
  return Boolean(doc?.rev && rev && rev !== doc.rev);
}

/** Same shape as a local file identity, so ink keeps its own store per document. */
export function dropboxIdentity(doc) {
  return `dbx::${doc?.path || ""}`;
}
