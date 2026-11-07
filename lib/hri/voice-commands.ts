// Thai voice commands for the simulated robots. Pure logic, no browser APIs, so it is unit-testable.
// Thai has no spaces between words, so matching is by substring on a normalised transcript.
import type { RobotBehavior } from "./behavior-engine";
import type { RobotCapabilities } from "./robot-profiles";

export type VoiceIntent =
  | "stop"
  | "introduce"
  | "thanks"
  | "wai"
  | "wave"
  | "greet"
  | "bow"
  | "nod"
  | "shake"
  | "come_closer"
  | "step_back"
  | "handover"
  | "look_left"
  | "look_right"
  | "look_center"
  | "happy"
  | "sorry"
  | "calm"
  | "slower"
  | "faster";

// Order matters: the first rule with a matching keyword wins, so specific phrases come before general ones.
const RULES: ReadonlyArray<readonly [VoiceIntent, readonly string[]]> = [
  ["stop", ["หยุด", "พอแล้ว", "พอก่อน", "เงียบ", "นิ่งๆ", "อยู่นิ่ง"]],
  ["introduce", ["ชื่ออะไร", "คือใคร", "แนะนำตัว", "เป็นใคร", "ทำอะไรได้"]],
  ["thanks", ["ขอบคุณ", "ขอบใจ", "เก่งมาก"]],
  ["step_back", ["ถอยหลัง", "ถอยไป", "ถอยออก", "ถอย", "ออกไป", "ไปไกลๆ", "ห่างออก", "ห่างๆ"]],
  ["come_closer", ["เข้ามาใกล้", "เดินเข้ามา", "เข้ามา", "มาหา", "มาใกล้", "ขยับเข้า", "เดินมา", "เข้าใกล้"]],
  ["handover", ["ยื่นของ", "ส่งของ", "ส่งให้", "ยื่นให้", "หยิบให้", "เอาของมา", "ขอของ"]],
  ["wai", ["ไหว้", "สวัสดีแบบไทย"]],
  ["wave", ["โบกมือ", "บ๊ายบาย", "บายบาย", "ลาก่อน", "โบกไม้"]],
  ["bow", ["ก้มตัว", "โค้งคำนับ", "โค้งตัว", "คำนับ", "ก้มหัว"]],
  ["greet", ["สวัสดี", "ทักทาย", "หวัดดี", "ฮัลโหล", "เฮลโหล"]],
  ["shake", ["ส่ายหัว", "ส่ายหน้า", "ไม่เห็นด้วย", "ไม่ใช่", "ปฏิเสธ"]],
  ["nod", ["พยักหน้า", "ใช่ไหม", "เห็นด้วย", "รับทราบ", "เข้าใจไหม", "ตกลง"]],
  ["look_left", ["มองซ้าย", "หันซ้าย", "ดูทางซ้าย", "ไปทางซ้าย"]],
  ["look_right", ["มองขวา", "หันขวา", "ดูทางขวา", "ไปทางขวา"]],
  ["look_center", ["มองตรง", "มองหน้า", "มองมาที่", "มองฉัน", "มองผม", "มองฉัน", "หันมา", "มองมา"]],
  ["sorry", ["เสียใจ", "เศร้า", "ขอโทษ", "ทำหน้าเศร้า"]],
  ["calm", ["สงบ", "ใจเย็น", "ผ่อนคลาย", "หายใจ"]],
  ["happy", ["ยิ้ม", "ดีใจ", "มีความสุข", "สนุก"]],
  ["slower", ["ช้าลง", "ช้าๆ", "เบาๆ", "ค่อยๆ"]],
  ["faster", ["เร็วขึ้น", "เร็วๆ", "เร็วหน่อย"]]
];

export const VOICE_INTENTS: readonly VoiceIntent[] = RULES.map(([intent]) => intent);

