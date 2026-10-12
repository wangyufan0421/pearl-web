import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CommunityArticlePage from "./CommunityArticlePage";

afterEach(cleanup);

const sourcePayload = {
  discussion: "wtf-is-pearl",
  fetchedAt: "2026-10-11T00:00:00.000Z",
  sources: [
    { sourceId: "2108519545514410023", href: "https://x.com/blocmates/status/2108519545514410023?s=20", author: "blocmates.", handle: "@blocmates", avatar: "https://example.com/blocmates.jpg", blocks: [{ id: "article-1", kind: "paragraph", text: "blocmates 完整原文章节" }] },
    { sourceId: "2108528311735607793", href: "https://x.com/theoristalgo/status/2108528311735607793", author: "theoristalgo ™️ | ⓝ", handle: "@theoristalgo", avatar: "https://example.com/theorist.jpg", blocks: [{ id: "theorist-1", kind: "paragraph", text: "theoristalgo 社区回应全文" }] },
    { sourceId: "2108568857317118362", href: "https://x.com/tokugawasuprema/status/2108568857317118362", author: "Tokugawa The Gem General", handle: "@tokugawasuprema", avatar: "https://example.com/tokugawa.jpg", blocks: [{ id: "tokugawa-1", kind: "paragraph", text: "Tokugawa 社区回应全文" }] },
    { sourceId: "2108579196268077447", href: "https://x.com/tulipking/status/2108579196268077447?s=20", author: "Tulip King 🌷", handle: "@tulipking", avatar: "https://example.com/tulip.jpg", blocks: [{ id: "reply-1", kind: "paragraph", text: "Show more 后的完整辩论内容" }] },
    { sourceId: "2108928836780065031", href: "https://x.com/KiwiCryptoBig/status/2108928836780065031", author: "Kiwibig.eth", handle: "@KiwiCryptoBig", avatar: "https://example.com/kiwi.jpg", blocks: [{ id: "kiwi-1", kind: "paragraph", text: "Kiwibig 中文社区回应全文" }] },
  ],
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => sourcePayload })));
});

describe("CommunityArticlePage", () => {
  it("presents the complete article and its debate as opposite-side scrollable source frames", async () => {
    render(<CommunityArticlePage />);

    expect(await screen.findByText("blocmates 完整原文章节")).not.toBeNull();
    expect(screen.getByText("theoristalgo 社区回应全文")).not.toBeNull();
    expect(screen.getByText("Tokugawa 社区回应全文")).not.toBeNull();
    expect(screen.getByText("Show more 后的完整辩论内容")).not.toBeNull();
    expect(screen.getByText("Kiwibig 中文社区回应全文")).not.toBeNull();
    expect(screen.getAllByTestId(/community-dialogue-/)).toHaveLength(5);
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "在 X 查看原文" })).toHaveLength(5);
  });

  it("does not retain the old article summary sections", () => {
    render(<CommunityArticlePage />);

    expect(screen.queryByRole("heading", { name: "文章如何描述 Pearl" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "为什么会被拿来和 Nockchain 比较" })).toBeNull();
  });
});
