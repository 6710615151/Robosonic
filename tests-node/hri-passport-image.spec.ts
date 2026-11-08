// The passport as a picture, and a robot reading it back. Seeds one passport on Neon dev (code starts
// with "1", which real codes never use) and removes it afterwards.
//   - the card offers a PNG download and a "scan to save" QR; ?save=1 (the phone) shows the picture first
//   - the Living Lab is the call room, with Create passport below
//   - the robot reads a passport held up to the camera, with no button: the camera is fed a canvas showing
//     the passport QR, so the real decoder runs on a real image
//
//   set -a && source ./.env.local && set +a
//   PLAYWRIGHT_EXTERNAL_SERVER=1 npx playwright test tests-node/hri-passport-image.spec.ts --workers=1
import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import pg from "pg";
import QRCode from "qrcode";
import { issuePassportTokens } from "../lib/hri/security";

test.skip(process.env.NEON_BRANCH !== "dev", "Writes test data: only runs when NEON_BRANCH=dev.");
test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 1000 } });

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
let row: { id: string; code: string; accessToken: string };

test.beforeAll(async () => {
  const tokens = issuePassportTokens();
  const id = `itest_${randomUUID()}`;
  const code = `1${randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`;
  await db.query(
    `INSERT INTO "HriPassport" ("id","code","nickname","accessTokenHash","editTokenHash","comfortDistance","speed",
       "gaze","voice","language","anxiety","captions","speechPace","noReach","status","updatedAt")
     VALUES ($1,$2,$3,$4,$5,0.6,1,'soft',true,'en','low','normal','normal',true,'active', now() AT TIME ZONE 'UTC')`,
    [id, code, "image-test", tokens.accessTokenHash, tokens.editTokenHash]
  );
  row = { id, code, accessToken: tokens.accessToken };
});

test.afterAll(async () => {
  await db.query(`DELETE FROM "HriPassport" WHERE "id" = $1`, [row.id]);
  await db.end();
});

const skipSplash = (page: Page) => page.addInitScript(() => sessionStorage.setItem("th_atlas_loaded_before", "true"));

// A white image: a camera with no QR in view.
const BLANK = "data:image/svg+xml;base64," + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="white"/></svg>').toString("base64");

// The browser's camera shows `qrDataUrl` (drawn on a canvas), whatever device the test machine has.
// Requests that include audio get a silent track added (headless audio capture may never settle).
async function cameraShows(page: Page, qrDataUrl: string) {
  await page.addInitScript((src) => {
    navigator.mediaDevices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
      const canvas = document.createElement("canvas");
      canvas.width = 640; canvas.height = 480;
      const ctx = canvas.getContext("2d")!;
      const img = new Image();
      await new Promise((resolve) => { img.onload = resolve; img.src = src; });
      const draw = () => { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 640, 480); ctx.drawImage(img, 170, 90, 300, 300); };
      draw();
      window.setInterval(draw, 100);
      const stream = canvas.captureStream(10);
      if (constraints?.audio) new AudioContext().createMediaStreamDestination().stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      return stream;
    };
  }, qrDataUrl);
}

test("the card offers the passport as a PNG, and a QR for the phone", async ({ page }) => {
  await skipSplash(page);
  await page.goto(`/living-lab/passport/${row.accessToken}`);
  const save = page.getByTestId("passport-save");
  await expect(save).toBeVisible();
  await expect(save.getByTestId("passport-save-qr")).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), save.getByTestId("passport-download").click()]);
  expect(download.suggestedFilename()).toBe(`hri-passport-${row.code}.png`);
  const bytes = await (await download.createReadStream()).toArray();
  const head = Buffer.concat(bytes).subarray(0, 8);
  expect(head.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
});

test("opened from the phone QR (?save=1), the picture comes first", async ({ page }) => {
  await skipSplash(page);
  await page.goto(`/living-lab/passport/${row.accessToken}?save=1`);
  await expect(page.getByTestId("passport-png")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("passport-save-qr")).toHaveCount(0);
});

test("the Living Lab is a call: robot full screen, Create passport below", async ({ page }) => {
  await skipSplash(page);
  await cameraShows(page, BLANK);
  await page.goto("/living-lab");
  const room = page.getByTestId("call");
  await expect(room).toBeVisible();
  await expect(room.getByTestId("call-create")).toBeVisible();
  // The room covers the viewport: the site chrome is behind it.
  const box = await room.boundingBox();
  expect(box).toMatchObject({ x: 0, y: 0, width: 1440, height: 1000 });
  await room.getByTestId("call-create").click();
  await expect(page.getByTestId("talk-intro")).toBeVisible();
});

test("holding a passport up to the camera is enough: the robot reads it by itself", async ({ page }) => {
  test.setTimeout(120_000);
  await skipSplash(page);
  await cameraShows(page, await QRCode.toDataURL(`http://localhost:3000/living-lab/passport/${row.accessToken}`, { width: 300, margin: 2 }));
  await page.goto("/living-lab");
  await expect(page.getByTestId("call-self")).toHaveClass(/is-on/, { timeout: 30_000 });
  // No button pressed: the caption changes from the welcome to what the robot will do for this passport.
  await expect(page.locator(".ll-call .ll-bubble")).toContainText(/I'll|I will/, { timeout: 60_000 });
});
