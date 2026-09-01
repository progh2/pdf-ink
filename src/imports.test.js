import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * A merge once kept one side of an import line and dropped `encodePngRgba`,
 * which neither `node --check` nor the Vite build catches: the call is just a
 * free variable that throws at click time. This walks every module and fails on
 * a name that some sibling module exports but this file neither imports nor
 * declares.
 */
const here = dirname(fileURLToPath(import.meta.url));

const files = readdirSync(here).filter((name) => name.endsWith(".js") && !name.endsWith(".test.js"));

function read(name) {
  return readFileSync(join(here, name), "utf8");
}

function exportedNames(source) {
  const names = new Set();
  for (const match of source.matchAll(/^export (?:async )?function (\w+)/gm)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/^export const (\w+)/gm)) {
    names.add(match[1]);
  }
  return names;
}

function importedNames(source) {
  const names = new Set();
  for (const match of source.matchAll(/import\s+(?:(\w+)\s*,\s*)?\{([^}]*)\}\s+from/g)) {
    if (match[1]) {
      names.add(match[1]);
    }
    for (const piece of match[2].split(",")) {
      const name = piece.trim().split(/\s+as\s+/).pop().trim();
      if (name) {
        names.add(name);
      }
    }
  }
  for (const match of source.matchAll(/import\s+(?:\*\s+as\s+)?(\w+)\s+from/g)) {
    names.add(match[1]);
  }
  return names;
}

function declaredNames(source) {
  const names = new Set();
  for (const match of source.matchAll(/^\s*(?:export )?(?:async )?function (\w+)/gm)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/^\s*(?:export )?(?:const|let|var) (\w+)/gm)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/(?:const|let|var) (\w+) =/g)) {
    names.add(match[1]);
  }
  // `const { buildAnnotatedPdf } = await import("./exportPdf.js")` counts too.
  for (const match of source.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) {
    for (const piece of match[1].split(",")) {
      const name = piece.trim().split(/[:=]/)[0].trim();
      if (name) {
        names.add(name);
      }
    }
  }
  return names;
}

describe("모듈 배선", () => {
  it("calls no helper that a sibling module exports without importing it", () => {
    const sources = new Map(files.map((name) => [name, read(name)]));
    const exportsByFile = new Map([...sources].map(([name, code]) => [name, exportedNames(code)]));
    const problems = [];
    for (const [name, code] of sources) {
      const imported = importedNames(code);
      const declared = declaredNames(code);
      for (const [other, names] of exportsByFile) {
        if (other === name) {
          continue;
        }
        for (const exported of names) {
          if (imported.has(exported) || declared.has(exported)) {
            continue;
          }
          if (new RegExp(`(?<![.\\w"'\`])${exported}\\s*\\(`).test(code)) {
            problems.push(`${name}: ${exported}() (exported by ${other})`);
          }
        }
      }
    }
    assert.deepEqual(problems, []);
  });
});

describe("모듈 배선: 어디서 들여오는지", () => {
  it("imports each name from the module that actually exports it", () => {
    const sources = new Map(files.map((name) => [name, read(name)]));
    const problems = [];
    for (const [name, code] of sources) {
      for (const match of code.matchAll(/import\s*\{([^}]*)\}\s*from\s*"\.\/([\w.]+)"/g)) {
        const from = match[2];
        const exported = exportedNames(sources.get(from) || "");
        if (!sources.has(from)) {
          continue;
        }
        for (const piece of match[1].split(",")) {
          const wanted = piece.trim().split(/\s+as\s+/)[0].trim();
          if (wanted && !exported.has(wanted)) {
            problems.push(`${name}: ${wanted} is not exported by ${from}`);
          }
        }
      }
    }
    assert.deepEqual(problems, []);
  });
});
