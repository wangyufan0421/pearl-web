import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ArticlesPage from "./ArticlesPage";

afterEach(cleanup);

describe("ArticlesPage", () => {
  it("presents all curated sources as one flat set of research cards", () => {
    render(<ArticlesPage />);

    expect(screen.getByRole("heading", { name: "Pearl相关文章" })).not.toBeNull();
    expect(screen.getAllByTestId("article-card")).toHaveLength(16);
  });

  it("links an external paper and the internal INT whitepaper reader", () => {
    render(<ArticlesPage />);

    expect(screen.getByRole("link", { name: "Proofs of Useful Work from Arbitrary Matrix Multiplication" }).getAttribute("href")).toBe("https://arxiv.org/abs/2504.09971");
    expect(screen.getByRole("link", { name: "Pearl INT 白皮书" }).getAttribute("href")).toBe("/archive/whitepaper");
  });

  it("includes English community long-form thesis threads", () => {
    render(<ArticlesPage />);

    expect(screen.getByRole("link", { name: "Pearl thesis: PoUW / Duplex vs Bitcoin security budget" }).getAttribute("href")).toBe("https://x.com/brezshares/status/2098035744598319569");
    expect(screen.getByRole("link", { name: "How I got into Pearl / Tom Schmidt thesis breakdown" }).getAttribute("href")).toBe("https://x.com/andyyy/status/2108099827930124377");
    expect(screen.getByRole("link", { name: "Pearl as AI Bitcoin" }).getAttribute("href")).toBe("https://x.com/tulipking/status/2108579196268077447");
  });
});
