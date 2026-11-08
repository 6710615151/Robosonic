import { chromium } from "playwright";

const base = "http://localhost:3001";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)));

const step = (msg) => console.log("[step]", msg);

await page.goto(base + "/living-lab", { waitUntil: "domcontentloaded" });
const start = page.getByRole("button", { name: /Loading robot|Start/ });
await start.waitFor();
for (let i = 0; i < 60 && (await start.isDisabled()); i++) await page.waitForTimeout(500);
step("robot ready: " + (await start.isEnabled()));
await start.click();

await page.getByRole("button", { name: /I made a wai/ }).click();
step("greeted");

for (let i = 0; i < 3; i++) {
  await page.getByRole("button", { name: /^Continue/ }).click();
  await page.waitForTimeout(1400);
}
await page.getByRole("button", { name: /Comfortable here/ }).click();
step("distance set");

await page.getByRole("button", { name: /^Comfortable$/ }).click();
await page.getByRole("button", { name: /^Normal$/ }).click();
await page.getByRole("button", { name: /Yes, hand it to me/ }).click();
await page.getByRole("button", { name: /^Next$/ }).click();
step("care needs set");

await page.getByRole("button", { name: /Yes, look at me/ }).click();
await page.getByRole("button", { name: /Text only/ }).click();
step("gaze + voice set");

const codeEl = page.locator(".ll-code");
await codeEl.waitFor({ timeout: 30000 });
const code = (await codeEl.textContent())?.trim();
step("passport created: " + code);

await page.getByRole("link", { name: /Start the hospital journey/ }).click();
await page.waitForURL(/\/living-lab\/meet\//);
step("journey page: " + page.url());

for (let station = 1; station <= 3; station++) {
  const begin = page.getByRole("button", { name: /Start station/ });
  await begin.waitFor();
  for (let i = 0; i < 60 && (await begin.isDisabled()); i++) await page.waitForTimeout(500);
  await begin.click();
  step(`station ${station} started`);

  const five = page.getByRole("button", { name: /^5 —/ });
  await five.waitFor({ timeout: 60000 });
  await five.click();
  const save = page.getByRole("button", { name: /Save station/ });
  await save.click();
  await page.getByText("Saved to the Living Lab.").waitFor({ timeout: 15000 });
  step(`station ${station} saved`);

  const next = page.getByRole("button", { name: /Next station/ });
  if (station < 3) {
    await next.click();
    await page.waitForTimeout(800);
  }
}

await page.getByText("Journey complete").first().waitFor({ timeout: 15000 });
step("journey complete ✓");
const avg = await page.locator(".mt-avg").textContent();
step("average: " + avg?.trim());

console.log("ERRORS:", errors.length ? errors : "none");
console.log("CODE_FOR_CLEANUP=" + code);
await browser.close();
