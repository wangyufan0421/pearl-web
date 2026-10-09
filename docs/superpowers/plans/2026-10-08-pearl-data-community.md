# Pearl 中文社区数据站 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive, one-page Chinese Pearl data community site with a pearl-white iridescent visual system, live PRL network and market data, history charts, and transparent methodology labels.

**Architecture:** A Vite + React + TypeScript single-page app renders a sectioned long-form data dashboard. A narrow `prlstats` client isolates remote API schemas, normalizes snapshots and series, and falls back to fixtures when an endpoint is unavailable. In development, Vite proxies `/api/prlstats/*` to avoid the remote API's missing CORS headers; production deployment needs an equivalent same-origin proxy route.

**Tech Stack:** Vite, React, TypeScript, CSS Modules or plain scoped CSS, Recharts, Zod, Vitest, Testing Library.

---

## Verified remote API contract

- `GET https://prlstats.com/api/network` returns a JSON snapshot with `ts`, `height`, `difficulty`, `hashrate_hs`, `avg_block_time_s`, `target_block_s`, `supply_prl`, `supply_pct`, `subsidy_prl`, and `emission_prl_day`.
- `GET https://prlstats.com/api/metrics` returns metric metadata including an ID, label, unit, source, method and caveat.
- `GET https://prlstats.com/api/series?m=price` returns an array whose first entry contains `{ meta, points }`, with timestamp/value point pairs.
- The verified endpoints do not advertise CORS headers. Do not make browser-to-remote requests directly; use `/api/prlstats/*` locally and the same path in production.

## File map

| File | Responsibility |
| --- | --- |
| `package.json` | Frontend commands and dependencies. |
| `vite.config.ts` | Development proxy from `/api/prlstats` to `https://prlstats.com`. |
| `src/main.tsx` | Application entry point. |
| `src/App.tsx` | One-page route, data loading orchestration, fallback state. |
| `src/styles/tokens.css` | Pearl visual tokens, typography, responsive scales. |
| `src/styles/app.css` | Long-page layout, iridescent sections, cards and responsive rules. |
| `src/data/schema.ts` | Zod contracts and normalized TypeScript types. |
| `src/data/prlstats.ts` | Fetch, parse, normalize, cache and error handling for remote data. |
| `src/data/fixtures.ts` | Honest fallback data labeled as sample / unavailable. |
| `src/lib/format.ts` | Currency, hash rate, supply, time and percentage formatting. |
| `src/components/MetricCard.tsx` | Accessible summary metric. |
| `src/components/SectionHeader.tsx` | Shared section label, Chinese explanation, source and freshness metadata. |
| `src/components/TrendChart.tsx` | Responsive line chart with 7D / 30D controls. |
| `src/components/HeroOverview.tsx` | Live overview and status rail. |
| `src/components/NetworkSection.tsx` | Hashrate, difficulty, block timing and supply. |
| `src/components/MiningSection.tsx` | Cost / profitability state and clearly labeled model assumptions. |
| `src/components/ChainSection.tsx` | Pools, activity, transfers and holders with explicit unavailable states. |
| `src/components/ValuationSection.tsx` | Price, FDV and BTC-relative valuation. |
| `src/components/AiSection.tsx` | AI data status and mining-during-inference explanation. |
| `src/components/MethodSection.tsx` | Sources, caveats, update state and reserved protocol-version area. |
| `public/assets/pearl-iridescent-background.png` | Generated original background asset, no source-image text, logo or buildings. |
| `public/favicon.svg` | Pearl-style monochrome favicon. |
| `src/data/schema.test.ts` | API parse and normalization tests. |
| `src/data/prlstats.test.ts` | Client fallback and URL construction tests. |
| `src/lib/format.test.ts` | Formatter tests. |

