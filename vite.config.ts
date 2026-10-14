/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createMarketApiPlugin } from "./server/market/vitePlugin.js";

type DevRequest = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  on(event: "data" | "end" | "error", listener: (...args: any[]) => void): void;
};

type DevResponse = { statusCode: number; setHeader(name: string, value: string): void; end(body?: string): void };

async function readJson(request: DevRequest): Promise<unknown> {
  if (request.method !== "POST") return undefined;
  const chunks: Uint8Array[] = [];
  await new Promise<void>((resolve, reject) => {
    request.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    request.on("end", resolve);
    request.on("error", reject);
  });
  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) : undefined;
}

function paramsFor(pathname: string): Record<string, string | undefined> | undefined {
  const admin = /^\/api\/admin\/community-discussions\/([a-z0-9-]+)(?:\/manage)?$/.exec(pathname);
  if (admin) return { slug: admin[1] };
  const sources = /^\/api\/admin\/community-discussions\/([^/]+)\/sources$/.exec(pathname);
  if (sources) return { slug: decodeURIComponent(sources[1]) };
  const refresh = /^\/api\/admin\/community-discussions\/([^/]+)\/sources\/([^/]+)\/refresh$/.exec(pathname);
  return refresh ? { slug: decodeURIComponent(refresh[1]), statusId: decodeURIComponent(refresh[2]) } : undefined;
}

function queryFor(searchParams: URLSearchParams): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of searchParams.entries()) {
    const previous = query[key];
    query[key] = previous === undefined ? value : Array.isArray(previous) ? [...previous, value] : [previous, value];
  }
  return query;
}

export function createDiscussionApiPlugin(environment: Record<string, string | undefined> = process.env) {
  return {
    name: "community-discussion-api",
    configureServer(server: { middlewares: { use(handler: (request: DevRequest, response: DevResponse, next: () => void) => void): void } }) {
    server.middlewares.use((request, response, next) => {
      void (async () => {
        const url = new URL(request.url ?? "/", "http://localhost");
        const pathname = url.pathname;
        const method = request.method ?? "GET";
        const isList = pathname === "/api/community-discussions";
        const isDetail = pathname === "/api/community-discussion";
        const params = paramsFor(pathname);
        const isCreate = pathname === "/api/admin/community-discussions";
        const isAdminList = pathname === "/api/admin/community-discussions/list/all";
        if (!isList && !isDetail && !params && !isCreate && !isAdminList) return next();

        let body: unknown;
        try {
          body = await readJson(request);
        } catch {
          response.statusCode = 400;
          response.setHeader("content-type", "application/json");
          response.end(JSON.stringify({ error: "invalid_request" }));
          return;
        }

        const query = queryFor(url.searchParams);
        const { createLiveDiscussionHandlers, toDiscussionHttpRequest } = await import("./server/discussions/runtime.js");
        const input = toDiscussionHttpRequest({ body, headers: request.headers, query }, params);
        const handlers = createLiveDiscussionHandlers(environment);
        const result = isAdminList && method === "GET" ? await handlers.handleAdminList(input)
          : params && method === "GET" && !pathname.includes("/sources") ? await handlers.handleAdminDetail(input)
          : params && method === "POST" && pathname.endsWith("/manage") ? await handlers.handleManageDiscussion(input)
          : isList && method === "GET"
          ? await handlers.handleListDiscussions(input)
          : isDetail && method === "GET"
            ? await handlers.handleGetDiscussion(input)
            : isCreate && method === "GET"
              ? await handlers.handleVerifyAdmin(input)
            : isCreate && method === "POST"
              ? await handlers.handleCreateDiscussion(input)
              : params && pathname.endsWith("/refresh") && method === "POST"
                ? await handlers.handleRefreshSource(input)
                : params && method === "POST"
                  ? await handlers.handleAddSources(input)
                  : { status: 400, body: { error: "invalid_request" } };
        response.statusCode = result.status;
        response.setHeader("content-type", "application/json");
        response.setHeader("cache-control", "no-store");
        response.end(JSON.stringify(result.body));
      })().catch(() => {
        response.statusCode = 503;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ error: "discussion_unavailable" }));
      });
    });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), createDiscussionApiPlugin({ ...process.env, ...loadEnv(mode, process.cwd(), "") }), createMarketApiPlugin({ ...process.env, ...loadEnv(mode, process.cwd(), "") })],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "server/**/*.test.ts"],
  },
}));
