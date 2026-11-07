"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Bot, ChartColumn, CircleDashed, Compass, Hand, IdCard, MoveDown, Play, RotateCcw, ShieldCheck } from "lucide-react";
import RobotStage from "@/app/components/robot/RobotStage";
import { adapt } from "@/lib/hri/adapt";
import type { Hue, RobotBehavior, RobotEvent } from "@/lib/hri/behavior-engine";
import { describeDistance } from "@/lib/hri/passport";
import { toPublicProfile } from "@/lib/hri/public-profile";
import { ROBOT_PROFILES } from "@/lib/hri/robot-profiles";
import { conditionOrder, newJourneyId, nextCondition, stationComplete, type StationRatings } from "@/lib/hri/journey";
import { recordMeetingAction } from "../../actions";
import { listOwnPassports } from "../../components/lab-env";
import { matchOwnPassport } from "../actions";

import type { StationTask } from "@/lib/hri/journey-stations";
export type { StationTask };
export type Station = { task: StationTask; robotId: string; name: string; type: string; org: string | null };

type Passport = {
  code: string;
  greeting: string;
  comfortDistance: number;
  speed: number;
  gaze: string;
  voice: boolean;
  language: string;
  calm: boolean;
  captions: "normal" | "large";
  speechPace: "normal" | "slow";
  noReach: boolean;
};
type LogEvent = { t: number; src: "robot" | "human"; type: string; [key: string]: unknown };
type Mode = "passport" | "default";

const START_DISTANCE = -2.6;
// What a robot does without a passport: waves, walks up close at full speed, holds eye contact.
const DEFAULT_BEHAVIOUR = { distance: 1.3, speed: 1.4, gaze: "direct", greeting: "wave", voice: true } as const;
// The meet flow has no persisted profile to show, so it reuses one fixed timestamp for adaptation.
const PROFILE_TIME = new Date(0);
const CARE_ROBOT = ROBOT_PROFILES[0];

function hueFor(type: string): Hue {
  if (/hospital|medical|therapy/i.test(type)) return "blue";
  if (/elder|care|companion/i.test(type)) return "amber";
  if (/rehab|assist/i.test(type)) return "green";
  return "teal";
}

