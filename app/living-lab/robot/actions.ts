"use server";

import { redirect } from "next/navigation";
import { loadCard } from "../passport/lookup";

// Robot Lab → Hospital Journey. The Robot Lab holds an access token, but the journey runs on the
// 6-character code, which the public API deliberately never returns. The token travels in the POST
// body (never a URL), is checked with the same budgets as the passport card page, and the visitor is
// sent to the journey. Anyone here already holds the token, which opens the card that shows the code,
// so nothing new is exposed.
export async function startJourneyFromToken(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  // Optional registry robot to start at (/living-lab/meet?robot=…); only an id-shaped value is passed on.
  const robot = String(formData.get("robot") ?? "");
  const robotQuery = /^[A-Za-z0-9_-]{1,64}$/.test(robot) ? `?robot=${robot}` : "";
  let target = "/living-lab/meet?error=not_found";
  try {
    const result = await loadCard(token);
    if (result.state === "rate_limited") target = "/living-lab/meet?error=rate_limited";
    if (result.state === "ok") {
      const { code, status, expiresAt } = result.passport;
      const usable = status === "active" && (!expiresAt || expiresAt.getTime() > Date.now());
      if (usable) target = `/living-lab/meet/${code}${robotQuery}`;
    }
  } catch (error) {
    console.error("HRI journey handoff unavailable", error);
  }
  redirect(target);
}