// Drop spaces, punctuation and the Thai repetition mark "ๆ". Polite endings (ครับ, ค่ะ, นะ) are left in:
// substring matching already ignores them.
function strip(value: string): string {
  return value.toLowerCase().replace(/[\s.,!?;:'"()\-–—…ๆ]/g, "");
}

export function normalizeTranscript(raw: string): string {
  return strip(raw);
}

// Keywords go through the same normalisation as the transcript, so "ช้าๆ" and "ช้า ๆ" compare equal.
const RULE_KEYS = RULES.map(([intent, words]) => [intent, words.map(strip)] as const);

export function parseVoiceCommand(raw: string): VoiceIntent | null {
  const text = normalizeTranscript(raw);
  if (!text) return null;
  for (const [intent, words] of RULE_KEYS) {
    if (words.some((word) => word && text.includes(word))) return intent;
  }
  return null;
}

export type CommandResult = {
  intent: VoiceIntent;
  /** False when the hardware cannot do it (no arms, fixed base, ...). Nothing moved. */
  done: boolean;
  /** What the robot says back, in Thai. */
  reply: string;
};

const MOBILE_STEP = 0.55;

type Refusal = { arms?: string; mobile?: string; head?: string };

const refuse = (reason: keyof Refusal): string =>
  ({
    arms: "ขอโทษครับ ผมไม่มีแขน เลยทำท่านี้ไม่ได้ ผมใช้จอบอกแทนนะครับ",
    mobile: "ขอโทษครับ ฐานของผมติดอยู่กับที่ เคลื่อนที่ไม่ได้ครับ",
    head: "ขอโทษครับ ผมไม่มีหัวที่หันได้ ผมใช้สัญญาณบนจอแทนครับ"
  })[reason];

export type RobotState = { distance: number; speed: number };

// Run one intent on one simulated robot. `state` is the caller's running distance/speed (the engine does not expose it).
export function runVoiceIntent(
  robot: RobotBehavior,
  caps: RobotCapabilities,
  intent: VoiceIntent,
  state: RobotState
): CommandResult {
  const ok = (reply: string): CommandResult => ({ intent, done: true, reply });
  const no = (reason: keyof Refusal): CommandResult => ({ intent, done: false, reply: refuse(reason) });
  const later = (fn: () => void, ms: number) => window.setTimeout(fn, ms);

  switch (intent) {
    case "stop":
      robot.clearGestures();
      robot.bothArms("relaxed");
      robot.lean("upright");
      robot.lookAt(0, 0.15);
      robot.expression("neutral");
      return ok("หยุดแล้วครับ");
    case "introduce":
      robot.expression("happy");
      if (caps.arms) {
        robot.moveArm("R", "handOnChest");
        later(() => robot.moveArm("R", "relaxed"), 2600);
      }
      return ok("ผมเป็นหุ่นยนต์จำลองของโครงการ HRI Passport ครับ ผมปรับการเข้าหาให้ตรงกับความสบายใจของแต่ละคน");
    case "thanks":
      robot.expression("happy");
      robot.nod(1);
      return ok("ยินดีครับ");
    case "greet":
      robot.expression("happy");
      if (caps.arms) {
        robot.wave("R", 2.2);
      } else {
        robot.nod(1);
      }
      return ok("สวัสดีครับ ยินดีที่ได้รู้จักครับ");
    case "wai":
      if (!caps.arms) {
        robot.nod(2);
        return no("arms");
      }
      robot.bothArms("wai");
      robot.bow(0.34, 1.6);
      later(() => robot.bothArms("relaxed"), 2400);
      return ok("สวัสดีครับ");
    case "wave":
      if (!caps.arms) {
        robot.nod(1);
        return no("arms");
      }
      robot.wave("R", 2.6);
      return ok("บ๊ายบายครับ");
    case "bow":
      robot.bow(0.4, 1.8);
      return ok("ครับ");
    case "nod":
      robot.nod(2);
      return ok("รับทราบครับ");
    case "shake":
      robot.shakeHead(2);
      return ok("ไม่ครับ");
    case "come_closer":
      if (!caps.mobile) return no("mobile");
      state.distance = Math.min(1.2, state.distance + MOBILE_STEP);
      robot.setDistance(state.distance);
      return ok("เข้าไปใกล้อีกนิดครับ");
    case "step_back":
      if (!caps.mobile) return no("mobile");
      state.distance = Math.max(-2.2, state.distance - MOBILE_STEP);
      robot.setDistance(state.distance);
      return ok("ถอยออกมาครับ");
    case "handover":
      if (!caps.arms) {
        robot.lean("forward");
        later(() => robot.lean("upright"), 1400);
        return no("arms");
      }
      robot.moveArm("R", "offer");
      later(() => robot.moveArm("R", "relaxed"), 2600);
      return ok("นี่ครับ เชิญรับได้เลยครับ");
    case "look_left":
      if (!caps.head) return no("head");
      robot.lookAt(-0.85, 0.1);
      return ok("มองทางซ้ายครับ");
    case "look_right":
      if (!caps.head) return no("head");
      robot.lookAt(0.85, 0.1);
      return ok("มองทางขวาครับ");
    case "look_center":
      if (!caps.head) return no("head");
      robot.lookAt(0, 0.1);
      return ok("มองตรงครับ");
    case "happy":
      robot.expression("happy");
      robot.setGlow(0.8, "teal");
      return ok("ผมดีใจครับ");
    case "sorry":
      robot.expression("sorry");
      robot.setGlow(0.35, "amber");
      robot.lean("slump");
      later(() => robot.lean("upright"), 1800);
      return ok("ขอโทษครับ");
    case "calm":
      robot.expression("calm");
      robot.setGlow(0.4, "blue");
      robot.breathe(8, 1.3);
      return ok("ใจเย็น ๆ หายใจลึก ๆ ครับ");
    case "slower":
      state.speed = Math.max(0.25, state.speed - 0.35);
      robot.setSpeed(state.speed);
      return ok("ช้าลงแล้วครับ");
    case "faster":
      state.speed = Math.min(Math.max(caps.maxSpeedMultiplier, 1), state.speed + 0.35);
      robot.setSpeed(state.speed);
      return ok("เร็วขึ้นแล้วครับ");
  }
}

export const NOT_UNDERSTOOD_REPLY = "ขอโทษครับ ผมยังไม่เข้าใจคำสั่งนี้ ลองพูดว่า สวัสดี ไหว้ โบกมือ หรือ เข้ามาใกล้ ๆ ดูนะครับ";

// Example phrases shown as one-tap chips (they also work typed or spoken).
export const EXAMPLE_COMMANDS: readonly string[] = [
  "สวัสดี",
  "ไหว้หน่อย",
  "โบกมือ",
  "เข้ามาใกล้ๆ",
  "ถอยหลัง",
  "ยื่นของให้หน่อย",
  "พยักหน้า",
  "ส่ายหัว",
  "มองซ้าย",
  "มองขวา",
  "ทำหน้าเศร้า",
  "ใจเย็นๆ",
  "ช้าลง",
  "หยุด"
];
