import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import CoreMechanismPage from "./CoreMechanismPage";

afterEach(cleanup);

describe("CoreMechanismPage", () => {
  it("presents the mechanism as a structured field guide", () => {
    render(<CoreMechanismPage />);

    expect(screen.getByRole("heading", { name: "核心机制" })).not.toBeNull();
    expect(screen.getByText("同一次计算，两头办事")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "算力实际怎么走" })).not.toBeNull();
    expect(screen.getByText("请求进来")).not.toBeNull();
    expect(screen.getByText("Pearl-GEMM：为什么机制讨论会转向浮点")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "机制背后的经济说法" })).not.toBeNull();
    expect(screen.getByText("用四句话收束「核心机制」")).not.toBeNull();
  });
});
