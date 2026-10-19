# PRL Supply History Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one interactive observed-only issued/unissued PRL supply chart below the six existing supply cards.

**Architecture:** Preserve the upstream `projected` flag in the shared series parser. A focused chart module transforms the existing `supply` series into daily observed points and renders a fixed-cap stacked SVG with a hover readout. The valuation page passes its already-loaded supply result to this module; no new network request or data store is needed.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, existing CSS tokens and data runtime.

---

## File map

- Modify `src/data/prlstats.ts`: carry the projected point flag through parsing.
- Modify `src/data/prlstats.test.ts`: prove actual and projected flags survive parsing.
- Create `src/SupplyHistoryChart.tsx`: pure supply-series preparation and accessible chart interaction.
- Create `src/SupplyHistoryChart.test.tsx`: calculations, range, empty state, and hover behavior.
- Modify `src/ValuationPage.tsx`: place the chart after supply cards and pass the current supply result.
- Modify `src/styles/valuation.css`: visually integrate the chart and make it responsive.
- Modify `src/styles/valuation-adjustments.css` and `src/i18n/catalogue.ts`: inherit typography and translate new labels.

### Task 1: Preserve the upstream prediction flag

- [ ] **Step 1: Write a failing parser test.** Add to `src/data/prlstats.test.ts`:

```ts
it("preserves projected supply points so charts can omit forecasts", async () => {
  const response = jsonResponse([{ meta: { id: "supply", label: "Circulating supply", unit: "PRL" }, points: [
    { t: 1791423600, v: 338_000_000 },
    { t: 1794015600, v: 370_000_000, projected: true },
  ] }]);
  const result = await getMetricSeries("supply", async () => response);
  expect(result.data.points.map(point => point.projected)).toEqual([false, true]);
});
```

- [ ] **Step 2: Verify red.** Run `npm test -- src/data/prlstats.test.ts`; expect the new test to fail because `projected` is absent.
- [ ] **Step 3: Implement the minimal parser change.** In `src/data/prlstats.ts`, extend `MetricPoint` with `projected?: boolean`, include `projected?: unknown` in point parsing, and return `projected: value.projected === true` alongside timestamp/value.
- [ ] **Step 4: Verify green.** Run `npm test -- src/data/prlstats.test.ts`; expect all tests in the file to pass.
- [ ] **Step 5: Commit.** Stage only the parser and parser test; commit `feat: preserve projected metric points`.

### Task 2: Build the observed supply chart

- [ ] **Step 1: Write failing tests in `src/SupplyHistoryChart.test.tsx`.** Import `prepareSupplyHistory` and `SupplyHistoryChart` from the new module. Test that a future/projected point is excluded, each daily bucket keeps its last observed point, remaining PRL equals `2_100_000_000 - issued`, 30D and 90D use the final observed date, an empty series explains the absence of data, and a pointer movement shows date plus both quantities before pointer leave hides them. Use a known 840-pixel SVG bounding rectangle in the pointer test, matching the existing `PriceTrend` test pattern.
- [ ] **Step 2: Verify red.** Run `npm test -- src/SupplyHistoryChart.test.tsx`; expect failure because the module does not exist.
- [ ] **Step 3: Implement `prepareSupplyHistory(points, range, now)` in `src/SupplyHistoryChart.tsx`.** Use `SUPPLY_CAP = 2_100_000_000`; discard `projected === true`, future dates, nonfinite/out-of-range supply values; sort by timestamp; group by UTC day, retaining the latest observation; keep the first and last raw observations as boundaries; filter from the final observation minus 30 or 90 days, or keep all. Return `{ timestamp, issued, remaining }[]`. No interpolation.
- [ ] **Step 4: Implement `SupplyHistoryChart`.** Render inside a panel after the supply cards. Build two SVG area paths around the common issued-supply boundary, use a constant 0–2.1B Y range, render date/PRL axes and legend, and choose the nearest visible point from pointer X. The pointer tooltip must show date, issued PRL, and remaining PRL simultaneously. Provide 30D/90D/ALL controls, default 90D; render a syncing/no-data message for fewer than two valid points and call `DataFreshness` for the supplied result.
- [ ] **Step 5: Verify green.** Run `npm test -- src/SupplyHistoryChart.test.tsx`; expect all tests in the file to pass. Then run `npm test -- src/data/prlstats.test.ts src/SupplyHistoryChart.test.tsx`.
- [ ] **Step 6: Commit.** Stage the new component and tests; commit `feat: add observed PRL supply chart`.

### Task 3: Integrate and polish

- [ ] **Step 1: Write a failing page-level test.** In `src/ValuationPage.test.tsx`, render the page with stubbed data-runtime loaders and assert that the supply chart heading appears after the six supply cards, with a source note. This test must fail before integration.
- [ ] **Step 2: Verify red.** Run `npm test -- src/ValuationPage.test.tsx`; expect the chart assertion to fail.
- [ ] **Step 3: Integrate.** Import `SupplyHistoryChart` into `src/ValuationPage.tsx` and render `<SupplyHistoryChart result={metric("supply")} />` immediately after the `.supply-cards` grid. Add chart-specific CSS in `src/styles/valuation.css` and font overrides in `src/styles/valuation-adjustments.css`; translate the chart labels in `src/i18n/catalogue.ts`. Keep existing cards unchanged.
- [ ] **Step 4: Verify green.** Run `npm test -- src/ValuationPage.test.tsx src/SupplyHistoryChart.test.tsx`; expect passing results. Run `npm test` and `npm run build`; expect exit code 0.
- [ ] **Step 5: Visual check.** Load `/valuation` at desktop and narrow widths. Confirm panel placement, distinct layers, no overflow, hover values, range switches, and empty-state behavior. Fix any verified defects with a failing test first.
- [ ] **Step 6: Commit.** Stage the valuation page, integration test, CSS, and translations; commit `feat: show supply history below supply cards`.
