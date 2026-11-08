import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
for (const path of ["/perspectives", "/contributions", "/dashboard", "/analytics", "/inventory", "/network", "/database"]) {
  await p.goto("http://localhost:3001" + path, { waitUntil: "networkidle" }).catch(() => {});
  await p.waitForTimeout(2500);
  const txt = await p.evaluate(() => document.body.innerText.replace(/\n{2,}/g, "\n").slice(0, 900));
  console.log("=====", path, "=====\n" + txt + "\n");
}
await b.close();
