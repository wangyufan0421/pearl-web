import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DataStatusSummary } from "./DataStatusSummary";
afterEach(cleanup);
it("names each saved dataset and warns when a non-chart dataset is stale", () => {
  render(<DataStatusSummary items={[
    { label: "网络概览", result: { data: {}, sourceKind: "live", fetchedAt: new Date("2026-10-12T00:00:00Z"), stale: true } },
    { label: "PRL 市场参考价", result: { data: {}, sourceKind: "live", fetchedAt: new Date("2026-10-12T00:01:00Z") } },
  ]} />);
  expect(screen.getByText("部分数据暂用上次成功结果，后台仍在更新。")).toBeTruthy();
  expect(screen.getByText("网络概览")).toBeTruthy(); expect(screen.getByText("PRL 市场参考价")).toBeTruthy();
  expect(document.querySelectorAll("time")).toHaveLength(2);
});
