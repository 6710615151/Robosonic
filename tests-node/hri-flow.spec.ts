// The Living Lab as one journey: create → experience (Robot Lab) → compare (hospital journey) → discover.
// Covers the shell, the "you need a passport" states, the masked token, the Robot Lab → journey handoff,
// registry robots that are not stations, and where the journey's end sends people.
// Writes test passports, so it refuses to run unless NEON_BRANCH=dev. It cleans up after itself.
//
//   set -a && source ./.env.local && set +a
//   PLAYWRIGHT_EXTERNAL_SERVER=1 npx playwright test tests-node/hri-flow.spec.ts --workers=1
import { randomUUID } from "node:crypto";
import { test, expect, type Browser } from "@playwright/test";
import pg from "pg";
import { issuePassportTokens } from "../lib/hri/security";

test.skip(process.env.NEON_BRANCH !== "dev", "Writes test data: only runs when NEON_BRANCH=dev.");
test.describe.configure({ mode: "serial" });

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const created: string[] = [];
const randomIp = () => `203.0.113.${Math.floor(Math.random() * 250) + 1}-${Date.now()}-${Math.random()}`;

async function seed() {
  const tokens = issuePassportTokens();
  const id = `itest_${randomUUID()}`;
  // Test codes start with "1", which real codes never contain.
  const code = `1${randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`;
  await db.query(
    `INSERT INTO "HriPassport" ("id","code","nickname","accessTokenHash","editTokenHash","comfortDistance","speed",
       "gaze","voice","language","anxiety","captions","speechPace","noReach","status","updatedAt")
     VALUES ($1,$2,$3,$4,$5,0.6,1,'soft',true,'en','low','normal','normal',false,'active', now() AT TIME ZONE 'UTC')`,
    [id, code, "flow-test", tokens.accessTokenHash, tokens.editTokenHash]
  );
  created.push(id);
  return { id, code, accessToken: tokens.accessToken };
}

async function open(browser: Browser, opts: { width?: number; own?: string } = {}) {
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": randomIp() },
    viewport: { width: opts.width ?? 1440, height: 1000 }
  });
  await context.addInitScript((own) => {
    sessionStorage.setItem("th_atlas_loaded_before", "true");
    if (own) localStorage.setItem(`hri-passport-edit:${own}`, "flow-test-edit-key");
  }, opts.own ?? "");
  return { context, page: await context.newPage() };
}

test.afterAll(async () => {
  await db.query(`DELETE FROM "HriSession" WHERE "passportId" = ANY($1::text[])`, [created]);
  await db.query(`DELETE FROM "HriPassport" WHERE "id" = ANY($1::text[])`, [created]);
  await db.end();
});

test("one lab bar: tabs plus a status panel that opens, closes with Escape, and states what is real", async ({ browser }) => {
  const { context, page } = await open(browser, { width: 390 });
  await page.goto("/living-lab");
  const nav = page.getByRole("navigation", { name: "Living Lab" });
  await expect(nav.getByRole("link", { name: "Lab home", exact: true })).toHaveAttribute("aria-current", "page");
  // Every stage page says where you are and what comes next.
  await page.goto("/living-lab/robot");
  await expect(page.getByTestId("lab-where")).toContainText("Stage 2 of 4");
  await expect(page.getByTestId("lab-where-next")).toHaveAttribute("href", "/living-lab/meet");
  await expect(nav.getByRole("link", { name: "Experience", exact: true })).toHaveAttribute("aria-current", "page");
  await page.goto("/living-lab");
  await expect(page.getByTestId("lab-where")).toHaveCount(0);
  // No second lab header above the tabs.
  await expect(page.locator(".lab-shell")).toHaveCount(0);

  const toggle = page.getByTestId("lab-status-toggle");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("lab-status")).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("lab-status-hardware")).toBeVisible();
  await expect(page.getByTestId("lab-status-hardware")).toContainText("not connected");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("lab-status")).toBeHidden();
  await expect(toggle).toBeFocused();

  // The bar is the only lab chrome above the page heading: the heading starts within the first screen.
  const top = await page.getByRole("heading", { level: 1 }).evaluate((h) => h.getBoundingClientRect().top);
  expect(top).toBeLessThan(260);
  await context.close();
});

