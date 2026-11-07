import type { Metadata } from "next";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import LivingLabClient, { type LabRobot } from "./LivingLabClient";
import { computeObservatory, parseWindow, windowStart, type ObservatoryStats } from "@/lib/hri/observatory";
import { readClientIdentity } from "./identity-actions";
import { identityRequired } from "@/lib/hri/identity-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HRI Wellness Living Lab | Thailand Humanoid Atlas",
  description: "One profile. Every robot understands you. Teach a simulated care robot your comfort boundaries once, carry them to every robot as a Care Passport, and see the research behind it.",
  alternates: { canonical: "/living-lab" }
};

// Robots whose registry type is about care, health or companionship: candidates for a passport meeting.
const CARE_TYPES = /hospital|medical|elder|care|rehab|therapy|telepresence|companion|assist|service/i;

type SearchParams = Promise<{ window?: string }>;

export default async function LivingLabPage({ searchParams }: { searchParams: SearchParams }) {
  const cookieStore = await cookies();
  const lang = (cookieStore.get("lang")?.value || "en") as "en" | "th";
  const range = parseWindow((await searchParams).window);
  const since = windowStart(range, new Date());

  let stats: ObservatoryStats | null = null;
  let robots: LabRobot[] = [];
  try {
    const created = since ? { createdAt: { gte: since } } : {};
    const started = since ? { startedAt: { gte: since } } : {};
    const [passports, robotRows, calibrations, stations] = await Promise.all([
      prisma.hriPassport.findMany({
        where: created,
        select: { comfortDistance: true, gaze: true, voice: true, speed: true, greeting: true, captions: true, noReach: true, participantId: true }
      }),
      prisma.robotModel.findMany({ select: { id: true, canonicalName: true, robotType: true, developerOrg: true, manufacturer: true }, orderBy: { canonicalName: "asc" } }),
      prisma.hriSession.findMany({ where: { protocol: "wai_first_calibration", ...started }, select: { summaryJson: true, inputMode: true }, orderBy: { startedAt: "desc" }, take: 2000 }),
      prisma.hriSession.findMany({ where: { protocol: "care_journey_station", ...started }, select: { summaryJson: true }, orderBy: { startedAt: "desc" }, take: 5000 })
    ]);
    // Aggregates only leave the server: lib/hri/observatory.ts.
    stats = computeObservatory({
      window: range,
      passports,
      calibrations: calibrations.map((c) => ({ inputMode: c.inputMode, summary: c.summaryJson })),
      stations: stations.map((s) => ({ summary: s.summaryJson }))
    });
    robots = robotRows
      .filter((r) => CARE_TYPES.test(r.robotType))
      .map((r) => ({ id: r.id, name: r.canonicalName, type: r.robotType, org: r.developerOrg ?? r.manufacturer ?? null }));
  } catch (error) {
    console.error("Living Lab: database unavailable", error instanceof Error ? error.message : "unknown error");
  }

  const identity = await readClientIdentity();
  return <LivingLabClient lang={lang} stats={stats} robots={robots} initialIdentity={identity} identityRequired={identityRequired()} />;
}