const ui = {
  en: {
    eyebrow: "Care Passport hospital journey",
    stationOf: (i: number, n: number) => `Station ${i} of ${n}`,
    journey: "Your hospital journey",
    from: "From the atlas robot registry",
    start: "Start station",
    replay: "Replay",
    withPassport: "With your Care Passport",
    withoutPassport: "Compare: default robot (no passport)",
    appliedTitle: "What this robot read from your passport",
    defaultTitle: "Default behaviour (no passport)",
    greeting: "Greeting", distance: "Stops at", speed: "Movement", gaze: "Eye contact", voice: "Voice",
    wai: "wai + bow", wave: "wave", noGreeting: "no gesture", slow: "slower", normal: "normal", fast: "fast",
    soft: "soft", direct: "direct", on: "spoken", off: "text only",
    accessibility: "slower speech + large text",
    reach: "may reach to hand items", noReach: "never reaches, places items nearby",
    tooClose: "Too close", tooFar: "Too far",
    rateTitle: "How did that station feel?",
    rateHint: "1 = very uncomfortable · 5 = very comfortable",
    rateLow: "Uncomfortable", rateHigh: "Comfortable",
    save: "Save station", saved: "Saved to the Living Lab.",
    saveRateLimited: "Too many tries from this network. Please wait a few minutes, then press Save again.",
    saveNotFound: "This passport no longer exists, so the rating could not be saved.",
    saveFailed: "The rating could not be saved. Please press Save again.",
    next: "Next station", finish: "Finish journey",
    doneTitle: "Journey complete",
    doneBody: "Thank you. Each rating was saved when you pressed Save, linked only to this passport's code, never to your name or email. In Research they appear only as group averages, and care details stay hidden until at least 5 people share them.",
    doneResearch: "See what the lab is learning",
    verdict: (diff: number) => diff > 0
      ? `On this journey you rated the robot that read your passport ${diff.toFixed(1)} points more comfortable on average.`
      : diff < 0
        ? `On this journey you rated the robot that had not read your passport ${Math.abs(diff).toFixed(1)} points more comfortable on average.`
        : "On this journey you rated both versions of the robot the same on average.",
    verdictNote: "This is your own result from one journey, not a finding of the lab.",
    nextTitle: "Where to next",
    nextCard: "Your passport card", nextCardBody: "See and edit what every robot reads.",
    nextCardElsewhere: "Your passport card opens from its QR code or the link you saved when you made it. Editing needs the edit key, which is kept only in the browser that created the passport.",
    nextRobot: "Robot Lab", nextRobotBody: "Watch two robots with different hardware apply this passport.",
    nextResearch: "Research", nextResearchBody: "Your ratings join the group averages; nothing is shown per person.",
    nextHome: "Living Lab home", nextHomeBody: "The overview of everything in the lab.",
    again: "Run the journey again",
    avg: "Your average comfort rating",
    back: "Back to the Living Lab",
    ready: "Press start when you are ready. The panel shows which version of the robot you will meet.",
    empty: "No care robots from the registry were found. Please seed the atlas and try again.",
    robotLabel: "Robot",
    condition: (n: number) => `Condition ${n} of 2`,
    conditionLabel: { default: "Robot without your passport", passport: "Robot with your passport" },
    startCondition: (n: number) => `Start condition ${n} of 2`,
    nextUp: "Saved. Now meet the same robot in the other condition.",
    protocolNote: "You meet this robot twice: once without your passport, once with it. The order alternates between stations so the comparison is fair.",
    compareTitle: "Side by side",
    compareSub: "Same station, same robot. Highlighted rows are what your passport changed.",
    colDefault: "Without passport",
    colPassport: "With passport",
    yourRating: "Your comfort",
    adaptedTitle: "Adapted to this robot's hardware",
    avgPassport: "Average with passport",
    avgDefault: "Average without passport",
    difference: "Difference",
    round: (n: number) => `Round ${n} of 2`,
    intro: {
      title: "Before you begin",
      points: (n: number) => [
        `You will visit ${n} hospital station${n === 1 ? "" : "s"}. At each one a care robot does a short task for you.`,
        "You meet the same robot twice: once as a default robot that has not read your passport, once after it has. The order is chosen for you and alternates between stations, so the comparison is fair.",
        "After each meeting, rate how comfortable you felt from 1 (very uncomfortable) to 5 (very comfortable). There are no right or wrong answers.",
        "Each rating is saved when you press Save. If you leave or reload, you can carry on where you stopped in this browser tab."
      ],
      sim: "The robots are 3D simulations in your browser. Distances are scene units, not metres.",
      begin: "Begin the journey"
    },
    resumed: (done: number, total: number) => `Welcome back. You have rated ${done} of ${total} meetings; carry on where you left off.`,
    robotNotInJourney: "The robot you picked is not one of this journey's stations, so the journey starts at station 1."
  },
  th: {
    eyebrow: "เส้นทางโรงพยาบาลด้วย Care Passport",
    stationOf: (i: number, n: number) => `สถานี ${i} จาก ${n}`,
    journey: "เส้นทางในโรงพยาบาลของคุณ",
    from: "จาก robot registry ของ Atlas",
    start: "เริ่มสถานี",
    replay: "เล่นอีกครั้ง",
    withPassport: "ใช้ Care Passport ของคุณ",
    withoutPassport: "เปรียบเทียบ: หุ่นแบบปกติ (ไม่ใช้พาสปอร์ต)",
    appliedTitle: "สิ่งที่หุ่นอ่านจากพาสปอร์ตของคุณ",
    defaultTitle: "พฤติกรรมปกติ (ไม่มีพาสปอร์ต)",
    greeting: "การทักทาย", distance: "หยุดที่ระยะ", speed: "ความเร็ว", gaze: "การสบตา", voice: "เสียง",
    wai: "ไหว้ + ก้มตัว", wave: "โบกมือ", noGreeting: "ไม่แสดงท่าทาง", slow: "ช้าลง", normal: "ปกติ", fast: "เร็ว",
    soft: "หลบสายตาเล็กน้อย", direct: "มองตรง", on: "พูดออกเสียง", off: "ข้อความอย่างเดียว",
    accessibility: "พูดช้าลง + ตัวอักษรใหญ่",
    reach: "ยื่นของถึงมือได้", noReach: "ไม่ยื่นมือ วางของไว้ใกล้ ๆ",
    tooClose: "ใกล้ไป", tooFar: "ไกลไป",
    rateTitle: "สถานีนี้รู้สึกอย่างไรบ้าง",
    rateHint: "1 = ไม่สบายใจเลย · 5 = สบายใจมาก",
    rateLow: "ไม่สบายใจ", rateHigh: "สบายใจ",
    save: "บันทึกสถานี", saved: "บันทึกสถานีลง Living Lab แล้ว",
    saveRateLimited: "เครือข่ายนี้ลองหลายครั้งเกินไป กรุณารอสักครู่ แล้วกดบันทึกอีกครั้ง",
    saveNotFound: "พาสปอร์ตนี้ไม่มีอยู่แล้ว จึงบันทึกคะแนนไม่ได้",
    saveFailed: "บันทึกคะแนนไม่สำเร็จ กรุณากดบันทึกอีกครั้ง",
    next: "สถานีถัดไป", finish: "จบเส้นทาง",
    doneTitle: "จบเส้นทางแล้ว",
    doneBody: "ขอบคุณครับ คะแนนแต่ละครั้งถูกบันทึกเมื่อคุณกดบันทึก โดยผูกกับรหัสพาสปอร์ตนี้เท่านั้น ไม่ผูกกับชื่อหรืออีเมล ในหน้างานวิจัยจะแสดงเป็นค่าเฉลี่ยของกลุ่มเท่านั้น และข้อมูลด้านการดูแลจะถูกซ่อนจนกว่าจะมีอย่างน้อย 5 คน",
    doneResearch: "ดูสิ่งที่แล็บเรียนรู้",
    verdict: (diff: number) => diff > 0
      ? `ในเส้นทางนี้ คุณให้คะแนนหุ่นที่อ่านพาสปอร์ตแล้วว่าสบายใจกว่าโดยเฉลี่ย ${diff.toFixed(1)} คะแนน`
      : diff < 0
        ? `ในเส้นทางนี้ คุณให้คะแนนหุ่นที่ยังไม่ได้อ่านพาสปอร์ตว่าสบายใจกว่าโดยเฉลี่ย ${Math.abs(diff).toFixed(1)} คะแนน`
        : "ในเส้นทางนี้ คุณให้คะแนนหุ่นทั้งสองแบบเท่ากันโดยเฉลี่ย",
    verdictNote: "นี่คือผลของคุณเองจากเส้นทางเดียว ไม่ใช่ข้อสรุปของแล็บ",
    nextTitle: "ไปต่อที่ไหนดี",
    nextCard: "การ์ดพาสปอร์ตของคุณ", nextCardBody: "ดูและแก้สิ่งที่หุ่นทุกตัวอ่าน",
    nextCardElsewhere: "การ์ดพาสปอร์ตเปิดได้จาก QR หรือลิงก์ที่คุณบันทึกไว้ตอนสร้าง การแก้ไขต้องใช้คีย์แก้ไข ซึ่งเก็บไว้เฉพาะในเบราว์เซอร์ที่ใช้สร้างพาสปอร์ตเท่านั้น",
    nextRobot: "ห้องทดลองหุ่นยนต์", nextRobotBody: "ดูหุ่นสองรุ่นที่ฮาร์ดแวร์ต่างกันนำพาสปอร์ตนี้ไปใช้",
    nextResearch: "งานวิจัย", nextResearchBody: "คะแนนของคุณรวมเป็นค่าเฉลี่ยของกลุ่ม ไม่แสดงรายบุคคล",
    nextHome: "หน้าแรก Living Lab", nextHomeBody: "ภาพรวมของทุกส่วนในแล็บ",
    again: "เดินเส้นทางอีกครั้ง",
    avg: "คะแนนความสบายใจเฉลี่ยของคุณ",
    back: "กลับไป Living Lab",
    ready: "กดเริ่มเมื่อพร้อม แผงด้านข้างจะบอกว่าคุณจะพบหุ่นแบบไหน",
    empty: "ไม่พบหุ่นดูแลใน registry กรุณา seed ข้อมูล atlas แล้วลองอีกครั้ง",
    robotLabel: "หุ่นยนต์",
    condition: (n: number) => `เงื่อนไขที่ ${n} จาก 2`,
    conditionLabel: { default: "หุ่นที่ไม่มีพาสปอร์ตของคุณ", passport: "หุ่นที่อ่านพาสปอร์ตของคุณ" },
    startCondition: (n: number) => `เริ่มเงื่อนไขที่ ${n} จาก 2`,
    nextUp: "บันทึกแล้ว ต่อไปพบหุ่นตัวเดิมในอีกเงื่อนไขหนึ่ง",
    protocolNote: "คุณจะพบหุ่นตัวนี้สองครั้ง ครั้งหนึ่งไม่มีพาสปอร์ต อีกครั้งมีพาสปอร์ต ลำดับจะสลับกันในแต่ละสถานีเพื่อให้การเปรียบเทียบยุติธรรม",
    compareTitle: "เปรียบเทียบเคียงกัน",
    compareSub: "สถานีเดียวกัน หุ่นตัวเดียวกัน แถวที่ไฮไลต์คือสิ่งที่พาสปอร์ตของคุณเปลี่ยน",
    colDefault: "ไม่มีพาสปอร์ต",
    colPassport: "มีพาสปอร์ต",
    yourRating: "ความสบายใจของคุณ",
    adaptedTitle: "ปรับตามฮาร์ดแวร์ของหุ่นตัวนี้",
    avgPassport: "เฉลี่ยเมื่อมีพาสปอร์ต",
    avgDefault: "เฉลี่ยเมื่อไม่มีพาสปอร์ต",
    difference: "ผลต่าง",
    round: (n: number) => `รอบ ${n} จาก 2`,
    intro: {
      title: "ก่อนเริ่ม",
      points: (n: number) => [
        `คุณจะไปที่ ${n} จุดในโรงพยาบาล ในแต่ละจุด หุ่นดูแลจะทำงานสั้น ๆ ให้คุณ`,
        "คุณจะพบหุ่นตัวเดิมสองครั้ง: ครั้งหนึ่งเป็นหุ่นแบบปกติที่ยังไม่ได้อ่านพาสปอร์ต อีกครั้งหลังจากที่อ่านแล้ว ระบบเลือกลำดับให้และสลับกันในแต่ละจุด เพื่อให้การเปรียบเทียบยุติธรรม",
        "หลังพบแต่ละครั้ง ให้คะแนนความสบายใจ 1 (ไม่สบายใจมาก) ถึง 5 (สบายใจมาก) ไม่มีคำตอบที่ถูกหรือผิด",
        "คะแนนจะถูกบันทึกเมื่อคุณกดบันทึก หากออกไปหรือโหลดหน้าใหม่ คุณทำต่อจากจุดเดิมได้ในแท็บนี้"
      ],
      sim: "หุ่นยนต์เป็นการจำลอง 3 มิติในเบราว์เซอร์ ระยะทางเป็นหน่วยในฉาก ไม่ใช่เมตร",
      begin: "เริ่มเส้นทาง"
    },
    resumed: (done: number, total: number) => `ยินดีต้อนรับกลับ คุณให้คะแนนไปแล้ว ${done} จาก ${total} ครั้ง ทำต่อจากจุดเดิมได้เลย`,
    robotNotInJourney: "หุ่นที่คุณเลือกไม่ได้อยู่ในจุดของเส้นทางนี้ จึงเริ่มที่จุดที่ 1"
  }
};

