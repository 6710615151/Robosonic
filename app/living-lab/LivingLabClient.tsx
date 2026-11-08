"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import QRCode from "qrcode";
import { BadgeCheck, Bot, Camera, CameraOff, Hand, HeartHandshake, Hospital, IdCard, Mic, MicOff, Pause, Play, ScanFace, Snail, UserPlus, Volume2, VolumeX } from "lucide-react";
import { adapt } from "@/lib/hri/adapt";
import { PROFILE_SCHEMA, type PublicProfile } from "@/lib/hri/public-profile";
import { ROBOT_PROFILES } from "@/lib/hri/robot-profiles";
import { buildSpokenSummary } from "@/lib/hri/spoken-summary";
import { useQrWatch } from "./components/qr-watch";
import RobotStage from "@/app/components/robot/RobotStage";
import type { RobotBehavior, RobotEvent } from "@/lib/hri/behavior-engine";
import { classifyWai, LeanBackDetector, POSE, shoulderWidth, WaiDetector } from "@/lib/hri/signals";
import { describeDistance, type PassportInput } from "@/lib/hri/passport";
import { AutoCalibrator, type AutoEvent, type AutoEvidence, type AutoResult, type AutoStage, type PauseReason, type VoiceCue } from "@/lib/hri/auto-calibration";
import { applyInterviewUpdates, initialReview, pendingTopics, toState, type FieldKey, type InterviewReply, type InterviewUpdates, type ReviewValues, type Source, type Sources } from "@/lib/hri/interview-ai";
import { TalkAnalyzer } from "@/lib/hri/talk-analysis";
import { findSpeechRecognition, listenOnce } from "@/lib/hri/speech-input";
import { matchFirstVoiceAnswer } from "@/lib/hri/voice-answers";
import type { PoseFrame } from "@/lib/hri/camera";
import { CameraSession } from "@/lib/hri/camera-session";
import { createPassportAction } from "./actions";
import IdentityCard from "./IdentityCard";
import { identityCopy } from "./identity-copy";
import type { ClientIdentity } from "./identity-actions";
import PassportCardVisual, { passportMrz } from "./PassportCardVisual";
import PassportSave from "./components/PassportSave";
import AutoInterview from "./AutoInterview";
import VoiceAnswerBox from "./VoiceAnswer";
import { copy, type Lang } from "./copy";
import { labCopy } from "./lab-copy";
import { CalibrationProgress, CreationStages, SectionHead } from "./LabSections";


type Phase = "intro" | "greet" | "approach" | "care" | "gaze" | "voice" | "confirm" | "auto" | "review" | "saving" | "done";
type InputMode = "buttons" | "camera" | "voice" | "auto";
type SessionSummary = Record<string, string | number | boolean | null>;
const REVIEW_SECONDS = 10;
// Conversation mode: at least this many small-talk questions, however quickly the camera finishes.
const MIN_TALK_QUESTIONS = 3;
const TALK_ANSWER_MS = 11000; // from asking (the question is spoken first) to "no answer, next question"
const TALK_CLOSING_MS = 7000; // the goodbye, then the passport is saved
const MAX_TALK_TURNS = 8; // the conversation always ends, even if the camera never finishes
// Values to talk about before the camera has produced any (Gemini only sees closed-list values).
const TALK_START_VALUES: ReviewValues = {
  greeting: "wai", comfortDistance: -2.2, speed: 1, gaze: "direct", voice: true, language: "th", anxiety: "low",
  captions: "normal", speechPace: "normal", noReach: true
};
// After the camera finishes, offer a spoken interview about what it cannot measure. While it is on offer the
// automatic save waits for the person to choose (talk, or skip and save with the measured values).
const INTERVIEW_OFFERED = true;
type LogEvent = { t: number; src: "robot" | "human"; type: string; [key: string]: unknown };

// Distances the robot steps through while approaching (higher = closer to the person).
const STEPS = [-2.2, -1.3, -0.4, 0.5, 1.3];
// What each choice on the review screen sets the distance to, when the person changes the band.
const DISTANCE_CHOICES = { close: 1.3, medium: -0.4, far: -1.3 } as const;
const REVIEW_SLOWER_SPEED = 0.5;
// The care questions are asked one at a time when answering by voice or text.
const CARE_QUESTIONS = ["anxiety", "communication", "reach"] as const;

// The four stages people see across the top; the detailed step list stays inside the panel.
function stageOf(phase: Phase): number {
  if (phase === "intro") return 0;
  if (phase === "confirm" || phase === "review" || phase === "saving") return 2;
  if (phase === "done") return 3;
  return 1;
}

