import { resolve } from "node:path";
import { createApplication } from "./application.js";
import { createMarketStore } from "./market/runtime.js";

try {
  const port = Number(process.env.PORT ?? "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid port");
  const server = createApplication({ store: createMarketStore(), staticDir: resolve(process.cwd(), "dist") });
  server.listen(port, process.env.HOST ?? "127.0.0.1", () => console.log(`Pearl web API listening on port ${port}; upstream collection runs in its separate worker`));
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { server.close(); setTimeout(() => process.exit(0), 10_000).unref(); });
} catch { console.error("Web server could not start. Check server environment, port, and build output."); process.exitCode = 1; }
