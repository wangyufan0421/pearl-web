import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const originalText = "社区原帖中文正文：不应翻译或截断。";
const primary = { xStatusId: "123", url: "https://x.com/author/status/123", role: "primary", author: "Author", handle: "@author", avatarUrl: null, publishedAt: "2026-10-09T00:00:00Z", fetchedAt: "2026-10-10T00:00:00Z", lastAttemptedAt: "2026-10-10T00:00:00Z", blocks: [{ id: "main", kind: "paragraph", text: originalText }], sourceType: "article", position: 0, fetchStatus: "success", lastFetchError: null };
const response = { ...primary, xStatusId: "124", role: "response", url: "https://x.com/reply/status/124", author: "Responder", handle: "@reply", position: 1, fetchStatus: "failed", blocks: [{ id: "reply", kind: "quote", text: "Full original response." }] };
const card = { slug: "new-pearl-debate", title: "A newly archived debate", summary: originalText, description: null, primary, responseCount: 1, latestRecordedAt: "2026-10-10T00:00:00Z", detailUrl: "/archive/community-discussion/new-pearl-debate" };
const detail = { slug: card.slug, title: card.title, description: null, sources: [primary, response] };

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    if (input === "/api/community-discussions") return { ok: true, json: async () => ({ discussions: [card] }) };
    if (input === "/api/community-discussion?slug=new-pearl-debate") return { ok: true, json: async () => detail };
    return { ok: false, status: 503, json: async () => ({ error: "discussion_unavailable" }) };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); window.history.replaceState({}, "", "/"); localStorage.clear(); });

describe("persistent community frontend", () => {
  it("defaults to saved Chinese translations in Chinese mode and can show the untouched original", async () => {
    vi.mocked(fetch).mockImplementation(async input => input === `/api/community-discussion?slug=${card.slug}` ? { ok: true, json: async () => ({ ...detail, sources: [{ ...primary, blocks: [{ id: "main", kind: "paragraph", text: "Complete English original.", translationZh: "完整的中文译文。" }] }] }) } as Response : { ok: false } as Response);
    window.history.replaceState({}, "", `/archive/community-discussion/${card.slug}`);
    render(<App />);
    expect(await screen.findByText("完整的中文译文。")).toBeInTheDocument();
    expect(screen.queryByText("Complete English original.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "英文原文" }));
    expect(screen.getByText("Complete English original.")).toBeInTheDocument();
  });
  it.each(["/archive/community-discussion", "/en/archive/community-discussion"])("opens the actual list at %s and links API-provided discussions", async path => {
    window.history.replaceState({}, "", path);
    render(<App />);
    const link = await screen.findByRole("link", { name: card.title });
    expect(link).toHaveAttribute("href", `${path}/${card.slug}`);
    expect(screen.queryByRole("heading", { name: "What is Pearl?" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pearl 是什么" })).not.toBeInTheDocument();
  });
  it("redirects the old English archive anchor to the discussion list", async () => {
    window.history.replaceState({}, "", "/en/archive?from=menu#community-discussion");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Community discussions", level: 1 })).toBeInTheDocument();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/en/archive/community-discussion?from=menu");
  });
  it("keeps the URL language when history opens an English legacy link from a Chinese page", async () => {
    window.history.replaceState({}, "", "/chain");
    render(<App />);
    await act(async () => { window.history.replaceState({}, "", "/en/archive#community-discussion"); window.dispatchEvent(new PopStateEvent("popstate")); });
    expect(await screen.findByRole("heading", { name: "Community discussions", level: 1 })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/en/archive/community-discussion");
  });
  it("renders full source blocks in English mode without translating original posts", async () => {
    window.history.replaceState({}, "", `/en/archive/community-discussion/${card.slug}`);
    render(<App />);
    expect(await screen.findByText(originalText)).toBeInTheDocument();
    expect(screen.getByText("Full original response.")).toBeInTheDocument();
    expect(screen.getAllByTestId("community-dialogue-message").map(node => node.getAttribute("data-side"))).toEqual(["left", "right"]);
    expect(screen.getByText("Update unavailable; showing the saved source.")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /View original on X/ })[0]).toHaveAttribute("href", primary.url);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(`/api/community-discussion?slug=${card.slug}`, expect.any(Object));
  });
  it("keeps the discussion and original text when switching language", async () => {
    window.history.replaceState({}, "", `/archive/community-discussion/${card.slug}`);
    render(<App />);
    await screen.findByText(originalText);
    const beforeSwitch = vi.mocked(fetch).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(window.location.pathname).toBe(`/en/archive/community-discussion/${card.slug}`);
    expect(screen.getByText(originalText)).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.length).toBe(beforeSwitch);
  });
  it("shows a service error and retry without replacing the page with the homepage", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response);
    window.history.replaceState({}, "", "/en/archive/community-discussion");
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Discussions are temporarily unavailable. Please try again later.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
  it("shows an honest empty state when the database has no published discussions", async () => {
    vi.mocked(fetch).mockImplementation(async input => input === "/api/community-discussions" ? { ok: true, json: async () => ({ discussions: [] }) } as Response : { ok: false } as Response);
    window.history.replaceState({}, "", "/en/archive/community-discussion");
    render(<App />);
    expect(await screen.findByText("No published discussions yet.")).toBeInTheDocument();
  });
  it("refreshes on focus and retains sources if the refresh fails", async () => {
    window.history.replaceState({}, "", `/en/archive/community-discussion/${card.slug}`);
    render(<App />);
    await screen.findByText(originalText);
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response);
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(originalText)).toBeInTheDocument();
  });
  it("shows a missing-discussion state for an unknown slug", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404 } as Response);
    window.history.replaceState({}, "", "/en/archive/community-discussion/missing");
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This discussion was not found or has not been published.");
  });
});
