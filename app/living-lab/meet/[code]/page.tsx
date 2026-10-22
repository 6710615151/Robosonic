import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normalizePassportCode } from "@/lib/hri/passport";
import MeetClient, { type Station } from "./MeetClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hospital Journey with a Care Passport | HRI Living Lab",
  robots: { index: false, follow: false }
};

type Params = Promise<{ code: string }>;
type SearchParams = Promise<{ robot?: string }>;

// A patient's hospital journey, played by real robots from the atlas registry (seed data from
// thailand_humanoid_atlas_seed_records.json). Each station has a task the robot really performs.
const JOURNEY: { task: Station["task"]; match: RegExp; typeMatch: RegExp }[] = [
  { task: "reception", match: /Mr SAM/i, typeMatch: /administrative|outpatient|service/i },
  { task: "delivery", match: /Pinto/i, typeMatch: /delivery|medical_assist/i },
  { task: "telepresence", match: /Ninja|Mirror Telepresence/i, typeMatch: /telepresence/i }
];

export default async function MeetPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { code: rawCode } = await params;
  const { robot: robotId } = await searchParams;
  const code = normalizePassportCode(rawCode);
  const lang = ((await cookies()).get("lang")?.value || "en") as "en" | "th";

  const passport = await prisma.hriPassport.findUnique({
    where: { code },
    select: {
      code: true, greeting: true, comfortDistance: true, speed: true, gaze: true, voice: true, language: true,
      anxiety: true, captions: true, speechPace: true, noReach: true
    }
  });
  if (!passport) redirect("/living-lab/meet?error=not_found");

  const robots = await prisma.robotModel.findMany({
    select: { id: true, canonicalName: true, robotType: true, developerOrg: true, manufacturer: true }
  });
  const used = new Set<string>();
  const stations: Station[] = [];
  for (const step of JOURNEY) {
    const robot =
      robots.find((r) => !used.has(r.id) && step.match.test(r.canonicalName)) ??
      robots.find((r) => !used.has(r.id) && step.typeMatch.test(r.robotType));
    if (!robot) continue;
    used.add(robot.id);
    stations.push({
      task: step.task,
      robotId: robot.id,
      name: robot.canonicalName,
      type: robot.robotType,
      org: robot.developerOrg ?? robot.manufacturer ?? null
    });
  }
  const startIndex = Math.max(0, stations.findIndex((s) => s.robotId === robotId));

  // Prisma stores these as strings; narrow them once at the page boundary.
  const care = {
    anxiety: (passport.anxiety === "medium" || passport.anxiety === "high" ? passport.anxiety : "low") as "low" | "medium" | "high",
    captions: (passport.captions === "large" ? "large" : "normal") as "normal" | "large",
    speechPace: (passport.speechPace === "slow" ? "slow" : "normal") as "normal" | "slow"
  };

  return <MeetClient lang={lang} passport={{ ...passport, ...care }} stations={stations} startIndex={startIndex} />;
}
