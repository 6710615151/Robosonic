// The contribution map never shows made-up data. Run against a server with no GEMINI_API_KEY, so every
// analysis fails. Changes the cached clusters, so it only runs when NEON_BRANCH=dev, and it restores them.
//
//   set -a && source ./.env.local && set +a      # GEMINI_API_KEY must not be set; needs the admin variables
//   pnpm build && pnpm start &
//   PLAYWRIGHT_EXTERNAL_SERVER=1 pnpm exec playwright test tests-node/map-no-sample-data.spec.ts
import { test, expect, type Page } from "@playwright/test";
import pg from "pg";

test.skip(process.env.NEON_BRANCH !== "dev" || Boolean(process.env.GEMINI_API_KEY), "Needs NEON_BRANCH=dev and no GEMINI_API_KEY.");
test.describe.configure({ mode: "serial" });

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const KEY = "map_contribution_clusters";
const row = () => db.query(`SELECT "valueJson" FROM "StatsCache" WHERE "key" = $1`, [KEY]);
const setCache = (value: unknown) => db.query(
  `INSERT INTO "StatsCache" ("key", "valueJson", "updatedAt") VALUES ($1, $2::jsonb, now()) ON CONFLICT ("key") DO UPDATE SET "valueJson" = $2::jsonb, "updatedAt" = now()`,
  [KEY, JSON.stringify(value)]
);
const clearCache = () => db.query(`DELETE FROM "StatsCache" WHERE "key" = $1`, [KEY]);
let saved: unknown;

test.beforeAll(async () => { saved = (await row()).rows[0]?.valueJson; });
test.afterAll(async () => {
  if (saved === undefined) await clearCache(); else await setCache(saved);
  await db.end();
});

const point = (id: string, title: string) => ({
  id, title, organization: title, locationLabel: "Bangkok, Thailand", latitude: 13.7, longitude: 100.5,
  summary: "From an analysis.", contributorType: "University", contributionCount: 2, detailsList: ["Item"]
});

async function expectNoData(page: Page) {
  await expect(page.getByText("so no clusters are shown")).toBeVisible();
  await expect(page.getByText("No ecosystem clusters analyzed yet.")).toBeVisible();
  await expect(page.getByText("King Mongkut's University")).toHaveCount(0);
  await expect(page.getByText("CT Asia")).toHaveCount(0);
}

test("with no analysis, the map shows nothing and says so, and stores nothing", async ({ page }) => {
  await clearCache();
  await page.goto("/map");
  await expectNoData(page);
  expect((await row()).rows).toHaveLength(0);
});

test("old sample data already in the cache is not shown", async ({ page }) => {
  await setCache(["kmutt_fibo", "chula_robo", "vistec_brain", "cmu_robotics", "ct_asia"].map((id) => point(id, `Sample ${id}`)));
  await page.goto("/map");
  await expectNoData(page);
  await expect(page.getByText("Sample kmutt_fibo")).toHaveCount(0);
});

test("a real result is shown, and a failed re-analysis keeps it and tells the admin", async ({ page }) => {
  const user = process.env.ADMIN_BASIC_USER;
  const password = process.env.ADMIN_BASIC_PASSWORD;
  test.skip(!user || !password, "Set ADMIN_BASIC_USER and ADMIN_BASIC_PASSWORD.");
  await setCache([point("real_lab", "A Real Lab")]);

  await page.goto("/admin-login");
  await page.fill('input[name="email"]', user!);
  await page.fill('input[name="password"]', password!);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => url.pathname === "/admin");

  await page.goto("/map");
  await expect(page.getByRole("cell", { name: "A Real Lab", exact: true })).toBeVisible();
  await expect(page.getByText("so no clusters are shown")).toHaveCount(0);

  await page.getByRole("button", { name: "Trigger Gemini AI Ecosystem Analysis" }).click();
  await expect(page.getByText("The analysis failed, so the map still shows the last result.")).toBeVisible();
  await expect(page).toHaveURL(/analysis=failed/);
  await expect(page.getByRole("cell", { name: "A Real Lab", exact: true })).toBeVisible();
  const stored = (await row()).rows[0].valueJson as { id: string }[];
  expect(stored.map((p) => p.id)).toEqual(["real_lab"]);
});
