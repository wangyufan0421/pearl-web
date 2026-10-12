import { describe, expect, it, vi } from "vitest";
import { createDiscussionApiPlugin } from "../../vite.config";

function installMiddleware(environment?: Record<string, string | undefined>) {
  let middleware: ((request: any, response: any, next: () => void) => void) | undefined;
  createDiscussionApiPlugin(environment).configureServer({ middlewares: { use: (handler: typeof middleware) => { middleware = handler; } } });
  return middleware!;
}

function request(url: string, method = "GET") {
  return {
    url,
    method,
    headers: {},
    on: vi.fn((event: "data" | "end" | "error", listener: () => void) => {
      if (event === "end") queueMicrotask(listener);
    }),
  };
}

async function dispatch(middleware: ReturnType<typeof installMiddleware>, req: ReturnType<typeof request>) {
  let resolve!: () => void;
  const done = new Promise<void>((complete) => { resolve = complete; });
  const response = { statusCode: 0, setHeader: vi.fn(), end: vi.fn(() => resolve()) };
  middleware(req, response, vi.fn());
  await done;
  return response;
}

describe("community discussion Vite dispatcher", () => {
  it("validates the configured admin token through GET without requiring a database", async () => {
    const req = request("/api/admin/community-discussions");
    req.headers = { authorization: "Bearer local-test-token" };
    const result = await dispatch(installMiddleware({ COMMUNITY_ADMIN_TOKEN: "local-test-token" }), req);
    expect(result.statusCode).toBe(200);
    expect(result.end).toHaveBeenCalledWith(JSON.stringify({ authorized: true }));
  });
  it("passes locally loaded server configuration to the protected handlers", async () => {
    const req = request("/api/admin/community-discussions", "POST");
    req.headers = { authorization: "Bearer local-test-token" };
    const result = await dispatch(installMiddleware({ COMMUNITY_ADMIN_TOKEN: "local-test-token" }), req);
    // Authentication succeeds; the empty request body is rejected before any external service is contacted.
    expect(result.statusCode).toBe(400);
    expect(result.end).toHaveBeenCalledWith(JSON.stringify({ error: "invalid_request" }));
  });
  it("preserves duplicate slug values so the public detail handler rejects the ambiguous query", async () => {
    const result = await dispatch(installMiddleware(), request("/api/community-discussion?slug=first&slug=second"));
    expect(result.statusCode).toBe(404);
    expect(result.end).toHaveBeenCalledWith(JSON.stringify({ error: "not_found" }));
  });

  it("dispatches protected admin routes through the same handler behavior", async () => {
    const result = await dispatch(installMiddleware(), request("/api/admin/community-discussions", "POST"));
    expect(result.statusCode).toBe(401);
    expect(result.end).toHaveBeenCalledWith(JSON.stringify({ error: "unauthorized" }));
  });
});
