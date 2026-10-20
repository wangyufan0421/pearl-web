import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("starts and stops community identity maintenance with the web service", () => {
  const source = readFileSync(resolve(process.cwd(), "server/main.ts"), "utf8");
  expect(source).toContain('from "./discussions/identityRuntime.js"');
  expect(source).toMatch(/startIdentityMaintenance\(process\.env\)/);
  expect(source).toMatch(/identityQueue\?\.stop\(\)/);
});