type StationCopy = { title: string; short: string; intro: (name: string) => string; action: string; actionNoReach?: string };

const stationCopy: Record<"en" | "th", Record<StationTask, StationCopy>> = {
  en: {
    reception: {
      title: "Reception & check-in",
      short: "The robot confirms your appointment and points you to the right clinic.",
      intro: (name: string) => `Welcome. I am ${name}. I will check you in for your appointment.`,
      action: "Your appointment is confirmed. Please follow the green line to the clinic."
    },
    delivery: {
      title: "Medicine delivery",
      short: "The robot brings your medicine to your bedside.",
      intro: (name: string) => `Hello. I am ${name}. I have brought your medicine.`,
      action: "Please take your medicine with water.",
      actionNoReach: "I will place your medicine on the tray beside you."
    },
    telepresence: {
      title: "Doctor video call",
      short: "The robot connects your doctor's video call and gives you privacy.",
      intro: (name: string) => `I am ${name}. I will connect your doctor's video call.`,
      action: "The doctor is on screen now. I will step aside for your privacy."
    }
  },
  th: {
    reception: {
      title: "คัดกรองและลงทะเบียน",
      short: "หุ่นยืนยันนัดหมายและบอกทางไปห้องตรวจ",
      intro: (name: string) => `ยินดีต้อนรับครับ ผมชื่อ ${name} ผมจะลงทะเบียนนัดหมายให้คุณครับ`,
      action: "ยืนยันนัดหมายแล้วครับ กรุณาเดินตามเส้นสีเขียวไปที่ห้องตรวจ"
    },
    delivery: {
      title: "ส่งยา",
      short: "หุ่นนำยามาส่งที่เตียงของคุณ",
      intro: (name: string) => `สวัสดีครับ ผมชื่อ ${name} ผมนำยามาส่งครับ`,
      action: "กรุณารับยาพร้อมน้ำครับ",
      actionNoReach: "ผมจะวางยาไว้บนถาดข้าง ๆ คุณครับ"
    },
    telepresence: {
      title: "ต่อสายหาหมอ",
      short: "หุ่นต่อสายวิดีโอคอลกับหมอและเปิดพื้นที่ส่วนตัวให้คุณ",
      intro: (name: string) => `ผมชื่อ ${name} ครับ ผมจะต่อสายวิดีโอคอลกับหมอให้ครับ`,
      action: "หมออยู่บนจอแล้วครับ ผมจะถอยออกไปให้ความเป็นส่วนตัว"
    }
  }
};

type StoredJourney = { journeyId: string; ratings: Record<number, StationRatings>; current: number };

// Reads this tab's saved journey, keeping only well-formed values for stations that exist.
function readJourney(key: string, stationCount: number): StoredJourney | null {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(key) ?? "null") as Record<string, unknown> | null;
    if (!raw || raw.v !== 1 || raw.started !== true || typeof raw.journeyId !== "string" || !/^[0-9a-f]{12}$/.test(raw.journeyId)) return null;
    const ratings: Record<number, StationRatings> = {};
    const isRating = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5;
    for (const [index, value] of Object.entries((raw.ratings ?? {}) as Record<string, Record<string, unknown>>)) {
      const i = Number(index);
      if (!Number.isInteger(i) || i < 0 || i >= stationCount || !value) continue;
      const kept: StationRatings = {};
      if (isRating(value.passport)) kept.passport = value.passport;
      if (isRating(value.default)) kept.default = value.default;
      if (Object.keys(kept).length) ratings[i] = kept;
    }
    const current = Number.isInteger(raw.current) && (raw.current as number) >= 0 && (raw.current as number) < stationCount ? (raw.current as number) : 0;
    return { journeyId: raw.journeyId, ratings, current };
  } catch {
    return null;
  }
}

