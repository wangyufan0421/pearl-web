export type CommunitySourceBlock = {
  id: string;
  kind: "heading" | "quote" | "paragraph";
  text: string;
};

export type CommunitySource = {
  sourceId: string;
  href: string;
  author: string;
  handle: string;
  avatar: string;
  publishedAt?: string;
  blocks: CommunitySourceBlock[];
};

export type CommunityDiscussion = {
  discussion: string;
  fetchedAt: string;
  sources: CommunitySource[];
};

function isDiscussion(value: unknown): value is CommunityDiscussion {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<CommunityDiscussion>;
  return typeof record.discussion === "string" && typeof record.fetchedAt === "string" && Array.isArray(record.sources);
}

export async function getCommunityDiscussion(discussion: string, fetcher: typeof fetch = fetch): Promise<CommunityDiscussion> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetcher(`/api/community-discussion?discussion=${encodeURIComponent(discussion)}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`community discussion request failed: ${response.status}`);
    const payload: unknown = await response.json();
    if (!isDiscussion(payload)) throw new Error("community discussion response is invalid");
    return payload;
  } finally {
    window.clearTimeout(timeout);
  }
}
