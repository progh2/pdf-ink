import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  PICKER_TYPES,
  canWriteHandle,
  ensureWritePermission,
  pickerOptions,
  saveTargetLabel,
  supportsFileHandles,
  writeHandle,
} from "./fileHandle.js";

function fakeHandle({ query, request } = {}) {
  const written = [];
  return {
    written,
    createWritable: async () => ({
      write: async (blob) => written.push(blob),
      close: async () => {},
    }),
    queryPermission: query ? async () => query : undefined,
    requestPermission: request ? async () => request : undefined,
  };
}

describe("#82 크롬 로컬 핸들", () => {
  it("only claims support when the picker is really there", () => {
    assert.equal(supportsFileHandles({ showOpenFilePicker: () => {} }), true);
    assert.equal(supportsFileHandles({}), false);
    assert.equal(supportsFileHandles(undefined), false);
    assert.deepEqual(pickerOptions().types, PICKER_TYPES);
    assert.equal(pickerOptions().multiple, false);
  });

  it("knows a writable handle from anything else", () => {
    assert.equal(canWriteHandle(fakeHandle()), true);
    assert.equal(canWriteHandle({}), false);
    assert.equal(canWriteHandle(null), false);
    assert.equal(saveTargetLabel(fakeHandle()), "원본에 저장했습니다.");
    assert.equal(saveTargetLabel(null), null, "no handle means the download path");
  });

  it("asks for write permission only when it is not granted yet", async () => {
    assert.equal(await ensureWritePermission(fakeHandle({ query: "granted" })), true);
    assert.equal(await ensureWritePermission(fakeHandle({ query: "denied" })), false);
    assert.equal(await ensureWritePermission(fakeHandle({ query: "prompt", request: "granted" })), true);
    assert.equal(await ensureWritePermission(fakeHandle({ query: "prompt", request: "denied" })), false);
    // Old builds without the permission API still try the write.
    assert.equal(await ensureWritePermission(fakeHandle()), true);
    assert.equal(await ensureWritePermission(null), false);
  });

  it("treats a throwing permission check as a no", async () => {
    const angry = {
      createWritable: async () => ({ write: async () => {}, close: async () => {} }),
      queryPermission: async () => {
        throw new Error("nope");
      },
    };
    assert.equal(await ensureWritePermission(angry), false);
  });

  it("writes and always closes the stream", async () => {
    const handle = fakeHandle({ query: "granted" });
    await writeHandle(handle, "bytes");
    assert.deepEqual(handle.written, ["bytes"]);
  });

  it("closes the stream even when the write fails", async () => {
    let closed = false;
    const handle = {
      createWritable: async () => ({
        write: async () => {
          throw new Error("disk full");
        },
        close: async () => {
          closed = true;
        },
      }),
    };
    await assert.rejects(() => writeHandle(handle, "bytes"), /disk full/);
    assert.equal(closed, true, "a half-written file must not stay open");
  });
});

describe("#82 배선", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const main = readFileSync(join(here, "main.js"), "utf8");

  it("saves back to the handle, and falls back to the download", () => {
    assert.match(main, /supportsFileHandles\(window\)/);
    assert.match(main, /ensureWritePermission\(state\.fileHandle\)/);
    assert.match(main, /writeHandle\(state\.fileHandle, blob\)/);
    assert.match(main, /downloadBlob\(blob, fileName\)/);
  });

  it("keeps the ink local: no upload on this path", () => {
    const save = main.slice(main.indexOf("async function saveDocumentNow"), main.indexOf("async function exportDocument("));
    assert.doesNotMatch(save, /fetch\(|XMLHttpRequest/);
  });
});

describe("#82 핸들은 그 문서의 것", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const main = readFileSync(join(here, "main.js"), "utf8");
  const storage = readFileSync(join(here, "storage.js"), "utf8");

  it("replaces the handle on every open, so the last file is never overwritten", () => {
    const open = main.slice(main.indexOf("async function openPdfBuffer"), main.indexOf("async function openSelectedFile"));
    assert.match(open, /state\.fileHandle = handle;/);
    assert.doesNotMatch(open, /if \(handle\) \{\s*state\.fileHandle = handle;/);
  });

  it("keeps the handle with the document, so reopening can still overwrite", () => {
    assert.match(main, /handle: state\.fileHandle,/);
    assert.match(main, /handle: row\.handle \|\| null,/);
    assert.match(storage, /if \(record\.handle\) \{[\s\S]*entry\.handle = record\.handle/);
  });
});
