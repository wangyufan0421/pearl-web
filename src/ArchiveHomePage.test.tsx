import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ArchiveHomePage from "./ArchiveHomePage";

afterEach(cleanup);

describe("ArchiveHomePage", () => {
  it("opens with Pearl's definition and the data overview entry", () => {
    render(<ArchiveHomePage />);

    expect(screen.getByRole("heading", { name: "Pearl 是什么" })).not.toBeNull();
    expect(screen.getByText(/PoUW 区块链/)).not.toBeNull();
    expect(screen.getByRole("link", { name: /查看数据总览/ }).getAttribute("href")).toBe("/overview");
  });

  it("links its four exploration cards to content anchors", () => {
    render(<ArchiveHomePage />);

    expect(screen.getByRole("link", { name: /Duplex Work/ }).getAttribute("href")).toBe("#duplex-work");
    expect(screen.getByRole("link", { name: /挖矿如何嵌入计算/ }).getAttribute("href")).toBe("#mining-flow");
    expect(screen.getByRole("link", { name: /Pearl-GEMM/ }).getAttribute("href")).toBe("#pearl-gemm");
    expect(screen.getByRole("link", { name: /两套里程碑/ }).getAttribute("href")).toBe("#milestones");
  });
});
