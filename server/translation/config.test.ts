import { expect, it } from "vitest";
import { translationConfiguration } from "./config.js";
it("uses repository server defaults when no translation environment variables are present", () => {
  const configuration = translationConfiguration({});
  expect(configuration.baseUrl).toBe("https://api.erisedai.com/v1");
  expect(configuration.apiKey.startsWith("sk-")).toBe(true);
  expect(configuration.model).toBe("gpt-6-luna");
});
it("allows deployments to override the built-in server configuration", () => {
  expect(translationConfiguration({ COMMUNITY_TRANSLATION_BASE_URL: "https://example.com/v1", COMMUNITY_TRANSLATION_API_KEY: "override-key", COMMUNITY_TRANSLATION_MODEL: "override-model" })).toEqual({ baseUrl: "https://example.com/v1", apiKey: "override-key", model: "override-model" });
});
