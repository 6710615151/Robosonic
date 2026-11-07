// Which Atlas registry robots play the hospital journey's stations. One place, so the journey page
// and the registry list (which says which robots are in the journey) can never disagree.
// Pure and client-safe; unit-tested in test/hri-journey-stations.test.ts.

export type StationTask = "reception" | "delivery" | "telepresence";

export type RegistryRobot = { id: string; canonicalName: string; robotType: string };

// A patient's hospital journey, played by real robots from the atlas registry (seed data from
// thailand_humanoid_atlas_seed_records.json). Each station has a task the robot really performs.
// A named robot is preferred; otherwise the first unused robot of a fitting type.
export const JOURNEY: { task: StationTask; match: RegExp; typeMatch: RegExp }[] = [
  { task: "reception", match: /Mr SAM/i, typeMatch: /administrative|outpatient|service/i },
  { task: "delivery", match: /Pinto/i, typeMatch: /delivery|medical_assist/i },
  { task: "telepresence", match: /Ninja|Mirror Telepresence/i, typeMatch: /telepresence/i }
];

// The stations in journey order. A station with no fitting robot is left out, so there may be fewer than 3.
export function pickStations<R extends RegistryRobot>(robots: R[]): { task: StationTask; robot: R }[] {
  const used = new Set<string>();
  const stations: { task: StationTask; robot: R }[] = [];
  for (const step of JOURNEY) {
    const robot =
      robots.find((r) => !used.has(r.id) && step.match.test(r.canonicalName)) ??
      robots.find((r) => !used.has(r.id) && step.typeMatch.test(r.robotType));
    if (!robot) continue;
    used.add(robot.id);
    stations.push({ task: step.task, robot });
  }
  return stations;
}
