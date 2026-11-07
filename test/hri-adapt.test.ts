import assert from "node:assert/strict";
import { test } from "node:test";
import { adapt, ADAPTATION_PRIORITY, DEFAULT_PLAN, explainPlan } from "../lib/hri/adapt";
import { toPublicProfile } from "../lib/hri/public-profile";
import { ROBOT_PROFILES } from "../lib/hri/robot-profiles";

const base = {
  comfortDistance: 0.4,
  speed: 1.1,
  gaze: "soft",
  language: "th",
  speechPace: "normal",
  greeting: "wai",
  voice: true,
  captions: "normal",
  noReach: true,
  anxiety: "low",
  status: "active",
  version: 1,
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  expiresAt: null
};

const full = ROBOT_PROFILES.find((r) => r.id === "a-humanoid")!;
const screen = ROBOT_PROFILES.find((r) => r.id === "b-screen")!;

const profile = (overrides: Partial<typeof base> = {}) =>
  toPublicProfile({ ...base, ...overrides });

test("adapt: a full humanoid applies every preference as written", () => {
  const plan = adapt(profile(), full);
  assert.equal(plan.distance.sceneUnits, 0.4);
  assert.equal(plan.distance.fixed, false);
  assert.equal(plan.movement.multiplier, 1.1);
  assert.equal(plan.movement.mobile, true);
  assert.equal(plan.eyeContact, "soft");
  assert.equal(plan.eyeMechanism, "head_and_eyes");
  assert.equal(plan.greeting, "wai");
  assert.equal(plan.voice, true);
  assert.equal(plan.handover, "place_nearby");
  assert.equal(plan.language, "th");
  assert.equal(plan.demeanor, "friendly");
  assert.deepEqual(plan.adaptations, []);
});

test("adapt: high anxiety is already folded into the profile, not re-derived", () => {
  const plan = adapt(profile({ speed: 1.4, anxiety: "high", captions: "large", speechPace: "slow" }), full);
  assert.equal(plan.movement.multiplier, 0.5, "careSpeed caps high anxiety at 0.5");
  assert.equal(plan.demeanor, "calm");
  assert.equal(plan.captions, "large");
  assert.equal(plan.speechRate, 0.85);
});

test("adapt: a screen-only robot keeps its base, cannot gaze, gesture or hand over", () => {
  const plan = adapt(profile(), screen);
  assert.equal(plan.distance.sceneUnits, 0);
  assert.equal(plan.distance.fixed, true);
  assert.equal(plan.movement.multiplier, 0);
  assert.equal(plan.movement.mobile, false);
  assert.equal(plan.eyeContact, "none");
  assert.equal(plan.eyeMechanism, "screen_cue");
  assert.equal(plan.greeting, "none");
  assert.equal(plan.handover, "place_nearby");
  assert.equal(plan.voice, true, "it still has a speaker");
  const codes = plan.adaptations.map((a) => a.code);
  assert.deepEqual(codes.sort(), ["fixed_base_distance", "fixed_base_speed", "no_arms", "no_head"]);
});

test("adapt: hardware speed caps are applied and reported", () => {
  const capped = { ...full, capabilities: { ...full.capabilities, maxSpeedMultiplier: 1 } };
  const plan = adapt(profile({ speed: 1.4 }), capped);
  assert.equal(plan.movement.multiplier, 1);
  assert.deepEqual(plan.adaptations, [{ code: "speed_capped", value: "×1" }]);
});

test("adapt: a robot without a speaker falls back to text", () => {
  const quiet = { ...full, capabilities: { ...full.capabilities, speaker: false } };
  const plan = adapt(profile({ voice: true }), quiet);
  assert.equal(plan.voice, false);
  assert.deepEqual(plan.adaptations, [{ code: "no_speaker" }]);
});

test("adapt: a request for no greeting stays silent on a full humanoid", () => {
  const plan = adapt(profile({ greeting: "none" }), full);
  assert.equal(plan.greeting, "none");
  assert.deepEqual(plan.adaptations, []);
});

test("adapt: pure and deterministic, never mutates the profile", () => {
  const source = profile();
  const snapshot = JSON.parse(JSON.stringify(source));
  const a = adapt(source, screen);
  const b = adapt(source, screen);
  assert.deepEqual(a, b);
  assert.deepEqual(JSON.parse(JSON.stringify(source)), snapshot);
});

