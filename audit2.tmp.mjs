import { chromium } from "playwright";

const base = "http://localhost:3001";
const browser = await chromium.launch();

// 1. h1 texts + overflow offenders
for (const [path, width] of [["/robots", 1440], ["/", 1440], ["/contributions", 390], ["/analytics", 390]]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(base + path, { waitUntil: "networkidle" }).catch(() => {});
  const data = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll("*")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && (r.right > vw + 1 || r.left < -1) && getComputedStyle(el).position !== "fixed";
    }).slice(0, 8).map((el) => ({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || "").toString().slice(0, 40),
      right: Math.round(el.getBoundingClientRect().right),
      width: Math.round(el.getBoundingClientRect().width),
      text: (el.textContent || "").trim().slice(0, 40)
    }));
    return { h1s: [...document.querySelectorAll("h1")].map((h) => ({ text: h.textContent.trim().slice(0, 60), cls: h.className })), offenders, vw };
  });
  console.log("===", path, width, JSON.stringify(data, null, 1));
  await page.close();
}

// 2. /database hydration detail
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(m.text().slice(0, 600)); });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 600)));
  await page.goto(base + "/database", { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1200);
  console.log("=== /database errors\n" + errs.join("\n---\n"));
  await page.close();
}

// 3. screenshots
for (const [path, name, width, height] of [
  ["/", "home-desktop", 1440, 900],
  ["/", "home-mobile", 390, 844],
  ["/living-lab", "livinglab-desktop", 1440, 1000],
  ["/living-lab/meet/MSAJYG", "meet-desktop", 1440, 1000],
  ["/map", "map-desktop", 1440, 900],
  ["/analytics", "analytics-desktop", 1440, 900]
]) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(base + path, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `/tmp/shot-${name}.png`, fullPage: false });
  await page.close();
}

await browser.close();
