import assert from "node:assert/strict";
import { test } from "node:test";
import { clustersFromCache } from "../lib/map-clusters";

const point = (id: string) => ({ id, title: "t", organization: "o", locationLabel: "l", latitude: 13, longitude: 100, summary: "s", contributorType: "University", contributionCount: 1, detailsList: [] });

test("map cache: a real analysis result is shown, even an empty one", () => {
  const clusters = [point("a"), point("b")];
  assert.deepEqual(clustersFromCache(clusters), clusters);
  assert.deepEqual(clustersFromCache([]), []);
});

test("map cache: the old invented sample clusters are never shown as data", () => {
  const sample = ["kmutt_fibo", "chula_robo", "vistec_brain", "cmu_robotics", "ct_asia"].map(point);
  assert.equal(clustersFromCache(sample), null);
});

test("map cache: a real result that shares one id with the samples is still shown", () => {
  const clusters = [point("kmutt_fibo"), point("somewhere_else")];
  assert.deepEqual(clustersFromCache(clusters), clusters);
});

test("map cache: anything that is not a list counts as no result", () => {
  for (const value of [null, undefined, {}, "x", 3]) assert.equal(clustersFromCache(value), null);
});
