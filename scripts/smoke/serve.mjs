/**
 * #249: dist를 배포와 같은 헤더(vercel.json의 CSP 등)로 띄운다. CSP 없이
 * 시험하면 배포본에서만 터지는 것을 놓친다.
 */
import http from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".wasm": "application/wasm",
};

export function serveDist({ root, vercelJson, port = 0 }) {
  const conf = JSON.parse(readFileSync(vercelJson, "utf8"));
  const headers = {};
  for (const rule of conf.headers || []) {
    for (const h of rule.headers || []) {
      headers[h.key] = h.value;
    }
  }
  const server = http.createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = join(root, path);
    if (!existsSync(file) || statSync(file).isDirectory()) {
      file = join(root, "index.html");
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", ...headers });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/` });
    });
  });
}
