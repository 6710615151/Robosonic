// Hospital-journey research protocol: every station is run in both conditions (a default robot that
// has not read the passport, and the same robot after it has), each rated 1-5 by the person.
// The order alternates from station to station, and the first station's order depends on a random
// journey id, so across people both orders start equally often (counterbalancing against order effects).
// Pure and client-safe; unit-tested in test/hri-journey.test.ts.

export type JourneyMode = "passport" | "default";
export type StationRatings = Partial<Record<JourneyMode, number>>;

// A random id for one journey run. Not derived from the passport or the person: it only links the two
// ratings of the same station so they can be compared as a pair.
export function newJourneyId(random: (n: number) => Uint8Array = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))): string {
  return Array.from(random(6), (b) => b.toString(16).padStart(2, "0")).join("");
}

function parity(journeyId: string) {
  let hash = 0;
  for (const char of journeyId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash & 1;
}

export function conditionOrder(journeyId: string, stationIndex: number): [JourneyMode, JourneyMode] {
  return (parity(journeyId) + stationIndex) % 2 === 0 ? ["passport", "default"] : ["default", "passport"];
}

export const stationComplete = (ratings: StationRatings | undefined) =>
  typeof ratings?.passport === "number" && typeof ratings?.default === "number";

// Which condition comes next at a station, or null when both are rated.
export function nextCondition(journeyId: string, stationIndex: number, ratings: StationRatings | undefined): { mode: JourneyMode; position: 1 | 2 } | null {
  const order = conditionOrder(journeyId, stationIndex);
  if (typeof ratings?.[order[0]] !== "number") return { mode: order[0], position: 1 };
  if (typeof ratings?.[order[1]] !== "number") return { mode: order[1], position: 2 };
  return null;
}
