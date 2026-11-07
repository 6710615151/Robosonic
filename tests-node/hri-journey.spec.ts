// The hospital journey UI (/living-lab/meet/[code]): an introduction first, then the counterbalanced
// conditions, and a reload must resume with the same order instead of starting a new journey.
// Writes a test passport and one station rating, so it only runs when NEON_BRANCH=dev. Cleans up.
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import pg from "pg";
import { issuePassportTokens } from "../lib/hri/security";

test.skip(process.env.NEON_BRANCH !== "dev", "Writes test data: only runs when NEON_BRANCH=dev.");

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const created: string[] = [];

async function seed() {
  const tokens = issuePassportTokens();
  const id = `itest_${randomUUID()}`;
  // Test codes start with "1", which real codes never contain.
  const code = `1${randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`;
  await db.query(
    `INSERT INTO "HriPassport" ("id","code","nickname","accessTokenHash","editTokenHash","comfortDistance","speed",
       "gaze","voice","language","anxiety","captions","speechPace","noReach","status","updatedAt")
     VALUES ($1,$2,'journey-test',$3,$4,-1.3,0.6,'soft',false,'en','low','normal','normal',true,'active', now() AT TIME ZONE 'UTC')`,
    [id, code, tokens.accessTokenHash, tokens.editTokenHash]
  );
  created.push(id);
  return { id, code };
}

test.afterAll(async () => {
  await db.query(`DELETE FROM "HriSession" WHERE "passportId" = ANY($1::text[])`, [created]);
  await db.query(`DELETE FROM "HriPassport" WHERE "id" = ANY($1::text[])`, [created]);
  await db.end();
});

test("the journey explains itself first, and a reload resumes with the same condition order", async ({ browser }) => {
  test.setTimeout(120_000);
  const row = await seed();
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `198.51.100.77-${Date.now()}` } });
  await context.addInitScript(() => sessionStorage.setItem("th_atlas_loaded_before", "true"));
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(`/living-lab/meet/${row.code}`);
  const intro = page.getByTestId("journey-intro");
  await expect(intro).toContainText("You meet the same robot twice");
  await intro.getByRole("button", { name: "Begin the journey" }).click();
  await expect(page.locator(".mt-head")).toContainText("Round 1 of 2");

  const firstCondition = (await page.locator(".mt-protocol li.current").textContent())!;
  await page.getByRole("button", { name: "Start condition 1 of 2" }).click({ timeout: 45_000 });
  const scale = page.getByRole("group", { name: "How did that station feel?" });
  await expect(scale).toBeVisible({ timeout: 45_000 });
  await scale.getByRole("button", { name: /^4 / }).click();
  await page.getByRole("button", { name: "Save station" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved. Now meet the same robot in the other condition." })).toBeVisible({ timeout: 20_000 });

  // Reload: same journey, round 2, the other condition. No intro again.
  await page.reload();
  await expect(page.getByTestId("journey-resumed")).toContainText("You have rated 1 of");
  await expect(page.getByTestId("journey-intro")).toHaveCount(0);
  await expect(page.locator(".mt-head")).toContainText("Round 2 of 2");
  const secondCondition = (await page.locator(".mt-protocol li.current").textContent())!;
  expect(secondCondition).not.toBe(firstCondition);
  await expect(page.locator(".mt-protocol li.done")).toHaveCount(1);

  // Exactly one station rating was stored for this passport.
  const sessions = await db.query(`SELECT count(*) FROM "HriSession" WHERE "passportId" = $1 AND "protocol" = 'care_journey_station'`, [row.id]);
  expect(Number(sessions.rows[0].count)).toBe(1);
  expect(pageErrors).toEqual([]);
  await context.close();
});

test("a robot link that is not a journey station says so instead of starting silently", async ({ browser }) => {
  const row = await seed();
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `198.51.100.78-${Date.now()}` } });
  const page = await context.newPage();
  await page.goto(`/living-lab/meet/${row.code}?robot=not-a-station`);
  await expect(page.getByRole("note")).toContainText("not one of this journey's stations");
  await context.close();
});
