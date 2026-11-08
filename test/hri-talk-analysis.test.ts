import { test } from "node:test";
import assert from "node:assert/strict";
import { TalkAnalyzer, TALK_GAZE_MIN_FRAMES } from "../lib/hri/talk-analysis";

// Pose landmarks with shoulders `width` apart and the nose shifted sideways by `turn` shoulder-widths.
function pose(turn: number, width = 0.3) {
  const lm = Array.from({ length: 17 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  lm[11] = { x: 0.5 + width / 2, y: 0.6, visibility: 1 };
  lm[12] = { x: 0.5 - width / 2, y: 0.6, visibility: 1 };
  lm[0] = { x: 0.5 + turn * width, y: 0.4, visibility: 1 };
  return lm;
}

test("gaze needs enough frames, then follows the share of looking away", () => {
  const a = new TalkAnalyzer();
  for (let i = 0; i < TALK_GAZE_MIN_FRAMES - 1; i++) a.frame(i * 100, pose(0.5), true);
  assert.equal(a.gaze(), null);
  a.frame(99_000, pose(0.5), true);
  assert.equal(a.gaze(), "soft");

  const b = new TalkAnalyzer();
  for (let i = 0; i < 80; i++) b.frame(i * 100, pose(i % 10 === 0 ? 0.5 : 0), true);
  assert.equal(b.gaze(), "direct");
});

test("frames while the robot looks away do not count toward gaze", () => {
  const a = new TalkAnalyzer();
  for (let i = 0; i < 100; i++) a.frame(i * 100, pose(0.5), false);
  assert.equal(a.summary().gazeFrames, 0);
  assert.equal(a.gaze(), null);
});

test("a lean-back is reported once and counted", () => {
  const a = new TalkAnalyzer();
  let fired = 0;
  for (let i = 0; i < 10; i++) if (a.frame(i * 100, pose(0, 0.3), true)) fired++;
  for (let i = 10; i < 20; i++) if (a.frame(i * 100, pose(0, 0.22), true)) fired++;
  assert.equal(fired, 1);
  assert.equal(a.summary().leanBacks, 1);
});

test("replies give averages; empty or implausible ones are ignored", () => {
  const a = new TalkAnalyzer();
  a.answer("สบายดีครับ", 1200, 2000);
  a.answer("ok fine", 800, 1000);
  a.answer("   ", 500, 1000);
  a.answer("hello", 90_000);
  const s = a.summary();
  assert.equal(s.answers, 2);
  assert.equal(s.meanResponseMs, 1000);
  assert.equal(s.meanCharsPerSecond, ("สบายดีครับ".length / 2 + "okfine".length / 1) / 2);
});

import { finalizeTalkReply } from "../lib/hri/interview-guard";
import { buildInterviewBody, interviewRequestSchema } from "../lib/hri/interview-ai";

const talkRequest = (text: string, opening = false) => interviewRequestSchema.parse({
  lang: "th", mode: "talk", opening, text, history: [], pending: [],
  state: { distance: "medium", speed: "normal", gaze: "direct", voice: "on", captions: "normal", speechPace: "normal", handover: "place", greeting: "wai" },
  camera: { waiDetected: true, leanBacks: 0, tooFast: 0, voiceCorrections: 0, leanIn: false, gazeMeasured: false, avertShare: null }
});

test("talk mode keeps the robot's small talk but records only preferences the person named", () => {
  const chat = finalizeTalkReply(talkRequest("วันนี้ไปกินข้าวกับเพื่อนมา"), { say: "ฟังดูสนุกจังครับ", updates: { voice: "off", captions: "large" }, certainty: "clear", save: true });
  assert.deepEqual(chat, { say: "ฟังดูสนุกจังครับ", updates: {}, save: false });

  const asked = finalizeTalkReply(talkRequest("ช่วยพูดช้าๆ หน่อยนะ แล้วก็ถอยไปหน่อย"), { say: "ได้เลยครับ", updates: {}, certainty: "unclear", save: false });
  assert.equal(asked.updates.speechPace, "slow");
  assert.equal(asked.updates.distance, "farther");
  assert.equal(asked.save, false);
});

test("talk mode uses its own prompt and never the interview topics", () => {
  const body = buildInterviewBody(talkRequest("", true));
  const prompt = body.systemInstruction.parts[0].text;
  assert.match(prompt, /small talk/);
  assert.doesNotMatch(prompt, /Topics still to ask about/);
});
