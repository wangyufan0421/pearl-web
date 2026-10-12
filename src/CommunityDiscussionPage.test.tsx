import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import CommunityDiscussionPage from "./CommunityDiscussionPage";

afterEach(cleanup);

describe("CommunityDiscussionPage", () => {
  it("presents the first curated Pearl discussion as one white X source card", () => {
    render(<CommunityDiscussionPage />);

    expect(screen.getByRole("heading", { name: "Pearl社区讨论" })).not.toBeNull();
    expect(screen.getAllByTestId("x-source-card")).toHaveLength(1);
    expect(screen.getByText("WTF Is Pearl? Why Is Everyone Comparing It to Nockchain?")).not.toBeNull();
    expect(screen.queryByText("Pearl 作为 AI Bitcoin？")).toBeNull();
    expect(screen.queryByRole("heading", { name: "这场讨论到底在争什么" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "已收录的评论切片" })).toBeNull();
  });

  it("keeps the original X posts available as sources", () => {
    render(<CommunityDiscussionPage />);

    expect(screen.getByRole("link", { name: "查看 blocmates 原文" }).getAttribute("href")).toBe("https://x.com/blocmates/status/2108519545514410023?s=20");
    expect(screen.queryByRole("link", { name: "查看 Tulip King 原文" })).toBeNull();
  });

  it("opens the article discussion from the card itself", () => {
    render(<CommunityDiscussionPage />);

    expect(screen.getByRole("link", { name: "进入 WTF Is Pearl? 讨论页" }).getAttribute("href")).toBe("/archive/community-discussion/wtf-is-pearl");
  });
});
