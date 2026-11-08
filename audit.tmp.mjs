import { chromium } from "playwright";

const base = "http://localhost:3001";
const pages = [
  "/",
  "/robots",
  "/perspectives",
  "/contributions",
  "/map",
  "/network",
  "/analytics",
  "/inventory",
  "/dashboard",
  "/database",
  "/submit-data",
  "/living-lab",
  "/living-lab/meet/MSAJYG",
  "/profile",
  "/data-pulls"
];

const browser = await chromium.launch();
const results = [];
for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } });
  for (const path of pages) {
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
    page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 160)));
    let status = 0, ms = 0, bytes = 0;
    try {
      const t0 = Date.now();
      const resp = await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 45000 });
      ms = Date.now() - t0;
      status = resp?.status() ?? 0;
      bytes = (await page.evaluate(() => performance.getEntriesByType("resource")
        .reduce((s, r) => s + (r.transferSize || 0), 0)));
      await page.waitForTimeout(800);
      const info = await page.evaluate(() => ({
        h1: document.querySelectorAll("h1").length,
        imgsNoAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).length,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        focusables: document.querySelectorAll("a[href],button,input,select,textarea,[tabindex]:not([tabindex='-1'])").length,
        lang: document.documentElement.lang,
        title: document.title.slice(0, 70)
      }));
      results.push({ width, path, status, ms, kb: Math.round(bytes / 1024), ...info, errors: errors.slice(0, 3) });
    } catch (e) {
      results.push({ width, path, status, ms, error: String(e).slice(0, 160), errors: errors.slice(0, 3) });
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(results, null, 1));