test("adapt: the no-passport default matches the meet flow's default behaviour", () => {
  assert.equal(DEFAULT_PLAN.distance.sceneUnits, 1.3);
  assert.equal(DEFAULT_PLAN.movement.multiplier, 1.4);
  assert.equal(DEFAULT_PLAN.eyeContact, "direct");
  assert.equal(DEFAULT_PLAN.greeting, "wave");
  assert.equal(DEFAULT_PLAN.voice, true);
  assert.equal(DEFAULT_PLAN.handover, "hand_to_person");
  assert.equal(DEFAULT_PLAN.demeanor, "friendly");
});

// ---------------- safety priority and explanations ----------------

test("adapt: with no rules the plan is unchanged (rules are opt-in)", () => {
  assert.deepEqual(adapt(profile(), full, []), adapt(profile(), full));
});

test("adapt: a clinical speed limit wins over a faster passport preference", () => {
  const plan = adapt(profile({ speed: 1.6 }), full, [{ source: "clinical", maxSpeedMultiplier: 0.8 }]);
  assert.equal(plan.movement.multiplier, 0.8);
  assert.ok(plan.adaptations.some((a) => a.code === "safety_speed_limit" && a.source === "clinical"));
});

test("adapt: a passport that is already slower than the limit is never sped up", () => {
  const plan = adapt(profile({ speed: 0.5 }), full, [{ source: "clinical", maxSpeedMultiplier: 0.8 }]);
  assert.equal(plan.movement.multiplier, 0.5);
  assert.ok(!plan.adaptations.some((a) => a.code === "safety_speed_limit"));
});

test("adapt: a minimum-distance rule keeps a 'close' passport farther away", () => {
  const plan = adapt(profile({ comfortDistance: 1.3 }), full, [{ source: "clinical", maxCloseness: 0.6 }]);
  assert.ok(plan.distance.closeness <= 0.6);
  assert.notEqual(plan.distance.band, "close");
  assert.ok(plan.adaptations.some((a) => a.code === "safety_distance_limit"));
});

test("adapt: hardware rules apply before clinical ones, and the tighter limit holds", () => {
  const robot = { ...full, safety: [{ source: "hardware" as const, maxSpeedMultiplier: 0.6 }] };
  const plan = adapt(profile({ speed: 2 }), robot, [{ source: "clinical", maxSpeedMultiplier: 0.9 }]);
  assert.equal(plan.movement.multiplier, 0.6);
  const limits = plan.adaptations.filter((a) => a.code === "safety_speed_limit");
  assert.equal(limits.length, 1);
  assert.equal(limits[0].source, "hardware");
  assert.deepEqual([...ADAPTATION_PRIORITY], ["hardware", "clinical", "passport", "default"]);
});

test("adapt: safety rules do not move a fixed-base robot", () => {
  const plan = adapt(profile({ speed: 2 }), screen, [{ source: "clinical", maxSpeedMultiplier: 0.5, maxCloseness: 0.2 }]);
  assert.equal(plan.movement.multiplier, 0);
  assert.equal(plan.distance.sceneUnits, 0);
  assert.ok(!plan.adaptations.some((a) => a.code.startsWith("safety_")));
});

test("adapt: large captions without a screen fall back to normal with a reason", () => {
  const noScreen = { ...full, capabilities: { ...full.capabilities, screen: false } };
  const plan = adapt(profile({ captions: "large" }), noScreen);
  assert.equal(plan.captions, "normal");
  assert.ok(plan.adaptations.some((a) => a.code === "no_screen"));
});

test("explainPlan: a full humanoid applies every preference", () => {
  const p = profile();
  const rows = explainPlan(p, adapt(p, full));
  assert.ok(rows.every((r) => r.outcome === "applied"), JSON.stringify(rows));
});

test("explainPlan: the screen robot reports what it cannot do and why", () => {
  const p = profile({ greeting: "wai" });
  const rows = Object.fromEntries(explainPlan(p, adapt(p, screen)).map((r) => [r.key, r]));
  assert.equal(rows.distance.outcome, "not_supported");
  assert.equal(rows.movement.applied, "stationary");
  assert.equal(rows.eyeContact.applied, "screen_cue");
  assert.equal(rows.greeting.outcome, "not_supported");
  assert.ok(rows.greeting.reasons.some((r) => r.code === "no_arms"));
  // place_nearby was asked for and is what happens: no failure is reported.
  assert.equal(rows.handover.outcome, "applied");
  assert.equal(rows.voice.outcome, "applied");
});

test("explainPlan: a safety limit is 'adapted', not 'not supported'", () => {
  const p = profile({ speed: 1.6 });
  const rows = explainPlan(p, adapt(p, full, [{ source: "clinical", maxSpeedMultiplier: 0.8 }]));
  const movement = rows.find((r) => r.key === "movement")!;
  assert.equal(movement.requested, "fast");
  assert.equal(movement.applied, "slow");
  assert.equal(movement.outcome, "adapted");
});
