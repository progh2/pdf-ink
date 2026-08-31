import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  AUTH_URL,
  DROPBOX_APP_KEY,
  TOKEN_SKEW_MS,
  asciiHeader,
  authorizeUrl,
  challengeFor,
  docFromEntry,
  downloadArg,
  dropboxIdentity,
  isConflict,
  makeVerifier,
  parentPath,
  pdfEntries,
  redirectUri,
  refreshBody,
  sessionFromToken,
  tokenBody,
  tokenExpired,
  uploadArg,
} from "./dropbox.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("#82 드롭박스 PKCE", () => {
  it("uses the app key and never an app secret", async () => {
    const src = readFileSync(join(root, "src/dropbox.js"), "utf8");
    assert.doesNotMatch(src, /client_secret|app_secret|APP_SECRET/i);
    assert.equal(DROPBOX_APP_KEY.length > 8, true);
    const url = new URL(authorizeUrl({ challenge: "abc", origin: "https://pdf-ink.vercel.app" }));
    assert.equal(url.origin + url.pathname, AUTH_URL);
    assert.equal(url.searchParams.get("client_id"), DROPBOX_APP_KEY);
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(url.searchParams.get("token_access_type"), "offline");
    assert.equal(url.searchParams.get("redirect_uri"), "https://pdf-ink.vercel.app/");
  });

  it("makes a fresh verifier and its S256 challenge", async () => {
    const a = makeVerifier();
    const b = makeVerifier();
    assert.notEqual(a, b);
    assert.match(a, /^[A-Za-z0-9_-]+$/);
    const challenge = await challengeFor(a);
    assert.match(challenge, /^[A-Za-z0-9_-]+$/);
    assert.equal(challenge.length, 43, "base64url of a sha-256");
    assert.equal(await challengeFor(a), challenge, "same verifier, same challenge");
    assert.notEqual(await challengeFor(b), challenge);
  });

  it("sends the verifier, not a secret, when trading the code", () => {
    const body = tokenBody({ code: "c1", verifier: "v1", origin: "http://localhost:5173" });
    assert.equal(body.get("grant_type"), "authorization_code");
    assert.equal(body.get("code_verifier"), "v1");
    assert.equal(body.get("client_id"), DROPBOX_APP_KEY);
    assert.equal(body.get("redirect_uri"), "http://localhost:5173/");
    assert.equal(body.get("client_secret"), null);
    const refresh = refreshBody({ refreshToken: "r1" });
    assert.equal(refresh.get("grant_type"), "refresh_token");
    assert.equal(refresh.get("client_secret"), null);
    assert.equal(redirectUri("https://pdf-ink.vercel.app/"), "https://pdf-ink.vercel.app/");
  });

  it("keeps the refresh token when a refresh omits it", () => {
    const first = sessionFromToken(
      { access_token: "a1", refresh_token: "r1", expires_in: 14400, account_id: "acc" },
      1000,
    );
    assert.equal(first.refreshToken, "r1");
    assert.equal(first.expiresAt, 1000 + 14400 * 1000);
    const again = sessionFromToken({ access_token: "a2", expires_in: 14400 }, 2000, first);
    assert.equal(again.refreshToken, "r1", "a refresh reply has no refresh token");
    assert.equal(again.accountId, "acc");
    assert.equal(sessionFromToken({}, 0), null);
  });

  it("treats a token as expired a minute early", () => {
    const session = { accessToken: "a", expiresAt: 4 * 3600_000 };
    assert.equal(tokenExpired(session, 0), false);
    assert.equal(tokenExpired(session, 4 * 3600_000 - TOKEN_SKEW_MS), true, "refreshed a minute early");
    assert.equal(tokenExpired(session, 4 * 3600_000 - TOKEN_SKEW_MS - 1), false);
    assert.equal(tokenExpired(null, 0), true);
    assert.equal(tokenExpired({ expiresAt: 9e9 }, 0), true, "no token at all");
  });
});

