import assert from "node:assert/strict";
import { test } from "node:test";
import { computeObservatory, MIN_CARE_CELL, observatoryCsv, parseWindow, windowStart, type PassportRow } from "../lib/hri/observatory";

const passport = (o: Partial<PassportRow> = {}): PassportRow => ({
  comfortDistance: -0.4, speed: 1, gaze: "direct", voice: true, greeting: "wai", captions: "normal", noReach: false, participantId: null, ...o
});
const station = (summary: Record<string, unknown>) => ({ summary });

test("observatory: comfort is split by condition, with sample sizes", () => {
  const s = computeObservatory({
    window: "all", passports: [], calibrations: [],
    stations: [
      station({ mode: "passport", comfort: 5, task: "reception", robot: "R1" }),
      station({ mode: "passport", comfort: 3, task: "delivery", robot: "R2" }),
      station({ mode: "default", comfort: 2, task: "reception", robot: "R1" })
    ]
  });
  assert.deepEqual(s.comfort.passport, { mean: 4, n: 2 });
  assert.deepEqual(s.comfort.default, { mean: 2, n: 1 });
  assert.equal(s.byStation.find((r) => r.task === "reception")!.default.n, 1);
  assert.equal(s.byRobot.length, 2);
});

test("observatory: invalid or missing ratings are counted as missing, never averaged", () => {
  const s = computeObservatory({
    window: "all", passports: [], calibrations: [],
    stations: [station({ mode: "passport", comfort: 9 }), station({ mode: "passport" }), station({ comfort: 4 }), station({ mode: "default", comfort: 2.5 })]
  });
  assert.equal(s.quality.missingRatings, 4);
  assert.equal(s.comfort.passport.n, 0);
  assert.equal(s.comfort.passport.mean, null);
});

test("observatory: the paired difference uses only stations rated in both conditions in one journey", () => {
  const s = computeObservatory({
    window: "all", passports: [], calibrations: [],
    stations: [
      station({ mode: "passport", comfort: 5, task: "reception", journey: "j1", order: 2 }),
      station({ mode: "default", comfort: 2, task: "reception", journey: "j1", order: 1 }),
      station({ mode: "passport", comfort: 4, task: "delivery", journey: "j1", order: 1 }), // no pair
      station({ mode: "default", comfort: 1, task: "reception" }) // legacy, no journey
    ]
  });
  assert.deepEqual(s.paired, { meanDifference: 3, n: 1 });
  assert.deepEqual(s.order, { passportFirst: 1, defaultFirst: 1, unknown: 1 });
});

test("observatory: care-need shares are suppressed below the minimum cohort", () => {
  const few = computeObservatory({ window: "all", passports: [passport({ noReach: true })], calibrations: [], stations: [] });
  assert.equal(few.preferences.noReach.share, null);
  assert.equal(few.preferences.noReach.suppressed, true);
  assert.equal(few.preferences.softGaze.suppressed, undefined);
  const many = computeObservatory({
    window: "all", passports: Array.from({ length: MIN_CARE_CELL }, (_, i) => passport({ noReach: i === 0, captions: "large" })), calibrations: [], stations: []
  });
  assert.equal(many.preferences.noReach.share, 1 / MIN_CARE_CELL);
  assert.equal(many.preferences.largeCaptions.share, 1);
});

test("observatory: participants, input modes and greetings", () => {
  const s = computeObservatory({
    window: "7d",
    passports: [passport({ participantId: "a" }), passport({ participantId: "a", greeting: "none" }), passport({ greeting: "wave" })],
    calibrations: [{ inputMode: "camera", summary: { tooClose: 2 } }, { inputMode: "auto", summary: {} }, { inputMode: "bogus", summary: null }],
    stations: []
  });
  assert.equal(s.quality.linkedParticipants, 1);
  assert.equal(s.quality.unlinkedPassports, 1);
  assert.deepEqual(s.preferences.greeting, { wai: 1, wave: 1, none: 1 });
  assert.deepEqual(s.calibration.inputModes, { buttons: 0, voice: 0, camera: 1, auto: 1 });
  assert.equal(s.calibration.tooClose, 2);
});

test("observatory: the CSV holds aggregates only and escapes robot names", () => {
  const s = computeObservatory({
    window: "all", passports: [passport()], calibrations: [],
    stations: [station({ mode: "passport", comfort: 4, task: "reception", robot: 'Mr "SAM", v2' })]
  });
  const csv = observatoryCsv(s);
  assert.ok(csv.startsWith("metric,group,condition,value,n,window\n"));
  assert.ok(csv.includes('"robot:Mr ""SAM"", v2"'));
  assert.ok(!/participant|email|code|nickname/i.test(csv));
});

test("observatory: windows", () => {
  assert.equal(parseWindow("30d"), "30d");
  assert.equal(parseWindow("1y"), "all");
  assert.equal(windowStart("all", new Date()), null);
  const now = new Date("2026-11-07T00:00:00Z");
  assert.equal(windowStart("7d", now)!.toISOString(), "2026-10-31T00:00:00.000Z");
});
