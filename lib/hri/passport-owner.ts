// Owner-only rules for an HRI Passport card: what the edit token may change.
// Pure and client-safe (no node:crypto, no Prisma) so the same schema is unit-tested and reused
// by the server action that performs the write.
import { z } from "zod";
import { passportSchema } from "./passport";

// The owner may change every preference field, but nothing else. `.strict()` rejects smuggled
// fields such as version, status, accessTokenHash, editTokenHash or consentAt.
export const ownerPatchSchema = passportSchema.partial().strict();
export type OwnerPatch = z.infer<typeof ownerPatchSchema>;

// Owner lookups and writes are rate-limited per client, like the public API.
// unlock: verifying an edit key from the card (a wrong key is also counted as a failed lookup).
// update: saving changed preferences.
// delete: hard delete, deliberately rarer.
export const OWNER_LIMITS = {
  unlock: { scope: "owner-unlock", limit: 20, windowSeconds: 600 },
  update: { scope: "owner-update", limit: 30, windowSeconds: 600 },
  delete: { scope: "owner-delete", limit: 5, windowSeconds: 3600 }
} as const;
