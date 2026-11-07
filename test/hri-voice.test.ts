import assert from "node:assert/strict";
import { test } from "node:test";
import { EXAMPLE_COMMANDS, parseVoiceCommand, type VoiceIntent } from "../lib/hri/voice-commands";

const cases: Array<[string, VoiceIntent]> = [
  ["สวัสดีครับ", "greet"],
  ["สวัสดี ค่ะ", "greet"],
  ["ไหว้หน่อย", "wai"],
  ["สวัสดีแบบไทย", "wai"],
  ["โบกมือหน่อยครับ", "wave"],
  ["บ๊ายบาย", "wave"],
  ["ก้มตัวหน่อย", "bow"],
  ["เดินเข้ามาใกล้ๆ", "come_closer"],
  ["เข้ามาใกล้ ๆ หน่อย", "come_closer"],
  ["ถอยหลังนะ", "step_back"],
  ["ออกไปหน่อย", "step_back"],
  ["ยื่นของให้หน่อย", "handover"],
  ["พยักหน้า", "nod"],
  ["ส่ายหัว", "shake"],
  ["ไม่เห็นด้วย", "shake"],
  ["เห็นด้วย", "nod"],
  ["มองซ้าย", "look_left"],
  ["มองขวานะ", "look_right"],
  ["มองตรง", "look_center"],
  ["ทำหน้าเศร้า", "sorry"],
  ["ใจเย็นๆ", "calm"],
  ["ยิ้มหน่อย", "happy"],
  ["ช้าลงหน่อย", "slower"],
  ["เร็วขึ้น", "faster"],
  ["หยุด", "stop"],
  ["พอแล้วครับ", "stop"],
  ["คุณชื่ออะไร", "introduce"],
  ["ขอบคุณครับ", "thanks"]
];

for (const [text, intent] of cases) {
  test(`voice: "${text}" -> ${intent}`, () => {
    assert.equal(parseVoiceCommand(text), intent);
  });
}

test("voice: unknown or empty speech is not a command", () => {
  assert.equal(parseVoiceCommand(""), null);
  assert.equal(parseVoiceCommand("   "), null);
  assert.equal(parseVoiceCommand("วันนี้ฝนตกไหม"), null);
});

test("voice: stop wins over other words in the same sentence", () => {
  assert.equal(parseVoiceCommand("หยุดโบกมือ"), "stop");
});

test("voice: every example chip maps to a command", () => {
  for (const example of EXAMPLE_COMMANDS) {
    assert.notEqual(parseVoiceCommand(example), null, example);
  }
});
