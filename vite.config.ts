import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { loadDiscussion } from "./server/communityDiscussion.ts";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  const apiKey = environment.TWITTER241_API_KEY || process.env.TWITTER241_API_KEY;
  const communityDiscussionDevApi = {
    name: "community-discussion-dev-api",
    configureServer(server: { middlewares: { use: (route: string, handler: (request: { url?: string }, response: { setHeader: (name: string, value: string) => void; end: (body: string) => void; statusCode: number }) => void | Promise<void>) => void } }) {
      server.middlewares.use("/api/community-discussion", async (request, response) => {
        try {
          const url = new URL(request.url ?? "", "http://localhost");
          const payload = await loadDiscussion(url.searchParams.get("discussion") ?? "", fetch, apiKey);
          response.setHeader("content-type", "application/json; charset=utf-8");
          response.end(JSON.stringify(payload));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to load community discussion";
          response.statusCode = message === "Unknown community discussion" ? 404 : 503;
          response.setHeader("content-type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ error: "discussion_unavailable", message }));
        }
      });
    },
  };

  return {
    plugins: [react(), communityDiscussionDevApi],
    server: {
      proxy: {
        "/api/prlstats": {
          target: "https://prlstats.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/prlstats/, ""),
        },
      },
    },
    test: {
      environment: "jsdom",
    },
  };
});