### Task 1: Scaffold the application shell

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/app.css`
- Create: `public/favicon.svg`

- [ ] **Step 1: Create a Vite React TypeScript project in the workspace root without overwriting `output/`, `tmp/`, or translation files.**

  Use `npm create vite@latest . -- --template react-ts` only after backing up or preserving non-starter workspace files. Add the following scripts and dependencies:

  ```json
  {
    "scripts": {
      "dev": "vite",
      "build": "tsc -b && vite build",
      "test": "vitest run"
    },
    "dependencies": {
      "@vitejs/plugin-react": "latest",
      "recharts": "latest",
      "react": "latest",
      "react-dom": "latest",
      "zod": "latest"
    },
    "devDependencies": {
      "@testing-library/react": "latest",
      "@testing-library/jest-dom": "latest",
      "jsdom": "latest",
      "typescript": "latest",
      "vite": "latest",
      "vitest": "latest"
    }
  }
  ```

- [ ] **Step 2: Configure the development proxy and test it manually.**

  In `vite.config.ts`, proxy only the dedicated local prefix:

  ```ts
  import { defineConfig } from "vite";
  import react from "@vitejs/plugin-react";

  export default defineConfig({
    plugins: [react()],
    server: {
      proxy: {
        "/api/prlstats": {
          target: "https://prlstats.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/prlstats/, ""),
        },
      },
    },
  });
  ```

  Run `npm run dev -- --host 127.0.0.1` and confirm `/api/prlstats/api/network` returns JSON through the local server.

- [ ] **Step 3: Establish the visual token system and base shell.**

  Define warm pearl surfaces, ink colors, restrained rose/blue/yellow accents, typography stacks, spacing, and chart colors in `tokens.css`. `App.tsx` must render a semantic landmark shell with a sticky header, anchor navigation and an empty loading section; do not use generic dashboard sidebars.

- [ ] **Step 4: Build the base shell.**

  ```tsx
  export function App() {
    return (
      <main className="site-shell">
        <header className="topbar" aria-label="主导航">
          <a className="brand" href="#overview">Pearl <span>中文社区</span></a>
          <nav aria-label="数据导航">
            <a href="#network">网络</a><a href="#mining">挖矿</a>
            <a href="#chain">链上</a><a href="#valuation">估值</a>
            <a href="#ai">AI</a><a href="#method">方法</a>
          </nav>
          <span className="coming-soon">文本 · 即将上线</span>
        </header>
        <section id="overview" aria-label="Pearl 数据总览" />
      </main>
    );
  }
  ```

- [ ] **Step 5: Run `npm run build`.**

  Expected: Vite writes a production bundle to `dist/` with no TypeScript errors.

### Task 2: Implement the data contract and test-first client

**Files:**
- Create: `src/data/schema.ts`
- Create: `src/data/prlstats.ts`
- Create: `src/data/fixtures.ts`
- Create: `src/data/schema.test.ts`
- Create: `src/data/prlstats.test.ts`

- [ ] **Step 1: Write schema tests before implementation.**

  ```ts
  import { describe, expect, it } from "vitest";
  import { parseNetworkSnapshot } from "./schema";

  describe("parseNetworkSnapshot", () => {
    it("normalizes a valid prlstats network response", () => {
      expect(parseNetworkSnapshot({
        ts: 1791423735, height: 124752, difficulty: 34714717.88,
        hashrate_hs: 4.78e19, avg_block_time_s: 204.2,
        target_block_s: 194, supply_prl: 338047273.6,
        supply_pct: 16.09, subsidy_prl: 2273.55, emission_prl_day: 1011969,
      }).hashrateHs).toBe(4.78e19);
    });
    it("rejects a non-numeric hashrate", () => {
      expect(() => parseNetworkSnapshot({ hashrate_hs: "unknown" })).toThrow();
    });
  });
  ```

- [ ] **Step 2: Implement Zod schemas and normalized types.**

  ```ts
  export const networkSchema = z.object({
    ts: z.number(), height: z.number(), difficulty: z.number(),
    hashrate_hs: z.number(), avg_block_time_s: z.number(),
    target_block_s: z.number(), supply_prl: z.number(), supply_pct: z.number(),
    subsidy_prl: z.number(), emission_prl_day: z.number(),
  });
  export type NetworkSnapshot = {
    updatedAt: Date; height: number; difficulty: number; hashrateHs: number;
    avgBlockTimeSeconds: number; targetBlockSeconds: number; supplyPrl: number;
    supplyPercent: number; subsidyPrl: number; emissionPrlDay: number;
  };
  ```

- [ ] **Step 3: Write client tests for a successful request and fixture fallback.**

  ```ts
  it("requests the same-origin proxy path", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(networkPayload));
    await getNetworkSnapshot(fetcher);
    expect(fetcher).toHaveBeenCalledWith("/api/prlstats/api/network", expect.any(Object));
  });

  it("returns a labeled fallback when the endpoint fails", async () => {
    const result = await getNetworkSnapshot(async () => { throw new Error("offline"); });
    expect(result.sourceKind).toBe("fallback");
  });
  ```

- [ ] **Step 4: Implement the client.**

  `getNetworkSnapshot` and `getSeries(metricId)` must accept an optional `fetch` implementation for tests, use an abort timeout, parse via Zod, and return `{ data, sourceKind: "live" | "fallback", fetchedAt }`. Use a fixture only after a failed request; do not treat fixture values as real-time data.

- [ ] **Step 5: Run `npm test -- --runInBand` and `npm run build`.**

  Expected: data parsing and fallback behavior pass before UI components consume the client.

### Task 3: Generate and integrate the background asset

**Files:**
- Create: `public/assets/pearl-iridescent-background.png`
- Modify: `src/styles/app.css`

- [ ] **Step 1: Generate one original background from the supplied images as references.**

  Prompt: “Wide website background, warm pearl-white paper base, extremely subtle low-saturation cloudy refractions in powder blue, blush pink, pale butter yellow and light lavender, irregular diffuse light pools, faint elegant grey arc outlines at very low opacity, airy editorial data-lab atmosphere, no text, no lettering, no logos, no buildings, no products, no watermark, 16:9.”

- [ ] **Step 2: Inspect the generated asset before use.**

  Reject it if it includes readable text, logos, building imagery, a hard rainbow band, high-contrast shapes, or a busy pattern.

- [ ] **Step 3: Integrate it as an atmospheric layer rather than a content background.**

  ```css
  .site-shell::before {
    content: "";
    position: fixed;
    inset: 0;
    z-index: -2;
    background: #f7f6f1 url("/assets/pearl-iridescent-background.png") center top / cover no-repeat;
    opacity: .72;
    pointer-events: none;
  }
  .data-panel { background: color-mix(in srgb, #fbfaf6 84%, transparent); }
  ```

- [ ] **Step 4: Verify contrast with browser dev tools.**

  Text must retain at least WCAG AA contrast against its rendered card or section surface; charts must use explicit colors rather than the backdrop for data encoding.

### Task 4: Build overview, network and valuation sections

**Files:**
- Create: `src/lib/format.ts`
- Create: `src/lib/format.test.ts`
- Create: `src/components/MetricCard.tsx`
- Create: `src/components/SectionHeader.tsx`
- Create: `src/components/TrendChart.tsx`
- Create: `src/components/HeroOverview.tsx`
- Create: `src/components/NetworkSection.tsx`
- Create: `src/components/ValuationSection.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add formatter tests.**

  ```ts
  it("formats exahashes", () => expect(formatHashrate(4.78e19)).toBe("47.8 EH/s"));
  it("formats small dollar values", () => expect(formatUsd(0.5594)).toBe("$0.56"));
  it("marks target deviation", () => expect(formatBlockDeviation(204.2, 194)).toContain("慢"));
  ```

- [ ] **Step 2: Implement formatters and shared components.**

  `MetricCard` takes `label`, `value`, `detail`, `status` and `sourceKind`; it must use `<dl>` semantics and visibly label fallback data as “暂无法读取实时数据”. `TrendChart` takes normalized `{ timestamp, value }[]`, has 7D/30D range buttons and uses a responsive Recharts container.

- [ ] **Step 3: Build the hero with real network data.**

  Render PRL price when the `price` series is available; otherwise display “待接入” rather than a fabricated price. Always render verified network metrics, including hashrate, difficulty, last block timing, supply progress and update time.

- [ ] **Step 4: Build network and valuation sections.**

  Network needs three trend charts: hashrate, difficulty and average block time; valuation needs price history plus FDV/BTC-FDV cards that explicitly say “待接入” until a verified source formula exists. No invented FDV data.

- [ ] **Step 5: Run unit tests and build.**

  Expected: formatter tests pass, sections render when price data is absent, and the site builds without console errors.

### Task 5: Build mining, chain, AI and method sections

**Files:**
- Create: `src/components/MiningSection.tsx`
- Create: `src/components/ChainSection.tsx`
- Create: `src/components/AiSection.tsx`
- Create: `src/components/MethodSection.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/app.css`

- [ ] **Step 1: Implement a transparent mining economic model presentation.**

  Show `单枚产币成本` and `盈利状态` only when a verified `standalone_cost` series is returned from `/api/prlstats/api/series?m=standalone_cost`. Otherwise show the metric name, an “模型数据待接入” state, and the documented input categories: electricity, GPU efficiency, PUE, depreciation and pool fee.

- [ ] **Step 2: Build explicit chain data states.**

  Render four cards for pools, activity, transfer distribution and holder concentration. A card without a verified source must say “数据建设中” and describe the intended source category; never show zero values as real chain data.

- [ ] **Step 3: Build AI and method sections.**

  AI uses source cards for inference-price and mining-during-inference models. Method uses the `/api/prlstats/api/metrics` metadata to render source, method and caveat for every loaded metric, with a fetch timestamp and a “读取 / 模型估算 / 建设中” legend.

- [ ] **Step 4: Add section anchors and progressive density.**

  Each section begins with a Chinese takeaway, then summary cards, then a chart or an explicit empty state. Keep the first viewport free of dense tables.

- [ ] **Step 5: Run `npm test` and `npm run build`.**

  Expected: no unavailable metric has a numeric value; all unavailable data is explained in Chinese.

### Task 6: Validate responsive behavior, API failures and local preview

**Files:**
- Modify: `src/styles/app.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add responsive rules.**

  At widths below 720px, collapse the navigation into a horizontally scrollable anchor row, make hero metrics a two-column grid, stack charts, and retain the refresh/source status.

- [ ] **Step 2: Exercise the failure path.**

  Block `/api/prlstats/api/network` in the browser or mock `fetch` rejection. Verify the hero shows the labeled fallback and that model/chain sections retain their non-deceptive states.

- [ ] **Step 3: Exercise the live path.**

  Start the Vite server, load the page via the local URL, and verify the network card reflects `/api/network` values and shows a current timestamp.

- [ ] **Step 4: Run final checks.**

  ```bash
  npm test
  npm run build
  ```

  Expected: all tests pass; production output exists in `dist/`; no source image text, logos or third-party artwork are included in the background asset.

## Spec coverage review

- One-page long scroll, real-time upper section and 7D/30D trends: Tasks 1, 2, 4 and 6.
- Six data modules and clear unavailable states: Tasks 4 and 5.
- prlstats API integration and methodological provenance: Tasks 2 and 5.
- Pearl-white iridescent visual direction using independent generated artwork: Task 3.
- Responsive site and reserved text entry: Tasks 1 and 6.
- No accounts, wallets, trading or user-generated content: excluded by the file map and component scope.
