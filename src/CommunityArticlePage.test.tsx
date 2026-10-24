import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CommunityArticlePage from "./CommunityArticlePage";
import { LanguageProvider } from "./i18n/Language";

function source(id: string, role: "primary" | "response", authorUserId: string, parentStatusId: string | null) {
  return {
    xStatusId: id, url: `https://x.com/test/status/${id}`, role, authorUserId, parentStatusId,
    author: `Author ${authorUserId}`, handle: `author${authorUserId}`, avatarUrl: null,
    publishedAt: null, fetchedAt: null, lastAttemptedAt: "2026-10-21T00:00:00Z",
    blocks: [{ id, kind: "paragraph", text: `Text ${id}` }], sourceType: "tweet",
    position: Number(id), fetchStatus: "success", lastFetchError: null,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true, json: async () => ({ slug: "example", title: "Example", description: null, sources: [
      source("100", "primary", "1", null), source("200", "response", "2", "100"),
      source("300", "response", "1", "200"), source("400", "response", "3", "300"),
    ] }),
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });

describe("saved discussion branches", () => {
  it("places the original author left, others right, and expands descendants on demand", async () => {
    render(<LanguageProvider><CommunityArticlePage slug="example" /></LanguageProvider>);
    await waitFor(() => expect(screen.getAllByTestId("community-dialogue-message")).toHaveLength(2));
    const initial = screen.getAllByTestId("community-dialogue-message");
    expect(initial[0]).toHaveAttribute("data-side", "left");
    expect(initial[1]).toHaveAttribute("data-side", "right");
    expect(screen.queryByText("Text 300")).not.toBeInTheDocument();
    fireEvent.click(within(initial[1]).getByRole("button", { name: /展开.*回应/ }));
    const expanded = screen.getAllByTestId("community-dialogue-message");
    expect(expanded).toHaveLength(3);
    expect(expanded[2]).toHaveAttribute("data-side", "left");
    fireEvent.click(within(expanded[2]).getByRole("button", { name: /展开.*回应/ }));
    expect(screen.getAllByTestId("community-dialogue-message")).toHaveLength(4);
    fireEvent.click(within(initial[1]).getByRole("button", { name: /收起.*回应/ }));
    expect(screen.getAllByTestId("community-dialogue-message")).toHaveLength(2);
  });
});
