import assert from "node:assert/strict";
import { test } from "node:test";
import { AUTO_STEPS, AutoCalibrator, type AutoEvent, type VoiceCue } from "../lib/hri/auto-calibration";
import { POSE, type Landmark } from "../lib/hri/signals";

// A calm person facing the camera at a steady distance.
function body(): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
  const set = (i: number, x: number, y: number) => (lm[i] = { x, y, visibility: 0.95 });
  const w = 0.24, cx = 0.5, sy = 0.42;
  set(POSE.lShoulder, cx + w / 2, sy);
  set(POSE.rShoulder, cx - w / 2, sy);
  set(POSE.nose, cx, sy - 0.6 * w);
  set(POSE.lElbow, cx + 0.6 * w, sy + 0.6 * w); set(POSE.rElbow, cx - 0.6 * w, sy + 0.6 * w);
  set(POSE.lWrist, cx + 0.6 * w, sy + 1.2 * w); set(POSE.rWrist, cx - 0.6 * w, sy + 1.2 * w);
  return lm;
}

// Drives a calibrator frame by frame, so a test can inject a spoken cue at an exact moment.
class Session {
  cal = new AutoCalibrator("th");
  events: AutoEvent[] = [];
  t = 0;

  step(count = 1) {
    for (let i = 0; i < count; i++) {
      this.events.push(...this.cal.update({ tMs: this.t, landmarks: body(), people: 1, luma: 120 }));
      this.t += 1000 / 30;
    }
  }
  until(done: () => boolean, maxMs = 120_000) {
    const limit = this.t + maxMs;
    while (!done() && this.t < limit && this.cal.stage !== "complete" && this.cal.stage !== "aborted") this.step();
    assert.ok(done() || this.cal.stage === "complete", "reached the expected moment");
  }
  say(cue: VoiceCue) {
    const out = this.cal.applyVoice(cue);
    this.events.push(...out);
    return out;
  }
  finish() {
    this.until(() => this.cal.stage === "complete");
    return this.events.find((e) => e.type === "complete") as Extract<AutoEvent, { type: "complete" }>;
  }
}

const atStep = (s: Session, index: number, stage: "moving" | "dwell") => () => s.cal.stepIndex === index && s.cal.stage === stage;

test("voice: saying hello while the robot waits counts as the greeting", () => {
  const s = new Session();
  s.until(() => s.cal.stage === "greet");
  const out = s.say("greeted");
  assert.ok(out.some((e) => e.type === "wai_received"));
  assert.equal(s.cal.stage, "returning_wai");
  assert.equal(s.finish().evidence.waiDetected, true);
});

test("voice: 'too close' backs the robot off, tagged as spoken, without counting as a lean-back", () => {
  const s = new Session();
  s.until(atStep(s, 2, "dwell"));
  const before = s.cal.distance;
  const out = s.say("too_close");
  const close = out.find((e) => e.type === "too_close") as Extract<AutoEvent, { type: "too_close" }>;
  assert.equal(close.source, "voice");
  assert.equal(close.backTo, Math.round((before - 0.8) * 100) / 100);
  const set = out.find((e) => e.type === "distance_set") as Extract<AutoEvent, { type: "distance_set" }>;
  assert.equal(set.reason, "voice_too_close");
  assert.equal(set.source, "voice");
  const done = s.finish();
  assert.equal(done.evidence.voiceCorrections, 1);
  assert.equal(done.evidence.leanBacks, 0, "the camera saw no lean-back");
  assert.equal(done.result.comfortDistance, close.backTo);
});

test("voice: 'too fast' halves the speed and steps back one step, then the approach continues", () => {
  const s = new Session();
  s.until(atStep(s, 2, "moving"));
  const out = s.say("too_fast");
  const fast = out.find((e) => e.type === "too_fast") as Extract<AutoEvent, { type: "too_fast" }>;
  assert.equal(fast.source, "voice");
  assert.equal(fast.speed, 0.5);
  assert.equal(fast.retreatTo, AUTO_STEPS[1]);
  const done = s.finish();
  assert.equal(done.result.speed, 0.5);
  assert.equal(done.evidence.tooFast, 1);
  assert.equal(done.evidence.voiceCorrections, 1);
});

test("voice: 'just right' settles at the current step right away", () => {
  const s = new Session();
  s.until(atStep(s, 2, "dwell"));
  const here = s.cal.distance;
  const out = s.say("comfortable");
  const set = out.find((e) => e.type === "distance_set") as Extract<AutoEvent, { type: "distance_set" }>;
  assert.equal(set.reason, "voice_comfortable");
  assert.equal(set.distance, here);
  assert.equal(s.cal.stage, "gaze");
  assert.equal(s.finish().result.comfortDistance, here);
});

test("voice: 'continue' moves one step but can never reach the closest step", () => {
  const s = new Session();
  s.until(atStep(s, 1, "dwell"));
  const out = s.say("continue");
  assert.ok(out.some((e) => e.type === "step" && (e as { index: number }).index === 2));
  s.until(atStep(s, AUTO_STEPS.length - 1, "dwell"));
  assert.deepEqual(s.say("continue"), [], "at the last regular step a spoken 'continue' is ignored");
  assert.equal(s.cal.stepIndex, AUTO_STEPS.length - 1);
});

test("voice: cues that do not fit the moment are ignored", () => {
  const s = new Session();
  s.until(() => s.cal.stage === "greet");
  assert.deepEqual(s.say("too_close"), []);
  assert.deepEqual(s.say("comfortable"), []);
  s.until(atStep(s, 1, "dwell"));
  assert.deepEqual(s.say("greeted"), []);
});

test("voice: two spoken corrections count as discomfort: more distance, slower speed", () => {
  const s = new Session();
  s.until(atStep(s, 2, "moving"));
  s.say("too_fast");
  s.until(atStep(s, 2, "dwell"));
  const out = s.say("too_close");
  const set = out.find((e) => e.type === "distance_set") as Extract<AutoEvent, { type: "distance_set" }>;
  assert.match(set.reason, /voice_too_close\+discomfort/);
  assert.ok(set.speed <= 0.5);
});

test("voice: nothing is applied after the session ended", () => {
  const s = new Session();
  s.finish();
  assert.deepEqual(s.say("too_close"), []);
});
