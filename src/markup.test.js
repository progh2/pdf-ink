import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "index.html"), "utf8");

/**
 * #212가 자물쇠를 옮기며 `</button>` 하나를 빠뜨려, 툴바와 본문이 그 버튼
 * 안으로 삼켜졌다. 테스트 654개가 전부 통과했는데 앱은 완전히 하얬다 —
 * 조각을 정규식으로 재는 계약은 **구조가 무너진 것을 못 본다**.
 * 여기서 태그를 실제로 세어 그 구멍을 막는다 (#219).
 */
const VOID = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
  "param", "source", "track", "wbr",
  // 인라인 SVG에서 스스로 닫지 않고 쓰는 것들
  "path", "rect", "circle", "line", "polyline", "polygon", "ellipse", "use", "stop",
]);

function walk(source) {
  const stack = [];
  const problems = [];
  const opened = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  let match;
  while ((match = re.exec(source))) {
    const [, closing, rawName, attrs, selfClosed] = match;
    const tag = rawName.toLowerCase();
    if (VOID.has(tag) || selfClosed === "/") {
      continue;
    }
    const line = source.slice(0, match.index).split("\n").length;
    if (!closing) {
      const id = (attrs.match(/id="([^"]+)"/) || [])[1] || "";
      const cls = (attrs.match(/class="([^"]+)"/) || [])[1] || "";
      stack.push({ tag, line, id, cls });
      opened.push({ tag, id, cls, depth: stack.length, path: stack.map((e) => e.id || e.cls || e.tag) });
      continue;
    }
    const top = stack.pop();
    if (!top) {
      problems.push(`${line}줄: </${tag}> 짝이 없다`);
    } else if (top.tag !== tag) {
      problems.push(`${line}줄: </${tag}> 인데 열려 있던 것은 <${top.tag}> (${top.line}줄)`);
    }
  }
  for (const left of stack) {
    problems.push(`${left.line}줄: <${left.tag}${left.id ? ` id="${left.id}"` : ""}> 가 안 닫혔다`);
  }
  return { problems, opened };
}

describe("#219 index.html 구조", () => {
  const { problems, opened } = walk(html);
  const find = (needle) => opened.find((node) => node.id === needle || node.cls === needle);

  it("has every tag closed by its own kind", () => {
    assert.deepEqual(problems, [], problems.join("\n"));
  });

  it("keeps the paper and the toolbar out of the header", () => {
    const body = find("write-body");
    const top = find("write-top");
    assert.ok(body, "write-body가 있어야 한다");
    assert.ok(top, "write-top이 있어야 한다");
    assert.ok(!body.path.includes("write-top"), "본문이 헤더 안에 삼켜졌다");
    assert.equal(body.depth, top.depth, "둘은 형제여야 한다");
  });

  it("never buries a panel inside a button", () => {
    for (const id of ["toolbar", "slot-panel", "workspace", "marquee-menu"]) {
      const node = find(id);
      assert.ok(node, `${id}가 있어야 한다`);
      assert.ok(
        !node.path.some((step) => String(step).includes("btn") || step === "interact-lock"),
        `${id}가 버튼 안에 들어갔다: ${node.path.join(" > ")}`,
      );
    }
  });

  it("opens each id exactly once", () => {
    const ids = opened.map((node) => node.id).filter(Boolean);
    const twice = ids.filter((id, at) => ids.indexOf(id) !== at);
    assert.deepEqual([...new Set(twice)], [], "같은 id가 두 번");
  });
});
