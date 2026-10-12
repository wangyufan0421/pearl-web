import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PeoplePage from "./PeoplePage";

afterEach(cleanup);

describe("PeoplePage", () => {
  it("separates public facts, anonymous capability, and editorial inference", () => {
    render(<PeoplePage />);

    expect(screen.getByRole("heading", { name: "Pearl人物与关系" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "匿名工程能力地图" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "合作方推测板" })).not.toBeNull();
    expect(screen.getAllByTestId("public-person-card")).toHaveLength(4);
    expect(screen.getAllByTestId("anonymous-role")).toHaveLength(15);
  });

  it("keeps every relationship record explicit about evidentiary limits", () => {
    render(<PeoplePage />);

    expect(screen.getAllByText("证明到哪")).toHaveLength(5);
    expect(screen.getAllByText("证不到哪")).toHaveLength(5);
    expect(screen.queryByText("85%")).toBeNull();
  });
});