test("without a passport, the Robot Lab and the journey entry say why one is needed and how to make it", async ({ browser }) => {
  const { context, page } = await open(browser);
  await page.goto("/living-lab/robot");
  await expect(page.getByTestId("console-empty").getByRole("link", { name: /Create a passport/ })).toHaveAttribute("href", "/living-lab/create");
  await expect(page.getByTestId("robot-next")).toHaveCount(0);

  await page.goto("/living-lab/meet");
  await expect(page.getByTestId("meet-empty").getByRole("link", { name: /Create a passport/ })).toHaveAttribute("href", "/living-lab/create");
  await expect(page.getByRole("textbox", { name: "Passport code" })).toBeVisible();
  await context.close();

  // Both "you need a passport" states fit a phone screen.
  const phone = await open(browser, { width: 390 });
  for (const path of ["/living-lab/meet", "/living-lab/robot"]) {
    await phone.page.goto(path);
    await expect(phone.page.getByTestId(path.endsWith("meet") ? "meet-empty" : "console-empty")).toBeVisible();
    expect(await phone.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${path} fits 390 px`).toBe(true);
  }
  await phone.context.close();
});

test("a loaded token is masked until asked for, and the Robot Lab continues to the journey without a token in any URL", async ({ browser }) => {
  test.setTimeout(120_000);
  const row = await seed();
  const { context, page } = await open(browser);
  await page.goto(`/living-lab/robot#token=${row.accessToken}`);
  await expect(page.getByTestId("robot-card-a")).toContainText("Passport v1", { timeout: 60_000 });

  const value = page.getByTestId("console-token-value");
  await expect(value).toHaveText(`${row.accessToken.slice(0, 4)}…${row.accessToken.slice(-4)}`);
  expect(await page.locator("main").first().innerText()).not.toContain(row.accessToken);
  await page.getByRole("button", { name: "Show token" }).click();
  await expect(value).toHaveText(row.accessToken);
  await page.getByRole("button", { name: "Hide token" }).click();
  await expect(value).not.toHaveText(row.accessToken);

  const next = page.getByTestId("robot-next");
  await expect(next.getByRole("link", { name: /Open the passport card/ })).toHaveAttribute("href", `/living-lab/passport/${row.accessToken}`);
  await next.getByRole("button", { name: /Start the hospital journey/ }).click();
  await page.waitForURL(new RegExp(`/living-lab/meet/${row.code}$`));
  expect(page.url()).not.toContain(row.accessToken);
  await expect(page.getByTestId("journey-intro")).toBeVisible();
  await context.close();
});

test("a passport made in this browser is offered as a one-tap start on the Robot Lab and the journey entry", async ({ browser }) => {
  test.setTimeout(120_000);
  const row = await seed();
  const { context, page } = await open(browser, { own: row.accessToken });

  await page.goto("/living-lab/robot");
  await page.getByTestId("console-own").getByRole("button", { name: "Use my passport" }).click();
  await expect(page.getByTestId("robot-card-a")).toContainText("Passport v1", { timeout: 60_000 });

  await page.goto("/living-lab/meet");
  await page.getByTestId("meet-own").getByRole("button", { name: /Start with my passport/ }).click();
  await page.waitForURL(new RegExp(`/living-lab/meet/${row.code}$`));
  await context.close();
});

test("a registry robot that plays no station is marked, and its link explains instead of starting silently", async ({ browser }) => {
  const { context, page } = await open(browser);
  await page.goto("/living-lab/robot");
  const registry = page.locator(".lab-registry li");
  if (!(await registry.count())) test.skip(true, "No registry robots in this database.");
  // Every robot offered for a meeting is a journey station; the rest carry no meeting link.
  await expect(page.locator('.lab-registry li[data-in-journey="no"] a')).toHaveCount(0);
  const stationLinks = page.locator('.lab-registry li[data-in-journey="yes"] a');
  expect(await stationLinks.count()).toBeGreaterThan(0);

  const other = await db.query(`SELECT "id", "canonicalName" FROM "RobotModel" WHERE "canonicalName" NOT ILIKE '%Mr SAM%' AND "canonicalName" NOT ILIKE '%Pinto%' AND "canonicalName" NOT ILIKE '%Ninja%' AND "canonicalName" NOT ILIKE '%Mirror Telepresence%' AND "robotType" !~* 'administrative|outpatient|service|delivery|medical_assist|telepresence' LIMIT 1`);
  if (other.rows[0]) {
    await page.goto(`/living-lab/meet?robot=${other.rows[0].id}`);
    await expect(page.getByTestId("meet-robot-note")).toContainText("is not one of the hospital journey's stations");
    await expect(page.locator('input[name="robot"]')).toHaveCount(0);
  }
  await context.close();
});

test("the end of the journey shows this journey's own ratings and four ways to continue", async ({ browser }) => {
  test.setTimeout(120_000);
  const row = await seed();
  const state = { v: 1, journeyId: "abcdef123456", current: 2, started: true, ratings: { 0: { passport: 5, default: 3 }, 1: { passport: 4, default: 4 }, 2: { passport: 4, default: 2 } } };

  // Made in this browser: the card and the Robot Lab open with this passport.
  {
    const { context, page } = await open(browser, { own: row.accessToken });
    await context.addInitScript(([code, s]) => sessionStorage.setItem(`hri-journey:${code}`, s), [row.code, JSON.stringify(state)] as const);
    await page.goto(`/living-lab/meet/${row.code}`);
    const next = page.getByTestId("journey-next");
    await expect(next).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("journey-next-card")).toHaveAttribute("href", `/living-lab/passport/${row.accessToken}`);
    await expect(page.getByTestId("journey-next-robot")).toHaveAttribute("href", `/living-lab/robot#token=${row.accessToken}`);
    await expect(page.getByTestId("journey-next-research")).toHaveAttribute("href", "/living-lab/research");
    await expect(page.getByTestId("journey-next-home")).toHaveAttribute("href", "/living-lab");
    await expect(page.getByTestId("journey-verdict")).toContainText("your own result from one journey");
    await context.close();
  }

  // Another browser: no guessing. The card is explained, the Robot Lab opens empty.
  {
    const { context, page } = await open(browser);
    await context.addInitScript(([code, s]) => sessionStorage.setItem(`hri-journey:${code}`, s), [row.code, JSON.stringify(state)] as const);
    await page.goto(`/living-lab/meet/${row.code}`);
    await expect(page.getByTestId("journey-next")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("journey-next-card-elsewhere")).toContainText("only in the browser that created");
    await expect(page.getByTestId("journey-next-card")).toHaveCount(0);
    await expect(page.getByTestId("journey-next-robot")).toHaveAttribute("href", "/living-lab/robot");
    await context.close();
  }
});
