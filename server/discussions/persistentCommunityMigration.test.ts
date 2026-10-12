import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspacePath = (...segments: string[]) => resolve(process.cwd(), ...segments);
const migration = readFileSync(workspacePath("supabase/migrations/202610110001_persistent_community_discussions.sql"), "utf8");
const responseInsertMigration = readFileSync(workspacePath("supabase/migrations/202610110002_atomic_discussion_response.sql"), "utf8");

describe("persistent community discussion migration", () => {
  it("uses the reviewed discussion and source defaults", () => {
    expect(migration).toMatch(/title text not null check \(char_length\(title\) between 1 and 160\)/);
    expect(migration).toMatch(/description text,/);
    expect(migration).toMatch(/status public\.discussion_status not null default 'published'/);
    expect(migration).toMatch(/last_attempted_at timestamptz not null default now\(\)/);
    expect(migration).toMatch(/position integer not null default 0 check \(position >= 0\)/);
    expect(migration).toMatch(/fetch_status public\.discussion_fetch_status not null default 'failed'/);
    expect(migration).toMatch(/unique \(discussion_id, role, position\)/);
    expect(migration).toMatch(
      /on public\.discussion_sources \(discussion_id, role, published_at, position\)/,
    );
  });

  it("normalizes an optional description and validates the requested status in the RPC", () => {
    expect(migration).toContain("nullif(input ->> 'description', '')");
    expect(migration).toContain("coalesce(nullif(input ->> 'status', '')::public.discussion_status, 'published')");
  });

  it("stores X status IDs as exact numeric strings without JavaScript number coercion", () => {
    const xStatusId = "2108519545514410023";

    expect(xStatusId).toBe("2108519545514410023");
    expect(migration).toMatch(/x_status_id text not null unique check \(x_status_id ~ '\^\[0-9\]\+\$'\)/);
    expect(migration).toContain("primary_source ->> 'xStatusId',");
    expect(migration).not.toContain("(primary_source ->> 'xStatusId')::bigint");
  });

  it("includes production server typechecking without test files", () => {
    const serverConfigPath = workspacePath("tsconfig.server.json");

    expect(existsSync(serverConfigPath)).toBe(true);
    if (!existsSync(serverConfigPath)) return;

    const packageJson = JSON.parse(readFileSync(workspacePath("package.json"), "utf8"));
    const serverConfig = JSON.parse(readFileSync(serverConfigPath, "utf8"));

    expect(packageJson.devDependencies["@types/node"]).toBeDefined();
    expect(packageJson.scripts.build).toContain("tsc -p tsconfig.server.json");
    expect(packageJson.scripts.build).toContain("npm run build:server");
    expect(serverConfig.compilerOptions.noEmit).toBe(true);
    expect(serverConfig.compilerOptions.moduleResolution).toBe("Bundler");
    expect(serverConfig.compilerOptions.types).toEqual(["node"]);
    expect(serverConfig.include).toEqual(["server/**/*.ts", "api/**/*.ts", "vite.config.ts"]);
    expect(serverConfig.exclude).toContain("**/*.test.ts");
  });

  it("documents applying the migration in Supabase and configuring the deployment host", () => {
    const readme = readFileSync(workspacePath("README.md"), "utf8");

    expect(readme).toContain("Supabase SQL Editor");
    expect(readme).toContain("202610110001_persistent_community_discussions.sql");
    expect(readme).toContain("202610110002_atomic_discussion_response.sql");
    expect(readme.indexOf("202610110001_persistent_community_discussions.sql")).toBeLessThan(
      readme.indexOf("202610110002_atomic_discussion_response.sql"),
    );
    expect(readme).toContain("deployment host");
  });

  it("provides a row-locked atomic response insertion RPC with global duplicate detection", () => {
    expect(responseInsertMigration).toContain("create_or_duplicate_discussion_response");
    expect(responseInsertMigration).toMatch(/from public\.discussions[\s\S]*for update/);
    expect(responseInsertMigration).toContain("where x_status_id = response_source ->> 'xStatusId'");
    expect(responseInsertMigration).toContain("coalesce(max(position), -1) + 1");
    expect(responseInsertMigration).toContain("unique_violation");
  });
});
