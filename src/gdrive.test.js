import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DRIVE_SCOPE,
  FILE_FIELDS,
  docFromPicked,
  downloadUrl,
  driveConfigured,
  driveIdentity,
  metadataUrl,
  pdfFromPickerResult,
  pickerViewConfig,
  remoteChanged,
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
    assert.deepEqual(pdfFromPickerResult(picked), { id: "f2", name: "노트.pdf", version: "" });
    assert.equal(pdfFromPickerResult({ action: "cancel" }), null);
    assert.equal(pdfFromPickerResult({ action: "picked", docs: [picked.docs[0]] }), null);
    assert.equal(pickerViewConfig().mimeTypes, "application/pdf");
  });

  it("keeps ink per document", () => {
    const doc = docFromPicked({ id: "f2", name: "노트.pdf", version: "7" });
    assert.deepEqual(doc, { id: "f2", name: "노트.pdf", version: "7" });
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
    assert.match(main, /if \(!String\(identity \|\| ""\)\.startsWith\("gdrive::"\)\) \{\s*state\.driveDoc = null;/);
  });
});
