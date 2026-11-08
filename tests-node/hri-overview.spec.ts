// The Living Lab overview (/living-lab/about; /living-lab itself is the call room): it must say what is real, offer a way to continue only when
// this browser really holds a passport, and keep old links working. Read-only: writes nothing.
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  // Skip the site's first-visit splash screen.
  await context.addInitScript(() => sessionStorage.setItem("th_atlas_loaded_before", "true"));
});

test("the overview says what this is, where to start, and that no physical robot is connected", async ({ page }) => {
  await page.goto("/living-lab/about");
  await expect(page.getByRole("heading", { level: 1, name: "Can robots understand you?" })).toBeVisible();
  // One dominant action, in the hero (the closing invitation repeats it).
  await expect(page.getByRole("link", { name: /Begin your experiment/ }).first()).toHaveAttribute("href", "/living-lab/create");

  const status = page.getByTestId("overview-status");
  const hardware = status.getByRole("listitem").filter({ hasText: "Physical robots" });
  await expect(hardware).toContainText("Not connected");
  await expect(page.getByTestId("lab-status-hardware")).toContainText("not connected");
  // Simulated robots are only ever labelled as simulations.
  await expect(status.getByRole("listitem").filter({ hasText: "Robots in the lab" })).toContainText("simulated");
});

test("'continue' appears only when this browser holds a passport's edit key", async ({ page }) => {
  await page.goto("/living-lab/about");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("overview-resume")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "My Passport", exact: true })).toHaveCount(0);

  await page.evaluate(() => localStorage.setItem("hri-passport-edit:TEST_ACCESS_TOKEN", "test-edit-key"));
  await page.reload();
  await expect(page.getByTestId("overview-resume").getByRole("link", { name: /Open my passport/ })).toHaveAttribute("href", "/living-lab/passport/TEST_ACCESS_TOKEN");
  await expect(page.getByRole("link", { name: "My Passport", exact: true })).toHaveAttribute("href", "/living-lab/passport/TEST_ACCESS_TOKEN");
});

test("links to the old single-page sections still land on the right page", async ({ page }) => {
  await page.goto("/living-lab#calibrate");
  await expect(page).toHaveURL(/\/living-lab\/create$/);
  await expect(page.getByRole("link", { name: "Create", exact: true })).toHaveAttribute("aria-current", "page");

  await page.goto("/living-lab?window=7d");
  await expect(page).toHaveURL(/\/living-lab\/research\?window=7d$/);
  await expect(page.getByRole("link", { name: "Discover", exact: true })).toHaveAttribute("aria-current", "page");
});

test("the overview has no horizontal overflow at phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/living-lab/about");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("the research page states its sample size and its privacy rule", async ({ page }) => {
  await page.goto("/living-lab/research");
  await expect(page.getByRole("heading", { level: 2, name: "What the Living Lab is learning" })).toBeVisible();
  // Either the aggregates (with sample sizes and the privacy rule) or an honest offline message.
  const offline = page.getByText("The research database is not reachable right now");
  if (await offline.count()) return;
  await expect(page.getByRole("heading", { name: "Sample in this period" })).toBeVisible();
  await expect(page.getByTestId("research-privacy")).toContainText("hidden in any group of fewer than 5 people");
});