export default function LivingLabClient({ lang, initialIdentity, identityRequired = false, layout = "page", openSheet = false, startManual = false }: {
  lang: Lang; initialIdentity: ClientIdentity;
  // True only when HRI_IDENTITY_REQUIRED=true: the robot then waits for a verified email.
  identityRequired?: boolean;
  // "call": the robot fills the screen like a video call, with a control bar (the Living Lab front door).
  // "page": the original page with the answer-by-buttons flows (/living-lab/create?manual=1).
  layout?: "page" | "call";
  openSheet?: boolean; // call: open the "create passport" sheet straight away (/living-lab/create)
  startManual?: boolean;
}) {
  const call = layout === "call";
  // The call room is drawn over the whole viewport, outside the site's animated page wrapper (whose
  // transform would otherwise trap position: fixed). It mounts after hydration; the page cannot scroll.
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!call) return;
    setPortal(document.body);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [call]);

  // Call room: camera and microphone open as soon as the room does, like joining a call. The camera feeds
  // your own tile and the passport QR watcher; nothing is analysed or saved until you agree to talk.
  const selfRef = useRef<HTMLVideoElement>(null);
  const selfStream = useRef<MediaStream | null>(null);
  const [media, setMedia] = useState<"asking" | "on" | "denied">("asking");
  const openMedia = useCallback(async () => {
    setMedia("asking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      selfStream.current?.getTracks().forEach((track) => track.stop());
      selfStream.current = stream;
      if (selfRef.current) selfRef.current.srcObject = stream;
      setMedia("on");
    } catch {
      setMedia("denied");
    }
  }, []);
  useEffect(() => {
    if (!call || !portal) return;
    void openMedia();
    return () => { selfStream.current?.getTracks().forEach((track) => track.stop()); selfStream.current = null; };
  }, [call, portal, openMedia]);
  useEffect(() => {
    if (media === "on" && selfRef.current && selfStream.current && selfRef.current.srcObject !== selfStream.current) selfRef.current.srcObject = selfStream.current;
  });
  const t = copy[lang];
  const idT = identityCopy[lang];
  // Verified Living Lab participant (masked email). Optional unless required by configuration (decision 1).
  const [identity, setIdentity] = useState<ClientIdentity>(initialIdentity);
  const identityOk = Boolean(identity) || !identityRequired;
  const robotRef = useRef<RobotBehavior | null>(null);
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [speech, setSpeech] = useState<string>(t.introSpeech);
  const [status, setStatus] = useState<string>(t.statusIdle);
  const [inputMode, setInputMode] = useState<InputMode>("buttons");
  const [cameraState, setCameraState] = useState<"off" | "loading" | "on" | "error">("off");
  const [cameraInfo, setCameraInfo] = useState("");
  const [step, setStep] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [comfort, setComfort] = useState<number | null>(null);
  const [gaze, setGaze] = useState<"direct" | "soft">("direct");
  const [voice, setVoice] = useState(false);
  const [anxiety, setAnxiety] = useState<"low" | "medium" | "high">("low");
  const [accessible, setAccessible] = useState(false);
  const [noReach, setNoReach] = useState(false);
  const [greeting, setGreeting] = useState<"wai" | "wave" | "none">("wai");
  const [careQuestion, setCareQuestion] = useState(0);
  const [log, setLog] = useState<LogEvent[]>([]);
  const [consent, setConsent] = useState(false);
  const [passportCode, setPassportCode] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [editToken, setEditToken] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedOwner, setSavedOwner] = useState<string | null>(null);
  // Auto mode
  const [autoStage, setAutoStage] = useState<AutoStage>("baseline");
  const [autoPaused, setAutoPaused] = useState<PauseReason | null>(null);
  const [autoPerson, setAutoPerson] = useState(false);
  const [autoWai, setAutoWai] = useState<boolean | null>(null);
  const [autoLeans, setAutoLeans] = useState(0);
  const [autoResult, setAutoResult] = useState<{ result: AutoResult; evidence: AutoEvidence } | null>(null);
  const [autoNotice, setAutoNotice] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const autoRef = useRef<AutoCalibrator | null>(null);
  // Camera + voice: spoken safety words while the robot approaches, and the Gemini interview afterwards.
  const [voiceSafety, setVoiceSafety] = useState(false);
  const [heardCue, setHeardCue] = useState<string | null>(null);
  const [micSupported, setMicSupported] = useState(false);
  const [autoValues, setAutoValues] = useState<ReviewValues | null>(null);
  const [autoSources, setAutoSources] = useState<Sources | null>(null);
  const [interviewTurns, setInterviewTurnsState] = useState(0);
  const interviewTurnsRef = useRef(0);
  const setInterviewTurns = (next: number | ((n: number) => number)) => {
    interviewTurnsRef.current = typeof next === "function" ? next(interviewTurnsRef.current) : next;
    setInterviewTurnsState(interviewTurnsRef.current);
  };
  const autoValuesRef = useRef<ReviewValues | null>(null);
  // Conversation mode, the default way in: camera and microphone on, the robot makes small talk, and the
  // Auto calibrator measures behind it. Nothing it measures is shown until the passport exists.
  const [talk, setTalk] = useState(false);
  const talkRef = useRef(false);
  const [manual, setManual] = useState(startManual);
  // Call layout: the create sheet, the passport scanner, and the passport the robot last read.
  const [sheet, setSheet] = useState(openSheet);
  const [askingPermission, setAskingPermission] = useState(false);
  const talkState = useRef({ asked: 0, answered: 0, awaiting: false, sensingDone: false, closing: false });
  const talkResult = useRef<{ result: AutoResult; evidence: AutoEvidence } | null>(null);
  const talkAnalyzer = useRef(new TalkAnalyzer());
  // Gemini small talk while it answers; null = not tried yet, false = unavailable, use the script.
  const talkAi = useRef<boolean | null>(null);
  const talkHistory = useRef<{ role: "user" | "robot"; text: string }[]>([]);
  // Preferences the person named in passing, applied when the passport is made.
  const talkUpdates = useRef<InterviewUpdates>({});
  const autoSourcesRef = useRef<Sources | null>(null);
  const spokeAt = useRef(0); // when the robot last started to speak: the mic must not hear it

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  // On narrow screens the robot is pinned (small) above the questions once a session starts; before that,
  // the consent and method choice come first and the robot sits below them (lab-theme.css). When a
  // session starts, bring the first question into view just below the robot.
  const panelRef = useRef<HTMLDivElement>(null);
  const wasIntro = useRef(true);
  useEffect(() => {
    const leavingIntro = wasIntro.current && phase !== "intro";
    wasIntro.current = phase === "intro";
    if (!leavingIntro || window.innerWidth > 960) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panelRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [phase]);
  const stepRef = useRef(step);
  stepRef.current = step;
  const counters = useRef({ tooClose: 0, tooFast: 0, leanBack: 0 });
  const timers = useRef<number[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const camera = useRef(new CameraSession());
  const logRef = useRef<HTMLDivElement | null>(null);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
  const clearTimers = () => { timers.current.forEach((id) => window.clearTimeout(id)); timers.current = []; };
  useEffect(() => () => { clearTimers(); camera.current.stop(); window.speechSynthesis?.cancel(); }, []);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [log]);

  const record = useCallback((e: LogEvent) => setLog((prev) => [...prev.slice(-299), e]), []);
  const human = (type: string, detail: Record<string, unknown> = {}) =>
    record({ t: +(robotRef.current?.time ?? 0).toFixed(3), src: "human", type, ...detail });
  const onRobotEvent = useCallback((e: RobotEvent) => record({ ...e, src: "robot" }), [record]);

  useEffect(() => { setMicSupported(findSpeechRecognition(window) !== null); }, []);

  const say = (text: string) => {
    spokeAt.current = Date.now();
    setSpeech(text);
    if (voiceRef.current && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === "th" ? "th-TH" : "en-US";
      u.rate = speed < 1 ? 0.85 : 1;
      window.speechSynthesis.speak(u);
    }
  };

  const onReady = useCallback((robot: RobotBehavior) => {
    robotRef.current = robot;
    robot.bothArms("relaxed");
    robot.setDistance(STEPS[0]);
    robot.lookAt(0, 0.35);
    robot.expression("neutral");
    robot.setGlow(0.45, "teal");
    robot.snap();
    setReady(true);
    if (layout === "call") {
      // The robot answers the call: a wai, and a line saying what to press.
      window.setTimeout(() => {
        robot.bothArms("wai"); robot.expression("calm"); robot.lookAt(0, 0.2);
        window.setTimeout(() => robot.bow(0.3, 1.5), 450);
        window.setTimeout(() => { robot.bothArms("relaxed"); robot.expression("happy"); }, 2500);
        setSpeech(copy[lang].talk.welcome);
      }, 900);
    }
  }, [layout, lang]);

  // Call page: a passport shown to the robot. It reads the public profile, adapts, and says what it will do.
  async function readScanned(token: string) {
    const robot = robotRef.current;
    try {
      const response = await fetch(`/api/hri/passport/${encodeURIComponent(token)}`, { cache: "no-store", headers: { accept: "application/json" } });
      const profile = (await response.json().catch(() => null)) as PublicProfile | null;
      if (!response.ok || !profile || profile.schema !== PROFILE_SCHEMA) { say(t.talk.scanFailed); return; }
      const plan = adapt(profile, ROBOT_PROFILES[0]);
      human("passport_scanned", { version: profile.version });
      if (robot) {
        robot.setSpeed(Math.max(plan.movement.multiplier, 0.25));
        robot.setDistance(plan.distance.sceneUnits);
        robot.lookAt(0, plan.eyeContact === "soft" ? 0.35 : 0.1);
        robot.expression(plan.demeanor === "calm" ? "calm" : "happy");
        if (plan.greeting === "wai") { robot.bothArms("wai"); later(450, () => robot.bow(0.3, 1.5)); later(2500, () => robot.bothArms("relaxed")); }
        else if (plan.greeting === "wave") robot.wave("R", 2.4);
      }
      // Speak only if the passport asks for a voice; the caption always shows.
      voiceRef.current = plan.voice;
      say(buildSpokenSummary(plan));
    } catch {
      say(t.talk.scanFailed);
    }
  }

  // ---------------- phases ----------------
  function begin(answerByVoice = false) {
    const robot = robotRef.current;
    if (!robot || !consent || !identityOk) return;
    clearTimers();
    counters.current = { tooClose: 0, tooFast: 0, leanBack: 0 };
    setLog([]); setStep(0); setSpeed(1); setComfort(null); setGreeting("wai"); setCareQuestion(0);
    setPassportCode(null); setAccessToken(null); setEditToken(null); setKeyCopied(false); setQr(null); setError(null);
    robot.setSpeed(1); robot.setDistance(STEPS[0]); robot.bothArms("relaxed"); robot.expression("neutral"); robot.lookAt(0, 0.35); robot.setGlow(0.45, "teal");
    // A voice conversation needs the robot to talk from the start; the person decides later whether it keeps talking.
    if (answerByVoice) { voiceRef.current = true; setVoice(true); }
    // After an Auto session the mode must fall back to what is actually on: camera or buttons.
    const mode: InputMode = answerByVoice ? "voice" : cameraState === "on" ? "camera" : "buttons";
    setInputMode(mode);
    setAutoNotice(null);
    human("session_start", { inputMode: mode });
    setPhase("greet");
    // The robot waits quietly with lowered eyes: it does not wave at or stare at the visitor.
    say(answerByVoice ? t.voiceInput.prompts.greet : t.waitSpeech);
    setStatus(mode === "camera" ? t.statusWaitCamera : t.statusWaitButton);
  }

  function receiveWai(source: "button" | "camera") {
    const robot = robotRef.current;
    if (!robot || phaseRef.current !== "greet") return;
    human("wai", { source });
    setPhase("approach");
    robot.lookAt(0, 0.2);
    robot.bothArms("wai");
    robot.expression("calm");
    say(t.waiSpeech);
    setStatus(t.statusWaiReturned);
    later(500, () => robot.bow(0.36, 1.7));
    later(2800, () => {
      robot.bothArms("relaxed");
      robot.expression("happy");
      robot.lookAt(0, 0);
      robot.setGlow(0.7, "teal");
      say(t.askApproach);
      setStatus(t.statusApproach(1, STEPS.length - 1));
    });
  }

  function approachNext() {
    const robot = robotRef.current;
    if (!robot || phaseRef.current !== "approach") return;
    const next = stepRef.current + 1;
    if (next >= STEPS.length) return finishDistance(STEPS[STEPS.length - 1], "closest_step");
    human("continue", { step: next });
    say(t.announceStep);
    later(1100 / robot.state.speed, () => {
      if (phaseRef.current !== "approach") return;
      robot.setDistance(STEPS[next]);
      robot.moveArm("R", next >= STEPS.length - 1 ? "offer" : "relaxed");
      setStep(next);
      setStatus(t.statusApproach(next, STEPS.length - 1));
      later(1500, () => { if (phaseRef.current === "approach") say(next >= STEPS.length - 1 ? t.closestAsk : t.askApproach); });
    });
  }

  function tooClose(source: "button" | "camera") {
    const robot = robotRef.current;
    if (!robot || phaseRef.current !== "approach") return;
    clearTimers();
    counters.current.tooClose++;
    if (source === "camera") counters.current.leanBack++;
    human("too_close", { source, distance: +robot.state.distance.toFixed(2) });
    const back = Math.max(-2.4, robot.state.distanceTarget - 0.8);
    robot.setDistance(back);
    robot.moveArm("R", "handOnChest");
    robot.moveArm("L", "relaxed");
    robot.expression("sorry");
    robot.lean("back");
    say(source === "camera" ? t.sorryLean : t.sorry);
    later(1700, () => { robot.lean("upright"); robot.moveArm("R", "relaxed"); });
    later(2600, () => finishDistance(back, "too_close"));
  }

  function tooFast() {
    const robot = robotRef.current;
    if (!robot || phaseRef.current !== "approach") return;
    counters.current.tooFast++;
    const s = Math.max(0.35, robot.state.speed * 0.5);
    robot.setSpeed(s);
    setSpeed(s);
    robot.nod(1);
    robot.expression("neutral");
    human("too_fast", { speed: s });
    say(t.slower);
  }

  function comfortable() {
    const robot = robotRef.current;
    if (!robot || phaseRef.current !== "approach") return;
    human("comfortable", { distance: +robot.state.distance.toFixed(2) });
    finishDistance(robot.state.distanceTarget, "comfortable");
  }

  function finishDistance(distance: number, reason: string) {
    const robot = robotRef.current;
    if (!robot) return;
    setComfort(distance);
    robot.moveArm("R", "relaxed");
    robot.nod(2);
    robot.expression("happy");
    robot.setGlow(0.9, "teal");
    human("distance_set", { distance: +distance.toFixed(2), reason });
    setPhase("care");
    later(900, () => {
      robot.lookAt(0, 0);
      say(t.askCare);
      setStatus(t.statusCare);
    });
  }

  // Care needs: shown to the robot immediately so the person sees the effect of each answer.
  function chooseAnxiety(level: "low" | "medium" | "high") {
    const robot = robotRef.current;
    setAnxiety(level);
    human("anxiety", { level });
    if (!robot) return;
    if (level === "high") { robot.setSpeed(Math.min(robot.state.speed, 0.5)); robot.setGlow(0.35, "blue"); robot.expression("calm"); say(t.anxietyHigh); }
    else if (level === "medium") { robot.setSpeed(Math.min(robot.state.speed, 0.75)); robot.setGlow(0.5, "blue"); robot.expression("neutral"); say(t.anxietyMedium); }
    else { robot.setGlow(0.8, "teal"); robot.expression("happy"); say(t.anxietyLow); }
    setSpeed(robot.state.speed);
  }
  function chooseAccessible(on: boolean) {
    setAccessible(on);
    human("communication", { accessible: on });
    say(on ? t.accessibleOn : t.accessibleOff);
  }
  function chooseReach(avoid: boolean) {
    const robot = robotRef.current;
    setNoReach(avoid);
    human("reach", { noReach: avoid });
    if (!robot) return;
    if (avoid) { robot.moveArm("R", "relaxed"); say(t.reachNo); }
    else { robot.moveArm("R", "offer"); later(1500, () => robot.moveArm("R", "relaxed")); say(t.reachYes); }
  }
  function careDone() {
    human("care_needs_set", { anxiety, accessible, noReach });
    setPhase("gaze");
    say(t.askGaze);
    setStatus(t.statusGaze);
  }
  // A delayed call must log the answers as they are by then, not as they were when it was scheduled.
  const careDoneRef = useRef(careDone);
  careDoneRef.current = careDone;

  function applyGaze(choice: "direct" | "soft") {
    const robot = robotRef.current;
    if (!robot) return;
    setGaze(choice);
    human("gaze_preference", { gaze: choice });
    if (choice === "soft") { robot.lookAt(0.25, 0.35); say(t.gazeSoft); } else { robot.lookAt(0, 0); robot.nod(1); say(t.gazeDirect); }
  }

  function chooseGaze(choice: "direct" | "soft") {
    if (!robotRef.current) return;
    applyGaze(choice);
    setPhase("voice");
    later(1800, () => { say(t.askVoice); setStatus(t.statusVoice); });
  }

  function chooseVoice(on: boolean) {
    const robot = robotRef.current;
    if (!robot) return;
    setVoice(on);
    voiceRef.current = on;
    human("voice_preference", { voice: on });
    say(on ? t.voiceOn : t.voiceOff);
    robot.bothArms("wai");
    later(1600, () => robot.bothArms("relaxed"));
    setPhase("confirm");
    setStatus(t.statusConfirm);
    later(2200, () => { if (phaseRef.current === "confirm") say(t.confirmSpeech); });
  }

  // ---------------- answering by voice or text ----------------
  function answerApproach(answer: "continue" | "comfortable" | "too_close" | "too_fast") {
    if (answer === "continue") approachNext();
    else if (answer === "comfortable") comfortable();
    else if (answer === "too_close") tooClose("button");
    else tooFast();
  }

  // After the robot has responded to an answer, it asks the next care question, then moves on.
  function afterCareAnswer() {
    const next = careQuestion + 1;
    if (next >= CARE_QUESTIONS.length) {
      later(1800, () => { if (phaseRef.current === "care") careDoneRef.current(); });
      return;
    }
    setCareQuestion(next);
    later(1800, () => { if (phaseRef.current === "care") say(t.voiceInput.prompts[CARE_QUESTIONS[next]]); });
  }

  // ---------------- review before saving ----------------
  function reviewDistance(choice: keyof typeof DISTANCE_CHOICES) {
    const distance = DISTANCE_CHOICES[choice];
    setComfort(distance);
    robotRef.current?.setDistance(distance);
    human("distance_set", { distance, reason: "review" });
  }

  function reviewSpeed(next: number) {
    setSpeed(next);
    robotRef.current?.setSpeed(next);
    human("speed_set", { speed: next });
  }

  async function saveReviewed() {
    const robot = robotRef.current;
    if (!robot || phaseRef.current !== "confirm") return;
    const distance = comfort ?? robot.state.distanceTarget;
    await savePassport(
      {
        greeting, comfortDistance: distance, speed, gaze, voice, language: lang,
        anxiety, captions: accessible ? "large" : "normal", speechPace: accessible ? "slow" : "normal", noReach
      },
      {
        tooClose: counters.current.tooClose,
        tooFast: counters.current.tooFast,
        leanBack: counters.current.leanBack,
        finalDistance: +distance.toFixed(2),
        finalSpeed: +speed.toFixed(2),
        durationSeconds: +robot.time.toFixed(1)
      },
      inputMode
    );
  }

  // Shared by the button/camera flow and Auto mode: create the passport, keep the edit key, show the QR.
  async function savePassport(passport: PassportInput, summary: SessionSummary, mode: InputMode) {
    setPhase("saving");
    setStatus(t.statusSaving);
    try {
      const result = await createPassportAction(
        passport,
        { protocol: "wai_first_calibration", inputMode: mode, events: log.slice(-250), summary },
        consent
      );
      if (!result.ok) {
        if (result.error === "identity_required") {
          // The session ended (or was signed out elsewhere) during calibration: ask to verify again.
          setIdentity(null);
          setError(idT.errors.identity_required);
        } else {
          setError(result.error === "rate_limited" ? t.saveRateLimited(Math.ceil(result.retryAfterSeconds / 60)) : t.saveFailed);
        }
        setPhase(mode === "auto" ? "review" : "confirm");
        return;
      }
      const { code, accessToken, editToken } = result;
      setSavedOwner(result.owner);
      // The edit token is the owner's key to the card page. Keep it in this browser so the card
      // unlocks here without asking again; the key is also shown once below for other devices.
      try { window.localStorage.setItem(`hri-passport-edit:${accessToken}`, editToken); } catch { /* private mode */ }
      const url = `${window.location.origin}/living-lab/passport/${accessToken}`;
      setPassportCode(code);
      setAccessToken(accessToken);
      setEditToken(editToken);
      setQr(await QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: "#101c2e", light: "#ffffff" } }));
      setPhase("done");
      setStatus(t.statusDone);
      say(t.doneSpeech(code));
      human("passport_created", { code });
    } catch {
      setError(t.saveFailed);
      setPhase(mode === "auto" ? "review" : "confirm");
    }
  }

  // Consent is what lets calibration (and the optional camera) start. Revoking it before Start
  // also turns the camera off: nothing is sensed without consent.
  function changeConsent(on: boolean) {
    setConsent(on);
    if (!on && (cameraState === "on" || cameraState === "loading")) {
      stopCam(); setInputMode("buttons"); human("camera_off");
    }
  }

  // "Again" may hand the screen to the next visitor, so their consent and care answers do not carry
  // over. The verified email does stay: it is shown on the card with "Not you?", because re-verifying
  // on a person's own device would spend an email for nothing. A shared device should sign out here.
  function startOver() {
    setCountdown(null);
    changeConsent(false);
    setAnxiety("low"); setAccessible(false); setNoReach(false); setGreeting("wai");
    setVoiceSafety(false); setHeardCue(null); setAutoValues(null); setAutoSources(null); setInterviewTurns(0);
    autoValuesRef.current = null; autoSourcesRef.current = null;
    talkRef.current = false; setTalk(false);
    setPhase("intro");
    setStatus(t.statusIdle);
    setSpeech(t.introSpeech);
  }

  async function copyEditKey() {
    if (!editToken) return;
    try {
      await navigator.clipboard.writeText(editToken);
      setKeyCopied(true);
      window.setTimeout(() => setKeyCopied(false), 2000);
    } catch {
      setKeyCopied(false);
    }
  }

  // ---------------- camera (optional) ----------------
  function stopCam() {
    camera.current.stop();
    setCameraState("off");
  }

  async function toggleCamera() {
    if (!consent) return;
    if (cameraState === "on" || cameraState === "loading") {
      stopCam(); setInputMode("buttons"); human("camera_off");
      return;
    }
    if ((await startCamera()) === "started") {
      setInputMode("camera");
      human("camera_on");
    }
  }

  // One camera pipeline for both modes: frames go to the Auto calibrator while it runs, otherwise to
  // the optional wai / lean-back helpers of the button flow.
  // "cancelled" means stopCam() ran while the camera was loading: whoever stopped it has already reset the UI.
  async function startCamera(): Promise<"started" | "cancelled" | "failed"> {
    const video = videoRef.current;
    if (!video) return "failed";
    setCameraState("loading");
    try {
      const wai = new WaiDetector();
      const lean = new LeanBackDetector();
      const onFrame = (frame: PoseFrame) => {
        const { tMs, landmarks, fps, people } = frame;
        setCameraInfo(`${fps.toFixed(0)} fps · ${landmarks ? t.personSeen : t.noPerson}`);
        const robot = robotRef.current;
        const nose = landmarks?.[POSE.nose];
        // The robot looks toward the visitor (image is not mirrored: image-right is the visitor's left).
        const lookAtVisitor = () => { if (robot && nose) robot.lookAt(-(nose.x - 0.5) * 2, (nose.y - 0.45) * 1.4); };

        const auto = autoRef.current;
        if (auto) {
          // While waiting for the wai the robot keeps its eyes lowered; afterwards it follows the person.
          const looking = auto.stage !== "baseline" && auto.stage !== "greet" && auto.stage !== "returning_wai";
          if (looking) lookAtVisitor();
          // Conversation mode: eye contact is read over the whole chat (lean-backs are the calibrator's here).
          if (talkRef.current) talkAnalyzer.current.frame(tMs, landmarks, looking, false);
          setAutoPerson(!!landmarks && people === 1);
          for (const event of auto.update({ tMs, landmarks, people, luma: frame.luma })) applyAutoEvent(event);
          return;
        }

        // Conversation mode after the calibrator: keep reading eye contact, and step back on a lean-back.
        if (talkRef.current && phaseRef.current === "auto") {
          lookAtVisitor();
          if (talkAnalyzer.current.frame(tMs, landmarks, true, true)) talkStepBack();
          return;
        }
        if (!landmarks) return;
        if (phaseRef.current === "approach" || phaseRef.current === "done") lookAtVisitor();
        if (phaseRef.current === "greet") {
          const s = wai.update(tMs, classifyWai(landmarks));
          if (s.state === "rising") setStatus(`${t.waiDetecting} ${Math.round(s.progress * 100)}%`);
          if (s.state === "fired") receiveWai("camera");
        }
        if (phaseRef.current === "approach" && lean.update(tMs, shoulderWidth(landmarks))) tooClose("camera");
      };
      const live = await camera.current.start(async (isCancelled) => {
        const { startPoseCamera } = await import("@/lib/hri/camera");
        return startPoseCamera(video, onFrame, isCancelled);
      });
      if (!live) return "cancelled";
      setCameraState("on");
      return "started";
    } catch (e) {
      setCameraState("error");
      setCameraInfo(e instanceof Error ? e.message : String(e));
      return "failed";
    }
  }

  // ---------------- Auto mode: one tap, then the camera does the rest ----------------
  async function startAuto(agreed = false) {
    const robot = robotRef.current;
    if (!robot || !(consent || agreed) || !identityOk) return;
    clearTimers();
    counters.current = { tooClose: 0, tooFast: 0, leanBack: 0 };
    setLog([]); setStep(0); setSpeed(1); setComfort(null);
    setPassportCode(null); setAccessToken(null); setEditToken(null); setKeyCopied(false); setQr(null); setError(null);
    setAutoNotice(null); setAutoResult(null); setCountdown(null); setAutoLeans(0); setAutoWai(null); setAutoPaused(null);
    setAutoStage("baseline"); setAutoPerson(false);
    // A new visitor: nothing of the last one's voice choices carries over.
    setVoiceSafety(false); setHeardCue(null); setAutoValues(null); setAutoSources(null); setInterviewTurns(0);
    autoValuesRef.current = null; autoSourcesRef.current = null;
    // Safe defaults for what the camera does not measure. Anxiety is never guessed.
    setGaze("direct"); setAnxiety("low"); setAccessible(false); setNoReach(true); setGreeting("wai");
    // Auto mode talks (and shows the text), so the person can follow without reading the screen.
    voiceRef.current = true; setVoice(true);
    robot.setSpeed(1); robot.setDistance(STEPS[0]); robot.bothArms("relaxed"); robot.expression("neutral"); robot.lookAt(0, 0.35); robot.setGlow(0.45, "teal");
    setInputMode("auto");
    autoRef.current = new AutoCalibrator(lang);
    setPhase("auto");
    human("session_start", { inputMode: "auto" });
    if (cameraState !== "on" && (await startCamera()) === "failed") {
      autoRef.current = null;
      setPhase("intro");
      setAutoNotice(t.cameraError);
    }
  }

  function stopAuto() {
    autoRef.current = null;
    setVoiceSafety(false); setHeardCue(null);
    stopCam();
    clearTimers();
    window.speechSynthesis?.cancel();
    const robot = robotRef.current;
    if (robot) { robot.setSpeed(1); robot.setDistance(STEPS[0]); robot.bothArms("relaxed"); robot.expression("neutral"); robot.lookAt(0, 0.35); }
    human("auto_stopped");
    talkRef.current = false; setTalk(false);
    setInputMode("buttons");
    setPhase("intro");
    setStatus(t.statusIdle);
    setSpeech(t.introSpeech);
  }

  // ---------------- Conversation mode ----------------
  async function startTalk(agreed = false) {
    if (!robotRef.current || !(consent || agreed) || !identityOk) return;
    setAutoNotice(null);
    // One browser prompt for both, while the explanation is on screen. Both are required for this experiment.
    // The stream is closed at once: the pose camera and speech recognition open their own when needed.
    setAskingPermission(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch {
      setAskingPermission(false);
      setAutoNotice(t.talk.permDenied);
      return;
    }
    setAskingPermission(false);
    talkState.current = { asked: 0, answered: 0, awaiting: false, sensingDone: false, closing: false };
    talkResult.current = null;
    talkAnalyzer.current = new TalkAnalyzer();
    talkAi.current = null; talkHistory.current = []; talkUpdates.current = {};
    talkRef.current = true; setTalk(true);
    await startAuto(agreed);
    if (!autoRef.current) {
      // The camera could not start (denied or missing): this experiment needs it.
      talkRef.current = false; setTalk(false);
      setAutoNotice(t.talk.camDenied);
      return;
    }
    if (findSpeechRecognition(window)) setVoiceSafety(true);
  }

  // The camera's view of the person so far, as neutral counts (the same facts the interview may see).
  function talkCamera() {
    const done = talkResult.current?.evidence;
    return {
      waiDetected: done?.waiDetected ?? false,
      leanBacks: Math.min(50, counters.current.leanBack),
      tooFast: Math.min(50, counters.current.tooFast),
      voiceCorrections: 0,
      leanIn: done?.leanIn ?? false,
      gazeMeasured: done?.gazeMeasured ?? false,
      avertShare: done?.avertShare ?? null
    };
  }

  // One turn of Gemini small talk. Returns false when the AI cannot answer (the script takes over).
  async function aiTurn(text: string | null): Promise<boolean> {
    if (talkAi.current === false) return false;
    try {
      const response = await fetch("/api/hri/interview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lang, mode: "talk", opening: text === null, text: text ?? "",
          history: talkHistory.current.slice(-10), pending: [],
          state: toState(autoValuesRef.current ?? { ...TALK_START_VALUES, language: lang }), camera: talkCamera()
        })
      });
      if (!response.ok) { talkAi.current = false; return false; }
      const reply = (await response.json()) as InterviewReply;
      if (!talkRef.current || talkState.current.closing) return true;
      talkAi.current = true;
      if (text) talkHistory.current.push({ role: "user", text: text.slice(0, 300) });
      talkHistory.current.push({ role: "robot", text: reply.say.slice(0, 300) });
      talkHistory.current = talkHistory.current.slice(-10);
      if (Object.keys(reply.updates).length) {
        talkUpdates.current = { ...talkUpdates.current, ...reply.updates };
        robotRef.current?.nod(1);
        human("talk_update", { fields: Object.keys(reply.updates).join(",") });
      }
      return speakTurn(reply.say);
    } catch {
      talkAi.current = false;
      return false;
    }
  }

  // The robot says a line that ends in a question and waits for a reply; silence moves the chat on.
  function speakTurn(line: string): true {
    const c = talkState.current;
    const asked = c.asked + 1;
    c.asked = asked; c.awaiting = true;
    robotRef.current?.expression("happy");
    say(line);
    human("talk_question", { index: asked, ai: talkAi.current === true });
    later(TALK_ANSWER_MS, () => {
      const now = talkState.current;
      if (!talkRef.current || now.closing || !now.awaiting || now.asked !== asked) return;
      now.awaiting = false;
      if (talkAi.current) void aiTurn(lang === "th" ? "(ไม่ได้ตอบ)" : "(no answer)").then((ok) => { if (!ok) { say(t.talk.noAnswer); later(2600, askNext); } });
      else { say(t.talk.noAnswer); later(2600, askNext); }
    });
    return true;
  }

  // Ask the next question: Gemini's, or the script's when the AI is unavailable.
  async function askNext(reply?: string) {
    const c = talkState.current;
    if (!talkRef.current || c.closing) return;
    if ((c.sensingDone && c.asked >= MIN_TALK_QUESTIONS) || c.asked >= MAX_TALK_TURNS) { closeTalk(); return; }
    robotRef.current?.expression("calm");
    if (await aiTurn(reply ?? (c.asked === 0 ? null : lang === "th" ? "(คุยต่อ)" : "(continue)"))) return;
    const scripted = t.talk.questions.slice(0, MAX_TALK_TURNS);
    if (c.asked >= scripted.length) { if (c.sensingDone) closeTalk(); return; }
    speakTurn(scripted[c.asked]);
  }

  // A reply was heard. Its timing is measured; the words go to the AI (if on) for the next turn and are
  // never stored by this site.
  function heardInTalk(transcript: string, waitedMs: number) {
    const c = talkState.current;
    if (!talkRef.current || !c.awaiting || c.closing) return;
    c.awaiting = false; c.answered += 1;
    talkAnalyzer.current.answer(transcript, waitedMs);
    robotRef.current?.nod(1);
    human("talk_answer", { index: c.asked });
    if (talkAi.current) {
      if ((c.sensingDone && c.asked >= MIN_TALK_QUESTIONS) || c.asked >= MAX_TALK_TURNS) { say(t.talk.acks[0]); later(1800, closeTalk); return; }
      void askNext(transcript);
      return;
    }
    say(t.talk.acks[(c.answered - 1) % t.talk.acks.length]);
    later(2400, () => { void askNext(); });
  }

  // A lean-back during the chat (after the calibrator): one step farther, kept for the passport.
  function talkStepBack() {
    const robot = robotRef.current;
    const values = autoValuesRef.current;
    if (!robot || !values || talkState.current.closing) return;
    const farther = applyInterviewUpdates(values, autoSourcesRef.current ?? initialReview(talkResult.current!.result, talkResult.current!.evidence).sources, { distance: "farther" }, { allowClosest: false });
    autoValuesRef.current = farther.values;
    if (autoSourcesRef.current) autoSourcesRef.current = { ...farther.sources, distance: "camera" };
    counters.current.leanBack++; counters.current.tooClose++;
    robot.setDistance(farther.values.comfortDistance); robot.expression("sorry"); robot.lean("back");
    later(1500, () => robot.lean("upright"));
    human("too_close", { source: "talk", distance: farther.values.comfortDistance });
  }

  function closeTalk() {
    const c = talkState.current;
    if (c.closing) return;
    c.closing = true; c.awaiting = false;
    setVoiceSafety(false);
    stopCam();
    const robot = robotRef.current;
    if (robot) {
      robot.expression("happy"); robot.bothArms("wai");
      later(500, () => robot.bow(0.3, 1.5));
      later(2400, () => robot.bothArms("relaxed"));
    }
    say(t.talk.closing);
    later(TALK_CLOSING_MS, () => { void finishTalk(); });
  }

  // Save straight away (the person agreed before starting) and show the issued passport.
  async function finishTalk() {
    const measured = talkResult.current;
    if (!measured || !talkRef.current) return;
    talkRef.current = false;
    let v = autoValuesRef.current ?? initialReview(measured.result, measured.evidence).values;
    // Eye contact over the whole conversation, when there was enough of it, refines the 5-second check.
    const talkGaze = talkAnalyzer.current.gaze();
    if (talkGaze) v = { ...v, gaze: talkGaze };
    // What the person asked for in their own words wins over what the camera inferred.
    v = applyInterviewUpdates(v, autoSourcesRef.current ?? initialReview(measured.result, measured.evidence).sources, talkUpdates.current, { allowClosest: measured.evidence.leanIn }).values;
    const analysis = talkAnalyzer.current.summary();
    await savePassport(
      {
        greeting: v.greeting, comfortDistance: v.comfortDistance, speed: v.speed, gaze: v.gaze, voice: v.voice,
        language: v.language, anxiety: "low", captions: v.captions, speechPace: v.speechPace, noReach: v.noReach
      },
      {
        ...measured.evidence,
        tooClose: counters.current.tooClose,
        tooFast: counters.current.tooFast,
        leanBack: counters.current.leanBack,
        finalDistance: v.comfortDistance,
        finalSpeed: v.speed,
        // Counts only. No words from the conversation are saved.
        conversation: true,
        talkAi: talkAi.current === true,
        talkQuestions: talkState.current.asked,
        talkAnswers: talkState.current.answered,
        talkMeanResponseMs: analysis.meanResponseMs,
        talkGazeFrames: analysis.gazeFrames,
        talkAvertShare: analysis.avertShare,
        talkLeanBacks: analysis.leanBacks,
        talkPreferencesNamed: Object.keys(talkUpdates.current).length
      },
      "auto"
    );
  }

  function applyAutoEvent(e: AutoEvent) {
    const robot = robotRef.current;
    if (!robot) return;
    switch (e.type) {
      case "stage":
        setAutoStage(e.stage);
        if (e.stage !== "complete" && e.stage !== "aborted") setStatus(talkRef.current ? t.talk.status : t.autoStages[e.stage]);
        if (e.stage === "baseline") say(talkRef.current ? t.talk.hello : t.autoBaselineSpeech);
        if (e.stage === "greet") { robot.lookAt(0, 0.35); if (!talkRef.current) say(t.waitSpeech); }
        break;
      case "paused":
        setAutoPaused(e.reason);
        setStatus(t.autoPause[e.reason]);
        say(t.autoPause[e.reason]);
        human("auto_paused", { reason: e.reason });
        break;
      case "resumed":
        setAutoPaused(null);
        say(t.autoResumed);
        human("auto_resumed");
        break;
      case "wai_progress":
        if (!talkRef.current) setStatus(`${t.waiDetecting} ${Math.round(e.progress * 100)}%`);
        break;
      case "wai_received":
      case "wai_timeout": {
        const seen = e.type === "wai_received";
        setAutoWai(seen);
        human(seen ? "wai" : "wai_timeout", { source: "auto" });
        robot.lookAt(0, 0.2); robot.bothArms("wai"); robot.expression("calm");
        say(talkRef.current ? t.talk.niceToMeet : seen ? t.waiSpeech : t.autoNoWai);
        later(500, () => robot.bow(0.36, 1.7));
        // The first everyday question follows the greeting; the measuring carries on underneath.
        if (talkRef.current) later(3200, () => { void askNext(); });
        later(2600, () => { robot.bothArms("relaxed"); robot.expression("happy"); robot.setGlow(0.7, "teal"); });
        break;
      }
      case "step":
        robot.setSpeed(e.speed);
        robot.setDistance(e.distance);
        setSpeed(e.speed);
        setStep(Math.min(e.index, STEPS.length - 1));
        if (e.index === 1 && !talkRef.current) say(t.autoStep);
        human("auto_step", { index: e.index, distance: e.distance });
        break;
      case "too_fast":
        counters.current.tooFast++;
        // A spoken correction is not a camera lean-back: keep the two counted apart.
        if (e.source !== "voice") { counters.current.leanBack++; setAutoLeans((n) => n + 1); }
        robot.setSpeed(e.speed); robot.setDistance(e.retreatTo); robot.expression("sorry"); robot.nod(1);
        setSpeed(e.speed);
        say(talkRef.current ? t.talk.sorry : t.autoTooFast);
        human("too_fast", { source: e.source ?? "auto", speed: e.speed });
        break;
      case "too_close":
        counters.current.tooClose++;
        if (e.source !== "voice") { counters.current.leanBack++; setAutoLeans((n) => n + 1); }
        robot.setDistance(e.backTo); robot.moveArm("R", "handOnChest"); robot.expression("sorry"); robot.lean("back");
        say(talkRef.current ? t.talk.sorry : t.sorryLean);
        later(1700, () => { robot.lean("upright"); robot.moveArm("R", "relaxed"); });
        human("too_close", { source: e.source ?? "auto", distance: e.backTo });
        break;
      case "lean_in":
        robot.expression("happy");
        if (!talkRef.current) say(t.autoLeanIn);
        human("lean_in", { source: "auto" });
        break;
      case "distance_set":
        setComfort(e.distance); setSpeed(e.speed);
        robot.setSpeed(e.speed); robot.setDistance(e.distance); robot.nod(1); robot.setGlow(0.9, "teal");
        human("distance_set", { source: e.source ?? "auto", distance: e.distance, reason: e.reason });
        break;
      case "gaze_check":
        robot.lookAt(0, 0);
        if (!talkRef.current) say(t.autoGazeCheck);
        break;
      case "complete":
        autoRef.current = null;
        // Sensing ends as soon as it is no longer needed; in a conversation, when the conversation ends.
        if (!talkRef.current) stopCam();
        setGaze(e.result.gaze);
        setAutoResult({ result: e.result, evidence: e.evidence });
        {
          const review = initialReview(e.result, e.evidence);
          autoValuesRef.current = review.values; autoSourcesRef.current = review.sources;
          setAutoValues(review.values); setAutoSources(review.sources); setInterviewTurns(0);
        }
        if (talkRef.current) {
          // Measuring is done; the conversation finishes naturally, then the passport is saved.
          talkResult.current = { result: e.result, evidence: e.evidence };
          const c = talkState.current;
          c.sensingDone = true;
          human("auto_complete", { ...e.evidence });
          if (!c.awaiting && (c.asked >= MIN_TALK_QUESTIONS || c.asked >= t.talk.questions.length)) closeTalk();
          break;
        }
        setPhase("review");
        setStatus(t.reviewTitle);
        // With the interview on offer, saving waits until the person chooses to talk or to skip.
        setCountdown(INTERVIEW_OFFERED ? null : REVIEW_SECONDS);
        robot.expression("happy"); robot.bothArms("wai");
        later(1600, () => robot.bothArms("relaxed"));
        say(t.reviewTitle);
        human("auto_complete", { ...e.evidence });
        break;
      case "aborted":
        autoRef.current = null;
        stopCam();
        robot.setSpeed(1); robot.setDistance(STEPS[0]); robot.expression("neutral"); robot.lookAt(0, 0.35);
        setAutoNotice(t.autoAborted[e.reason]);
        talkRef.current = false; setTalk(false); setVoiceSafety(false);
        setInputMode("buttons");
        setPhase("intro");
        setStatus(t.statusIdle);
        say(t.autoAborted[e.reason]);
        human("auto_aborted", { reason: e.reason });
        break;
    }
  }

  async function saveAuto() {
    if (!autoResult || phaseRef.current !== "review") return;
    setCountdown(null);
    const { result, evidence } = autoResult;
    // The values after the interview (if any). A ref, so a save triggered in the same turn as the
    // last spoken answer already sees that answer.
    const v = autoValuesRef.current ?? initialReview(result, evidence).values;
    const sources = autoSourcesRef.current;
    await savePassport(
      {
        greeting: v.greeting, comfortDistance: v.comfortDistance, speed: v.speed, gaze: v.gaze, voice: v.voice,
        language: v.language, anxiety: "low", captions: v.captions, speechPace: v.speechPace, noReach: v.noReach
      },
      {
        ...evidence,
        tooClose: counters.current.tooClose,
        tooFast: counters.current.tooFast,
        leanBack: counters.current.leanBack,
        finalDistance: v.comfortDistance,
        finalSpeed: v.speed,
        // Counts only. No words from the conversation are saved.
        interviewTurns: interviewTurnsRef.current,
        fieldsFromVoice: sources ? Object.values(sources).filter((s) => s === "voice").length : 0
      },
      "auto"
    );
  }

  // The interview calls this with values that passed the server's check. Apply them to the review, show
  // them on the robot, and remember where each came from.
  function applyInterview(update: InterviewUpdates): FieldKey[] {
    const current = autoValuesRef.current;
    const sources = autoSourcesRef.current;
    if (!current || !sources) return [];
    const out = applyInterviewUpdates(current, sources, update, { allowClosest: autoResult?.evidence.leanIn ?? false });
    autoValuesRef.current = out.values; autoSourcesRef.current = out.sources;
    setAutoValues(out.values); setAutoSources(out.sources);
    setInterviewTurns((n) => n + 1);
    const robot = robotRef.current;
    if (robot && out.changed.length) {
      robot.nod(1);
      if (out.changed.includes("distance")) robot.setDistance(out.values.comfortDistance);
      if (out.changed.includes("speed")) robot.setSpeed(out.values.speed);
      if (out.changed.includes("voice")) { voiceRef.current = out.values.voice; setVoice(out.values.voice); }
    }
    human("interview_update", { fields: out.changed.join(",") });
    return out.changed;
  }

  function interviewActive(active: boolean, failed?: boolean) {
    // While talking, saving waits. If the AI cannot be reached, the normal countdown takes over.
    if (active) setCountdown(null);
    else if (failed) setCountdown(REVIEW_SECONDS);
  }

  // The review screen saves by itself after a visible countdown, so Auto mode needs no second tap.
  useEffect(() => {
    if (phase !== "review" || countdown === null) return;
    if (countdown <= 0) { void saveAuto(); return; }
    const id = window.setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown]);

  // Spoken safety words while the robot approaches ("stop", "too close", "too fast"). Matched on this device
  // against the closed vocabulary of voice-answers.ts and fed into the same state machine as the camera:
  // never sent to an AI. Opt-in, because browsers may send audio to their own speech service.
  useEffect(() => {
    if (phase !== "auto" || !voiceSafety) return;
    const Recognition = findSpeechRecognition(window);
    if (!Recognition) return;
    let stopped = false;
    let cancel: (() => void) | null = null;
    let timer = 0;
    const loop = () => {
      if (stopped) return;
      // Never listen while the robot talks: it would hear itself.
      if (window.speechSynthesis?.speaking || Date.now() - spokeAt.current < 900) {
        timer = window.setTimeout(loop, 300);
        return;
      }
      const startedAt = Date.now();
      cancel = listenOnce(Recognition, lang, ({ alternatives, problem }) => {
        cancel = null;
        if (stopped) return;
        if (problem === "denied" || problem === "unavailable") {
          setVoiceSafety(false);
          setAutoNotice(t.interview.micDenied2);
          return;
        }
        // Discard anything heard while the robot started to speak in the meantime.
        if (!problem && spokeAt.current < startedAt) {
          const calibrator = autoRef.current;
          const greeted = calibrator?.stage === "greet" ? matchFirstVoiceAnswer("greet", alternatives) : null;
          const approach = matchFirstVoiceAnswer("approach", alternatives);
          const match = greeted ?? approach;
          if (calibrator && match) {
            const cue: VoiceCue = greeted ? "greeted" : (approach!.answer as VoiceCue);
            setHeardCue(match.transcript);
            human("voice_cue", { cue });
            calibrator.applyVoice(cue).forEach(applyAutoEvent);
          }
          const reply = alternatives.find((a) => a.trim());
          if (talkRef.current && reply) heardInTalk(reply, Date.now() - startedAt);
        }
        timer = window.setTimeout(loop, 150);
      });
    };
    loop();
    return () => { stopped = true; cancel?.(); window.clearTimeout(timer); };
    // The handlers read refs and setters only; restarting on every render would drop the microphone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, voiceSafety, lang]);

  // The five headline preferences printed on the passport card (confirm preview and the issued card).
  const cardPrefs = () => [
    { key: "distance" as const, label: t.factDistance, value: describeDistance(comfort ?? robotRef.current?.state.distanceTarget ?? 0)[lang] },
    { key: "speed" as const, label: t.factSpeed, value: speed < 1 ? t.slow : t.normal },
    { key: "gaze" as const, label: t.factGaze, value: gaze === "soft" ? t.soft : t.direct },
    { key: "language" as const, label: t.factLanguage, value: lang === "th" ? t.langThai : t.langEnglish },
    { key: "speech" as const, label: t.factSpeech, value: accessible ? t.slow : t.normal }
  ];

  const sourceLabel = (source: Source) =>
    source === "camera" ? t.interview.sourceCamera : source === "voice" ? t.interview.sourceVoice : t.interview.sourceDefault;
  const Src = ({ of }: { of: Source }) => <em className={`ll-src ll-src-${of}`}>{sourceLabel(of)}</em>;

  // Show a passport to the camera at any time outside the conversation: the robot reads it by itself.
  // (Called before the early return below, as every hook must be.)
  useQrWatch(selfRef, call && media === "on" && !talk && (phase === "intro" || phase === "done"), (token) => void readScanned(token));

  if (call && !portal) return <main className="ll ll-call-pending" aria-busy="true" />;
  const room = (
    <main className={call ? "ll ll-call" : "ll"} data-testid={call ? "call" : undefined}>
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      {call && (
        <div className="ll-call-top">
          <span className="ll-call-name">Atlas</span>
          <span className="ll-call-sim">{t.talk.simulated}</span>
        </div>
      )}

      <div className="lab-section" id="calibrate-wrap">
      {!call && <SectionHead id="calibrate" eyebrow={labCopy[lang].calibrate.eyebrow} title={labCopy[lang].calibrate.title} lead={labCopy[lang].calibrate.lead} />}
      {!call && <CreationStages label={t.ready.stagesLabel} stages={t.ready.stages} current={stageOf(phase)} />}
      <section className={phase === "intro" ? "ll-grid is-intro" : "ll-grid"}>
        <div className="ll-stage-card">
          <div className="ll-bubble" aria-live="polite">{speech}</div>
          <div className="ll-stage">
            <RobotStage framing="fullBody" onReady={onReady} onEvent={onRobotEvent} className="ll-canvas" ariaLabel={t.robotLabel} />
          </div>
          <div className="ll-chip" role="status">{status}</div>
          <div className={`ll-cam ${cameraState === "on" ? "is-on" : ""}`}>
            <video ref={videoRef} playsInline muted aria-label={t.cameraPreview} />
            {cameraState !== "off" && !talk && !call && <span>{cameraState === "loading" ? t.cameraLoading : cameraInfo}</span>}
          </div>
        </div>

        <div className={`ll-side${call ? ` is-${phase === "intro" ? (sheet ? "sheet" : "hidden") : phase === "auto" && talk ? "pill" : "sheet"}` : ""}`}>
        <div className="ll-panel" ref={panelRef}>
          {!talk && <CalibrationProgress lang={lang} phase={phase} auto={inputMode === "auto"} />}
          {phase === "intro" && !manual && (
            <div className="ll-step ll-ready ll-talk-intro" data-testid="talk-intro">
              <h2>{t.talk.introTitle}</h2>
              <ul className="ll-talk-points">{t.talk.points.map((point) => <li key={point}>{point}</li>)}</ul>
              {call ? (
                <p className="ll-consent-text">{identityRequired || identity ? t.consentLabel : t.consentLabelUnlinked}</p>
              ) : (
                <label className="ll-consent">
                  <input type="checkbox" checked={consent} onChange={(e) => changeConsent(e.target.checked)} />
                  <span>{identityRequired || identity ? t.consentLabel : t.consentLabelUnlinked}</span>
                </label>
              )}
              {!consent && !call && <p className="ll-consent-hint">{t.consentHint}</p>}
              {!identityOk ? <p className="ll-consent-hint">{idT.required}</p> : !identity && <p className="ll-note">{t.ready.emailHint}</p>}
              {autoNotice && <p className="ll-error" role="alert">{autoNotice}</p>}
              {askingPermission && <p className="ll-note" role="status" data-testid="talk-permission">{t.talk.asking}</p>}
              {call ? (
                <button className="ll-btn primary big ll-talk-start" onClick={() => { changeConsent(true); void startTalk(true); }} disabled={!ready || !identityOk || cameraState === "loading" || askingPermission} data-testid="talk-start">
                  <Mic size={18} aria-hidden="true" /> {ready ? t.talk.agreeStart : t.loadingRobot}
                </button>
              ) : (
                <button className="ll-btn primary big ll-talk-start" onClick={() => void startTalk()} disabled={!ready || !consent || !identityOk || cameraState === "loading" || askingPermission} data-testid="talk-start">
                  <Mic size={18} aria-hidden="true" /> {ready ? t.talk.start : t.loadingRobot}
                </button>
              )}
              {call
                ? <button type="button" className="ll-linkbtn" onClick={() => setSheet(false)}>{t.talk.notNow}</button>
                : <button type="button" className="ll-linkbtn" onClick={() => { setManual(true); setAutoNotice(null); }} data-testid="talk-fallback">{t.talk.fallback}</button>}
            </div>
          )}

          {phase === "intro" && manual && (
            <div className="ll-step ll-ready">
              <button type="button" className="ll-linkbtn" onClick={() => { setManual(false); setAutoNotice(null); }}>← {t.talk.backToTalk}</button>
              <h2>{t.introTitle}</h2>
              <ol className="ll-stages">
                <li>
                  <h3><span className="ll-stage-no" aria-hidden="true">1</span> {t.ready.whatTitle}</h3>
                  <details className="ll-what">
                    <summary>{t.ready.whatSummary}</summary>
                    <ol className="ll-list">{t.introSteps.map((s) => <li key={s}>{s}</li>)}</ol>
                  </details>
                  <p className="ll-note">{t.privacy}</p>
                </li>
                <li>
                  <h3><span className="ll-stage-no" aria-hidden="true">2</span> {t.ready.agreeTitle}</h3>
                  <label className="ll-consent">
                    <input type="checkbox" checked={consent} onChange={(e) => changeConsent(e.target.checked)} />
                    <span>{identityRequired || identity ? t.consentLabel : t.consentLabelUnlinked}</span>
                  </label>
                  {!consent && <p className="ll-consent-hint">{t.consentHint}</p>}
                  {!identityOk ? <p className="ll-consent-hint">{idT.required}</p> : !identity && <p className="ll-note">{t.ready.emailHint}</p>}
                </li>
                <li>
                  <h3><span className="ll-stage-no" aria-hidden="true">3</span> {t.ready.chooseTitle}</h3>
                  <p className="ll-note">{consent ? t.ready.chooseLead : t.ready.locked}</p>
                  {autoNotice && <p className="ll-error" role="alert">{autoNotice}</p>}
                  <div className="ll-methods">
                    <section className="ll-method" aria-labelledby="ll-m-buttons">
                      <h4 id="ll-m-buttons">{t.ready.methods.buttons.title}</h4>
                      <p>{t.ready.methods.buttons.body}</p>
                      <p className="ll-needs"><span>{t.ready.needs}:</span> {t.ready.methods.buttons.needs}</p>
                      <div className="ll-row">
                        <button className="ll-btn primary" onClick={() => begin()} disabled={!ready || !consent || !identityOk}><Play size={18} aria-hidden="true" /> {ready ? t.start : t.loadingRobot}</button>
                        <button className="ll-btn" onClick={toggleCamera} disabled={!consent || cameraState === "loading"}>
                          {cameraState === "on" ? <CameraOff size={18} aria-hidden="true" /> : <Camera size={18} aria-hidden="true" />} {cameraState === "on" ? t.cameraOff : t.cameraOn}
                        </button>
                      </div>
                      {cameraState === "error" && <p className="ll-error">{t.cameraError}: {cameraInfo}</p>}
                    </section>
                    <section className="ll-method" aria-labelledby="ll-m-voice">
                      <h4 id="ll-m-voice">{t.ready.methods.voice.title}</h4>
                      <p>{t.ready.methods.voice.body}</p>
                      <p className="ll-needs"><span>{t.ready.needs}:</span> {t.ready.methods.voice.needs}</p>
                      <button className="ll-btn primary" onClick={() => begin(true)} disabled={!ready || !consent || !identityOk}>
                        <Mic size={18} aria-hidden="true" /> {t.voiceInput.start}
                      </button>
                    </section>
                    <section className="ll-method" aria-labelledby="ll-m-auto">
                      <h4 id="ll-m-auto">{t.ready.methods.auto.title}</h4>
                      <p>{t.ready.methods.auto.body}</p>
                      <p className="ll-needs"><span>{t.ready.needs}:</span> {t.ready.methods.auto.needs}</p>
                      <button className="ll-btn auto" onClick={() => void startAuto()} disabled={!ready || !consent || !identityOk || cameraState === "loading"}>
                        <ScanFace size={18} aria-hidden="true" /> {t.autoStart}
                      </button>
                      <p className="ll-note">{t.ready.aiNote}</p>
                    </section>
                  </div>
                </li>
              </ol>
            </div>
          )}

          {phase === "greet" && (
            <div className="ll-step">
              <h2>{t.greetTitle}</h2>
              <p>{t.greetHelp}</p>
              {inputMode === "voice" && <VoiceAnswerBox key="greet" lang={lang} question="greet" onAnswer={() => receiveWai("button")} />}
              <button className="ll-btn primary big" onClick={() => receiveWai("button")}>🙏 {t.waiButton}</button>
            </div>
          )}

          {phase === "approach" && (
            <div className="ll-step">
              <h2>{t.approachTitle}</h2>
              <p>{t.approachHelp}{inputMode === "camera" ? ` ${t.leanHint}` : ""}</p>
              <div className="ll-meter" aria-label={t.distanceLabel}>
                {STEPS.slice(1).map((_, i) => <span key={i} className={i < step ? "on" : ""} />)}
              </div>
              {inputMode === "voice" && <VoiceAnswerBox key="approach" lang={lang} question="approach" onAnswer={answerApproach} />}
              <div className="ll-choices">
                <button className="ll-btn primary big" onClick={approachNext}><Play size={18} aria-hidden="true" /> {t.continue}</button>
                <button className="ll-btn big good" onClick={comfortable}><HeartHandshake size={18} aria-hidden="true" /> {t.comfortable}</button>
                <button className="ll-btn big warn" onClick={() => tooClose("button")}><Hand size={18} aria-hidden="true" /> {t.tooClose}</button>
                <button className="ll-btn big" onClick={tooFast}><Snail size={18} aria-hidden="true" /> {t.tooFast} {speed < 1 ? `(×${speed.toFixed(2)})` : ""}</button>
              </div>
            </div>
          )}

          {phase === "care" && (
            <div className="ll-step">
              <h2>{t.careTitle}</h2>
              {inputMode === "voice" && CARE_QUESTIONS[careQuestion] === "anxiety" && (
                <VoiceAnswerBox key="anxiety" lang={lang} question="anxiety" onAnswer={(answer) => { chooseAnxiety(answer); afterCareAnswer(); }} />
              )}
              {inputMode === "voice" && CARE_QUESTIONS[careQuestion] === "communication" && (
                <VoiceAnswerBox key="communication" lang={lang} question="communication" onAnswer={(answer) => { chooseAccessible(answer === "accessible"); afterCareAnswer(); }} />
              )}
              {inputMode === "voice" && CARE_QUESTIONS[careQuestion] === "reach" && (
                <VoiceAnswerBox key="reach" lang={lang} question="reach" onAnswer={(answer) => { chooseReach(answer === "avoid"); afterCareAnswer(); }} />
              )}
              <p className="ll-q">{t.qAnxiety}</p>
              <div className="ll-seg" role="group" aria-label={t.qAnxiety}>
                {(["low", "medium", "high"] as const).map((lvl) => (
                  <button key={lvl} className={`ll-btn ${anxiety === lvl ? "sel" : ""}`} aria-pressed={anxiety === lvl} onClick={() => chooseAnxiety(lvl)}>{t.anxietyLabels[lvl]}</button>
                ))}
              </div>
              <p className="ll-q">{t.qComm}</p>
              <div className="ll-seg" role="group" aria-label={t.qComm}>
                <button className={`ll-btn ${!accessible ? "sel" : ""}`} aria-pressed={!accessible} onClick={() => chooseAccessible(false)}>{t.commNormal}</button>
                <button className={`ll-btn ${accessible ? "sel" : ""}`} aria-pressed={accessible} onClick={() => chooseAccessible(true)}>{t.commAccessible}</button>
              </div>
              <p className="ll-q">{t.qReach}</p>
              <div className="ll-seg" role="group" aria-label={t.qReach}>
                <button className={`ll-btn ${!noReach ? "sel" : ""}`} aria-pressed={!noReach} onClick={() => chooseReach(false)}>{t.reachOk}</button>
                <button className={`ll-btn ${noReach ? "sel" : ""}`} aria-pressed={noReach} onClick={() => chooseReach(true)}>{t.reachAvoid}</button>
              </div>
              <button className="ll-btn primary big" style={{ width: "100%", marginTop: 12 }} onClick={careDone}><Play size={18} aria-hidden="true" /> {t.next}</button>
            </div>
          )}

          {phase === "gaze" && (
            <div className="ll-step">
              <h2>{t.gazeTitle}</h2>
              {inputMode === "voice" && <VoiceAnswerBox key="gaze" lang={lang} question="gaze" onAnswer={chooseGaze} />}
              <div className="ll-choices">
                <button className="ll-btn big" onClick={() => chooseGaze("direct")}>{t.gazeDirectBtn}</button>
                <button className="ll-btn big" onClick={() => chooseGaze("soft")}>{t.gazeSoftBtn}</button>
              </div>
            </div>
          )}

          {phase === "auto" && talk && (
            <div className="ll-step ll-talking" data-testid="talking">
              <h2>{t.talk.title}</h2>
              <p>{t.talk.note}</p>
              <p className="ll-live"><span className="ll-live-dot" aria-hidden="true" /> {t.talk.listening}</p>
              <button className="ll-btn" onClick={stopAuto}><Pause size={18} aria-hidden="true" /> {t.talk.stop}</button>
            </div>
          )}

          {phase === "saving" && talk && (
            <div className="ll-step"><p className="ll-countdown" role="status">{t.talk.saving}</p></div>
          )}

          {phase === "auto" && !talk && (
            <div className="ll-step">
              <h2>{t.autoTitle}</h2>
              <p>{t.autoSimNote}</p>
              <p className="ll-auto-stage" aria-live="polite">{autoPaused ? t.autoPause[autoPaused] : t.autoStages[autoStage]}</p>
              <div className="ll-meter" aria-label={t.distanceLabel}>
                {STEPS.slice(1).map((_, i) => <span key={i} className={i < step ? "on" : ""} />)}
              </div>
              <div className="ll-auto-signals">
                <span className={autoPerson ? "ok" : "warn"}>{autoPerson ? t.autoSignalPerson : t.autoSignalNoPerson}</span>
                <span>{t.autoSignalWai}: {autoWai === null ? "…" : autoWai ? "✓" : "–"}</span>
                <span>{t.autoSignalLean}: {autoLeans}</span>
              </div>
              {micSupported && (
                <div className="ll-mic" data-testid="auto-mic">
                  <button
                    className="ll-btn" aria-pressed={voiceSafety} data-testid="auto-mic-toggle"
                    onClick={() => { setVoiceSafety((on) => !on); setHeardCue(null); human(voiceSafety ? "voice_safety_off" : "voice_safety_on"); }}
                  >
                    {voiceSafety ? <MicOff size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />} {voiceSafety ? t.interview.micOff : t.interview.micOn}
                  </button>
                  <p className="ll-note" role="status">
                    {voiceSafety
                      ? heardCue ? `${t.interview.micHeard}: “${heardCue}”` : t.interview.micListening
                      : `${t.interview.micHint} ${t.interview.micDisclosure}`}
                  </p>
                </div>
              )}
              <button className="ll-btn" onClick={stopAuto}>{t.autoStop}</button>
            </div>
          )}

          {(phase === "review" || (phase === "saving" && inputMode === "auto" && !talk)) && autoResult && autoValues && autoSources && (
            <div className="ll-step">
              <h2>{t.reviewTitle}</h2>
              <ul className="ll-facts">
                <li>{t.factDistance}: {describeDistance(autoValues.comfortDistance)[lang]} <Src of={autoSources.distance} /></li>
                <li>{t.factSpeed}: {autoValues.speed < 1 ? t.slow : t.normal} <Src of={autoSources.speed} /></li>
                <li>{t.factGaze}: {autoValues.gaze === "soft" ? t.soft : t.direct} <Src of={autoSources.gaze} /></li>
                <li>{t.factVoice}: {autoValues.voice ? t.on : t.interview.textOnly} <Src of={autoSources.voice} /></li>
                {interviewTurns > 0 && (
                  <>
                    <li>{t.interview.factCaptions}: {autoValues.captions === "large" ? t.interview.large : t.interview.normal} <Src of={autoSources.captions} /></li>
                    <li>{t.interview.factPace}: {autoValues.speechPace === "slow" ? t.interview.slow : t.interview.normal} <Src of={autoSources.speechPace} /></li>
                    <li>{t.interview.factHandover}: {autoValues.noReach ? t.interview.place : t.interview.hand} <Src of={autoSources.handover} /></li>
                  </>
                )}
              </ul>
              <p className="ll-q">{t.reviewEvidence}</p>
              <ul className="ll-list">
                <li>{autoResult.evidence.waiDetected ? t.reviewWaiYes : t.reviewWaiNo}</li>
                <li>{t.reviewLeans(autoResult.evidence.leanBacks)}</li>
                {autoResult.evidence.voiceCorrections > 0 && <li>{t.interview.evidenceVoice(autoResult.evidence.voiceCorrections)}</li>}
                {autoResult.evidence.leanIn && <li>{t.reviewLeanIn}</li>}
                <li>{t.reviewGaze(autoResult.evidence.avertShare)}</li>
              </ul>
              {pendingTopics(autoSources).length > 0 && <p className="ll-note">{t.reviewDefaults}</p>}
              {INTERVIEW_OFFERED && phase === "review" && (
                <AutoInterview
                  lang={lang}
                  values={autoValues}
                  sources={autoSources}
                  camera={{
                    waiDetected: autoResult.evidence.waiDetected, leanBacks: autoResult.evidence.leanBacks,
                    tooFast: autoResult.evidence.tooFast, voiceCorrections: autoResult.evidence.voiceCorrections,
                    leanIn: autoResult.evidence.leanIn, gazeMeasured: autoResult.evidence.gazeMeasured,
                    avertShare: autoResult.evidence.avertShare
                  }}
                  say={say}
                  onUpdates={applyInterview}
                  onSave={saveAuto}
                  onActive={interviewActive}
                  onSkip={() => setCountdown(REVIEW_SECONDS)}
                />
              )}
              {phase === "saving" ? (
                <p className="ll-countdown" role="status">{t.statusSaving}</p>
              ) : countdown !== null ? (
                <p className="ll-countdown" role="timer">{t.reviewSaving(countdown)}</p>
              ) : (
                <p className="ll-note">{t.reviewHeld}</p>
              )}
              <div className="ll-row">
                <button className="ll-btn primary" onClick={saveAuto} disabled={phase === "saving"}>{t.reviewSaveNow}</button>
                {countdown !== null && phase === "review" && <button className="ll-btn" onClick={() => setCountdown(null)}>{t.reviewStop}</button>}
                <button className="ll-btn" disabled={phase === "saving"} onClick={startOver}>
                  <Pause size={18} aria-hidden="true" /> {t.again}
                </button>
              </div>
              {error && <p className="ll-error">{error}</p>}
            </div>
          )}

          {phase === "voice" && (
            <div className="ll-step">
              <h2>{t.voiceTitle}</h2>
              {inputMode === "voice" && <VoiceAnswerBox key="voice" lang={lang} question="voice" onAnswer={(answer) => chooseVoice(answer === "on")} />}
              <div className="ll-choices">
                <button className="ll-btn big" onClick={() => chooseVoice(true)}><Volume2 size={18} aria-hidden="true" /> {t.voiceYes}</button>
                <button className="ll-btn big" onClick={() => chooseVoice(false)}><VolumeX size={18} aria-hidden="true" /> {t.voiceNo}</button>
              </div>
            </div>
          )}

          {(phase === "confirm" || (phase === "saving" && inputMode !== "auto")) && (
            <div className="ll-step" data-testid="confirm-step">
              <h2>{t.confirmTitle}</h2>
              <p className="ll-note">{t.confirmHint}</p>
              <div className="ll-preview" aria-label={labCopy[lang].calibrate.previewTitle}>
                <p className="ll-q">{labCopy[lang].calibrate.previewTitle}</p>
                <PassportCardVisual
                  heading={t.cardHeading}
                  motto={t.cardMotto}
                  code="······"
                  codeLabel={t.codeLabel}
                  qr={null}
                  qrAlt={t.qrAlt}
                  statusLabel={labCopy[lang].calibrate.steps.review}
                  active={false}
                  language={lang}
                  version={1}
                  prefs={cardPrefs()}
                />
                <p className="ll-note">{labCopy[lang].calibrate.previewNote}</p>
              </div>
              <fieldset className="ll-review" disabled={phase === "saving"}>
                <p className="ll-q">{t.factGreeting}</p>
                <div className="ll-seg" role="group" aria-label={t.factGreeting}>
                  {(["wai", "wave", "none"] as const).map((g) => (
                    <button key={g} className={`ll-btn ${greeting === g ? "sel" : ""}`} aria-pressed={greeting === g} onClick={() => setGreeting(g)}>{t.greetingLabels[g]}</button>
                  ))}
                </div>
                <p className="ll-q">{t.factDistance}</p>
                <div className="ll-seg" role="group" aria-label={t.factDistance}>
                  {(["close", "medium", "far"] as const).map((band) => {
                    const selected = describeDistance(comfort ?? robotRef.current?.state.distanceTarget ?? 0).en === band;
                    return <button key={band} className={`ll-btn ${selected ? "sel" : ""}`} aria-pressed={selected} onClick={() => { if (!selected) reviewDistance(band); }}>{t.distanceLabels[band]}</button>;
                  })}
                </div>
                <p className="ll-q">{t.factSpeed}</p>
                <div className="ll-seg" role="group" aria-label={t.factSpeed}>
                  <button className={`ll-btn ${speed >= 1 ? "sel" : ""}`} aria-pressed={speed >= 1} onClick={() => reviewSpeed(1)}>{t.normal}</button>
                  <button className={`ll-btn ${speed < 1 ? "sel" : ""}`} aria-pressed={speed < 1} onClick={() => { if (speed >= 1) reviewSpeed(REVIEW_SLOWER_SPEED); }}>{t.slow}</button>
                </div>
                <p className="ll-q">{t.factGaze}</p>
                <div className="ll-seg" role="group" aria-label={t.factGaze}>
                  <button className={`ll-btn ${gaze === "direct" ? "sel" : ""}`} aria-pressed={gaze === "direct"} onClick={() => applyGaze("direct")}>{t.direct}</button>
                  <button className={`ll-btn ${gaze === "soft" ? "sel" : ""}`} aria-pressed={gaze === "soft"} onClick={() => applyGaze("soft")}>{t.soft}</button>
                </div>
                <p className="ll-q">{t.factVoice}</p>
                <div className="ll-seg" role="group" aria-label={t.factVoice}>
                  <button className={`ll-btn ${voice ? "sel" : ""}`} aria-pressed={voice} onClick={() => { setVoice(true); voiceRef.current = true; }}>{t.voiceYes}</button>
                  <button className={`ll-btn ${!voice ? "sel" : ""}`} aria-pressed={!voice} onClick={() => { setVoice(false); voiceRef.current = false; window.speechSynthesis?.cancel(); }}>{t.voiceNo}</button>
                </div>
                <p className="ll-q">{t.factAnxiety}</p>
                <div className="ll-seg" role="group" aria-label={t.factAnxiety}>
                  {(["low", "medium", "high"] as const).map((lvl) => (
                    <button key={lvl} className={`ll-btn ${anxiety === lvl ? "sel" : ""}`} aria-pressed={anxiety === lvl} onClick={() => chooseAnxiety(lvl)}>{t.anxietyLabels[lvl]}</button>
                  ))}
                </div>
                <p className="ll-q">{t.factComm}</p>
                <div className="ll-seg" role="group" aria-label={t.factComm}>
                  <button className={`ll-btn ${!accessible ? "sel" : ""}`} aria-pressed={!accessible} onClick={() => chooseAccessible(false)}>{t.commNormal}</button>
                  <button className={`ll-btn ${accessible ? "sel" : ""}`} aria-pressed={accessible} onClick={() => chooseAccessible(true)}>{t.commAccessible}</button>
                </div>
                <p className="ll-q">{t.factReach}</p>
                <div className="ll-seg" role="group" aria-label={t.factReach}>
                  <button className={`ll-btn ${!noReach ? "sel" : ""}`} aria-pressed={!noReach} onClick={() => chooseReach(false)}>{t.reachOk}</button>
                  <button className={`ll-btn ${noReach ? "sel" : ""}`} aria-pressed={noReach} onClick={() => chooseReach(true)}>{t.reachAvoid}</button>
                </div>
              </fieldset>
              {inputMode === "voice" && phase === "confirm" && <VoiceAnswerBox key="confirm" lang={lang} question="confirm" onAnswer={() => { void saveReviewed(); }} />}
              {phase === "saving" && <p className="ll-countdown" role="status">{t.statusSaving}</p>}
              <div className="ll-row">
                <button className="ll-btn primary" onClick={saveReviewed} disabled={phase === "saving"}>{t.confirmSave}</button>
                <button className="ll-btn" disabled={phase === "saving"} onClick={startOver}><Pause size={18} aria-hidden="true" /> {t.again}</button>
              </div>
              {error && <p className="ll-error" role="alert">{error}</p>}
            </div>
          )}

          {phase === "done" && passportCode && accessToken && editToken && (
            <div className="ll-step">
              <h2>{t.passportTitle}</h2>
              <PassportCardVisual
                issued
                heading={t.cardHeading}
                motto={t.cardMotto}
                code={passportCode}
                codeLabel={t.codeLabel}
                codeClassName="ll-code"
                qr={qr}
                qrAlt={t.qrAlt}
                statusLabel={t.cardActive}
                active
                language={lang}
                version={1}
                meta={t.cardVersion(1)}
                prefs={cardPrefs()}
              />
              <PassportSave
                lang={lang}
                saveUrl={`${window.location.origin}/living-lab/passport/${accessToken}?save=1`}
                data={{
                  heading: "HRI PASSPORT", motto: t.cardMotto, codeLabel: t.codeLabel, code: passportCode,
                  cardUrl: `${window.location.origin}/living-lab/passport/${accessToken}`,
                  prefs: cardPrefs(), scanNote: lang === "th" ? "ยกรูปนี้ให้หุ่นยนต์สแกน" : "Show this to a robot to scan", mrz: passportMrz(passportCode, lang, 1)
                }}
              />
              {!call && <><p className="ll-q">{t.moreTitle}</p>
              <ul className="ll-facts ll-more">
                <li><span>{t.factGreeting}</span><strong>{t.greetingLabels[greeting]}</strong></li>
                <li><span>{t.factVoice}</span><strong>{voice ? t.on : t.off}</strong></li>
                <li><span>{t.factAnxiety}</span><strong>{inputMode === "auto" ? t.factNotAsked : t.anxietyLabels[anxiety]}</strong></li>
                <li><span>{t.factComm}</span><strong>{accessible ? t.commAccessible : t.commNormal}</strong></li>
                <li><span>{t.factReach}</span><strong>{noReach ? t.reachAvoid : t.reachOk}</strong></li>
              </ul></>}
              {savedOwner && <p className="ll-owner"><BadgeCheck size={16} aria-hidden="true" /> {idT.savedUnder(savedOwner)}</p>}
              {!call && <p className="ll-note">{t.scanHint}</p>}
              <div className="ll-editkey">
                <p><strong>{t.editKeyTitle}</strong></p>
                <div className="ll-editkey-row">
                  <code>{editToken}</code>
                  <button type="button" className="ll-btn" onClick={copyEditKey}>{keyCopied ? t.copied : t.copyKey}</button>
                </div>
                <p className="ll-note">{t.editKeyHint}</p>
              </div>
              {call ? (
                <div className="ll-row">
                  <Link className="ll-btn" href={`/living-lab/passport/${accessToken}`}><IdCard size={18} aria-hidden="true" /> {t.cardLink}</Link>
                  <button className="ll-btn" onClick={startOver}><Pause size={18} aria-hidden="true" /> {t.again}</button>
                </div>
              ) : (
              <div className="ll-next" data-testid="passport-next">
                <h3>{t.nextSteps.title}</h3>
                <ul>
                  <li>
                    <Link className="ll-btn primary" href={`/living-lab/meet/${passportCode}`}><Hospital size={18} aria-hidden="true" /> {t.meetNow}</Link>
                    <p className="ll-note">{t.nextSteps.journeyBody(passportCode)}</p>
                  </li>
                  <li>
                    {/* The token travels in the fragment, which browsers never send to the server. */}
                    <Link className="ll-btn" href={`/living-lab/robot#token=${accessToken}`}><Bot size={18} aria-hidden="true" /> {t.nextSteps.robot}</Link>
                    <p className="ll-note">{t.nextSteps.robotBody}</p>
                  </li>
                  <li>
                    <Link className="ll-btn" href={`/living-lab/passport/${accessToken}`}><IdCard size={18} aria-hidden="true" /> {t.cardLink}</Link>
                    <p className="ll-note">{t.nextSteps.card}</p>
                  </li>
                </ul>
                <button className="ll-btn ll-again" onClick={startOver}><Pause size={18} aria-hidden="true" /> {t.again}</button>
              </div>
              )}
            </div>
          )}

          {/* The event log is for the answer-it-yourself flows. In the conversation it would show what the
              robot is measuring, so it stays out of sight there. */}
          {manual && !talk && <details className="ll-log-wrap">
            <summary>{t.logTitle} ({log.length})</summary>
            <div className="ll-log" ref={logRef} role="log">
              {log.map((e, i) => <div key={i}><b className={e.src}>{e.src}</b> {e.t.toFixed(1)}s · {e.type}</div>)}
            </div>
          </details>}
        </div>
        {(!call || (identityRequired && phase === "intro" && sheet)) && <IdentityCard lang={lang} identity={identity} onChange={setIdentity} locked={phase !== "intro" && phase !== "done"} required={identityRequired} consent={consent} />}
        </div>
      </section>

      </div>

      {call && (
        <div className={`ll-self${media === "on" ? " is-on" : ""}`} data-testid="call-self">
          <video ref={selfRef} autoPlay playsInline muted aria-label={t.cameraPreview} />
          {media !== "on" && <b aria-hidden="true">{t.talk.you}</b>}
          {media === "on" && !talk && (phase === "intro" || phase === "done") && <span className="ll-self-hint">{t.talk.showQr}</span>}
        </div>
      )}
      {call && media === "denied" && <p className="ll-call-alert" role="alert" data-testid="call-denied">{t.talk.callDenied}</p>}

      {call && (
        <div className="ll-callbar" role="toolbar" aria-label={t.talk.controls}>
          <span className={`ll-callbar-ind${media === "on" ? " is-on" : ""}`} title={media === "on" ? t.talk.micOn : t.talk.micOffNow} data-testid="call-mic">
            {media === "on" ? <Mic size={20} aria-hidden="true" /> : <MicOff size={20} aria-hidden="true" />}
            <span className="visually-hidden">{media === "on" ? t.talk.micOn : t.talk.micOffNow}</span>
          </span>
          <span className={`ll-callbar-ind${media === "on" ? " is-on" : ""}`} title={media === "on" ? t.talk.camOn : t.talk.camOffNow} data-testid="call-cam">
            {media === "on" ? <Camera size={20} aria-hidden="true" /> : <CameraOff size={20} aria-hidden="true" />}
            <span className="visually-hidden">{media === "on" ? t.talk.camOn : t.talk.camOffNow}</span>
          </span>
          {media === "denied" && (
            <button type="button" className="ll-callbar-btn" onClick={() => void openMedia()} data-testid="call-allow">{t.talk.allow}</button>
          )}
          {phase === "intro" && (
            <button type="button" className="ll-callbar-btn is-primary" onClick={() => setSheet(true)} data-testid="call-create">
              <UserPlus size={20} aria-hidden="true" /> {t.talk.create}
            </button>
          )}
        </div>
      )}
    </main>
  );
  return call && portal ? createPortal(<div className="lab ll-portal">{room}</div>, portal) : room;
}

const styles = `
.ll { display: grid; grid-template-columns: minmax(0, 1fr); gap: 28px; }
.ll-preview { display: grid; gap: 8px; margin: 4px 0 16px; padding: 14px; border: 1px dashed var(--lab-tint-border); border-radius: 8px; background: var(--lab-paper); }
.ll-preview .ll-q { margin: 0 !important; }
.ll-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap; border-bottom: 1px solid var(--border); padding-bottom: 14px; }
.ll-head h1 { margin: 4px 0 0; font-size: clamp(26px, 2.4vw, 36px); font-weight: 900; color: var(--lab-ink); }
.ll-eyebrow { margin: 0; font-size: 12px; font-weight: 750; letter-spacing: 1.2px; text-transform: uppercase; color: var(--warning); display: inline-flex; gap: 6px; align-items: center; }
.ll-sub { margin: 6px 0 0; color: var(--text-secondary); font-size: 14px; max-width: 720px; line-height: 1.5; }
.ll-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(320px, 1fr); gap: 16px; align-items: start; }
@media (max-width: 960px) { .ll-grid { grid-template-columns: 1fr; } }
.ll-stage-card { position: relative; background: linear-gradient(180deg, #ffffff, var(--lab-stage-end)); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; height: 600px; }
@media (max-width: 960px) { .ll-stage-card { height: 480px; } }
.ll-stage { position: absolute; inset: 0; }
.ll-canvas { width: 100%; height: 100%; }
.ll-bubble { position: absolute; z-index: 2; left: 14px; right: 14px; top: 14px; background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; font-size: 17px; line-height: 1.45; box-shadow: 0 8px 20px rgba(0,0,0,.06); min-height: 50px; }
.ll-chip { position: absolute; z-index: 2; left: 14px; bottom: 14px; background: rgba(11,31,58,.9); color: #fff; padding: 7px 13px; border-radius: 999px; font-size: 13px; font-weight: 650; }
.ll-cam { position: absolute; z-index: 2; right: 12px; bottom: 12px; width: 150px; display: none; border-radius: 10px; overflow: hidden; border: 2px solid #fff; background: #000; }
.ll-cam.is-on { display: block; }
.ll-cam video { width: 100%; display: block; transform: scaleX(-1); }
.ll-cam span { position: absolute; left: 0; right: 0; bottom: 0; font-size: 11px; color: #fff; background: rgba(0,0,0,.55); padding: 2px 6px; }
.ll-side { display: grid; gap: 16px; align-content: start; min-width: 0; }
.ll-owner { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 700; color: var(--accent-strong); margin: 0 0 8px !important; }
.ll-id { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px; display: grid; gap: 10px; }
.ll-id h2 { margin: 0; font-size: 18px; display: inline-flex; align-items: center; gap: 8px; color: var(--lab-ink); }
.ll-id h2 svg { color: var(--accent); }
.ll-id p { margin: 0; }
.ll-id-form { display: grid; gap: 6px; }
.ll-id-form label { font-size: 13px; font-weight: 700; }
.ll-id-inline { display: flex; gap: 8px; flex-wrap: wrap; }
.ll-id-inline input { flex: 1 1 200px; min-width: 0; min-height: 48px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; font: inherit; font-size: 16px; background: #fff; color: var(--lab-ink); }
.ll-id-inline input:focus-visible { outline: 3px solid var(--lab-focus); outline-offset: 1px; border-color: var(--accent); }
.ll-id-inline .ll-btn { flex: 0 0 auto; }
.ll-id-code { font: 700 22px ui-monospace, monospace !important; letter-spacing: 8px; text-align: center; }
.ll-id-sent { font-size: 13.5px; line-height: 1.5; background: var(--lab-tint); border: 1px solid var(--lab-tint-border); border-radius: 10px; padding: 10px 12px; }
.ll-id-links { display: flex; gap: 16px; flex-wrap: wrap; }
.ll-id-link { background: none !important; border: none !important; box-shadow: none !important; padding: 4px 0 !important; min-height: 0 !important; color: var(--accent) !important; font: inherit; font-size: 13.5px; font-weight: 700; text-decoration: underline; cursor: pointer; }
.ll-id-link:disabled { color: var(--text-secondary) !important; text-decoration: none; cursor: default; }
.ll-id-privacy { font-size: 12.5px; color: var(--text-secondary); border-top: 1px solid var(--border); padding-top: 10px; }
.ll-id.is-verified { background: var(--lab-tint); border-color: var(--lab-tint-border); padding: 12px 14px; }
.ll-id-row { display: flex; align-items: center; gap: 10px; }
.ll-id-check { color: var(--accent); flex: none; }
.ll-id-who { display: grid; min-width: 0; flex: 1; }
.ll-id-who span { font-size: 12px; color: var(--text-secondary); }
.ll-id-who strong { font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ll-id-switch { min-height: 40px !important; padding: 6px 12px !important; font-size: 13.5px; }
.ll-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px; display: grid; gap: 14px; }
.ll-step h2 { margin: 0 0 8px; font-size: 20px; }
.ll-step p { margin: 0 0 12px; line-height: 1.5; }
.ll-list { margin: 0 0 12px; padding-left: 20px; line-height: 1.7; }
.ll-note { font-size: 13px; color: var(--text-secondary); }
.ll-consent { display: flex; gap: 10px; align-items: flex-start; background: var(--lab-tint); border: 1px solid var(--lab-tint-border); border-radius: 10px; padding: 12px; margin: 0 0 4px; font-size: 13.5px; line-height: 1.5; cursor: pointer; }
.ll-consent input { margin-top: 3px; width: 18px; height: 18px; accent-color: var(--accent); flex: none; }
.ll-consent-hint { margin: 0 0 10px; font-size: 12.5px; font-weight: 700; color: var(--warning); }
.ll-editkey { border: 1px dashed var(--border); border-radius: 10px; padding: 12px; margin: 0 0 12px; background: var(--lab-paper); }
.ll-editkey p { margin: 0 0 6px; }
.ll-editkey-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 6px; }
.ll-editkey code { flex: 1 1 220px; word-break: break-all; font: 12.5px ui-monospace, monospace; background: var(--lab-dark); color: var(--lab-dark-ink); border-radius: 8px; padding: 9px 10px; }
.ll-row, .ll-choices { display: flex; gap: 10px; flex-wrap: wrap; }
.ll-choices { display: grid; grid-template-columns: 1fr 1fr; }
.ll-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 10px 16px; border-radius: 10px; border: 1px solid var(--border); background: #fff; color: var(--lab-ink); font: inherit; font-weight: 700; cursor: pointer; text-decoration: none; }
.ll-btn.big { min-height: 60px; font-size: 17px; }
.ll-btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.ll-btn.good { background: var(--lab-tint); border-color: var(--lab-tint-border); }
.ll-btn.warn { background: #fdf1e7; border-color: #e3b48c; }
.ll-btn:disabled { opacity: .55; cursor: not-allowed; }
.ll-btn:focus-visible { outline: 3px solid var(--lab-focus); outline-offset: 2px; }
.ll-meter { display: flex; gap: 6px; margin-bottom: 14px; }
.ll-meter span { flex: 1; height: 10px; border-radius: 6px; background: var(--surface-muted); }
.ll-meter span.on { background: var(--accent); }
.ll-facts { margin: 0; padding-left: 18px; line-height: 1.6; font-size: 14px; }
/* "Also on your passport": label/value rows under the passport card (the card itself is PassportCardVisual). */
.ll-more { list-style: none; padding: 0; display: grid; gap: 0; margin: 0 0 12px; }
.ll-more li { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--border); font-size: 13.5px; }
.ll-more li:last-child { border-bottom: none; }
.ll-more span { color: var(--text-secondary); }
.ll-more strong { text-align: right; }
.ll-error { color: var(--danger); font-size: 14px; }
.ll-q { margin: 12px 0 6px !important; font-weight: 700; }
.ll-voice { background: var(--lab-tint); border: 1px solid var(--lab-tint-border); border-radius: 10px; padding: 12px; margin: 10px 0; display: grid; gap: 8px; }
.ll-voice .ll-q, .ll-voice .ll-note { margin: 0; }
.ll-heard { margin: 0; font-size: 14px; font-weight: 700; overflow-wrap: anywhere; }
.ll-type { display: grid; gap: 4px; font-size: 13.5px; }
.ll-type-row { display: flex; gap: 8px; }
.ll-type-row input { flex: 1 1 auto; min-width: 0; min-height: 44px; padding: 0 10px; border: 1px solid var(--lab-tint-border); border-radius: 8px; font: inherit; background: #fff; color: var(--lab-ink); }
.ll-review { border: 0; margin: 0; padding: 0; min-width: 0; }
.ll-seg { display: flex; gap: 8px; flex-wrap: wrap; }
.ll-seg .ll-btn { flex: 1 1 120px; min-height: 48px; }
.ll-btn.sel { background: var(--lab-tint); border-color: var(--accent); box-shadow: inset 0 0 0 2px var(--accent); }
.ll-hero { background: var(--lab-tint); border-color: var(--lab-tint-border) !important; }
.ll-hero.muted { background: var(--lab-paper); border-color: var(--border) !important; }
.ll-hero small { font-size: 14px; font-weight: 700; color: var(--text-secondary); margin-left: 2px; }
.ll-log-wrap summary { cursor: pointer; font-weight: 700; font-size: 14px; }
.ll-log { margin-top: 8px; max-height: 160px; overflow: auto; background: var(--lab-dark); color: var(--lab-dark-ink); border-radius: 8px; padding: 8px; font: 12px ui-monospace, monospace; }
.ll-log b.robot { color: #7fdcf0; } .ll-log b.human { color: #ffd27f; }
.ll-findings { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px; }
.ll-findings h2 { margin: 0; font-size: 20px; } .ll-findings h3 { margin: 18px 0 0; font-size: 16px; }
.ll-head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
@media (max-width: 560px) {
  .ll-stage-card { height: 380px; }
  .ll-choices { grid-template-columns: 1fr; }
  .ll-head-actions { width: 100%; }
  .ll-head-actions .button { flex: 1 1 auto; }
}
.ll-talk-intro h2 { margin-bottom: 4px !important; }
.ll-talk-points { margin: 0; padding-left: 20px; display: grid; gap: 8px; font-size: 14.5px; line-height: 1.6; color: var(--text-primary); }
.ll-talk-start { width: 100%; justify-content: center; }
.ll-linkbtn { justify-self: start; min-height: 40px; padding: 0 2px; border: 0; background: none; font: inherit; font-size: 13.5px; font-weight: 600; color: var(--accent); text-decoration: underline; text-underline-offset: 4px; cursor: pointer; }
.ll-talking p { margin: 0; }
.ll-live { display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 600; color: var(--lab-tint-ink); }
.ll-live-dot { width: 9px; height: 9px; border-radius: 50%; background: #c0392b; box-shadow: 0 0 0 3px rgba(192, 57, 43, .18); }
@media (prefers-reduced-motion: no-preference) { .ll-live-dot { animation: ll-live 1.6s ease-in-out infinite; } }
@keyframes ll-live { 50% { opacity: .35; } }
.ll-auto-offer { display: grid; gap: 6px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); }
.ll-btn.auto { background: var(--lab-dark); border-color: var(--lab-dark); color: #fff; width: 100%; }
.ll-btn.auto:disabled { background: var(--lab-muted-line); border-color: var(--lab-muted-line); }
.ll-auto-stage { font-size: 17px; font-weight: 700; margin: 4px 0 10px; min-height: 1.5em; }
.ll-auto-signals { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 14px; font-size: 13px; }
.ll-auto-signals span { padding: 4px 10px; border-radius: 999px; background: var(--surface-muted); border: 1px solid var(--border); }
.ll-auto-signals .ok { background: var(--lab-tint); border-color: var(--lab-tint-border); }
.ll-auto-signals .warn { background: #fdf1e7; border-color: #e3b48c; }
.ll-countdown { font-weight: 700; color: var(--accent-strong); margin: 4px 0 10px; }
/* Where each value came from: a text tag, never colour alone. */
.ll-src { display: inline-block; margin-left: 6px; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-style: normal; font-weight: 700; border: 1px solid var(--border); background: var(--surface-muted); color: var(--text-secondary); white-space: nowrap; }
.ll-src-camera { background: var(--lab-tint); border-color: var(--lab-tint-border); color: var(--lab-tint-ink); }
.ll-src-voice { background: var(--lab-dark); border-color: var(--lab-dark); color: var(--lab-cyan); }
.ll-mic { display: grid; gap: 6px; margin: 0 0 12px; }
.ll-mic .ll-note { margin: 0; }
.ll-interview { display: grid; gap: 10px; margin: 14px 0; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--lab-paper); }
.ll-interview h3 { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 16px; }
.ll-interview p { margin: 0; }
.ll-topics { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; font-size: 12.5px; }
.ll-topics li { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--border); background: #fff; }
.ll-topics li.done { background: var(--lab-tint); border-color: var(--lab-tint-border); color: var(--lab-tint-ink); font-weight: 700; }
.ll-chat { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; max-height: 240px; overflow: auto; }
.ll-chat li { padding: 8px 11px; border-radius: 10px; font-size: 14px; line-height: 1.5; border: 1px solid var(--border); background: #fff; }
.ll-chat li.robot { background: var(--lab-tint); border-color: var(--lab-tint-border); }
.ll-chat li b { margin-right: 6px; font-size: 12px; }
.ll-type input { flex: 1 1 200px; min-height: 44px; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--border); font: inherit; background: #fff; }
@media (prefers-reduced-motion: reduce) {
  .ll-btn, .ll-consent input { transition: none; }
}
`;
