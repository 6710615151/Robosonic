// Server-side reads (import only from server components) shared by the Living Lab pages. Only aggregates and public registry rows leave
// this file; the aggregation rules (and the n < 5 privacy suppression) live in lib/hri/observatory.ts.
import { prisma } from "@/lib/prisma";
import { computeObservatory, windowStart, type ObservatoryStats, type ObservatoryWindow } from "@/lib/hri/observatory";

import { pickStations } from "@/lib/hri/journey-stations";

// inJourney: this robot plays a hospital-journey station (the same rule as /living-lab/meet/[code]).
export type LabRobot = { id: string; name: string; type: string; org: string | null; inJourney: boolean };

// Robots whose registry type is about care, health or companionship: candidates for a passport meeting.
const CARE_TYPES = /hospital|medical|elder|care|rehab|therapy|telepresence|companion|assist|service/i;

const logOffline = (where: string, error: unknown) =>
  console.error(`Living Lab ${where}: database unavailable`, error instanceof Error ? error.message : "unknown error");

// Care robots from the Atlas registry, or null when the database cannot be reached.
export async function loadCareRobots(): Promise<LabRobot[] | null> {
  try {
    const rows = await prisma.robotModel.findMany({
      select: { id: true, canonicalName: true, robotType: true, developerOrg: true, manufacturer: true },
      orderBy: { canonicalName: "asc" }
    });
    // Stations are picked from every registry row in database order, exactly as the journey page does.
    const stationIds = new Set(pickStations(await prisma.robotModel.findMany({ select: { id: true, canonicalName: true, robotType: true } })).map((s) => s.robot.id));
    return rows
      .filter((r) => CARE_TYPES.test(r.robotType) || stationIds.has(r.id))
      .map((r) => ({ id: r.id, name: r.canonicalName, type: r.robotType, org: r.developerOrg ?? r.manufacturer ?? null, inJourney: stationIds.has(r.id) }));
  } catch (error) {
    logOffline("robots", error);
    return null;
  }
}

// Research Observatory aggregates for a time window, or null when the database cannot be reached.
export async function loadObservatory(range: ObservatoryWindow): Promise<ObservatoryStats | null> {
  const since = windowStart(range, new Date());
  try {
    const created = since ? { createdAt: { gte: since } } : {};
    const started = since ? { startedAt: { gte: since } } : {};
    const [passports, calibrations, stations] = await Promise.all([
      prisma.hriPassport.findMany({
        where: created,
        select: { comfortDistance: true, gaze: true, voice: true, speed: true, greeting: true, captions: true, noReach: true, participantId: true }
      }),
      prisma.hriSession.findMany({ where: { protocol: "wai_first_calibration", ...started }, select: { summaryJson: true, inputMode: true }, orderBy: { startedAt: "desc" }, take: 2000 }),
      prisma.hriSession.findMany({ where: { protocol: "care_journey_station", ...started }, select: { summaryJson: true }, orderBy: { startedAt: "desc" }, take: 5000 })
    ]);
    return computeObservatory({
      window: range,
      passports,
      calibrations: calibrations.map((c) => ({ inputMode: c.inputMode, summary: c.summaryJson })),
      stations: stations.map((s) => ({ summary: s.summaryJson }))
    });
  } catch (error) {
    logOffline("observatory", error);
    return null;
  }
}
