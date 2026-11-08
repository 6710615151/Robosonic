import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDirectCommand } from "../lib/hri/voice-commands";
import { bodyForModel } from "../lib/hri/gemini";

test("a bare command, with polite endings, is answered at once", () => {
  assert.equal(parseDirectCommand("สวัสดีครับ"), "greet");
  assert.equal(parseDirectCommand("ไหว้หน่อยครับ"), "wai");
  assert.equal(parseDirectCommand("โบกมือหน่อย"), "wave");
  assert.equal(parseDirectCommand("เข้ามาใกล้ๆ หน่อยนะครับ"), "come_closer");
  assert.equal(parseDirectCommand("หยุดค่ะ"), "stop");
  assert.equal(parseDirectCommand("แนะนำตัวหน่อย"), "introduce"); // "นะ" inside the keyword is not a filler
});

test("a sentence that merely contains a command word goes to the AI instead", () => {
  assert.equal(parseDirectCommand("ผมชอบให้หุ่นยืนห่างๆ และพูดช้าๆ"), null);
  assert.equal(parseDirectCommand("ช่วยไหว้ให้ดูหน่อย"), null);
  assert.equal(parseDirectCommand("สวัสดีครับ วันนี้อากาศเป็นยังไงบ้าง"), null);
  assert.equal(parseDirectCommand("ผมไม่ใช่คนที่ชอบเข้าสังคม"), null);
  assert.equal(parseDirectCommand("เมื่อกี้ผมพูดว่าอะไรนะ"), null);
});

test("nothing or only fillers is not a command", () => {
  assert.equal(parseDirectCommand(""), null);
  assert.equal(parseDirectCommand("   "), null);
  assert.equal(parseDirectCommand("ครับ"), null);
});

const body = { contents: [], generationConfig: { maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } } };

test("thinking is switched off with the setting each model accepts", () => {
  for (const model of ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash"]) {
    const sent = bodyForModel(body, model) as typeof body & { generationConfig: { thinkingConfig: unknown; maxOutputTokens: number } };
    assert.deepEqual(sent.generationConfig.thinkingConfig, { thinkingLevel: "minimal" }, model);
    assert.equal(sent.generationConfig.maxOutputTokens, 300, model);
  }
  for (const model of ["gemini-3.1-flash-lite", "gemini-2.5-flash"]) {
    assert.equal(bodyForModel(body, model), body, model);
  }
  assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 0); // the caller's body is never changed
});

test("a body without a thinking setting is passed through", () => {
  const plain = { contents: [], generationConfig: { maxOutputTokens: 300 } };
  assert.equal(bodyForModel(plain, "gemini-3.5-flash-lite"), plain);
  assert.equal(bodyForModel(null, "gemini-3.5-flash"), null);
});
