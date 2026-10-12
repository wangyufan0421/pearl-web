// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { createApplication } from "./application.js";

let server: Server | undefined; let folder: string | undefined;
afterEach(async () => { if (server) await new Promise<void>(resolve => server!.close(() => resolve())); if (folder) await rm(folder, { recursive: true }); });
describe("cloud HTTP application", () => {
  it("serves saved data, SPA deep links and protected administration without upstream access", async () => {
    folder = await mkdtemp(join(tmpdir(), "pearl-http-test-"));
    await writeFile(join(folder, "index.html"), "<html>Pearl test</html>");
    server = createApplication({ staticDir: folder, environment: { COMMUNITY_ADMIN_TOKEN: "test-token" }, store: { get: async () => ({ payload: { height: 42 }, fetchedAt: new Date().toISOString(), lastAttemptedAt: new Date().toISOString(), failed: false }) } });
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address() as { port: number }; const origin = `http://127.0.0.1:${address.port}`;
    const market = await fetch(`${origin}/api/prlstats/api/network`);
    expect(await market.json()).toEqual({ height: 42 });
    expect(market.headers.get("x-data-fetched-at")).toBeTruthy();
    expect(await (await fetch(`${origin}/en/archive/community-discussion`)).text()).toContain("Pearl test");
    expect((await fetch(`${origin}/api/admin/community-discussions`)).status).toBe(401);
    expect(await (await fetch(`${origin}/api/admin/community-discussions`, { headers: { authorization: "Bearer test-token" } })).json()).toEqual({ authorized: true });
    expect((await fetch(`${origin}/api/unknown`)).status).toBe(404);
    expect((await fetch(`${origin}/.env.local`)).status).toBe(404);
    expect((await fetch(`${origin}/api/prlstats/api/network`, { method: "POST" })).status).toBe(405);
  });
});
