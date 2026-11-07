import { prisma } from "@/lib/prisma";
import { API_LIMITS } from "@/lib/hri/passport-api";
import { consumeRateLimit, currentClientId, peekRateLimit } from "@/lib/hri/rate-limit";
import { hashToken, isWellFormedToken } from "@/lib/hri/security";

// Looking a passport up by its access token, for pages and actions that already hold the token
// (the passport card, and the Robot Lab's "start the hospital journey"). Same budgets as the robot API.

const PASSPORT_FIELDS = {
  code: true,
  greeting: true,
  comfortDistance: true,
  speed: true,
  gaze: true,
  voice: true,
  language: true,
  captions: true,
  speechPace: true,
  noReach: true,
  status: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  expiresAt: true
} as const;

export type PassportRow = {
  code: string;
  greeting: string;
  comfortDistance: number;
  speed: number;
  gaze: string;
  voice: boolean;
  language: string;
  captions: string;
  speechPace: string;
  noReach: boolean;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
};

export type CardState =
  | { state: "ok"; passport: PassportRow }
  | { state: "rate_limited" }
  | { state: "not_found" };

// The card is protected like the API: an unknown token counts toward the shared failed-lookup
// budget, and every caller gets the same per-minute request budget as a robot would.
export async function loadCard(token: string): Promise<CardState> {
  const caller = await currentClientId();
  const { requests, misses } = API_LIMITS;
  if (!(await consumeRateLimit(`card:${caller}`, requests.limit, requests.windowSeconds)).allowed) {
    return { state: "rate_limited" };
  }
  if (!(await peekRateLimit(`miss:${caller}`, misses.limit, misses.windowSeconds)).allowed) {
    return { state: "rate_limited" };
  }
  if (!isWellFormedToken(token)) {
    await consumeRateLimit(`miss:${caller}`, misses.limit, misses.windowSeconds);
    return { state: "not_found" };
  }
  const passport = await prisma.hriPassport.findUnique({
    where: { accessTokenHash: hashToken(token) },
    select: PASSPORT_FIELDS
  });
  if (!passport) {
    await consumeRateLimit(`miss:${caller}`, misses.limit, misses.windowSeconds);
    return { state: "not_found" };
  }
  return { state: "ok", passport };
}

