"use server";

import { prisma } from "@/lib/prisma";
import { API_LIMITS } from "@/lib/hri/passport-api";
import { normalizePassportCode } from "@/lib/hri/passport";
import { consumeRateLimit, currentClientId } from "@/lib/hri/rate-limit";
import { hashToken, isWellFormedToken } from "@/lib/hri/security";

// End of the hospital journey: is the passport just used one this browser created? The browser sends
// the access tokens it holds edit keys for (localStorage); the answer is the matching token or null.
// Nothing new is revealed: the caller already holds each token, and a token opens the card showing its
// code. Uses the same per-minute request budget as the passport card page.
export async function matchOwnPassport(code: string, tokens: string[]): Promise<string | null> {
  const wanted = normalizePassportCode(code);
  const candidates = (Array.isArray(tokens) ? tokens : []).filter((t) => typeof t === "string" && isWellFormedToken(t)).slice(0, 5);
  if (wanted.length !== 6 || !candidates.length) return null;
  try {
    const caller = await currentClientId();
    const { requests } = API_LIMITS;
    if (!(await consumeRateLimit(`card:${caller}`, requests.limit, requests.windowSeconds)).allowed) return null;
    const rows = await prisma.hriPassport.findMany({
      where: { accessTokenHash: { in: candidates.map(hashToken) }, code: wanted },
      select: { accessTokenHash: true }
    });
    const hit = rows[0]?.accessTokenHash;
    return hit ? candidates.find((t) => hashToken(t) === hit) ?? null : null;
  } catch (error) {
    console.error("HRI own-passport match unavailable", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}
