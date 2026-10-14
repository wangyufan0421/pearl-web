// Server-only defaults, included with the repository at the owner's request.
// Never import this module from src/ or expose its values through HTTP responses.
const defaults = {
  baseUrl: "https://api.erisedai.com/v1",
  apiKey: "sk-fKR5PWUZMCLXYtYW67CtSixSQzE4Ef8MVO2bU3po8exG9wfj",
  model: "gpt-6-luna",
};

export function translationConfiguration(environment: Record<string, string | undefined> = process.env) {
  return {
    baseUrl: environment.COMMUNITY_TRANSLATION_BASE_URL?.trim() || defaults.baseUrl,
    apiKey: environment.COMMUNITY_TRANSLATION_API_KEY?.trim() || defaults.apiKey,
    model: environment.COMMUNITY_TRANSLATION_MODEL?.trim() || defaults.model,
  };
}
