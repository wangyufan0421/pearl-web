import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import WhitepaperPage from "./WhitepaperPage";

afterEach(cleanup);

describe("WhitepaperPage", () => {
  it("embeds the original PDF and retains a direct-reading fallback", () => {
    render(<WhitepaperPage />);

    expect(screen.getByRole("heading", { name: "Pearl 白皮书" })).not.toBeNull();
    expect(screen.getByRole("region", { name: "可滚动的白皮书阅读器" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "在新窗口打开原文" }).getAttribute("href")).toBe("/documents/pearl-whitepaper.pdf");
  });
});
