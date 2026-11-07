import assert from "node:assert/strict";
import { test } from "node:test";
import { buildGeminiBody, memoryLimit, parseGeminiReply, requestSchema, systemPrompt } from "../lib/hri/voice-ai";
import { VOICE_INTENTS } from "../lib/hri/voice-commands";

const wrap = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] });

test("voice-ai: a valid reply with an action is parsed", () => {
  const reply = parseGeminiReply(wrap(JSON.stringify({ say: "สวัสดีครับ", intent: "wai" })));
  assert.deepEqual(reply, { say: "สวัสดีครับ", intent: "wai" });
});

test("voice-ai: intent none becomes null", () => {
  const reply = parseGeminiReply(wrap(JSON.stringify({ say: "ครับ", intent: "none" })));
  assert.deepEqual(reply, { say: "ครับ", intent: null });
});

test("voice-ai: an invented action is rejected, so the model cannot run anything outside the list", () => {
  assert.equal(parseGeminiReply(wrap(JSON.stringify({ say: "ได้ครับ", intent: "self_destruct" }))), null);
});

test("voice-ai: malformed or empty model output is rejected", () => {
  assert.equal(parseGeminiReply(wrap("not json")), null);
  assert.equal(parseGeminiReply(wrap(JSON.stringify({ say: "", intent: "none" }))), null);
  assert.equal(parseGeminiReply({}), null);
  assert.equal(parseGeminiReply(null), null);
});

test("voice-ai: request validation limits length, history and preference fields", () => {
  assert.ok(requestSchema.safeParse({ text: "สวัสดี" }).success);
  assert.equal(requestSchema.safeParse({ text: "" }).success, false);
  assert.equal(requestSchema.safeParse({ text: "ก".repeat(301) }).success, false);
  const long = Array.from({ length: 7 }, () => ({ role: "user", text: "x" }));
  assert.equal(requestSchema.safeParse({ text: "a", history: long }).success, false);
  // Sensitive passport fields must not be accepted.
  assert.equal(requestSchema.safeParse({ text: "a", preferences: { anxiety: "high" } }).success, false);
  assert.equal(requestSchema.safeParse({ text: "a", preferences: { nickname: "x" } }).success, false);
});

test("voice-ai: the Gemini body restricts the action to the known list and keeps history order", () => {
  const body = buildGeminiBody({
    text: "แล้วอีกทีล่ะ",
    history: [{ role: "user", text: "ไหว้หน่อย" }, { role: "robot", text: "สวัสดีครับ" }]
  });
  const enumValues = body.generationConfig.responseSchema.properties.intent.enum;
  assert.deepEqual(enumValues, [...VOICE_INTENTS, "none"]);
  assert.deepEqual(body.contents.map((c) => c.role), ["user", "model", "user"]);
  assert.equal(body.generationConfig.responseMimeType, "application/json");
});

test("voice-ai: the system prompt carries preferences but nothing sensitive", () => {
  const prompt = systemPrompt({ language: "th", greeting: "wai" });
  assert.match(prompt, /"greeting":"wai"/);
  assert.doesNotMatch(prompt, /anxiety/i);
});

test("voice-ai: memory limiter blocks after the limit and resets after the window", () => {
  const key = `t-${Math.random()}`;
  assert.equal(memoryLimit(key, 2, 60, 1000), true);
  assert.equal(memoryLimit(key, 2, 60, 1001), true);
  assert.equal(memoryLimit(key, 2, 60, 1002), false);
  assert.equal(memoryLimit(key, 2, 60, 1000 + 61_000), true);
});
