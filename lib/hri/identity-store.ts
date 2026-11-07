// Prisma adapter for IdentityStore (tables "HriParticipant" and "HriEmailChallenge").
import { prisma } from "@/lib/prisma";
import type { IdentityStore } from "./identity";

export const prismaIdentityStore: IdentityStore = {
  async latestChallenge(email) {
    return prisma.hriEmailChallenge.findFirst({ where: { email }, orderBy: { createdAt: "desc" } });
  },

  async replaceChallenge({ email, codeHash, expiresAt, now }) {
    const [, created] = await prisma.$transaction([
      prisma.hriEmailChallenge.updateMany({ where: { email, consumedAt: null }, data: { consumedAt: now } }),
      prisma.hriEmailChallenge.create({ data: { email, codeHash, expiresAt, createdAt: now } })
    ]);
    // Expired challenges are useless after a day. Occasional cleanup, not security-relevant.
    if (Math.random() < 0.01) {
      prisma.hriEmailChallenge.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 86_400_000) } } }).catch(() => undefined);
    }
    return created;
  },

  async discardChallenge(id) {
    await prisma.hriEmailChallenge.deleteMany({ where: { id } });
  },

  async recordFailedAttempt(id) {
    const row = await prisma.hriEmailChallenge.update({ where: { id }, data: { attempts: { increment: 1 } }, select: { attempts: true } });
    return row.attempts;
  },

  async consumeChallenge(id, now) {
    // Conditional update: two parallel verifications of the same code cannot both succeed.
    const { count } = await prisma.hriEmailChallenge.updateMany({ where: { id, consumedAt: null }, data: { consumedAt: now } });
    return count === 1;
  },

  async upsertParticipant(email, now) {
    return prisma.hriParticipant.upsert({
      where: { email },
      create: { email, verifiedAt: now },
      update: {},
      select: { id: true, email: true, sessionVersion: true }
    });
  },

  async findParticipant(id) {
    return prisma.hriParticipant.findUnique({ where: { id }, select: { id: true, email: true, sessionVersion: true } });
  }
};
