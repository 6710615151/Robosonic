// Conversation mode, the default way to create a passport: one consent, then camera and microphone on and
// the robot makes small talk while the Auto calibrator measures behind it. Uses Chromium's fake camera and
// microphone (a test pattern with nobody in it), so it proves the wiring and that nothing measured is shown,
// not detection accuracy (that needs the venue test in HRI_FEASIBILITY_SPIKE.md §3.4).
//
//   set -a && source ./.env.local && set +a
//   PLAYWRIGHT_EXTERNAL_SERVER=1 npx playwright test tests-node/hri-talk.spec.ts --workers=1
import { test, expect } from "@playwright/test";
import pg from "pg";
import { signInParticipant } from "./identity-helper";

test.skip(process.env.NEON_BRANCH !== "dev", "Reads the dev database: only runs when NEON_BRANCH=dev.");
test.describe.configure({ mode: "serial" });
test.use({
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  viewport: { width: 1440, height: 1000 }
});

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const participants: { cleanup: () => Promise<unknown> }[] = [];
test.afterAll(async () => {
  for (const p of participants) await p.cleanup();
  await db.end();
});

async function openCreate(page: import("@playwright/test").Page) {
  participants.push(await signInParticipant(db, page.context()));
  await page.goto("/living-lab/create");
  await expect(page.getByTestId("talk-intro")).toBeVisible();
  return page.getByTestId("talk-start");
}

test.describe("with a camera and microphone", () => {
  test.use({ permissions: ["camera", "microphone"] });

  test("talking is the default way in, needs consent, and buttons stay one link away", async ({ page }) => {
    const start = await openCreate(page);
    await expect(page.getByTestId("talk-intro")).toContainText("camera and microphone turn on");
    await expect(start).toBeDisabled();
    // The answer methods are not on the first screen.
    await expect(page.getByRole("button", { name: "Talk or type your answers" })).toHaveCount(0);

    await page.getByTestId("talk-fallback").click();
    await expect(page.getByRole("button", { name: "Talk or type your answers" })).toBeVisible();
    await page.getByRole("button", { name: /Back to talking with the robot/ }).click();
    await expect(page.getByTestId("talk-intro")).toBeVisible();

    await page.getByLabel(/I agree to save my preferences/).check();
    await expect(start).toBeEnabled({ timeout: 60_000 });
  });

  test("starting turns the camera and microphone on, the robot talks, and no measurement is shown", async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    // Headless Chromium on some machines never settles a request that includes audio. Hand it a silent
    // stream (plus the fake camera) so this test checks the page, not the test machine's audio stack.
    await page.addInitScript(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        if (!constraints?.audio) return original(constraints);
        const silent = new AudioContext().createMediaStreamDestination().stream;
        if (constraints.video) (await original({ video: true })).getVideoTracks().forEach((track) => silent.addTrack(track));
        return silent;
      };
    });
    const start = await openCreate(page);
    await page.getByLabel(/I agree to save my preferences/).check();
    await expect(start).toBeEnabled({ timeout: 60_000 });
    await start.click();

    const talking = page.getByTestId("talking");
    await expect(talking).toBeVisible({ timeout: 60_000 });
    await expect(talking).toContainText("Camera and microphone are on");
    // Nothing the camera measures appears while talking: no stages, signals, counts or meters.
    await expect(page.locator(".ll-auto-signals, .ll-auto-stage, .ll-meter")).toHaveCount(0);
    await expect(page.getByText(/Lean-backs|fps ·|Person in view/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /I made a wai|Too close|Comfortable here/ })).toHaveCount(0);

    await talking.getByRole("button", { name: "Stop" }).click();
    await expect(page.getByTestId("talk-intro")).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("without microphone permission", () => {
  test.use({ permissions: [] });

  test("the experiment explains that it needs the camera and microphone and offers buttons", async ({ page }) => {
    const start = await openCreate(page);
    // A browser that refuses the microphone, whatever the test machine has.
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
    });
    await page.reload();
    await page.getByLabel(/I agree to save my preferences/).check();
    await expect(start).toBeEnabled({ timeout: 60_000 });
    await start.click();
    await expect(page.getByRole("alert").filter({ hasText: "needs the camera and the microphone" })).toBeVisible();
    await expect(page.getByTestId("talking")).toHaveCount(0);
    await expect(page.getByTestId("talk-fallback")).toBeVisible();
  });
});
