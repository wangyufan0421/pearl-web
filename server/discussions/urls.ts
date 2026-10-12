const X_HOSTS = new Set([
  "x.com",
  "www.x.com",
  "mobile.x.com",
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com",
]);

const STATUS_PATH = /^\/([^/]+)\/status\/([0-9]+)\/?$/;

export type NormalizedXStatusUrl = {
  statusId: string;
  url: string;
};

export function normalizeXStatusUrl(value: string): NormalizedXStatusUrl {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Expected an X status URL");
  }

  const match = X_HOSTS.has(parsed.hostname.toLowerCase()) && STATUS_PATH.exec(parsed.pathname);
  if (!match) throw new Error("Expected an X status URL");

  const [, handle, statusId] = match;
  return {
    statusId,
    url: `https://x.com/${handle}/status/${statusId}`,
  };
}
