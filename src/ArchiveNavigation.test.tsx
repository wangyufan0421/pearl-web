import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ArchiveNavigation } from "./ArchiveNavigation";

afterEach(cleanup);

describe("ArchiveNavigation", () => {
  it("keeps the archive homepage link and provides all five archive entries", () => {
    render(<nav aria-label="主导航"><ArchiveNavigation /></nav>);

    expect(screen.getByRole("link", { name: "Pearl档案" }).getAttribute("href")).toBe("/archive");
    expect(screen.getByRole("link", { name: "Pearl 核心机制" }).getAttribute("href")).toBe("/archive/core-mechanism");
    expect(screen.getByRole("link", { name: "Pearl社区讨论" }).getAttribute("href")).toBe("/archive#community-discussion");
    expect(screen.getByRole("link", { name: "Pearl白皮书" }).getAttribute("href")).toBe("/archive/whitepaper");
    expect(screen.getByRole("link", { name: "Pearl相关文章" }).getAttribute("href")).toBe("/archive/articles");
    expect(screen.getByRole("link", { name: "Pearl人物与关系" }).getAttribute("href")).toBe("/archive/people");
  });
});
