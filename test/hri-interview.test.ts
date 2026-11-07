import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyInterviewUpdates, buildInterviewBody, distanceBand, interviewRequestSchema, nudgeDistance, nudgeSpeed,
  parseInterviewReply, pendingTopics, systemPrompt, toState,
  type InterviewRequest, type RawInterviewReply, type ReviewValues, type Sources
} from "../lib/hri/interview-ai";
import { evidenceFrom, finalizeInterviewReply, isHedge, yesNo } from "../lib/hri/interview-guard";

const camera = { waiDetected: true, leanBacks: 1, tooFast: 0, voiceCorrections: 0, leanIn: false, gazeMeasured: true, avertShare: 0.1 };
const baseState = { distance: "medium", speed: "normal", gaze: "direct", voice: "off", captions: "normal", speechPace: "normal", handover: "place", greeting: "wai" } as const;

function req(over: Partial<InterviewRequest> = {}): InterviewRequest {
  return interviewRequestSchema.parse({
    lang: "th", opening: false, text: "x", history: [], state: baseState,
    pending: ["voice", "readability", "handover"], camera, ...over
  });
}
const raw = (over: Partial<RawInterviewReply> = {}): RawInterviewReply => ({
  say: "รับทราบครับ", updates: {}, certainty: "clear", save: false, ...over
});

// ---------------- request and reply shape ----------------

test("interview: the request schema has no room for anxiety, nickname, code or token", () => {
  const withExtra = (key: string, where: "root" | "state" | "camera") => {
    const body = { lang: "th", text: "x", state: baseState, pending: [], camera } as Record<string, unknown>;
    if (where === "root") body[key] = "high";
    else (body[where] as Record<string, unknown>) = { ...(body[where] as object), [key]: "high" };
    return interviewRequestSchema.safeParse(body).success;
  };
  assert.equal(withExtra("anxiety", "state"), false);
  assert.equal(withExtra("nickname", "state"), false);
  assert.equal(withExtra("token", "camera"), false);
  assert.equal(interviewRequestSchema.safeParse({ lang: "th", text: "x", state: baseState, pending: [], camera }).success, true);
});

test("interview: needs words unless it is the opening turn; limits length and history", () => {
  assert.equal(interviewRequestSchema.safeParse({ lang: "th", text: "", state: baseState, pending: [], camera }).success, false);
  assert.equal(interviewRequestSchema.safeParse({ lang: "th", opening: true, state: baseState, pending: [], camera }).success, true);
  assert.equal(interviewRequestSchema.safeParse({ lang: "th", text: "ก".repeat(301), state: baseState, pending: [], camera }).success, false);
  const long = Array.from({ length: 11 }, () => ({ role: "user", text: "x" }));
  assert.equal(interviewRequestSchema.safeParse({ lang: "th", text: "x", history: long, state: baseState, pending: [], camera }).success, false);
});

test("interview: Gemini's JSON is validated; invented values and broken output are rejected", () => {
  const wrap = (value: unknown) => ({ candidates: [{ content: { parts: [{ text: typeof value === "string" ? value : JSON.stringify(value) }] } }] });
  const ok = parseInterviewReply(wrap({ say: "ครับ", updates: { voice: "on", handover: null }, certainty: "clear", save: false }));
  assert.deepEqual(ok?.updates, { voice: "on" }, "null fields are ignored");
  assert.equal(parseInterviewReply(wrap({ say: "ครับ", updates: { anxiety: "high" }, certainty: "clear", save: false }))?.updates.hasOwnProperty("anxiety"), false);
  assert.equal(parseInterviewReply(wrap({ say: "ครับ", updates: { voice: "maybe" }, certainty: "clear", save: false })), null);
  assert.equal(parseInterviewReply(wrap("not json")), null);
  assert.equal(parseInterviewReply({}), null);
});

test("interview: the Gemini body lists only the closed values and keeps the conversation order", () => {
  const body = buildInterviewBody(req({ text: "ใช่ครับ", history: [{ role: "robot", text: "พูดออกเสียงไหมครับ" }] }));
  const props = body.generationConfig.responseSchema.properties.updates.properties;
  assert.deepEqual(Object.keys(props).sort(), ["captions", "distance", "gaze", "greeting", "handover", "speechPace", "speed", "voice"]);
  assert.equal("anxiety" in props, false);
  assert.deepEqual(body.contents.map((c) => c.role), ["model", "user"]);
  const prompt = systemPrompt(req());
  assert.match(prompt, /NOT feelings/);
  assert.match(prompt, /Never interpret movement as emotion/);
});

// ---------------- the guard: the model slips we saw against real Gemini ----------------

