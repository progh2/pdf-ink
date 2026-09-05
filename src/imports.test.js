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

/**
 * #232: `syncSettings()`는 아무 데도 없는 함수였다. 부르는 순간 예외가 나
 * 스위치가 통째로 죽었는데, 형제 모듈이 export한 것만 보던 가드는 **제
 * 파일 안의 오타**를 못 봤다. 이제 그것도 본다.
 */
function definedNames(source) {
  const names = new Set();
  for (const match of source.matchAll(/^\s*(?:export )?(?:async )?function ([A-Za-z0-9_$]+)/gm)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) {
    for (const piece of match[1].split(",")) {
      const name = piece.trim().split(/[:=]/)[0].trim();
      if (name) {
        names.add(name);
      }
    }
  }
  // 인자·잡는 이름도 그 자리에서는 정의된 것이다.
  for (const match of source.matchAll(/(?:function [A-Za-z0-9_$]*|=>|catch)\s*\(([^)]*)\)/g)) {
    for (const piece of match[1].split(",")) {
      const name = piece.trim().split(/[:=]/)[0].replace(/^\.\.\./, "").trim();
      if (/^[A-Za-z0-9_$]+$/.test(name)) {
        names.add(name);
      }
    }
  }
  return names;
}

describe("스스로 부르는 이름", () => {
  it("calls no local helper that does not exist", () => {
    const code = read("main.js");
    const imported = importedNames(code);
    const defined = definedNames(code);
    const problems = [];
    // 우리 코드가 쓰는 이름꼴(sync*·draw*·open*…)만 본다: 브라우저 API는 제외.
    for (const match of code.matchAll(/(?<![.\w"'`$])((?:sync|draw|open|close|show|hide|refresh|paste|apply|persist|schedule|toggle|select|update|place|bind)[A-Z][A-Za-z0-9_$]*)\s*\(/g)) {
      const name = match[1];
      if (!defined.has(name) && !imported.has(name) && !problems.includes(name)) {
        problems.push(name);
      }
    }
    assert.deepEqual(problems, [], `main.js가 없는 함수를 부른다: ${problems.join(", ")}`);
  });
});

describe("모듈 배선", () => {
  it("uses no helper or constant that a sibling module exports without importing it", () => {
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
            continue;
          }
          // A constant is used as a value, never called, so the check above
          // never saw it — #178 shipped a build that would have thrown.
          if (/^[A-Z][A-Z0-9_]*$/.test(exported) && new RegExp(`(?<![.\\w"'\`])${exported}(?![\\w])`).test(code)) {
            problems.push(`${name}: ${exported} (exported by ${other})`);
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
