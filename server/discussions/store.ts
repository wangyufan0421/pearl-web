import type { FetchStatus, SourceBlock, SourceRole, SourceType } from "./types.js";

export type DiscussionStatus = "draft" | "published";

export type DiscussionRecord = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: DiscussionStatus;
  primarySourceId: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredSource = {
  id: string;
  discussionId: string;
  xStatusId: string;
  url: string;
  role: SourceRole;
  author: string | null;
  handle: string | null;
  avatarUrl: string | null;
  publishedAt: string | null;
  fetchedAt: string | null;
  lastAttemptedAt: string;
  blocks: SourceBlock[];
  sourceType: SourceType | null;
  position: number;
  fetchStatus: FetchStatus;
  lastFetchError: string | null;
};

export type CreateDiscussionWithPrimaryInput = Omit<DiscussionRecord, "id" | "primarySourceId"> & {
  primary: Omit<StoredSource, "id" | "discussionId" | "role" | "position">;
};

export type PublicSource = Omit<StoredSource, "id" | "discussionId">;

export type PublicDiscussionCard = {
  slug: string;
  title: string;
  summary: string;
  description: string | null;
  primary: Pick<PublicSource, "xStatusId" | "url" | "author" | "handle" | "avatarUrl" | "publishedAt">;
  responseCount: number;
  latestRecordedAt: string;
  detailUrl: string;
};

export type PublicDiscussionDetail = {
  slug: string;
  title: string;
  description: string | null;
  sources: PublicSource[];
};

export type SourceWriteOutcome = {
  statusId: string;
  outcome: "created" | "duplicate" | "failed";
};

export type ResponseInsertInput = Omit<StoredSource, "id" | "position">;

export type ResponseInsertResult = {
  outcome: "created" | "duplicate";
};

export interface DiscussionStore {
  createDiscussionWithPrimary(input: CreateDiscussionWithPrimaryInput): Promise<{ discussion: DiscussionRecord; primary: StoredSource }>;
  getDiscussionBySlug(slug: string): Promise<DiscussionRecord | undefined>;
  getSourceByStatusId(statusId: string): Promise<StoredSource | undefined>;
  getSourceForDiscussion(slug: string, statusId: string): Promise<StoredSource | undefined>;
  insertSource(source: Omit<StoredSource, "id">): Promise<StoredSource>;
  createOrDuplicateResponse(source: ResponseInsertInput): Promise<ResponseInsertResult>;
  updateSource(source: StoredSource): Promise<StoredSource>;
  nextResponsePosition(discussionId: string): Promise<number>;
  listPublishedDiscussions(): Promise<PublicDiscussionCard[]>;
  getPublishedDiscussion(slug: string): Promise<PublicDiscussionDetail | undefined>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function publicSource(source: StoredSource): PublicSource {
  const { id: _id, discussionId: _discussionId, ...value } = source;
  return clone(value);
}

function primarySummary(source: StoredSource): string {
  const firstReadableBlock = source.blocks.map((block) => block.text.trim()).find(Boolean) ?? "";
  return firstReadableBlock.replace(/\s+/g, " ").slice(0, 200);
}

function orderedSources(sources: StoredSource[]): StoredSource[] {
  return sources.slice().sort((left, right) => {
    if (left.role !== right.role) return left.role === "primary" ? -1 : 1;
    if (left.publishedAt === null && right.publishedAt !== null) return 1;
    if (left.publishedAt !== null && right.publishedAt === null) return -1;
    if (left.publishedAt !== right.publishedAt) return (left.publishedAt ?? "").localeCompare(right.publishedAt ?? "");
    return left.position - right.position;
  });
}

export class InMemoryDiscussionStore implements DiscussionStore {
  private readonly discussions = new Map<string, DiscussionRecord>();
  private readonly sources = new Map<string, StoredSource>();
  private readonly sourceIds = new Map<string, string>();
  private nextId = 1;