test("guard: 'whatever' is not a choice, even if the model records one", () => {
  const out = finalizeInterviewReply(req({ text: "อืม ก็แล้วแต่", pending: ["handover"], state: { ...baseState, handover: "hand" } }), raw({ updates: { handover: "place" } }));
  assert.deepEqual(out.updates, {});
  assert.match(out.say, /ขอถามอีกครั้ง/);
  assert.equal(isHedge("ได้หมดเลยครับ"), true);
});

test("guard: 'it's all fine' on the voice question changes nothing", () => {
  const out = finalizeInterviewReply(req({ text: "ได้หมดเลยครับ", pending: ["voice", "readability", "handover"] }), raw({ updates: { voice: "on" } }));
  assert.deepEqual(out.updates, {});
  assert.match(out.say, /พูดออกเสียง/);
});

test("guard: a value nobody mentioned is dropped (the model echoing 'voice on')", () => {
  const out = finalizeInterviewReply(req({ text: "ผมกลัวหุ่นยนต์มาก และเป็นโรคหัวใจ จดไว้ด้วย" }), raw({ updates: { voice: "on" } }));
  assert.deepEqual(out.updates, {});
  assert.match(out.say, /ขอถามอีกครั้ง/);
});

test("guard: two preferences in one sentence are both recorded, even if the model caught only one", () => {
  const out = finalizeInterviewReply(req({ text: "พูดออกเสียงก็ดีครับ แต่ช่วยพูดช้าๆ หน่อย" }), raw({ updates: { voice: "on" } }));
  assert.deepEqual(out.updates, { voice: "on", speechPace: "slow" });
  assert.equal(out.say, "รับทราบครับ");
});

test("guard: a bare yes or no answers the topic the robot just asked, in the right direction", () => {
  const asked = (text: string) => ({ history: [{ role: "robot" as const, text }] });
  const handover = { pending: ["handover" as const], ...asked("ให้ผมยื่นของถึงมือคุณไหมครับ") };
  assert.deepEqual(finalizeInterviewReply(req({ text: "ได้ครับ", ...handover }), raw({ updates: { handover: "hand" } })).updates, { handover: "hand" });
  assert.deepEqual(finalizeInterviewReply(req({ text: "ไม่ครับ", ...handover, state: { ...baseState, handover: "hand" } }), raw({ updates: { handover: "place" } })).updates, { handover: "place" });
  // The model leaves the update out (nothing changes, so it sees nothing to record): the answer still counts.
  assert.deepEqual(finalizeInterviewReply(req({ text: "ใช่ครับ", pending: ["voice", "readability", "handover"], state: { ...baseState, voice: "on" }, ...asked("ให้ผมพูดออกเสียงไหมครับ") }), raw({ updates: {} })).updates, { voice: "on" });
  // The model gets the direction wrong: the person's words win, and the robot moves on.
  const wrong = finalizeInterviewReply(req({ text: "ไม่ครับ", ...handover, state: { ...baseState, handover: "place" } }), raw({ updates: { handover: "hand" } }));
  assert.deepEqual(wrong.updates, { handover: "place" });
  assert.match(wrong.say, /บันทึกพาสปอร์ต/);
});

test("guard: confirming a value that is already set still answers the topic", () => {
  const out = finalizeInterviewReply(req({ text: "พูดออกเสียงครับ", state: { ...baseState, voice: "on" }, history: [{ role: "robot", text: "ให้ผมพูดออกเสียงไหมครับ" }] }), raw({ updates: { voice: "on" } }));
  assert.deepEqual(out.updates, { voice: "on" });
  assert.equal(out.say, "รับทราบครับ");
});

test("guard: a bare yes is not applied when the robot asked about something else", () => {
  const out = finalizeInterviewReply(req({ text: "ใช่ครับ", pending: ["voice", "readability", "handover"], history: [{ role: "robot", text: "ตอนนี้ระยะห่างพอดีไหมครับ" }] }), raw({ updates: { voice: "on" } }));
  assert.deepEqual(out.updates, {});
  assert.match(out.say, /ขอถามอีกครั้ง|ให้ผมพูดออกเสียง/);
});

test("guard: distance and speed changes need the person to ask, and only in the asked direction", () => {
  const asked = finalizeInterviewReply(req({ text: "ช่วยยืนห่างกว่านี้หน่อย", pending: [] }), raw({ updates: { distance: "farther" } }));
  assert.deepEqual(asked.updates, { distance: "farther" });
  const opposite = finalizeInterviewReply(req({ text: "ช่วยยืนห่างกว่านี้หน่อย", pending: [] }), raw({ updates: { distance: "closer" } }));
  assert.deepEqual(opposite.updates, { distance: "farther" }, "the words win; the model's opposite guess is replaced");
  assert.deepEqual(finalizeInterviewReply(req({ text: "ช้าลงหน่อย", pending: [] }), raw({ updates: {} })).updates, { speed: "slower" });
  assert.deepEqual(finalizeInterviewReply(req({ text: "ขอบคุณครับ", pending: [] }), raw({ updates: { distance: "closer" } })).updates, {});
});

