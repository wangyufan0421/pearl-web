import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const card = { slug: "existing-debate", title: "Existing discussion", summary: "Original source summary", description: null, primary: { xStatusId: "123", url: "https://x.com/source/status/123", author: "Source", handle: "@source", avatarUrl: null, publishedAt: null }, responseCount: 0, latestRecordedAt: "2026-10-12T00:00:00Z", detailUrl: "/archive/community-discussion/existing-debate" };
const source = { ...card.primary, role: "primary", fetchedAt: null, lastAttemptedAt: "2026-10-12T00:00:00Z", blocks: [], sourceType: "article", position: 0, fetchStatus: "success", lastFetchError: null };
const detail = { slug: card.slug, title: card.title, description: null, sources: [source] };
const response = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response;

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); window.history.replaceState({}, "", "/en/admin/community-discussions");
  vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
    if (input === "/api/admin/community-discussions" && init?.method === "GET") return response({ authorized: true });
    if (input === "/api/admin/community-discussions" && init?.method === "POST") return response({ discussion: { slug: "new-debate", title: "New debate", status: "published" }, detailUrl: "/archive/community-discussion/new-debate" }, 201);
    if (input === "/api/community-discussions") return response({ discussions: [card] });
    if (input.startsWith("/api/community-discussion?slug=")) return response({ ...detail, slug: input.split("=")[1] });
    if (input.endsWith("/sources")) return response({ outcomes: [{ statusId: "124", outcome: "created" }, { statusId: "125", outcome: "duplicate" }, { statusId: "126", outcome: "failed" }] });
    if (input.endsWith("/refresh")) return response({ source: { xStatusId: "126", fetchStatus: "success" } });
    return response({}, 503);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); window.history.replaceState({}, "", "/"); });

async function authenticate() {
  fireEvent.change(screen.getByLabelText("Admin token"), { target: { value: "test-admin-token" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify token" }));
  await screen.findByText("Admin token verified.");
}

describe("community administrator page", () => {
  it("shows only verification before admitting an administrator", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Community administration", level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create and publish discussion" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Main article X link")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Response X links")).not.toBeInTheDocument();
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex,nofollow");
  });
  it("keeps the entry forms hidden after an invalid key", async () => {
    vi.mocked(fetch).mockImplementation(async () => response({ error: "unauthorized" }, 401));
    render(<App />);
    fireEvent.change(screen.getByLabelText("Admin token"), { target: { value: "wrong-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify token" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByLabelText("Main article X link")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Response X links")).not.toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([input]) => input === "/api/community-discussions")).toBe(false);
  });
  it("verifies a bearer token without storing it in the browser or URL", async () => {
    render(<App />); await authenticate();
    expect(fetch).toHaveBeenCalledWith("/api/admin/community-discussions", expect.objectContaining({ method: "GET", headers: expect.objectContaining({ Authorization: "Bearer test-admin-token" }) }));
    expect(JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } })).not.toContain("test-admin-token");
    expect(window.location.href).not.toContain("test-admin-token");
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(screen.getByLabelText("Admin token")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Create and publish discussion" })).not.toBeInTheDocument();
  });
  it("creates a published discussion from a pasted main article link", async () => {
    render(<App />); await authenticate();
    fireEvent.change(screen.getByLabelText("Main article X link"), { target: { value: "https://x.com/source/status/123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create and publish discussion" }));
    expect(await screen.findByText("Discussion created and published." )).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/admin/community-discussions", expect.objectContaining({ method: "POST", body: JSON.stringify({ primaryUrl: "https://x.com/source/status/123", status: "published" }) }));
    expect(screen.getByRole("link", { name: "Open published discussion" })).toHaveAttribute("href", "/en/archive/community-discussion/new-debate");
  });
  it("submits response links and displays individual outcomes with retry", async () => {
    render(<App />); await authenticate();
    await screen.findByRole("option", { name: card.title });
    fireEvent.change(screen.getByLabelText("Select discussion"), { target: { value: card.slug } });
    fireEvent.change(screen.getByLabelText("Response X links"), { target: { value: "https://x.com/a/status/124\nhttps://x.com/b/status/125\nhttps://x.com/c/status/126" } });
    fireEvent.click(screen.getByRole("button", { name: "Add responses" }));
    expect(await screen.findByText("Added")).toBeInTheDocument();
    expect(screen.getByText("Already archived")).toBeInTheDocument();
    expect(screen.getByText("Fetch failed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry source 126" }));
    expect(await screen.findByText("Source refreshed successfully.")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(`/api/admin/community-discussions/${card.slug}/sources/126/refresh`, expect.objectContaining({ method: "POST" }));
  });
  it("rejects non-X links before performing a write", async () => {
    render(<App />); await authenticate();
    fireEvent.change(screen.getByLabelText("Main article X link"), { target: { value: "https://example.com/article" } });
    fireEvent.click(screen.getByRole("button", { name: "Create and publish discussion" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Use X or Twitter status links.");
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  });
  it("clears authorization if the server rejects a later write", async () => {
    render(<App />); await authenticate();
    vi.mocked(fetch).mockImplementation(async (_input, init) => init?.method === "POST" ? response({ error: "unauthorized" }, 401) : response({ discussions: [card] }));
    fireEvent.change(screen.getByLabelText("Main article X link"), { target: { value: "https://x.com/source/status/123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create and publish discussion" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Admin token is invalid or expired. Verify it again.");
    expect(screen.queryByRole("button", { name: "Create and publish discussion" })).not.toBeInTheDocument();
  });
  it("keeps authorization and form input when switching the UI language", async () => {
    render(<App />); await authenticate();
    fireEvent.change(screen.getByLabelText("Main article X link"), { target: { value: "https://x.com/source/status/123" } });
    fireEvent.click(screen.getByRole("button", { name: /^中文$/ }));
    expect(screen.getByRole("heading", { name: "社区讨论管理", level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText("主文章 X 链接")).toHaveValue("https://x.com/source/status/123");
    expect(screen.getByRole("button", { name: "创建并发布讨论" })).toBeEnabled();
  });
  it("does not apply a late write response after the administrator logs out", async () => {
    render(<App />); await authenticate();
    let complete!: (result: Response) => void;
    const previous = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation((input, init) => init?.method === "POST" ? new Promise<Response>(resolve => { complete = resolve; }) : previous(input, init));
    fireEvent.change(screen.getByLabelText("Main article X link"), { target: { value: "https://x.com/source/status/123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create and publish discussion" }));
    await waitFor(() => expect(complete).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await act(async () => { complete(response({ discussion: { slug: "new-debate", title: "New debate", status: "published" }, detailUrl: "/archive/community-discussion/new-debate" }, 201)); });
    expect(screen.queryByText("Discussion created and published.")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open published discussion" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create and publish discussion" })).not.toBeInTheDocument();
  });
});
