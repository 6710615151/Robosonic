// The code-side gate for the passport interview. Gemini proposes; this decides what is recorded.
// A value is applied only when the person's own words back it up, using the closed vocabulary of
// voice-answers.ts (which already handles negation and contradictions) plus a few small lexicons.
// Anything the model claims without that evidence is dropped and the robot asks again, so a model slip
// ("voice on" nobody mentioned, "whatever" read as a choice) can never silently change a preference.
import { matchVoiceAnswer } from "./voice-answers";
import type { InterviewReply, InterviewRequest, InterviewUpdates, PendingTopic, RawInterviewReply } from "./interview-ai";

type Field = keyof InterviewUpdates;
type Evidence = Partial<Record<Field, string>>;

const strip = (value: string) => value.toLowerCase().replace(/[\s.,!?;:'"()\-–—…ๆ]/g, "");
const PARTICLES = /(ครับผม|ครับ|ค่ะ|คะ|นะครับ|นะคะ|นะ)+$/;

const YES = ["ใช่", "ได้", "โอเค", "ตกลง", "เอา", "yes", "yeah", "yep", "ok", "okay", "sure"];
const NO = ["ไม่", "ไม่ต้อง", "ไม่เอา", "ไม่ใช่", "no", "nope"];
// Hedging is not a preference.
const HEDGES = ["แล้วแต่", "ได้หมด", "ไม่รู้", "ไม่แน่ใจ", "อะไรก็ได้", "ไหนก็ได้", "whatever", "up to you", "i don't mind", "not sure", "idk", "anything"];
const FINISH = ["บันทึก", "ยืนยัน", "เสร็จแล้ว", "พอแล้ว", "จบ", "save", "confirm", "finish", "done"];

export function yesNo(text: string): "yes" | "no" | null {
  const bare = strip(text).replace(PARTICLES, "");
  if (YES.map(strip).includes(bare)) return "yes";
  if (NO.map(strip).includes(bare)) return "no";
  return null;
}

export const isHedge = (text: string) => HEDGES.some((word) => strip(text).includes(strip(word)));

// A cue word counts as a request only when it is not negated just before: "ไม่ต้องตัวใหญ่" refuses large text.
const NEGATION = /(ไม่ต้องการ|ไม่ต้อง|ไม่เอา|ไม่อยากได้|ไม่อยาก|ไม่ใช่|ไม่ใช้|ไม่ขอ|ไม่|dont|donot|notneed|not|never|without)$/;

function mention(text: string, words: string[]): "yes" | "no" | "conflict" | undefined {
  const t = strip(text);
  let yes = false;
  let no = false;
  for (const word of words) {
    const w = strip(word);
    if (!w) continue;
    for (let at = t.indexOf(w); at !== -1; at = t.indexOf(w, at + 1)) {
      if (NEGATION.test(t.slice(0, at))) no = true;
      else yes = true;
    }
  }
  if (yes && no) return "conflict";
  return yes ? "yes" : no ? "no" : undefined;
}

// Exactly one value is asked for (not negated) or there is no evidence.
function lexicon(text: string, table: Record<string, string[]>): string | undefined {
  const asked = Object.entries(table).filter(([, words]) => mention(text, words) === "yes");
  return asked.length === 1 ? asked[0][0] : undefined;
}

// What the person's words clearly say, field by field. Generic words ("ได้", "ไม่") only count when the
// topic was just asked or the sentence names the subject, so "ไม่ต้องตัวใหญ่" is not read as a handover answer.
export function evidenceFrom(text: string, topic: PendingTopic | undefined): Evidence {
  const t = strip(text);
  const has = (words: string[]) => words.some((word) => t.includes(strip(word)));
  const out: Evidence = {};

  if (has(["พูด", "เสียง", "ออกเสียง", "ข้อความ", "เงียบ", "speak", "voice", "aloud", "text", "silent", "quiet"])) {
    const voice = matchVoiceAnswer("voice", text);
    if (voice) out.voice = voice;
  }

  // Size and pace: asking for them, or refusing them ("ไม่ต้องตัวใหญ่" means normal size).
  const large = mention(text, ["ตัวใหญ่", "ตัวโต", "ตัวอักษรใหญ่", "ตัวหนังสือใหญ่", "large text", "big text", "bigger text"]);
  const slow = mention(text, topic === "readability" ? ["พูดช้า", "พูดให้ช้า", "slowly", "speak slow", "ช้า", "slow"] : ["พูดช้า", "พูดให้ช้า", "slowly", "speak slow"]);
  if (large === "yes") out.captions = "large";
  else if (large === "no") out.captions = "normal";
  if (slow === "yes") out.speechPace = "slow";
  else if (slow === "no") out.speechPace = "normal";
  if (topic === "readability" && large === undefined && slow === undefined && has(["ปกติ", "ธรรมดา", "normal"])) {
    out.captions = "normal";
    out.speechPace = "normal";
  }

  if (topic === "handover" || has(["ยื่น", "ส่งให้", "ถึงมือ", "วางไว้", "วางของ", "hand it", "hand me", "place it", "nearby"])) {
    const reach = matchVoiceAnswer("reach", text);
    if (reach) out.handover = reach === "ok" ? "hand" : "place";
  }

  if (has(["สบตา", "มองตรง", "หลบตา", "มองหน้า", "มองฉัน", "มองผม", "eye contact", "look at me", "look away"])) {
    const gaze = matchVoiceAnswer("gaze", text);
    if (gaze) out.gaze = gaze;
  }

  const greeting = lexicon(text, { wai: ["ไหว้", "wai"], wave: ["โบกมือ", "wave"], none: ["ไม่ต้องทัก", "ไม่ทัก", "no greeting"] });
  if (greeting) out.greeting = greeting;
  const distance = lexicon(text, {
    closer: ["ใกล้กว่า", "ใกล้ขึ้น", "ใกล้อีก", "เข้ามาอีก", "closer"],
    farther: ["ใกล้ไป", "ใกล้เกินไป", "ห่างกว่า", "ห่างขึ้น", "ห่างหน่อย", "ไกลกว่า", "ไกลขึ้น", "ถอย", "farther", "further", "move back"]
  });
  if (distance) out.distance = distance;
  const speed = lexicon(text, {
    slower: ["ช้าลง", "เดินช้า", "ช้ากว่า", "slower", "slow down"],
    faster: ["เร็วขึ้น", "เร็วกว่า", "faster", "speed up"]
  });
  if (speed) out.speed = speed;
  return out;
}

const TOPIC_FIELDS: Record<PendingTopic, Field[]> = {
  voice: ["voice"],
  readability: ["captions", "speechPace"],
  handover: ["handover"]
};

// A bare yes/no answers the question just asked: yes means the first option of that topic.
const YES_VALUES: Record<PendingTopic, InterviewUpdates> = {
  voice: { voice: "on" },
  readability: { captions: "large", speechPace: "slow" },
  handover: { handover: "hand" }
};
const NO_VALUES: Record<PendingTopic, InterviewUpdates> = {
  voice: { voice: "off" },
  readability: { captions: "normal", speechPace: "normal" },
  handover: { handover: "place" }
};

// The question for each topic. When the same question was just asked and not answered, say so.
const ASK: Record<"th" | "en", Record<PendingTopic | "save", string>> = {
  th: {
    voice: "ให้ผมพูดออกเสียงไหมครับ ตอบว่า ใช่ หรือ ไม่ ก็ได้ครับ",
    readability: "ให้ผมใช้ตัวอักษรใหญ่และพูดช้าลงไหมครับ ตอบว่า ใช่ หรือ ไม่ ก็ได้ครับ",
    handover: "ให้ผมยื่นของถึงมือคุณไหมครับ หรือให้วางไว้ใกล้ ๆ",
    save: "ให้ผมบันทึกพาสปอร์ตเลยไหมครับ ตอบว่า บันทึก หรือ ยังก่อน ก็ได้ครับ"
  },
  en: {
    voice: "Should I speak out loud? You can just say yes or no.",
    readability: "Should I use larger text and speak more slowly? You can just say yes or no.",
    handover: "Should I hand items straight to you, or place them nearby?",
    save: "Shall I save your passport now? Say save, or not yet."
  }
};
const AGAIN = { th: "ขอถามอีกครั้งนะครับ ", en: "Let me ask again: " };

const currentValue = (request: InterviewRequest, field: Field): string | undefined =>
  field === "distance" || field === "speed" ? undefined : request.state[field];

// Which open topic did the robot's last question belong to? Read from the robot's own words, not guessed
// from the order, so a bare "yes" is applied to what was actually asked.
const TOPIC_CUES: Record<PendingTopic, string[]> = {
  voice: ["พูดออกเสียง", "ออกเสียง", "ข้อความอย่างเดียว", "speak out loud", "out loud", "text only", "spoken"],
  readability: ["ตัวอักษรใหญ่", "ตัวใหญ่", "ตัวหนังสือ", "พูดช้า", "larger text", "bigger text", "more slowly"],
  handover: ["ยื่น", "วางไว้", "hand items", "hand it", "place them", "nearby"]
};

export function askedTopic(request: InterviewRequest): PendingTopic | undefined {
  const last = [...request.history].reverse().find((turn) => turn.role === "robot")?.text;
  if (!last) return request.pending[0];
  const t = strip(last);
  // The robot asked about something else (distance, saving): a bare yes belongs to no topic.
  return request.pending.find((topic) => TOPIC_CUES[topic].some((word) => t.includes(strip(word))));
}

export function finalizeInterviewReply(request: InterviewRequest, raw: RawInterviewReply): InterviewReply {
  if (request.opening) return { say: raw.say, updates: {}, save: false };
  // The model itself was unsure: it is asking a confirming question. Nothing changes.
  if (raw.certainty !== "clear") return { say: raw.say, updates: {}, save: false };

  const text = request.text;
  const topic = askedTopic(request);
  const evidence = evidenceFrom(text, topic);
  const hedged = Object.keys(evidence).length === 0 && isHedge(text);
  const answer = yesNo(text);
  const byAnswerValues: InterviewUpdates =
    topic !== undefined && answer !== null ? (answer === "yes" ? YES_VALUES[topic] : NO_VALUES[topic]) : {};
  const accepted: InterviewUpdates = {};
  let rejected = false;

  for (const [field, value] of Object.entries(raw.updates) as [Field, string][]) {
    const backed = evidence[field] === value || (byAnswerValues as Record<string, string>)[field] === value;
    if (backed) (accepted as Record<string, string>)[field] = value;
    // Not backed, but already so: nothing to change and nothing to claim.
    else if (currentValue(request, field) !== value) rejected = true;
  }
  // What the person's words say, even if the model left it out: "speak out loud, but slowly" and a plain
  // "yes" to the question just asked. Confirming a value that is already set counts as an answer too.
  if (!hedged) {
    for (const [field, value] of Object.entries({ ...byAnswerValues, ...evidence }) as [Field, string][]) {
      if (accepted[field] === undefined) (accepted as Record<string, string>)[field] = value;
    }
  }

  let save = false;
  if (raw.save) {
    const said = FINISH.some((word) => strip(text).includes(strip(word))) || (request.pending.length === 0 && answer === "yes");
    if (said) save = true;
    else rejected = true;
  }

  if (rejected || (hedged && Object.keys(accepted).length === 0)) {
    // Ask about the first topic that is still open after what was accepted, not one just answered.
    const answered = (t: PendingTopic) => TOPIC_FIELDS[t].some((field) => accepted[field] !== undefined);
    const next = request.pending.find((t) => !answered(t));
    const prefix = next !== undefined && next === topic ? AGAIN[request.lang] : "";
    return { say: prefix + ASK[request.lang][next ?? "save"], updates: accepted, save: false };
  }
  return { say: raw.say, updates: accepted, save };
}