test("guard: saving needs the person to say so", () => {
  const done = { pending: [] as never[] };
  assert.equal(finalizeInterviewReply(req({ text: "โอเค บันทึกเลย", ...done }), raw({ save: true })).save, true);
  assert.equal(finalizeInterviewReply(req({ text: "ใช่ครับ", ...done }), raw({ save: true })).save, true, "a yes to 'save now?' counts when nothing else is pending");
  const premature = finalizeInterviewReply(req({ text: "อืม", ...done }), raw({ save: true }));
  assert.equal(premature.save, false);
  assert.match(premature.say, /บันทึก/);
  assert.equal(finalizeInterviewReply(req({ text: "ใช่ครับ" }), raw({ save: true })).save, false, "not while topics are still pending");
});

test("guard: an unsure model reply and the opening turn change nothing", () => {
  assert.deepEqual(finalizeInterviewReply(req({ text: "อืม" }), raw({ certainty: "unclear", updates: { voice: "on" }, say: "หมายถึงพูดออกเสียงใช่ไหมครับ" })),
    { say: "หมายถึงพูดออกเสียงใช่ไหมครับ", updates: {}, save: false });
  assert.deepEqual(finalizeInterviewReply(req({ opening: true, text: "" }), raw({ updates: { voice: "on" }, save: true })).updates, {});
});

test("guard: negation and contradiction are handled by the shared vocabulary", () => {
  assert.equal(evidenceFrom("ไม่พูดออกเสียง ขอข้อความอย่างเดียว", "voice").voice, "off");
  assert.equal(evidenceFrom("พูดก็ได้ ไม่พูดก็ได้", "voice").voice, undefined, "contradictory");
  assert.equal(evidenceFrom("ไม่ต้องตัวใหญ่", "voice").handover, undefined, "generic 'ไม่ต้อง' is not a handover answer");
  assert.equal(yesNo("ใช่ครับ"), "yes");
  assert.equal(yesNo("ไม่ครับ"), "no");
  assert.equal(yesNo("ได้หมดเลย"), null);
});

// ---------------- applying updates in the browser ----------------

const values: ReviewValues = { greeting: "wai", comfortDistance: -0.4, speed: 1, gaze: "direct", voice: true, language: "th", anxiety: "low", captions: "normal", speechPace: "normal", noReach: true };
const sources: Sources = { distance: "camera", speed: "camera", gaze: "camera", voice: "default", captions: "default", speechPace: "default", handover: "default", greeting: "default" };

test("apply: changed fields are marked as coming from the conversation, the rest keep their source", () => {
  const out = applyInterviewUpdates(values, sources, { voice: "off", handover: "hand", captions: "large", speechPace: "slow" }, { allowClosest: false });
  assert.equal(out.values.voice, false);
  assert.equal(out.values.noReach, false);
  assert.equal(out.values.captions, "large");
  assert.equal(out.values.speechPace, "slow");
  assert.equal(out.sources.voice, "voice");
  assert.equal(out.sources.distance, "camera");
  assert.deepEqual(pendingTopics(out.sources), []);
  assert.deepEqual(pendingTopics(sources), ["voice", "readability", "handover"]);
});

test("apply: distance moves one step and never to the closest step without a lean-in", () => {
  assert.equal(nudgeDistance(0.5, "closer", false), 0.5);
  assert.equal(nudgeDistance(0.5, "closer", true), 1.3);
  assert.equal(nudgeDistance(-0.4, "closer", false), 0.5);
  assert.equal(nudgeDistance(-0.4, "farther", false), -1.3);
  assert.equal(nudgeDistance(-2.4, "farther", false), -2.4, "cannot go beyond the farthest");
  assert.equal(nudgeSpeed(1, "slower"), 0.5);
  assert.equal(nudgeSpeed(0.4, "slower"), 0.35);
  assert.equal(nudgeSpeed(0.5, "faster"), 0.75);
  assert.equal(nudgeSpeed(1, "faster"), 1);
});

test("apply: the state sent to the model matches the values", () => {
  assert.equal(distanceBand(1.3), "close");
  assert.equal(distanceBand(-0.4), "medium");
  assert.equal(distanceBand(-1.3), "far");
  assert.deepEqual(toState({ ...values, noReach: false, voice: false }), {
    distance: "medium", speed: "normal", gaze: "direct", voice: "off", captions: "normal", speechPace: "normal", handover: "hand", greeting: "wai"
  });
});

