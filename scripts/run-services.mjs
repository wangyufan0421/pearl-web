import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

// Node's env-file handling preserves explicitly exported environment variables.
for (const file of [".env.local", ".env"]) if (existsSync(file)) loadEnvFile(file);
const development = process.argv.includes("--dev");
const children = [];
let closing = false;
function shutdown(code) {
  if (closing) return; closing = true;
  children.forEach(child => child.kill("SIGTERM"));
  process.exitCode = code;
  const timeout = setTimeout(() => { children.forEach(child => child.kill("SIGKILL")); }, 12_000); timeout.unref();
}
function launch(file, args = []) {
  const child = spawn(process.execPath, [file, ...args], { stdio: "inherit", env: process.env, windowsHide: true }); children.push(child);
  child.on("error", () => shutdown(1));
  child.on("exit", code => { if (!closing) shutdown(code ?? 1); });
}
launch(development ? "node_modules/vite/bin/vite.js" : "dist-server/main.js", development ? ["--host", "127.0.0.1", "--port", "5173", "--strictPort"] : []);
launch("dist-server/market/worker.js");
if (process.env.COMMUNITY_TRANSLATION_BASE_URL && process.env.COMMUNITY_TRANSLATION_API_KEY && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) launch("dist-server/translation/worker.js");
process.once("SIGINT", () => shutdown(0)); process.once("SIGTERM", () => shutdown(0));
