import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://localhost:3001/robots", { waitUntil: "domcontentloaded" });
for (const t of [500, 1500, 3000]) { await p.waitForTimeout(t === 500 ? 500 : t - (t === 1500 ? 500 : 1500)); console.log(t, "h1s:", await p.evaluate(() => [...document.querySelectorAll("h1")].map(h => h.textContent.trim().slice(0, 30)))); }
console.log("loader in dom:", await p.evaluate(() => !!document.querySelector(".splash-title")));
await b.close();