test("guard: when part of an answer is refused, the robot asks the next open topic, not the one just answered", () => {
  // handover answered correctly, but the model also invented 'voice on'.
  const out = finalizeInterviewReply(
    req({ text: "ยื่นให้ถึงมือได้เลย แล้วช่วยยืนห่างกว่านี้หน่อย", pending: ["handover"] }),
    raw({ updates: { handover: "hand", distance: "farther", voice: "on" } })
  );
  assert.deepEqual(out.updates, { handover: "hand", distance: "farther" });
  assert.match(out.say, /บันทึกพาสปอร์ต/, "nothing else is open, so it moves on to saving");
  // Nothing answered: the same question again, flagged as a repeat.
  const again = finalizeInterviewReply(req({ text: "ได้หมดเลย", pending: ["voice", "readability", "handover"] }), raw({ updates: { voice: "on" } }));
  assert.match(again.say, /^ขอถามอีกครั้ง/);
  // A different topic is open next: asked plainly, without "again".
  const next = finalizeInterviewReply(req({ text: "พูดออกเสียงครับ ไม่เอาตัวใหญ่นะ ยื่นให้ถึงมือ", pending: ["voice", "readability", "handover"], state: { ...baseState, captions: "large" } }), raw({ updates: { voice: "on", speed: "slower" } }));
  assert.doesNotMatch(next.say, /อีกครั้ง/);
});

test("review: the starting values say where each one came from", async () => {
  const { initialReview } = await import("../lib/hri/interview-ai");
  const result = { greeting: "wai", comfortDistance: -1.3, speed: 0.5, gaze: "soft", voice: true, language: "th", anxiety: "low", captions: "normal", speechPace: "normal", noReach: true } as const;
  const evidence = { waiDetected: true, leanBacks: 0, voiceCorrections: 1, tooFast: 1, leanIn: false, distanceReason: "voice_comfortable", gazeMeasured: false, avertShare: null, pauses: 0, durationSeconds: 30 };
  const review = initialReview(result, evidence);
  assert.equal(review.values.anxiety, "low");
  assert.equal(review.sources.distance, "voice");
  assert.equal(review.sources.speed, "voice", "slowed only because the person said so");
  assert.equal(review.sources.gaze, "default", "gaze could not be measured");
  assert.equal(review.sources.greeting, "camera");
  assert.equal(review.sources.voice, "default");
  assert.deepEqual(pendingTopics(review.sources), ["voice", "readability", "handover"]);
});

test("guard: refusing something is never read as asking for it (negation)", () => {
  // The bug found in a live run: "ไม่ต้องตัวใหญ่" must mean normal size, not large.
  assert.equal(evidenceFrom("ไม่ต้องตัวใหญ่ครับ ปกติก็พอ", "readability").captions, "normal");
  assert.equal(evidenceFrom("ไม่เอาตัวใหญ่", "readability").captions, "normal");
  assert.equal(evidenceFrom("ตัวใหญ่หน่อยครับ", "readability").captions, "large");
  assert.equal(evidenceFrom("ไม่ต้องพูดช้า", "voice").speechPace, "normal");
  assert.equal(evidenceFrom("พูดช้าๆ หน่อย", "voice").speechPace, "slow");
  assert.equal(evidenceFrom("ไม่ต้องไหว้", "voice").greeting, undefined, "a refused greeting is not a request for it");
  assert.equal(evidenceFrom("ไหว้ก็ดี", "voice").greeting, "wai");
  assert.equal(evidenceFrom("ไม่ต้องช้าลง", "voice").speed, undefined);
  assert.equal(evidenceFrom("ตัวใหญ่ก็ได้ ไม่ต้องตัวใหญ่ก็ได้", "readability").captions, undefined, "contradiction");

  // End to end through the guard, with the model echoing the wrong value.
  const out = finalizeInterviewReply(
    req({ text: "ไม่ต้องตัวใหญ่ครับ ปกติก็พอ", pending: ["readability", "handover"], history: [{ role: "robot", text: "ให้ผมใช้ตัวอักษรใหญ่ไหมครับ" }] }),
    raw({ updates: { captions: "large" } })
  );
  assert.deepEqual(out.updates, { captions: "normal" });
});

test("pending: answering either text size or pace closes the readability topic", () => {
  const base: Sources = { distance: "camera", speed: "default", gaze: "camera", voice: "voice", captions: "default", speechPace: "default", handover: "voice", greeting: "default" };
  assert.deepEqual(pendingTopics(base), ["readability"]);
  assert.deepEqual(pendingTopics({ ...base, captions: "voice" }), []);
  assert.deepEqual(pendingTopics({ ...base, speechPace: "voice" }), []);
});
