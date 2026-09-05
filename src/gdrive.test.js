import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DRIVE_SCOPE,
  FILE_FIELDS,
  appIdFromClientId,
  createFileBody,
  docFromPicked,
  downloadUrl,
  driveConfigured,
  driveIdentity,
  mediaUrl,
  metadataUrl,
  pdfFromPickerResult,
  pickerViewConfig,
  remoteChanged,
  searchUrl,
  sidecarQuery,
  tokenClientConfig,
  tokenRequestOptions,
  updateUrl,
} from "./gdrive.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("#133 구글 드라이브", () => {
  it("asks for drive.file only, and carries no secret", () => {
    const src = readFileSync(join(root, "src/gdrive.js"), "utf8");
    assert.equal(DRIVE_SCOPE, "https://www.googleapis.com/auth/drive.file");
    assert.doesNotMatch(src, /client_secret|CLIENT_SECRET/);
    assert.doesNotMatch(src, /auth\/drive['"]|drive\.readonly/, "never the whole drive");
    assert.deepEqual(tokenClientConfig("cb", "id-1"), {
      client_id: "id-1",
      scope: DRIVE_SCOPE,
      callback: "cb",
    });
  });

  it("stays hidden until both keys are configured", () => {
    assert.equal(driveConfigured("id", "key"), true);
    assert.equal(driveConfigured("id", ""), false);
    assert.equal(driveConfigured("", "key"), false);
    assert.equal(driveConfigured("", ""), false);
  });

  it("prompts once, then re-uses the grant quietly", () => {
    assert.deepEqual(tokenRequestOptions(false), { prompt: "consent" });
    assert.deepEqual(tokenRequestOptions(true), { prompt: "" });
  });

  it("builds the three urls a document needs", () => {
    assert.equal(
      metadataUrl("a b/c"),
      `https://www.googleapis.com/drive/v3/files/a%20b%2Fc?fields=${encodeURIComponent(FILE_FIELDS)}`,
    );
    assert.equal(downloadUrl("id1"), "https://www.googleapis.com/drive/v3/files/id1?alt=media");
    assert.match(updateUrl("id1"), /^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\/id1\?uploadType=media/);
  });

  it("takes only a pdf out of the picker", () => {
    const picked = {
      action: "picked",
      docs: [
        { id: "f1", name: "폴더", mimeType: "application/vnd.google-apps.folder" },
        { id: "f2", name: "노트.pdf", mimeType: "application/pdf" },
      ],
    };
    assert.deepEqual(pdfFromPickerResult(picked), { id: "f2", name: "노트.pdf", version: "", parent: "" });
    assert.equal(pdfFromPickerResult({ action: "cancel" }), null);
    assert.equal(pdfFromPickerResult({ action: "picked", docs: [picked.docs[0]] }), null);
    assert.equal(pickerViewConfig().mimeTypes, "application/pdf");
  });

  it("keeps ink per document", () => {
    const doc = docFromPicked({ id: "f2", name: "노트.pdf", version: "7", parents: ["folder1"] });
    assert.deepEqual(doc, { id: "f2", name: "노트.pdf", version: "7", parent: "folder1" });
    assert.equal(driveIdentity(doc), "gdrive::f2");
    assert.notEqual(driveIdentity(doc), driveIdentity({ id: "f3" }));
    assert.equal(docFromPicked(null), null);
  });

  it("refuses to bury a newer version", () => {
    assert.equal(remoteChanged({ version: "7" }, { version: "8" }), true);
    assert.equal(remoteChanged({ version: "7" }, { version: "7" }), false);
    assert.equal(remoteChanged({ version: "" }, { version: "8" }), false, "nothing to compare yet");
    assert.equal(remoteChanged(null, { version: "8" }), false);
  });
});

