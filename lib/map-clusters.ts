// What the contribution map may show. Pure, so it can be unit-tested (test/map-clusters.test.ts).

export type ContributionMapPoint = {
  id: string;
  title: string;
  organization: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  summary: string;
  contributorType: string;
  contributionCount: number;
  detailsList: string[];
};

// Earlier versions wrote these hand-written sample clusters into the cache when an analysis failed.
// They name real institutions with invented counts, so a cache holding them must not be shown as data.
const OLD_SAMPLE_IDS = ["kmutt_fibo", "chula_robo", "vistec_brain", "cmu_robotics", "ct_asia"];

function isOldSampleData(points: { id?: unknown }[]) {
  return points.length === OLD_SAMPLE_IDS.length && points.every((point) => OLD_SAMPLE_IDS.includes(String(point.id)));
}

// The clusters a cached value holds, or null when it holds no real analysis result.
export function clustersFromCache(value: unknown): ContributionMapPoint[] | null {
  if (!Array.isArray(value) || isOldSampleData(value)) return null;
  return value as ContributionMapPoint[];
}
