import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { stat, realpath } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve, relative, extname, isAbsolute } from "node:path";
import { createMarketHandler } from "./market/http.js";
import type { ReadStore } from "./market/store.js";
import { createDiscussionRouter } from "./discussions/router.js";

type Options = { store: ReadStore; staticDir: string; environment?: Record<string, string | undefined> };
const types: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon" };
function json(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }); response.end(JSON.stringify(body));
}
async function readBody(request: IncomingMessage) {
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of request) { size += chunk.length; if (size > 64 * 1024) throw new Error("Body too large"); chunks.push(chunk); }
  const text = Buffer.concat(chunks).toString("utf8"); return text ? JSON.parse(text) : undefined;
}
export function createApplication({ store, staticDir, environment = process.env }: Options) {
  const market = createMarketHandler(store); const discussions = createDiscussionRouter(environment);
  return createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? "/", "http://localhost"); const method = request.method ?? "GET";
      if (url.pathname === "/api/health") return json(response, 200, { status: "ok", role: "web" });
      if (url.pathname.startsWith("/api/prlstats/") || url.pathname === "/api/market/candles") {
        if (method !== "GET") return json(response, 405, { error: "method_not_allowed" });
        const result = await market(url); return json(response, result.status, result.body, result.headers);
      }
      if (url.pathname.startsWith("/api/")) {
        let body: unknown;
        if (method === "POST") { try { body = await readBody(request); } catch { return json(response, 400, { error: "invalid_request" }); } }
        const result = await discussions(url, method, request.headers, body); return json(response, result.status, result.body);
      }
      if (method !== "GET" && method !== "HEAD") return json(response, 405, { error: "method_not_allowed" });
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.split("/").some(part => part.startsWith("."))) return json(response, 404, { error: "not_found" });
      const root = await realpath(staticDir); let file = resolve(root, `.${pathname}`);
      try { if (!(await stat(file)).isFile()) file = resolve(root, "index.html"); }
      catch { if (extname(pathname)) return json(response, 404, { error: "not_found" }); file = resolve(root, "index.html"); }
      file = await realpath(file); const inside = relative(root, file);
      if (inside.startsWith("..") || isAbsolute(inside)) return json(response, 404, { error: "not_found" });
      const info = await stat(file);
      response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream", "content-length": String(info.size), "cache-control": extname(file) === ".html" ? "no-cache" : "public, max-age=3600" });
      if (method === "HEAD") response.end(); else createReadStream(file).on("error", () => response.destroy()).pipe(response);
    })().catch(() => { if (!response.headersSent) json(response, 503, { error: "service_unavailable" }); else response.destroy(); });
  });
}
