// Signs a browser context in as a fresh Living Lab participant without sending an email.
// The session token comes from the real identity module (verifyCode against an in-memory store
// holding one challenge), so it is signed exactly as the server expects. The server must use the
// same secret: HRI_IDENTITY_SECRET from the environment, or the dev-only default when unset.
import { randomUUID } from "node:crypto";
import type { BrowserContext } from "@playwright/test";
import type pg from "pg";
import { createIdentity, DEV_ONLY_IDENTITY_SECRET, type ChallengeRecord, type IdentityStore } from "../lib/hri/identity";

export async function signInParticipant(db: pg.Pool, context: BrowserContext) {
  const id = `itest_${randomUUID()}`;
  const email = `${id}@itest.invalid`;
  await db.query(`INSERT INTO "HriParticipant" ("id","email","verifiedAt") VALUES ($1,$2, now() AT TIME ZONE 'UTC')`, [id, email]);

  let challenge: ChallengeRecord | null = null;
  let sentCode = "";
  const store: IdentityStore = {
    latestChallenge: async () => challenge,
    replaceChallenge: async ({ email: e, codeHash, expiresAt, now }) =>
      (challenge = { id: "c", email: e, codeHash, attempts: 0, expiresAt, consumedAt: null, createdAt: now }),
    discardChallenge: async () => { challenge = null; },
    recordFailedAttempt: async () => ++challenge!.attempts,
    consumeChallenge: async (_id, now) => { challenge!.consumedAt = now; return true; },
    upsertParticipant: async () => ({ id, email, sessionVersion: 1 }),
    findParticipant: async () => ({ id, email, sessionVersion: 1 })
  };
  const identity = createIdentity({
    store,
    mailer: { send: async ({ code }) => { sentCode = code; } },
    consume: async () => ({ allowed: true, remaining: 1, retryAfterSeconds: 0 }),
    now: () => new Date(),
    secret: process.env.HRI_IDENTITY_SECRET?.trim() || DEV_ONLY_IDENTITY_SECRET
  });
  await identity.requestCode(email, "playwright", "en");
  const result = await identity.verifyCode(email, sentCode, "playwright");
  if (!result.ok) throw new Error(`test sign-in failed: ${result.error}`);

  await context.addCookies([{ name: "hri_participant", value: result.sessionToken, domain: "localhost", path: "/living-lab", httpOnly: true, sameSite: "Lax" }]);
  return {
    id,
    email,
    // Passports are unlinked (SetNull), not deleted, when the participant goes.
    cleanup: () => db.query(`DELETE FROM "HriParticipant" WHERE "id" = $1`, [id])
  };
}