  async createDiscussionWithPrimary(input: CreateDiscussionWithPrimaryInput) {
    if (this.discussions.has(input.slug)) throw new Error(`Discussion slug already exists: ${input.slug}`);
    if (this.sourceIds.has(input.primary.xStatusId)) throw new Error(`Source already exists: ${input.primary.xStatusId}`);
    const { primary: primaryInput, ...discussionInput } = input;
    const discussionId = `discussion-${this.nextId++}`;
    const primaryId = `source-${this.nextId++}`;
    const discussion: DiscussionRecord = { ...discussionInput, id: discussionId, primarySourceId: primaryId };
    const primary: StoredSource = { ...primaryInput, id: primaryId, discussionId, role: "primary", position: 0 };
    this.discussions.set(discussion.slug, clone(discussion));
    this.sources.set(primary.id, clone(primary));
    this.sourceIds.set(primary.xStatusId, primary.id);
    return { discussion: clone(discussion), primary: clone(primary) };
  }

  async getDiscussionBySlug(slug: string) {
    const value = this.discussions.get(slug);
    return value ? clone(value) : undefined;
  }

  async getSourceByStatusId(statusId: string) {
    const id = this.sourceIds.get(statusId);
    const value = id ? this.sources.get(id) : undefined;
    return value ? clone(value) : undefined;
  }

  async getSourceForDiscussion(slug: string, statusId: string) {
    const discussion = this.discussions.get(slug);
    const source = await this.getSourceByStatusId(statusId);
    return source && discussion?.id === source.discussionId ? source : undefined;
  }

  async insertSource(source: Omit<StoredSource, "id">) {
    if (this.sourceIds.has(source.xStatusId)) throw new Error(`Source already exists: ${source.xStatusId}`);
    const id = `source-${this.nextId++}`;
    const value = { ...source, id };
    this.sources.set(id, clone(value));
    this.sourceIds.set(value.xStatusId, id);
    return clone(value);
  }

  async createOrDuplicateResponse(source: ResponseInsertInput): Promise<ResponseInsertResult> {
    if (this.sourceIds.has(source.xStatusId)) return { outcome: "duplicate" };
    const position = [...this.sources.values()]
      .filter((item) => item.discussionId === source.discussionId && item.role === "response")
      .reduce((highest, item) => Math.max(highest, item.position), -1) + 1;
    const id = `source-${this.nextId++}`;
    const value: StoredSource = { ...source, id, position };
    this.sources.set(id, clone(value));
    this.sourceIds.set(value.xStatusId, id);
    return { outcome: "created" };
  }

  async updateSource(source: StoredSource) {
    if (!this.sources.has(source.id)) throw new Error(`Source does not exist: ${source.id}`);
    this.sources.set(source.id, clone(source));
    return clone(source);
  }

  async nextResponsePosition(discussionId: string) {
    const positions = [...this.sources.values()]
      .filter((source) => source.discussionId === discussionId && source.role === "response")
      .map((source) => source.position);
    return positions.length === 0 ? 0 : Math.max(...positions) + 1;
  }

  async listPublishedDiscussions() {
    const cards = [...this.discussions.values()]
      .filter((discussion) => discussion.status === "published")
      .map((discussion) => this.cardFor(discussion));
    return clone(cards);
  }

  async getPublishedDiscussion(slug: string) {
    const discussion = this.discussions.get(slug);
    if (!discussion || discussion.status !== "published") return undefined;
    const sources = orderedSources([...this.sources.values()].filter((source) => source.discussionId === discussion.id));
    return clone({ slug: discussion.slug, title: discussion.title, description: discussion.description, sources: sources.map(publicSource) });
  }

  private cardFor(discussion: DiscussionRecord): PublicDiscussionCard {
    const sources = [...this.sources.values()].filter((source) => source.discussionId === discussion.id);
    const primary = sources.find((source) => source.id === discussion.primarySourceId)!;
    const latestRecordedAt = sources.reduce((latest, source) => (source.lastAttemptedAt > latest ? source.lastAttemptedAt : latest), discussion.createdAt);
    return {
      slug: discussion.slug,
      title: discussion.title,
      summary: primarySummary(primary),
      description: discussion.description,
      primary: {
        xStatusId: primary.xStatusId,
        url: primary.url,
        author: primary.author,
        handle: primary.handle,
        avatarUrl: primary.avatarUrl,
        publishedAt: primary.publishedAt,
      },
      responseCount: sources.filter((source) => source.role === "response").length,
      latestRecordedAt,
      detailUrl: `/archive/community-discussion/${discussion.slug}`,
    };
  }
}
