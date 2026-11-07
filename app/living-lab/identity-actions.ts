"use server";

// Thin Next adapters around lib/hri/identity.ts: caller id in, cookie out.
// Results are plain { ok, error } objects because Next redacts thrown messages in production.
import { cookies } from "next/headers";
import { maskEmail } from "@/lib/hri/identity";
import { currentClientId } from "@/lib/hri/rate-limit";
import { canSendCodes, currentParticipant, getIdentity, PARTICIPANT_COOKIE, PARTICIPANT_COOKIE_PATH } from "@/lib/hri/identity-server";

export type ClientIdentity = { email: string } | null;

export async function requestEmailCodeAction(email: string, language: "th" | "en") {
  const identity = getIdentity();
  if (!identity || !canSendCodes()) return { ok: false as const, error: "unavailable" as const };
  try {
    return await identity.requestCode(email, await currentClientId(), language === "th" ? "th" : "en");
  } catch (error) {
    console.error("Living Lab identity: requestCode failed", error instanceof Error ? error.message : error);
    return { ok: false as const, error: "unavailable" as const };
  }
}

export async function verifyEmailCodeAction(email: string, code: string) {
  const identity = getIdentity();
  if (!identity) return { ok: false as const, error: "unavailable" as const };
  try {
    const result = await identity.verifyCode(email, code, await currentClientId());
    if (!result.ok) return result;
    (await cookies()).set(PARTICIPANT_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: PARTICIPANT_COOKIE_PATH,
      maxAge: result.maxAgeSeconds
    });
    return { ok: true as const, identity: { email: maskEmail(result.participant.email) } };
  } catch (error) {
    console.error("Living Lab identity: verifyCode failed", error instanceof Error ? error.message : error);
    return { ok: false as const, error: "unavailable" as const };
  }
}

export async function signOutParticipantAction() {
  (await cookies()).set(PARTICIPANT_COOKIE, "", { path: PARTICIPANT_COOKIE_PATH, maxAge: 0 });
  return { ok: true as const };
}

// For the page: who is signed in, masked for shared screens.
export async function readClientIdentity(): Promise<ClientIdentity> {
  try {
    const participant = await currentParticipant();
    return participant ? { email: maskEmail(participant.email) } : null;
  } catch {
    return null;
  }
}
