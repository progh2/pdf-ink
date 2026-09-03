/**
 * Builds public/THIRD-PARTY-NOTICES.txt from the packages that actually ship
 * in the browser bundle (#176).
 *
 * Apache-2.0 §4 and the MIT text both say the notice travels with the code.
 * Vite's minifier drops comments, so the bundle loses those headers — this
 * file is where they live instead, and the app links to it.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Everything reachable from the two runtime imports. Node-only paths are not shipped. */
export const BUNDLED = [
  { name: "pdfjs-dist", file: "LICENSE", why: "PDF 렌더·목차 읽기 (워커 포함)" },
  { name: "pdf-lib", file: "LICENSE.md", why: "주석 굽기·목차 쓰기" },
  { name: "@pdf-lib/standard-fonts", file: "LICENSE.md", why: "pdf-lib 표준 글꼴 폭 정보" },
  { name: "@pdf-lib/upng", file: "LICENSE", why: "pdf-lib PNG 인코딩" },
  { name: "pako", file: "LICENSE", why: "pdf-lib 압축" },
  { name: "tslib", file: "LICENSE.txt", why: "pdf-lib 런타임 도우미" },
  { name: "workbox-window", file: "LICENSE", why: "서비스 워커 등록 (PWA)" },
];

export function noticeFor({ name, file, why }, read = (path) => readFileSync(path, "utf8")) {
  const pkg = JSON.parse(read(join(root, "node_modules", name, "package.json")));
  const text = read(join(root, "node_modules", name, file)).trim();
  return [
    "".padEnd(72, "="),
    `${name} ${pkg.version}  —  ${pkg.license}`,
    `쓰임: ${why}`,
    pkg.homepage ? `출처: ${pkg.homepage}` : "",
    "".padEnd(72, "="),
    "",
    text,
    "",
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function buildNotices(list = BUNDLED) {
  const header = [
    "필기웹 (pdf-ink) — 함께 실려 나가는 다른 사람들의 코드",
    "",
    "필기웹 자신은 GNU AGPL-3.0-or-later입니다(저장소의 LICENSE).",
    "아래 것들은 각자의 라이선스 그대로이며, 그 라이선스가 요구하는",
    "저작권 표시를 여기에 그대로 옮겨 둡니다 — 번들은 압축되면서",
    "주석이 지워지기 때문입니다.",
    "",
    "",
  ].join("\n");
  return header + list.map((item) => noticeFor(item)).join("\n");
}

if (process.argv[1] && process.argv[1].endsWith("notices.mjs")) {
  const out = join(root, "public", "THIRD-PARTY-NOTICES.txt");
  if (!existsSync(join(root, "public"))) {
    throw new Error("public/ 가 없습니다");
  }
  writeFileSync(out, buildNotices());
  console.log(`wrote ${out}`);
}
