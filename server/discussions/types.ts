export type SourceBlock = {
  id: string;
  kind: "heading" | "quote" | "paragraph";
  text: string;
};

export type SourceType = "tweet" | "noteTweet" | "article";

export type SourceRole = "primary" | "response";

export type FetchStatus = "success" | "failed";

export type FetchedSource = {
  xStatusId: string;
  url: string;
  author: string | null;
  handle: string | null;
  avatarUrl: string | null;
  publishedAt: string | null;
  fetchedAt: string;
  blocks: SourceBlock[];
  sourceType: SourceType;
  title: string | null;
};
