// The Living Lab call room (/living-lab): camera and microphone open on arrival, one tap to agree and talk,
// and nothing measured is shown while talking. Chromium gets a fake camera plus a silent audio track
// (headless audio capture never settles on some machines), so this proves the page, not detection
// accuracy (that needs the venue test in HRI_FEASIBILITY_SPIKE.md §3.4).
//
//   set -a && source ./.env.local && set +a
//   PLAYWRIGHT_EXTERNAL_SERVER=1 npx playwright test tests-node/hri-talk.spec.ts --workers=1
import { test, expect, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });
test.use({
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  viewport: { width: 1440, height: 1000 }
});

async function media(page: Page, allowed: boolean) {
  await page.addInitScript((ok) => {
    sessionStorage.setItem("th_atlas_loaded_before", "true");
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (!ok) throw new DOMException("denied", "NotAllowedError");
      if (!constraints?.audio) return original(constraints);
      const stream = new AudioContext().createMediaStreamDestination().stream;
      if (constraints.video) (await original({ video: true })).getVideoTracks().forEach((track) => stream.addTrack(track));
      return stream;
    };
  }, allowed);
}

test("arriving opens the camera and microphone, with no button to press", async ({ page }) => {
  await media(page, true);
  await page.goto("/living-lab");
  await expect(page.getByTestId("call")).toBeVisible();
  await expect(page.getByTestId("call-self")).toHaveClass(/is-on/, { timeout: 30_000 });
  await expect(page.getByTestId("call-mic")).toHaveClass(/is-on/);
  await expect(page.getByTestId("call-cam")).toHaveClass(/is-on/);
  // No scan button: a passport QR is read automatically. No lab navigation either.
  await expect(page.getByTestId("call-scan")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Living Lab" })).toHaveCount(0);
  // Leave, like hanging up: back to the research overview.
  await expect(page.getByTestId("call-leave")).toHaveAttribute("href", "/");
});

test("one tap agrees and starts talking; nothing measured is shown", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await media(page, true);
  await page.goto("/living-lab");
  await page.getByTestId("call-create").click();
  const intro = page.getByTestId("talk-intro");
  await expect(intro).toContainText("camera and microphone turn on");
  // The consent text is shown in full above the single button.
  await expect(intro).toContainText("I agree to save my preferences");
  const start = page.getByTestId("talk-start");
  await expect(start).toBeEnabled({ timeout: 60_000 });
  await start.click();

  const talking = page.getByTestId("talking");
  await expect(talking).toBeVisible({ timeout: 60_000 });
  // The conversation is a chat: a transcript and a typed input, alongside the voice.
  await expect(page.getByTestId("talk-chat")).toBeVisible();
  await expect(page.getByTestId("talk-typed")).toBeVisible();
  await expect(page.locator(".ll-auto-signals, .ll-auto-stage, .ll-meter, .ll-log-wrap")).toHaveCount(0);
  await expect(page.getByText(/Lean-backs|fps ·|Person in view/)).toHaveCount(0);
  await talking.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByTestId("talk-intro")).toBeVisible();
  expect(errors).toEqual([]);
});

test("a passport made in this browser opens the follow-up questions instead of the create chat", async ({ page }) => {
  await media(page, true);
  await page.addInitScript(() => {
    localStorage.setItem("hri-own-passport", JSON.stringify({
      code: "TEST234",
      accessToken: "test-access",
      editToken: "test-edit",
      values: {
        greeting: "wai", comfortDistance: 0.5, speed: 0.7, gaze: "soft", voice: true,
        language: "en", anxiety: "low", captions: "large", speechPace: "slow", noReach: true
      },
      sources: {
        distance: "camera", speed: "camera", gaze: "camera", greeting: "camera",
        voice: "default", captions: "default", speechPace: "default", handover: "default"
      }
    }));
  });
  await page.goto("/living-lab");
  const back = page.getByTestId("own-passport");
  await expect(back).toBeVisible({ timeout: 30_000 });
  await expect(back).toContainText("Welcome back");
  await expect(back).toContainText("TEST234");
  // No camera-measured create chat: the passport exists, so the guided questions come next.
  await expect(page.getByTestId("talk-intro")).toHaveCount(0);
  await page.getByTestId("own-questions").click();
  await expect(page.getByTestId("auto-interview")).toBeVisible();
});

test("if the camera and microphone are refused, the room says so and offers to ask again", async ({ page }) => {
  await media(page, false);
  await page.goto("/living-lab");
  await expect(page.getByTestId("call-denied")).toContainText("camera and microphone are off");
  await expect(page.getByTestId("call-allow")).toBeVisible();
  await expect(page.getByTestId("call-self")).not.toHaveClass(/is-on/);
});

test("the former Living Lab pages lead to the call room", async ({ page }) => {
  await media(page, true);
  for (const path of ["/living-lab/about", "/living-lab/create", "/living-lab/robot", "/living-lab/meet", "/living-lab/meet/ABC234", "/living-lab/research"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/living-lab$/);
  }
});
