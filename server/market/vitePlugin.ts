import { createMarketHandler } from "./http.js";
import { createMarketStore } from "./runtime.js";

export function createMarketApiPlugin(environment: Record<string, string | undefined>) {
  let handler: ReturnType<typeof createMarketHandler> | undefined;
  return {
    name: "saved-market-data-api",
    configureServer(server: { middlewares: { use(handler: (request: { url?: string; method?: string }, response: { statusCode: number; setHeader(name: string, value: string): void; end(body: string): void }, next: () => void) => void): void } }) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        if (!url.pathname.startsWith("/api/prlstats/") && url.pathname !== "/api/market/candles") return next();
        void (async () => {
          const result = request.method !== "GET"
            ? { status: 405, headers: {}, body: { error: "method_not_allowed" } }
            : await (handler ??= createMarketHandler(createMarketStore(environment)))(url);
          response.statusCode = result.status;
          response.setHeader("content-type", "application/json");
          for (const [key, value] of Object.entries(result.headers)) response.setHeader(key, value);
          response.end(JSON.stringify(result.body));
        })().catch(() => { response.statusCode = 503; response.setHeader("content-type", "application/json"); response.end(JSON.stringify({ error: "data_unavailable" })); });
      });
    },
  };
}
