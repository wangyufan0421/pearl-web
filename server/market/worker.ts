import { createCollector } from "./collector.js";
import { createMarketStore, marketStorageMode } from "./runtime.js";

try {
  const collector = createCollector({ store: createMarketStore(), onResult: (key, ok) => console.log(`${new Date().toISOString()} ${key} ${ok ? "saved" : "failed; previous snapshot retained"}`) });
  collector.start();
  console.log(`Market collector started independently of website visits; storage=${marketStorageMode()}`);
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { collector.stop(); process.exitCode = 0; });
} catch {
  console.error("Market collector could not start. Check server environment and snapshot migration.");
  process.exitCode = 1;
}