export default function MeetClient({
  lang,
  passport,
  stations,
  startIndex,
  robotNotInJourney = false
}: {
  lang: "en" | "th";
  passport: Passport;
  stations: Station[];
  startIndex: number;
  // A ?robot= link named a robot that is not one of the stations: say so instead of starting silently.
  robotNotInJourney?: boolean;
}) {
  const t = ui[lang];
  const voiceLang = (passport.language === "th" ? "th" : "en") as "th" | "en";
  const largeText = passport.captions === "large";
  const [current, setCurrent] = useState(() => Math.min(Math.max(0, startIndex), Math.max(0, stations.length - 1)));
  const station = stations[current] ?? null;
  const copy = station ? stationCopy[lang][station.task] : null;

  // The robot's behaviour comes from the passport through the same adapter the robot console uses.
  // The server already capped the speed (toJourneyPassport), so only the calm demeanour is left to derive.
  const profile = toPublicProfile({
    ...passport,
    anxiety: passport.calm ? "high" : "low",
    status: "active",
    version: 1,
    updatedAt: PROFILE_TIME,
    expiresAt: null
  });
  const plan = adapt(profile, CARE_ROBOT);
  const careBehaviour = {
    distance: plan.distance.sceneUnits,
    speed: plan.movement.multiplier,
    gaze: plan.eyeContact,
    greeting: plan.greeting,
    voice: plan.voice,
    hue: (passport.calm ? "blue" : hueFor(station?.type ?? "")) as Hue,
    expression: (plan.demeanor === "calm" ? "calm" : "happy") as "calm" | "happy"
  };

  const robotRef = useRef<RobotBehavior | null>(null);
  const timers = useRef<number[]>([]);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("passport");
  const [applied, setApplied] = useState<string[]>([]);
  const [bubble, setBubble] = useState<string>(t.ready);
  const [log, setLog] = useState<LogEvent[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<number, StationRatings>>({});
  // Random per journey run; set after mount so server and client render the same first frame.
  const [journeyId, setJourneyId] = useState("");
  const [started, setStarted] = useState(false);
  const [resumed, setResumed] = useState<number | null>(null);
  // At the end: the access token of this passport if this browser created it (undefined = not checked).
  const [ownToken, setOwnToken] = useState<string | null | undefined>(undefined);
  const ratingsRef = useRef(ratings);
  ratingsRef.current = ratings;
  // Resume: a reload or a visit to another page must not start a new journey id, because the id fixes the
  // counterbalanced order. Only ratings the server confirmed are kept, in this tab only (sessionStorage).
  const storeKey = `hri-journey:${passport.code}`;
  useEffect(() => {
    const saved = readJourney(storeKey, stations.length);
    if (saved) {
      setJourneyId(saved.journeyId);
      setRatings(saved.ratings);
      setCurrent(saved.current);
      setStarted(true);
      setResumed(Object.values(saved.ratings).reduce((n, r) => n + Object.keys(r).length, 0));
    } else {
      setJourneyId(newJourneyId());
    }
  }, [storeKey, stations.length]);
  useEffect(() => {
    if (!journeyId) return;
    try {
      window.sessionStorage.setItem(storeKey, JSON.stringify({ v: 1, journeyId, ratings, current, started }));
    } catch {
      // Storage blocked (private mode): the journey still works, it just cannot resume after a reload.
    }
  }, [storeKey, journeyId, ratings, current, started]);
  const next = nextCondition(journeyId, current, ratings[current]);
  const stationDone = stationComplete(ratings[current]);
  const [running, setRunning] = useState(false);
  const [comfort, setComfort] = useState<number | null>(null);
  const adjustments = useRef({ tooClose: 0, tooFar: 0 });

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };
  useEffect(() => () => { clearTimers(); window.speechSynthesis?.cancel(); }, []);

  // Moving to another station resets the stage and the station's own state.
  useEffect(() => {
    clearTimers();
    setApplied([]);
    setSaved(false);
    setComfort(null);
    setRunning(false);
    setReady(false);
    // After a resume the first condition here may already be rated: show the one that is actually next.
    setMode(nextCondition(journeyId, current, ratingsRef.current[current])?.mode ?? conditionOrder(journeyId, current)[0]);
    adjustments.current = { tooClose: 0, tooFar: 0 };
    setBubble(t.ready);
    window.speechSynthesis?.cancel();
  }, [current, t.ready, journeyId]);

  const record = useCallback((e: LogEvent) => setLog((prev) => [...prev.slice(-299), e]), []);
  const onRobotEvent = useCallback((e: RobotEvent) => record({ ...e, src: "robot" }), [record]);
  const human = (type: string, detail: Record<string, unknown> = {}) => record({ t: +(robotRef.current?.time ?? 0).toFixed(3), src: "human", type, ...detail });

  const behaviour = mode === "passport" ? careBehaviour : DEFAULT_BEHAVIOUR;

  const say = (text: string, voiceOn: boolean) => {
    setBubble(text);
    if (voiceOn && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voiceLang === "th" ? "th-TH" : "en-US";
      u.rate = passport.speechPace === "slow" ? 0.8 : careBehaviour.speed < 1 ? 0.88 : 1;
      window.speechSynthesis.speak(u);
    }
  };

  const onReady = useCallback((r: RobotBehavior) => {
    robotRef.current = r;
    r.bothArms("relaxed");
    r.setDistance(START_DISTANCE);
    r.setGlow(0.6, hueFor(station?.type ?? ""));
    r.expression("neutral");
    r.snap();
    setReady(true);
  }, [station?.type]);

  function run(nextMode: Mode = mode) {
    const r = robotRef.current;
    if (!r || !station || !copy) return;
    clearTimers();
    window.speechSynthesis?.cancel();
    setMode(nextMode);
    setApplied([]);
    setComfort(null);
    setSaved(false);
    setSaveError(null);
    setRunning(true);
    adjustments.current = { tooClose: 0, tooFar: 0 };
    const b = nextMode === "passport" ? careBehaviour : DEFAULT_BEHAVIOUR;
    human("station_start", { task: station.task, mode: nextMode, robot: station.name });
    if (nextMode === "default") human("passport_not_read", { code: passport.code });

    // Reset to a neutral start, far away.
    r.clearGestures();
    r.setSpeed(1);
    r.bothArms("relaxed");
    r.lean("upright");
    r.setDistance(START_DISTANCE);
    r.lookAt(0, 0.2);
    r.expression("neutral");
    r.setGlow(0.6, hueFor(station.type));

    const mark = (key: string) => setApplied((prev) => [...prev, key]);
    let at = 600;
    if (nextMode === "passport") { say(t.robotLabel + " · " + (lang === "th" ? "กำลังอ่าน Care Passport ของคุณ…" : "Reading your Care Passport…"), b.voice); at = 1500; }

    later(at, () => {
      r.setSpeed(b.speed); mark("speed");
      if (b.greeting === "wai") {
        r.bothArms("wai"); r.expression("calm");
        later(500, () => r.bow(0.36, 1.7));
        later(2600, () => { r.bothArms("relaxed"); r.expression(nextMode === "passport" ? careBehaviour.expression : "happy"); });
      } else if (b.greeting === "wave") {
        r.wave("R", 2.4); r.expression("happy");
      } else {
        // The person asked for no gesture: stay relaxed and greet with the voice only.
        r.bothArms("relaxed"); r.expression(nextMode === "passport" ? careBehaviour.expression : "happy");
      }
      say(copy.intro(station.name), b.voice);
      mark("greeting"); mark("voice");
    });
    later(at + 3200, () => {
      r.setDistance(b.distance);
      if (b.gaze === "soft") r.lookAt(0.25, 0.35); else r.lookAt(0, 0);
      mark("distance"); mark("gaze");
    });
    later(at + 3200 + 3000 / b.speed, () => {
      // The station task itself.
      if (station.task === "delivery") {
        if (nextMode === "passport" && passport.noReach) {
          r.moveArm("R", "relaxed"); r.lean("forward");
          later(900, () => r.lean("upright"));
          say(copy.actionNoReach ?? copy.action, b.voice);
          mark("care");
        } else {
          r.moveArm("R", "offer"); r.expression("happy");
          later(2600, () => r.moveArm("R", "relaxed"));
          say(copy.action, b.voice);
        }
      } else if (station.task === "reception") {
        r.moveArm("R", "point"); r.expression("happy");
        later(2200, () => r.moveArm("R", "relaxed"));
        say(copy.action, b.voice);
      } else {
        r.moveArm("R", "point"); r.expression("happy");
        later(1400, () => { r.bothArms("relaxed"); r.lean("upright"); });
        say(copy.action, b.voice);
      }
      mark("task");
    });
    later(at + 3200 + 3000 / b.speed + 3000 / b.speed, () => {
      r.nod(1);
      if (nextMode === "passport") mark("care");
      setRunning(false);
    });
  }

  function adjust(kind: "too_close" | "too_far") {
    const r = robotRef.current;
    if (!r) return;
    human(kind, { distance: +r.state.distanceTarget.toFixed(2), mode });
    if (kind === "too_close") {
      adjustments.current.tooClose++;
      r.setDistance(r.state.distanceTarget - 0.7); r.moveArm("R", "handOnChest"); r.expression("sorry"); r.lean("back");
      later(1600, () => { r.lean("upright"); r.moveArm("R", "relaxed"); r.expression("neutral"); });
      say(lang === "th" ? "ขอโทษครับ ผมถอยออกมาแล้ว" : "Sorry, I have stepped back.", behaviour.voice);
    } else {
      adjustments.current.tooFar++;
      r.setDistance(r.state.distanceTarget + 0.6); r.expression("happy");
      say(lang === "th" ? "ได้ครับ ผมจะเข้าไปใกล้อีกนิด" : "Okay, I will come a little closer.", behaviour.voice);
    }
  }

  async function saveStation() {
    if (!station || comfort === null || !next || next.mode !== mode) return;
    const position = next.position;
    const r = robotRef.current;
    setSaving(true);
    setSaveError(null);
    try {
      // Care needs stay on the passport only (data minimisation); the server also strips them.
      const result = await recordMeetingAction(passport.code, {
        protocol: "care_journey_station",
        inputMode: "buttons",
        robotModelId: station.robotId,
        events: log.slice(-250),
        summary: {
          mode,
          order: position,
          journey: journeyId,
          task: station.task,
          robot: station.name,
          comfort,
          tooClose: adjustments.current.tooClose,
          tooFar: adjustments.current.tooFar,
          finalDistance: r ? +r.state.distanceTarget.toFixed(2) : null
        }
      });
      if (!result.ok) {
        setSaveError(result.error === "rate_limited" ? t.saveRateLimited : result.error === "not_found" ? t.saveNotFound : t.saveFailed);
        return;
      }
      setSaved(true);
      setRatings((prev) => ({ ...prev, [current]: { ...prev[current], [mode]: comfort } }));
      human("station_saved", { task: station.task, mode, comfort, order: position });
      // Ready for the other condition at this station: same robot, fresh start.
      setApplied([]);
      setComfort(null);
      if (position === 1) {
        const other = conditionOrder(journeyId, current)[1];
        setMode(other);
        setBubble(t.nextUp);
      }
    } catch {
      setSaveError(t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  function goNext() {
    if (current < stations.length - 1) {
      setCurrent((i) => i + 1);
    }
  }

  type Behaviour = { distance: number; speed: number; gaze: string; greeting: string; voice: boolean };
  const rowsFor = (b: Behaviour): { key: string; label: string; value: string }[] => [
    { key: "greeting", label: t.greeting, value: b.greeting === "wai" ? t.wai : b.greeting === "wave" ? t.wave : t.noGreeting },
    { key: "distance", label: t.distance, value: describeDistance(b.distance)[lang] },
    { key: "speed", label: t.speed, value: b.speed < 1 ? t.slow : b.speed > 1 ? t.fast : t.normal },
    { key: "gaze", label: t.gaze, value: b.gaze === "soft" ? t.soft : t.direct },
    { key: "voice", label: t.voice, value: b.voice ? t.on : t.off }
  ];
  const rows = rowsFor(behaviour);
  const careRows: { key: string; label: string; value: string }[] = [
    { key: "accessibility", label: lang === "th" ? "การสื่อสาร" : "Communication", value: passport.captions === "large" || passport.speechPace === "slow" ? t.accessibility : t.normal },
    { key: "reach", label: lang === "th" ? "การยื่นของ" : "Handing items", value: passport.noReach ? t.noReach : t.reach }
  ];

  const done = stations.length > 0 && stations.every((_, i) => stationComplete(ratings[i]));
  const averageOf = (mode: Mode) => {
    const values = Object.values(ratings).map((r) => r[mode]).filter((v): v is number => typeof v === "number");
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };
  const avgPassport = averageOf("passport");
  const avgDefault = averageOf("default");

  // Once the journey is done, find out (on the server) whether this browser holds this passport's token,
  // so the next steps can open its card and the Robot Lab with it. No token, no guess: plain links.
  useEffect(() => {
    if (!done || ownToken !== undefined) return;
    const tokens = listOwnPassports();
    if (!tokens.length) { setOwnToken(null); return; }
    let live = true;
    matchOwnPassport(passport.code, tokens).then((token) => { if (live) setOwnToken(token); }, () => { if (live) setOwnToken(null); });
    return () => { live = false; };
  }, [done, ownToken, passport.code]);

  if (!station || !copy) {
    return (
      <main style={{ display: "grid", gap: 16 }}>
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <h1>{t.journey}</h1>
        <div className="notice" style={{ borderLeftColor: "var(--warning)" }}>{t.empty}</div>
        <Link className="mt-btn" href="/living-lab">{t.back}</Link>
      </main>
    );
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <header className="mt-head">
        <div>
          <p className="mt-eyebrow">{t.eyebrow} · {passport.code}</p>
          <h1>{done ? t.doneTitle : t.journey}</h1>
          <p className="muted" aria-live="polite">{t.stationOf(current + 1, stations.length)}{!done && next ? ` · ${t.round(next.position)}` : ""} · {copy.title}</p>
        </div>
        <ol className="mt-steps" aria-label={t.journey}>
          {stations.map((s, i) => {
            const doneHere = stationComplete(ratings[i]);
            return (
              <li key={`${s.robotId}-${i}`} className={`${i === current ? "current" : ""} ${doneHere ? "done" : ""}`}>
                <button onClick={() => setCurrent(i)} aria-current={i === current ? "step" : undefined}>
                  {doneHere ? <BadgeCheck size={16} aria-hidden="true" /> : <CircleDashed size={16} aria-hidden="true" />}
                  <span>{stationCopy[lang][s.task].title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </header>

      {robotNotInJourney && !started && <p className="mt-notice" role="note">{t.robotNotInJourney}</p>}
      {resumed !== null && resumed > 0 && !done && <p className="mt-notice is-ok" role="status" data-testid="journey-resumed">{t.resumed(resumed, stations.length * 2)}</p>}

      {!started && !done ? (
        <section className="mt-panel mt-intro" aria-labelledby="journey-intro" data-testid="journey-intro">
          <h2 id="journey-intro">{t.intro.title}</h2>
          <ol className="mt-intro-list">
            {t.intro.points(stations.length).map((point) => <li key={point}>{point}</li>)}
          </ol>
          <p className="muted">{t.intro.sim}</p>
          <div className="mt-row">
            <button className="mt-btn primary" disabled={!journeyId} onClick={() => setStarted(true)}>
              <Play size={18} aria-hidden="true" /> {t.intro.begin}
            </button>
          </div>
        </section>
      ) : done ? (
        <section className="mt-panel mt-done">
          <h2>{t.doneTitle}</h2>
          <p className="muted">{t.doneBody}</p>
          <dl className="mt-avgs">
            <div className="is-passport"><dt>{t.avgPassport}</dt><dd>{avgPassport === null ? "–" : avgPassport.toFixed(1)}<small>/5</small></dd></div>
            <div className="is-default"><dt>{t.avgDefault}</dt><dd>{avgDefault === null ? "–" : avgDefault.toFixed(1)}<small>/5</small></dd></div>
            <div><dt>{t.difference}</dt><dd>{avgPassport === null || avgDefault === null ? "–" : `${avgPassport - avgDefault >= 0 ? "+" : ""}${(avgPassport - avgDefault).toFixed(1)}`}</dd></div>
          </dl>
          <table className="mt-table">
            <thead><tr><th scope="col">{t.journey}</th><th scope="col">{t.colDefault}</th><th scope="col">{t.colPassport}</th></tr></thead>
            <tbody>
              {stations.map((s, i) => (
                <tr key={`${s.robotId}-${i}`}>
                  <th scope="row">{stationCopy[lang][s.task].title}<span>{s.name}</span></th>
                  <td>{ratings[i]?.default ?? "–"}/5</td>
                  <td>{ratings[i]?.passport ?? "–"}/5</td>
                </tr>
              ))}
            </tbody>
          </table>
          {avgPassport !== null && avgDefault !== null && (
            <p className="mt-verdict" data-testid="journey-verdict">{t.verdict(Math.round((avgPassport - avgDefault) * 10) / 10)} <span className="muted">{t.verdictNote}</span></p>
          )}
          <nav className="mt-next" aria-labelledby="journey-next-title" data-testid="journey-next">
            <h3 id="journey-next-title">{t.nextTitle}</h3>
            <ul>
              <li>
                {ownToken ? (
                  <Link href={`/living-lab/passport/${ownToken}`} data-testid="journey-next-card"><IdCard size={18} aria-hidden="true" /><strong>{t.nextCard}</strong><span>{t.nextCardBody}</span></Link>
                ) : (
                  <div className="mt-next-static" data-testid="journey-next-card-elsewhere"><IdCard size={18} aria-hidden="true" /><strong>{t.nextCard}</strong><span>{t.nextCardElsewhere}</span></div>
                )}
              </li>
              <li><Link href={ownToken ? `/living-lab/robot#token=${ownToken}` : "/living-lab/robot"} data-testid="journey-next-robot"><Bot size={18} aria-hidden="true" /><strong>{t.nextRobot}</strong><span>{t.nextRobotBody}</span></Link></li>
              <li><Link href="/living-lab/research" data-testid="journey-next-research"><ChartColumn size={18} aria-hidden="true" /><strong>{t.nextResearch}</strong><span>{t.nextResearchBody}</span></Link></li>
              <li><Link href="/living-lab" data-testid="journey-next-home"><Compass size={18} aria-hidden="true" /><strong>{t.nextHome}</strong><span>{t.nextHomeBody}</span></Link></li>
            </ul>
          </nav>
          <div className="mt-row">
            <button className="mt-btn" onClick={() => { setRatings({}); setCurrent(0); setResumed(null); setJourneyId(newJourneyId()); }}><RotateCcw size={18} aria-hidden="true" /> {t.again}</button>
          </div>
        </section>
      ) : (
        <section className="mt-grid">
          <div className="mt-stage">
            <div className={`mt-bubble ${largeText ? "large" : ""}`} aria-live="polite">{bubble}</div>
            <RobotStage key={station.robotId} framing="fullBody" onReady={onReady} onEvent={onRobotEvent} className="mt-canvas" ariaLabel={station.name} />
            <div className={`mt-chip is-${mode}`}>{t.conditionLabel[mode]}</div>
          </div>

          <div className="mt-panel">
            <div className="mt-task">
              <h2>{copy.title}</h2>
              <p className="muted">{copy.short}</p>
              <p className="mt-robot"><ShieldCheck size={16} aria-hidden="true" /> {station.name} · {station.type.replace(/_/g, " ")}{station.org ? ` · ${station.org}` : ""}</p>
            </div>

            {stationDone ? (
              <div className="mt-compare">
                <h2>{t.compareTitle}</h2>
                <p className="muted">{t.compareSub}</p>
                <table className="mt-table">
                  <thead><tr><th scope="col"><span className="sr-only">{t.appliedTitle}</span></th><th scope="col">{t.colDefault}</th><th scope="col">{t.colPassport}</th></tr></thead>
                  <tbody>
                    {(() => {
                      const before = rowsFor(DEFAULT_BEHAVIOUR);
                      const after = rowsFor(careBehaviour);
                      return before.map((row, i) => (
                        <tr key={row.key} className={row.value !== after[i].value ? "changed" : ""}>
                          <th scope="row">{row.label}</th><td>{row.value}</td><td>{after[i].value}</td>
                        </tr>
                      ));
                    })()}
                    {careRows.map((row) => {
                      // A default robot speaks normally and hands items over.
                      const before = row.key === "reach" ? t.reach : t.normal;
                      return <tr key={row.key} className={before !== row.value ? "changed" : ""}><th scope="row">{row.label}</th><td>{before}</td><td>{row.value}</td></tr>;
                    })}
                    <tr className="mt-rated"><th scope="row">{t.yourRating}</th><td>{ratings[current]?.default}/5</td><td>{ratings[current]?.passport}/5</td></tr>
                  </tbody>
                </table>
                {plan.adaptations.length > 0 && (
                  <p className="muted mt-adapted">{t.adaptedTitle}: {plan.adaptations.map((a) => a.code.replace(/_/g, " ")).join(", ")}</p>
                )}
                <div className="mt-row">
                  {current < stations.length - 1 && <button className="mt-btn primary" onClick={goNext}>{t.next}</button>}
                  <Link className="mt-btn" href="/living-lab">{t.back}</Link>
                </div>
              </div>
            ) : next && (
              <>
                <div className="mt-protocol">
                  <ol aria-label={t.protocolNote}>
                    {conditionOrder(journeyId, current).map((m, i) => (
                      <li key={m} className={`${m === next.mode ? "current" : ""} ${typeof ratings[current]?.[m] === "number" ? "done" : ""}`} aria-current={m === next.mode ? "step" : undefined}>
                        <span>{t.condition(i + 1)}</span> {t.conditionLabel[m]}
                      </li>
                    ))}
                  </ol>
                  <p className="muted">{t.protocolNote}</p>
                </div>

                <div className="mt-row">
                  <button className="mt-btn primary" disabled={!ready || running} onClick={() => run(next.mode)}>
                    <Play size={18} aria-hidden="true" /> {applied.length && mode === next.mode ? t.replay : t.startCondition(next.position)}
                  </button>
                </div>

                <div className={`mt-card is-${mode}`}>
                  <h2>{mode === "passport" ? t.appliedTitle : t.defaultTitle}</h2>
                  <ul>
                    {rows.map((row) => (
                      <li key={row.key} className={applied.includes(row.key) ? "on" : ""}>
                        {applied.includes(row.key) ? <BadgeCheck size={18} aria-hidden="true" /> : <CircleDashed size={18} aria-hidden="true" />}
                        <span>{row.label}</span><strong>{row.value}</strong>
                      </li>
                    ))}
                  </ul>
                  {mode === "passport" && (
                    <ul className="mt-care">
                      {careRows.map((row) => (
                        <li key={row.key}><span>{row.label}</span><strong>{row.value}</strong></li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-row">
                  <button className="mt-btn" disabled={!ready} onClick={() => adjust("too_close")}><Hand size={18} aria-hidden="true" /> {t.tooClose}</button>
                  <button className="mt-btn" disabled={!ready} onClick={() => adjust("too_far")}><MoveDown size={18} aria-hidden="true" /> {t.tooFar}</button>
                </div>

                {!running && applied.length > 0 && mode === next.mode && (
                  <div className="mt-rating">
                    <h2>{t.rateTitle}</h2>
                    <p className="muted">{t.rateHint}</p>
                    <div className="mt-scale" role="group" aria-label={t.rateTitle}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          className={comfort === n ? "sel" : ""}
                          aria-pressed={comfort === n}
                          aria-label={`${n} — ${n <= 2 ? t.rateLow : n >= 4 ? t.rateHigh : t.normal}`}
                          onClick={() => { setComfort(n); human("comfort_rating", { value: n, task: station.task, mode }); }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <div className="mt-scale-ends"><span>{t.rateLow}</span><span>{t.rateHigh}</span></div>
                    <div className="mt-row">
                      <button className="mt-btn primary" disabled={comfort === null || saving || running} onClick={saveStation}>{t.save}</button>
                    </div>
                  </div>
                )}
                {saved && <p className="mt-ok" role="status">{t.nextUp}</p>}
                {saveError && <p className="mt-error" role="alert">{saveError}</p>}
                <Link className="mt-link" href="/living-lab">{t.back}</Link>
              </>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

const css = `
.mt-head { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; align-items: flex-end; border-bottom: 1px solid var(--border); padding-bottom: 12px; }
.mt-head h1 { margin: 4px 0; font-size: clamp(24px, 2.2vw, 34px); font-weight: 900; color: var(--lab-ink); }
.mt-eyebrow { margin: 0; font-size: 12px; font-weight: 750; letter-spacing: 1.2px; text-transform: uppercase; color: var(--warning); }
.mt-steps { list-style: none; display: flex; gap: 6px; flex-wrap: wrap; margin: 0; padding: 0; }
.mt-steps button { display: inline-flex; align-items: center; gap: 6px; min-height: 42px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--border); background: #fff; color: var(--text-secondary); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.mt-steps .current button { border-color: var(--accent); color: var(--lab-ink); box-shadow: inset 0 0 0 2px var(--accent); }
.mt-steps .done button svg { color: var(--accent); }
.mt-grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(320px, 1fr); gap: 16px; align-items: start; }
@media (max-width: 960px) { .mt-grid { grid-template-columns: 1fr; } }
.mt-stage { position: relative; height: 620px; border-radius: 14px; overflow: hidden; border: 1px solid var(--border); background: linear-gradient(180deg, #ffffff, var(--lab-stage-end)); }
@media (max-width: 960px) { .mt-stage { height: 480px; } }
.mt-canvas { position: absolute; inset: 0; }
.mt-bubble { position: absolute; z-index: 2; left: 14px; right: 14px; top: 14px; background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; font-size: 17px; min-height: 50px; box-shadow: 0 8px 20px rgba(0,0,0,.06); transition: font-size .2s; }
.mt-bubble.large { font-size: 22px; line-height: 1.45; font-weight: 600; }
.mt-chip { position: absolute; z-index: 2; left: 14px; bottom: 14px; background: rgba(11,31,58,.9); color: #fff; padding: 7px 13px; border-radius: 999px; font-size: 13px; font-weight: 650; }
.mt-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px; display: grid; gap: 14px; }
.mt-task h2 { margin: 0 0 4px; font-size: 20px; }
.mt-task p { margin: 0; }
.mt-robot { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px !important; font-size: 13px; font-weight: 650; color: var(--text-secondary); }
.mt-robot svg { color: var(--accent); }
.mt-row { display: flex; gap: 10px; flex-wrap: wrap; }
.mt-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; padding: 10px 16px; border-radius: 10px; border: 1px solid var(--border); background: #fff; color: var(--lab-ink); font: inherit; font-weight: 700; cursor: pointer; text-decoration: none; flex: 1 1 180px; }
.mt-btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.mt-btn:disabled { opacity: .55; cursor: not-allowed; }
.mt-btn:focus-visible { outline: 3px solid var(--lab-focus); outline-offset: 2px; }
.mt-card { border: 1px dashed var(--accent); border-radius: 12px; padding: 14px; background: var(--lab-paper); }
.mt-card h2 { margin: 0 0 10px; font-size: 17px; }
.mt-card ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.mt-card li { display: grid; grid-template-columns: 22px 1fr auto; gap: 8px; align-items: center; color: var(--text-secondary); transition: color .3s; }
.mt-card li.on { color: var(--lab-ink); }
.mt-card li.on svg { color: var(--accent); }
.mt-card .mt-care { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
.mt-card .mt-care li { grid-template-columns: 1fr auto; font-size: 13px; }
.mt-rating { border: 1px solid var(--border); border-radius: 12px; padding: 14px; background: #fff; display: grid; gap: 8px; }
.mt-rating h2 { margin: 0; font-size: 17px; }
.mt-rating p { margin: 0; font-size: 13px; }
.mt-scale { display: flex; gap: 8px; }
.mt-scale button { flex: 1 1 0; min-height: 52px; border-radius: 10px; border: 1px solid var(--border); background: #fff; font: inherit; font-size: 20px; font-weight: 800; cursor: pointer; }
.mt-scale button.sel { background: var(--lab-tint); border-color: var(--accent); box-shadow: inset 0 0 0 2px var(--accent); color: var(--lab-ink); }
.mt-scale button:focus-visible { outline: 3px solid var(--lab-focus); outline-offset: 2px; }
.mt-scale-ends { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); }
.mt-ok { color: var(--accent); font-weight: 700; margin: 0; }
.mt-error { color: var(--warning); font-weight: 700; margin: 0; }
.mt-done { border-color: var(--accent); }
.mt-done h2 { margin: 0; }
.mt-verdict { margin: 0; font-size: 15px; line-height: 1.6; color: var(--lab-ink); }
.mt-verdict .muted { display: block; font-size: 13px; }
.mt-next { display: grid; gap: 10px; padding-top: 14px; border-top: 1px solid var(--border); }
.mt-next h3 { margin: 0; font-size: 17px; }
.mt-next ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 10px; }
.mt-next a, .mt-next-static { height: 100%; display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; align-content: start; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: #fff; color: var(--lab-ink); text-decoration: none; }
.mt-next a:hover { border-color: var(--lab-ink); }
.mt-next a:focus-visible { outline: 3px solid var(--lab-focus); outline-offset: 2px; }
.mt-next svg { grid-row: span 2; margin-top: 2px; color: var(--accent); }
.mt-next strong { font-size: 15px; }
.mt-next span { font-size: 13px; line-height: 1.5; color: var(--text-secondary); }
.mt-next-static { background: var(--lab-paper); border-style: dashed; }
.mt-avg { font-size: 17px; margin: 0; }
.mt-avg strong { font-size: 24px; color: var(--accent); }
.mt-summary { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.mt-summary li { display: grid; grid-template-columns: 22px 1fr auto; gap: 8px; align-items: center; color: var(--text-secondary); }
.mt-summary li svg { color: var(--accent); }
.mt-summary strong { color: var(--lab-ink); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.mt-eyebrow { font-family: var(--lab-mono); font-weight: 600; letter-spacing: .12em; color: var(--lab-cyan-ink) !important; }
.mt-head h1 { font-weight: 700 !important; letter-spacing: -0.02em; }
.mt-panel, .mt-stage, .mt-card, .mt-rating { border-radius: 8px !important; }
.mt-btn.primary { background: var(--lab-navy); border-color: var(--lab-navy); }
.mt-chip.is-passport { background: #00657c; }
.mt-chip.is-default { background: #8a4f17; }
.mt-card.is-default { border-color: #c0742c; }
.mt-card.is-passport { border-color: var(--lab-cyan-ink); }
.mt-protocol { display: grid; gap: 8px; }
.mt-protocol ol { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.mt-protocol li { display: grid; gap: 2px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 13.5px; font-weight: 600; color: var(--text-secondary); background: var(--surface); }
.mt-protocol li span { font: 600 10.5px/1.4 var(--lab-mono); letter-spacing: .1em; text-transform: uppercase; color: var(--text-secondary); }
.mt-protocol li.current { border-color: var(--lab-navy); color: var(--lab-ink); box-shadow: inset 0 0 0 1px var(--lab-navy); }
.mt-protocol li.done { background: var(--lab-tint); border-color: var(--lab-tint-border); color: var(--lab-tint-ink); }
.mt-protocol li.done span::after { content: " ✓"; }
.mt-protocol p { margin: 0; font-size: 12.5px; }
.mt-compare { display: grid; gap: 10px; }
.mt-compare h2 { margin: 0; font-size: 18px; }
.mt-compare p { margin: 0; font-size: 13px; }
.mt-table { width: 100%; min-width: 0; table-layout: fixed; border-collapse: collapse; font-size: 13.5px; }
.mt-table th, .mt-table td { background: transparent; overflow-wrap: anywhere; }
.mt-table tbody th { text-transform: none; letter-spacing: 0; }
.mt-panel { min-width: 0; }
.mt-table th, .mt-table td { text-align: left; padding: 9px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
.mt-table thead th { font: 600 10.5px/1.4 var(--lab-mono); letter-spacing: .1em; text-transform: uppercase; color: var(--text-secondary); }
.mt-table thead th:nth-child(2) { color: #8a4f17; }
.mt-table thead th:nth-child(3) { color: var(--lab-cyan-ink); }
.mt-table tbody th { font-weight: 600; color: var(--text-secondary); }
/* Header labels wrap instead of running into the next column (Thai labels are long at phone width). */
.mt-table thead th { white-space: normal; }
.mt-table thead th:first-child, .mt-table tbody th { width: 46%; }
.mt-table tbody th span { white-space: normal; overflow-wrap: anywhere; }
html[lang="th"] .mt-table thead th { font-family: inherit; letter-spacing: 0; text-transform: none; font-size: 12px; }
.mt-table tbody th span { display: block; font-weight: 400; font-size: 12px; }
.mt-table td { font-weight: 600; color: var(--lab-ink); font-variant-numeric: tabular-nums; }
.mt-table tr.changed td:nth-child(3) { background: var(--lab-tint); box-shadow: inset 2px 0 0 var(--lab-cyan-ink); }
.mt-table tr.mt-rated th, .mt-table tr.mt-rated td { border-top: 2px solid var(--border); font-size: 15px; }
.mt-adapted { font-size: 12.5px !important; }
.mt-link { justify-self: start; font-weight: 600; font-size: 13.5px; min-height: 40px; display: inline-flex; align-items: center; }
.mt-avgs { margin: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.mt-avgs div { padding: 12px 12px 12px 0; display: grid; gap: 4px; }
.mt-avgs div + div { padding-left: 12px; border-left: 1px solid var(--border); }
.mt-avgs dt { font-size: 12.5px; color: var(--text-secondary); }
.mt-avgs dd { margin: 0; font: 600 26px/1.1 var(--lab-mono); color: var(--lab-ink); }
.mt-avgs dd small { font-size: 13px; color: var(--text-secondary); }
.mt-avgs .is-passport dt::before, .mt-avgs .is-default dt::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
.mt-avgs .is-passport dt::before { background: #0089a8; }
.mt-avgs .is-default dt::before { background: #c0742c; }
@media (max-width: 560px) { .mt-protocol ol, .mt-avgs { grid-template-columns: 1fr; } .mt-avgs div + div { padding-left: 0; border-left: none; border-top: 1px solid var(--border); } }
`;