describe("#133 배선", () => {
  const main = readFileSync(join(root, "src/main.js"), "utf8");
  const html = readFileSync(join(root, "index.html"), "utf8");

  it("hides the button until both keys exist, so nothing dead ships", () => {
    assert.match(html, /id="gdrive-open" hidden/);
    assert.match(main, /if \(els\.gdriveOpen && driveConfigured\(\)\) \{\s*els\.gdriveOpen\.hidden = false;/);
  });

  it("takes a token from Google, never a secret", () => {
    assert.match(main, /initTokenClient\(\s*tokenClientConfig/);
    assert.match(main, /requestAccessToken\(tokenRequestOptions\(Boolean\(state\.driveToken\)\)\)/);
    assert.doesNotMatch(main, /client_secret/);
    // The token lives in memory, not in storage.
    assert.doesNotMatch(main, /saveDriveToken|localStorage\.setItem\(["'].*drive/);
  });

  it("opens through the picker and checks the bytes are a pdf", () => {
    const open = main.slice(main.indexOf("async function openDriveFile"), main.indexOf("/**\n * Drive has no If-Match"));
    assert.match(open, /validatePdfContents/);
    assert.match(open, /openPdfBuffer\(buffer, \{ identity: driveIdentity\(doc\), name: doc\.name \}\)/);
    assert.match(main, /pdfFromPickerResult\(result\)/);
    assert.match(main, /setDeveloperKey\(GOOGLE_API_KEY\)/);
  });

  it("looks before writing, and retries once when the hour is up", () => {
    const save = main.slice(main.indexOf("async function saveToDrive"), main.indexOf("/** Takes the newer file, keeps the ink this browser has not saved yet. */\nasync function reloadFromDrive"));
    assert.match(save, /driveRemoteChanged\(doc, meta\)/);
    assert.match(save, /return "conflict"/);
    assert.match(main, /if \(reply\.status === 401\)/);
  });

  it("shares the #126/#127 paths instead of growing a second set", () => {
    assert.match(main, /await flattenAfterWriteBack\(blob\);\s*flashBanner\(`드라이브에 저장했습니다/);
    assert.match(main, /function checkRemote\(\)[\s\S]*checkDropboxRemote\(\);\s*checkDriveRemote\(\)/);
    // #277: gdrive:: identity면 되살리고, 아니면 비운다.
    assert.match(main, /if \(dbxId\.startsWith\("gdrive::"\)\) \{[\s\S]{0,220}state\.driveDoc = \{ id:/);
    assert.match(main, /\} else \{\s*state\.driveDoc = null;\s*state\.driveSidecarId = "";/);
  });
});

describe("#165 피커 설정", () => {
  it("takes the app id out of the client id", () => {
    assert.equal(appIdFromClientId("44932901774-abc.apps.googleusercontent.com"), "44932901774");
    assert.equal(appIdFromClientId("no-digits.apps.googleusercontent.com"), "");
    assert.equal(appIdFromClientId(""), "");
  });

  it("starts in My Drive, shows folders, and only picks pdfs", () => {
    const view = pickerViewConfig();
    assert.equal(view.parent, "root", "a folder to walk, not a search box");
    assert.equal(view.includeFolders, true);
    assert.equal(view.selectFolderEnabled, false);
    assert.equal(view.mimeTypes, "application/pdf");
  });
});

describe("#165 배선", () => {
  const main = readFileSync(join(root, "src/main.js"), "utf8");

  it("gives the picker the app id and a folder view", () => {
    assert.match(main, /\.setAppId\(appIdFromClientId\(\)\)/);
    assert.match(main, /ViewId\.DOCS/);
    assert.doesNotMatch(main, /ViewId\.PDFS/, "the search view is gone");
    assert.match(main, /view\.setParent\(config\.parent\)/);
    assert.match(main, /view\.setSelectFolderEnabled\(config\.selectFolderEnabled\)/);
  });

  it("says what went wrong when opening fails", () => {
    const open = main.slice(main.indexOf("async function openDriveFile"), main.indexOf("/**\n * Drive has no If-Match"));
    assert.match(open, /throw new Error\(String\(metaReply\.status\)\)/);
    assert.match(open, /throw new Error\(String\(reply\.status\)\)/);
    assert.match(open, /구글 드라이브에서 열지 못했습니다\.\$\{why\}/);
  });
});

describe("#169 드라이브 사이드카", () => {
  it("looks for it by name in the same folder", () => {
    const q = sidecarQuery("노트.pdf.ink", "folder1");
    assert.match(q, /name = '노트\.pdf\.ink'/);
    assert.match(q, /'folder1' in parents/);
    assert.match(q, /trashed = false/, "a deleted sidecar must not come back");
    assert.doesNotMatch(sidecarQuery("노트.pdf.ink", ""), /in parents/, "root is fine too");
  });

  it("escapes a quote in the name instead of breaking the query", () => {
    assert.match(sidecarQuery("it's.pdf.ink", ""), /name = 'it\\'s\.pdf\.ink'/);
  });

  it("creates it beside the document", () => {
    assert.deepEqual(createFileBody("노트.pdf.ink", "folder1"), {
      name: "노트.pdf.ink",
      mimeType: "application/json",
      parents: ["folder1"],
    });
    assert.deepEqual(createFileBody("노트.pdf.ink", ""), {
      name: "노트.pdf.ink",
      mimeType: "application/json",
    });
  });

  it("writes the bytes to the file it made", () => {
    assert.equal(mediaUrl("id1"), "https://www.googleapis.com/upload/drive/v3/files/id1?uploadType=media");
    assert.match(searchUrl("q"), /^https:\/\/www\.googleapis\.com\/drive\/v3\/files\?/);
    assert.match(searchUrl("q"), /spaces=drive/);
  });

  it("remembers which folder the document lives in", () => {
    assert.match(FILE_FIELDS, /parents/);
  });
});

describe("#169 배선", () => {
  const main = readFileSync(join(root, "src/main.js"), "utf8");

  it("finds the sidecar once and reuses its id", () => {
    const find = main.slice(main.indexOf("async function findDriveSidecar"), main.indexOf("/** Same shape as the Dropbox one"));
    assert.match(find, /if \(state\.driveSidecarId\) \{\s*return state\.driveSidecarId;/, "no repeat search");
    assert.match(find, /sidecarQuery\(sidecarName\(doc\.name\), doc\.parent\)/);
  });

  it("creates it beside the pdf, then writes the bytes", () => {
    const save = main.slice(main.indexOf("async function saveDriveSidecar"), main.indexOf("async function loadDriveSidecar"));
    assert.match(save, /createFileBody\(sidecarName\(doc\.name\), doc\.parent\)/);
    assert.match(save, /driveMediaUrl\(id\)/);
    assert.match(save, /method: "PATCH"/);
    assert.doesNotMatch(save, /annotatedPdfBlob|bakeIntoPdf/, "the pdf is not touched");
  });

  it("reads it on open and takes the newer save", () => {
    const load = main.slice(main.indexOf("async function loadDriveSidecar"), main.indexOf("/* ---- 자동 저장"));
    // #83부터: 더 최근 쪽이 구조를 정하고, 필기는 합집합이다.
    assert.match(load, /const takeStructure = pickNewer\(local, remote\) === "remote"/);
    assert.match(load, /mergePages\(state\.pages, remote\.pages, state\.inkGone\)/);
    assert.match(main, /await loadDriveSidecar\(doc\)/);
  });

  it("autosaves a drive document the same way as a dropbox one", () => {
    assert.match(main, /await \(state\.driveDoc \? saveDriveSidecar\(\) : saveInkSidecar\(\)\)/);
    assert.match(main, /state\.driveSidecarId = ""/, "a new document forgets the old sidecar");
  });
});