describe("#82 드롭박스 파일", () => {
  const entries = [
    { ".tag": "file", name: "b.pdf", path_lower: "/b.pdf", rev: "r2", size: 10 },
    { ".tag": "file", name: "note.txt", path_lower: "/note.txt" },
    { ".tag": "folder", name: "수학", path_lower: "/수학" },
    { ".tag": "file", name: "a.PDF", path_lower: "/a.pdf", rev: "r1", size: 20 },
  ];

  it("shows folders and pdfs only", () => {
    const shown = pdfEntries(entries);
    assert.deepEqual(shown.map((entry) => entry.name), ["수학", "a.PDF", "b.pdf"]);
    assert.deepEqual(pdfEntries([]), []);
  });

  it("walks back up a folder", () => {
    assert.equal(parentPath("/수학/1학기"), "/수학");
    assert.equal(parentPath("/수학"), "");
    assert.equal(parentPath(""), "");
  });

  it("escapes a Korean path for the api header", () => {
    const arg = asciiHeader(downloadArg("/수학/노트.pdf"));
    assert.match(arg, /^[\x20-\x7e]*$/, "headers must be ascii");
    assert.deepEqual(JSON.parse(arg), { path: "/수학/노트.pdf" });
  });

  it("writes back to the same file, refusing a silent overwrite", () => {
    const arg = JSON.parse(uploadArg("/a.pdf", "r1"));
    assert.equal(arg.path, "/a.pdf");
    assert.deepEqual(arg.mode, { ".tag": "update", update: "r1" });
    assert.equal(arg.autorename, false, "never quietly makes a second file");
    // No rev known: plain overwrite.
    assert.deepEqual(JSON.parse(uploadArg("/a.pdf", "")).mode, { ".tag": "overwrite" });
  });

  it("knows a conflict reply from any other error", () => {
    assert.equal(isConflict({ error: { ".tag": "path", reason: { ".tag": "conflict" } } }), true);
    assert.equal(isConflict({ error: { ".tag": "path", reason: { ".tag": "no_write_permission" } } }), false);
    assert.equal(isConflict({ error_summary: "other" }), false);
    assert.equal(isConflict(null), false);
  });

  it("keeps ink per document, like a local file does", () => {
    const doc = docFromEntry(entries[0]);
    assert.deepEqual(doc, { path: "/b.pdf", name: "b.pdf", rev: "r2", size: 10 });
    assert.equal(dropboxIdentity(doc), "dbx::/b.pdf");
    assert.notEqual(dropboxIdentity(doc), dropboxIdentity(docFromEntry(entries[3])));
    assert.equal(docFromEntry(entries[2]), null, "a folder is not a document");
  });
});

describe("#82 드롭박스 배선", () => {
  const main = readFileSync(join(root, "src/main.js"), "utf8");
  const html = readFileSync(join(root, "index.html"), "utf8");
  const prefs = readFileSync(join(root, "src/prefs.js"), "utf8");

  it("logs in with PKCE and cleans the address bar", () => {
    assert.match(main, /function startDropboxLogin[\s\S]*makeVerifier\(\)/);
    assert.match(main, /challengeFor\(verifier\)/);
    assert.match(main, /sessionStorage\.setItem\(DROPBOX_VERIFIER_KEY/);
    assert.match(main, /window\.history\.replaceState\(\{\}, "", window\.location\.pathname\)/);
    assert.doesNotMatch(main, /client_secret/);
  });

  it("keeps the token in this browser only", () => {
    assert.match(prefs, /export function loadDropboxSession[\s\S]*localStorage|readRaw/);
    assert.match(main, /saveDropboxSession\(session\)/);
    assert.match(main, /function disconnectDropbox[\s\S]*clearDropboxSession\(\)/);
    assert.match(main, /function disconnectDropbox[\s\S]*REVOKE_URL/);
    assert.match(html, /id="dropbox-logout">연결 끊기/);
  });

  it("refreshes before the token dies, instead of failing a save", () => {
    assert.match(main, /function dropboxToken[\s\S]*tokenExpired\(state\.dropbox\)/);
    assert.match(main, /refreshBody\(\{ refreshToken: state\.dropbox\.refreshToken \}\)/);
  });

  it("saves back to the same file and never wins a conflict silently", () => {
    assert.match(main, /uploadArg\(doc\.path, doc\.rev\)/);
    assert.match(main, /if \(isConflict\(payload\)\)/);
    assert.match(main, /드롭박스에서 파일이 바뀌었습니다/);
    // A local file opened afterwards must not write to Dropbox.
    assert.match(main, /if \(!String\(identity \|\| ""\)\.startsWith\("dbx::"\)\) \{\s*state\.dropboxDoc = null;/);
  });

  it("checks the bytes are a pdf before opening them", () => {
    const open = main.slice(main.indexOf("async function openDropboxFile"), main.indexOf("/** Writes the annotated PDF back"));
    assert.match(open, /validatePdfContents/);
    assert.match(open, /openPdfBuffer\(buffer, \{ identity: dropboxIdentity\(doc\), name: doc\.name \}\)/);
  });

  it("offers the chooser from the upload screen, with no bar cell", () => {
    assert.match(html, /id="dropbox-open">드롭박스에서 열기/);
    assert.equal((html.match(/class="toolbar"/g) || []).length, 1);
    assert.doesNotMatch(html, /data-tool="dropbox"|data-more="dropbox"/);
  });
});
