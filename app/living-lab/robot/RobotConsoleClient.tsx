"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, Minus, Play, Radio, Volume2, VolumeX } from "lucide-react";
import RobotStage from "@/app/components/robot/RobotStage";
import { adapt, DEFAULT_PLAN, explainPlan, type BehaviourPlan, type PreferenceKey, type SafetyRule } from "@/lib/hri/adapt";
import type { RobotBehavior } from "@/lib/hri/behavior-engine";
import { PROFILE_SCHEMA, type PublicProfile } from "@/lib/hri/public-profile";
import { ROBOT_PROFILES, type RobotCapabilities, type RobotProfile } from "@/lib/hri/robot-profiles";
import { buildDefaultSpeech, buildSpokenSummary } from "@/lib/hri/spoken-summary";
import {
  NOT_UNDERSTOOD_REPLY,
  parseVoiceCommand,
  runVoiceIntent,
  type RobotState,
  type VoiceIntent
} from "@/lib/hri/voice-commands";
import { robotCopy, type RobotLang } from "./copy";
import VoiceControl, { type VoiceLogEntry } from "./VoiceControl";
import styles from "./robot.module.css";

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

// A demonstration ward protocol. Clinical rules rank above the passport, below hardware safety.
const WARD_PROTOCOL: SafetyRule[] = [{ source: "clinical", maxSpeedMultiplier: 0.8, maxCloseness: 0.6 }];

// Accept either a raw token or a passport card link (?t=... is not used; the token is the last path segment).
function readToken(raw: string): string | null {
  const value = raw.trim();
  if (TOKEN_RE.test(value)) return value;
  try {
    const url = new URL(value);
    const last = url.pathname.split("/").filter(Boolean).pop() ?? "";
    if (TOKEN_RE.test(last)) return last;
  } catch {
    // Not a URL and not a token.
  }
  return null;
}

// What this robot says, shown as a caption too. The default robot has no passport to talk about.
function spokenText(key: string, plan: BehaviourPlan) {
  return key === "default" ? buildDefaultSpeech(plan.language) : buildSpokenSummary(plan);
}

function speak(text: string, lang: RobotLang, rate: number) {
  const synth = window.speechSynthesis;
  if (!synth) return null;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === "th" ? "th-TH" : "en-US";
  utterance.rate = Math.min(1.5, Math.max(0.6, rate));
  synth.speak(utterance);
  return utterance;
}

// Play the plan as a short script: settle, greet, then show how the robot would hand something over.
function perform(robot: RobotBehavior, plan: BehaviourPlan, caps: RobotCapabilities): number[] {
  robot.clearGestures();
  robot.bothArms("relaxed");
  robot.lean("upright");
  robot.expression(plan.demeanor === "calm" ? "calm" : "happy");
  robot.setGlow(plan.demeanor === "calm" ? 0.45 : 0.7, plan.demeanor === "calm" ? "blue" : "teal");
  if (caps.mobile) {
    robot.setDistance(plan.distance.sceneUnits);
    robot.setSpeed(Math.max(plan.movement.multiplier, 0.25));
  } else {
    robot.setSpeed(1);
  }
  if (caps.head) {
    if (plan.eyeContact === "soft") robot.lookAt(0.3, 0.35);
    else if (plan.eyeContact === "direct") robot.lookAt(0, 0.1);
    else robot.lookAt(0, 0.2);
  } else {
    robot.lookAt(0, 0.15);
  }

  const timers: number[] = [];
  if (caps.arms && plan.greeting === "wai") {
    robot.bothArms("wai");
    timers.push(window.setTimeout(() => robot.bow(0.34, 1.6), 450));
    timers.push(window.setTimeout(() => robot.bothArms("relaxed"), 2400));
  } else if (caps.arms && plan.greeting === "wave") {
    robot.wave("R", 2.4);
  }
  timers.push(
    window.setTimeout(() => {
      if (!caps.arms) return;
      if (plan.handover === "hand_to_person") {
        robot.moveArm("R", "offer");
        timers.push(window.setTimeout(() => robot.moveArm("R", "relaxed"), 2200));
      } else {
        robot.lean("forward");
        timers.push(window.setTimeout(() => robot.lean("upright"), 1200));
      }
    }, 3200)
  );
  return timers;
}

export default function RobotConsoleClient({ lang }: { lang: RobotLang }) {
  const t = robotCopy[lang];
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [ward, setWard] = useState(false);
  const rulesRef = useRef<SafetyRule[]>([]);
  rulesRef.current = ward ? WARD_PROTOCOL : [];
  const planFor = (p: PublicProfile, robot: RobotProfile) => adapt(p, robot, rulesRef.current);

  const profileRef = useRef<PublicProfile | null>(null);
  const robots = useRef<Record<string, RobotBehavior | null>>({});
  const timers = useRef<Record<string, number[]>>({});
  const [voiceLog, setVoiceLog] = useState<VoiceLogEntry[]>([]);
  const [speakReplies, setSpeakReplies] = useState(true);
  const speakRepliesRef = useRef(true);
  const logId = useRef(0);
  const [aiMode, setAiMode] = useState(true);
  const aiModeRef = useRef(true);
  const [thinking, setThinking] = useState(false);
  const [aiNotice, setAiNotice] = useState(false);
  const chatHistory = useRef<Array<{ role: "user" | "robot"; text: string }>>([]);
  // Running distance/speed per robot, so "come closer" and "slower" accumulate.
  const motion = useRef<Record<string, RobotState>>({
    a: { distance: 0, speed: 1 },
    b: { distance: 0, speed: 1 }
  });

  const performOn = useCallback((key: string, plan: BehaviourPlan, caps: RobotCapabilities) => {
    const robot = robots.current[key];
    if (!robot) return;
    for (const timer of timers.current[key] ?? []) window.clearTimeout(timer);
    timers.current[key] = perform(robot, plan, caps);
  }, []);

  useEffect(() => {
    return () => {
      for (const list of Object.values(timers.current)) {
        for (const timer of list) window.clearTimeout(timer);
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!profile) return;
    const rules = ward ? WARD_PROTOCOL : [];
    performOn("a", adapt(profile, ROBOT_PROFILES[0], rules), ROBOT_PROFILES[0].capabilities);
    performOn("b", adapt(profile, ROBOT_PROFILES[1], rules), ROBOT_PROFILES[1].capabilities);
  }, [profile, ward, performOn]);

  function ready(key: string, robot: RobotBehavior) {
    robots.current[key] = robot;
    if (key === "default") {
      performOn("default", DEFAULT_PLAN, ROBOT_PROFILES[0].capabilities);
      return;
    }
    const current = profileRef.current;
    if (!current) return;
    const robotProfile = key === "a" ? ROBOT_PROFILES[0] : ROBOT_PROFILES[1];
    performOn(key, planFor(current, robotProfile), robotProfile.capabilities);
  }

  async function readPassport(event: FormEvent) {
    event.preventDefault();
    const token = readToken(input);
    if (!token) {
      setError(t.errorBadToken);
      return;
    }
    await loadToken(token);
  }

  // Links from the passport card and the end of creation carry the token in the URL fragment
  // (#token=…), which browsers never send to the server. Read it once, then drop it from the address bar.
  useEffect(() => {
    const match = /^#token=([A-Za-z0-9_-]{43})$/.exec(window.location.hash);
    if (!match) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setInput(match[1]);
    void loadToken(match[1]);
    // Runs once on arrival; loadToken only uses refs and setters.
  }, []);

  async function loadToken(token: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/hri/passport/${encodeURIComponent(token)}`, {
        cache: "no-store",
        headers: { accept: "application/json" }
      });
      const body = (await response.json().catch(() => null)) as
        | (PublicProfile & { error?: string; retryAfterSeconds?: number })
        | null;
      if (!response.ok) {
        setError(
          body?.error === "rate_limited"
            ? t.errorRateLimited
            : body?.error === "invalid_token"
              ? t.errorBadToken
              : body?.error === "revoked" || body?.error === "expired"
                ? t.errorInactive
                : body?.error === "not_found"
                  ? t.errorNotFound
                  : t.errorUnavailable
        );
        return;
      }
      if (!body || body.schema !== PROFILE_SCHEMA || !body.preferences) {
        setError(t.errorUnavailable);
        return;
      }
      profileRef.current = body;
      setProfile(body);
      setSpeaking(null);
      window.speechSynthesis?.cancel();
    } catch {
      setError(t.errorUnavailable);
    } finally {
      setBusy(false);
    }
  }

  // Run one action on both simulated robots; each obeys within its own hardware.
  function applyIntent(intent: VoiceIntent): VoiceLogEntry["results"] {
    const results: VoiceLogEntry["results"] = [];
    for (const target of [
      { key: "a", robot: ROBOT_PROFILES[0] },
      { key: "b", robot: ROBOT_PROFILES[1] }
    ]) {
      const instance = robots.current[target.key];
      if (!instance) continue;
      // A voice command takes over from the scripted passport demo.
      for (const timer of timers.current[target.key] ?? []) window.clearTimeout(timer);
      timers.current[target.key] = [];
      const result = runVoiceIntent(instance, target.robot.capabilities, intent, motion.current[target.key]);
      results.push({ key: target.key, name: target.robot.name[lang], done: result.done, reply: result.reply });
    }
    return results;
  }

  // Public passport preferences only. Never anxiety, nickname, code, token or logs.
  function aiPreferences() {
    const current = profileRef.current;
    if (!current) return undefined;
    const plan = planFor(current, ROBOT_PROFILES[0]);
    return { language: plan.language, greeting: plan.greeting, voice: plan.voice, captions: plan.captions };
  }

  async function askAi(text: string): Promise<{ say: string; intent: VoiceIntent | null } | null> {
    try {
      const response = await fetch("/api/hri/voice-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, history: chatHistory.current.slice(-6), preferences: aiPreferences() })
      });
      if (!response.ok) return null;
      const body = (await response.json()) as { say?: string; intent?: VoiceIntent | null };
      return body.say ? { say: body.say, intent: body.intent ?? null } : null;
    } catch {
      return null;
    }
  }

  // A spoken or typed Thai phrase. In AI mode the model answers and may pick an action; otherwise (or when
  // the AI is unavailable) the built-in keyword parser handles it.
  async function handleUtterance(text: string) {
    let intent: VoiceIntent | null = null;
    let results: VoiceLogEntry["results"] = [];
    let say: string | null = null;
    let viaAi = false;

    if (aiModeRef.current) {
      setThinking(true);
      const answer = await askAi(text);
      setThinking(false);
      if (answer) {
        viaAi = true;
        setAiNotice(false);
        intent = answer.intent;
        say = answer.say;
        const moved = intent ? applyIntent(intent) : [];
        results = moved.length
          ? moved.map((entry) => ({ ...entry, reply: entry.done ? answer.say : entry.reply }))
          : [{ key: "a", name: ROBOT_PROFILES[0].name[lang], done: true, reply: answer.say }];
        chatHistory.current.push({ role: "user", text }, { role: "robot", text: answer.say });
        chatHistory.current = chatHistory.current.slice(-12);
      } else {
        setAiNotice(true);
      }
    }

    if (!viaAi) {
      intent = parseVoiceCommand(text);
      if (intent) {
        results = applyIntent(intent);
        say = results[0]?.reply ?? null;
      } else {
        results = [{ key: "a", name: ROBOT_PROFILES[0].name[lang], done: false, reply: NOT_UNDERSTOOD_REPLY }];
        say = NOT_UNDERSTOOD_REPLY;
      }
    }

    logId.current += 1;
    const entry: VoiceLogEntry = { id: logId.current, heard: text, intent, results, ai: viaAi };
    setVoiceLog((current) => [entry, ...current].slice(0, 8));

    // One voice answers, so the replies do not talk over each other.
    if (speakRepliesRef.current && say) {
      const rate = profileRef.current ? planFor(profileRef.current, ROBOT_PROFILES[0]).speechRate : 1;
      speak(say, "th", rate);
    }
  }

  function toggleAi() {
    const next = !aiModeRef.current;
    aiModeRef.current = next;
    setAiMode(next);
    setAiNotice(false);
    if (!next) chatHistory.current = [];
  }

  function toggleSpeakReplies() {
    const next = !speakRepliesRef.current;
    speakRepliesRef.current = next;
    setSpeakReplies(next);
    if (!next) window.speechSynthesis?.cancel();
  }

  function speakPlan(key: string, plan: BehaviourPlan) {
    const utterance = speak(spokenText(key, plan), plan.language, plan.speechRate);
    if (!utterance) return;
    setSpeaking(key);
    utterance.onend = () => setSpeaking((current) => (current === key ? null : current));
    utterance.onerror = () => setSpeaking((current) => (current === key ? null : current));
  }

  function stopSpeaking() {
    window.speechSynthesis?.cancel();
    setSpeaking(null);
  }

  const plans = {
    a: profile ? planFor(profile, ROBOT_PROFILES[0]) : null,
    b: profile ? planFor(profile, ROBOT_PROFILES[1]) : null
  };

  const FACT_KEY: Record<PreferenceKey, keyof typeof t.fact> = {
    distance: "distance", movement: "speed", eyeContact: "eyeContact", greeting: "greeting",
    voice: "voice", captions: "captions", handover: "handover"
  };
  const valueLabel = (value: string) => {
    if (value === "screen_cue") return t.explain.screenCue;
    if (value === "fixed") return t.explain.fixed;
    if (value === "hand_to_person" || value === "place_nearby" || value === "none") return t.explain[value];
    return (t.value as Record<string, string>)[value] ?? value;
  };

  // The nine facts shown for a plan, as display strings (also used to compare against the default robot).
  const shown = (plan: BehaviourPlan) => [
    { label: t.fact.distance, value: plan.distance.fixed ? t.value.fixed : t.value[plan.distance.band] },
    { label: t.fact.speed, value: plan.movement.mobile ? t.value[plan.movement.band] : t.value.stationary },
    { label: t.fact.eyeContact, value: plan.eyeMechanism === "screen_cue" ? t.value.none : t.value[plan.eyeContact] },
    { label: t.fact.greeting, value: plan.greeting === "none" ? t.value.noGesture : t.value[plan.greeting] },
    { label: t.fact.voice, value: plan.voice ? t.value.spoken : t.value.text },
    { label: t.fact.handover, value: plan.handover === "hand_to_person" ? t.value.hand : t.value.place },
    { label: t.fact.captions, value: t.value[plan.captions] },
    { label: t.fact.demeanor, value: t.value[plan.demeanor] },
    { label: t.fact.language, value: t.value[plan.language] }
  ];

  const card = (robot: RobotProfile | null, plan: BehaviourPlan | null, key: "a" | "b" | "default") => {
    const isDefault = robot === null;
    const defaultRobot = ROBOT_PROFILES[0];
    const caps = robot?.capabilities ?? defaultRobot.capabilities;
    const title = robot ? robot.name[lang] : t.defaultTitle;
    const subtitle = robot ? robot.short[lang] : t.defaultHint;
    const active = plan !== null;

    return (
      <article
        key={key}
        data-testid={`robot-card-${key}`}
        className={`${styles.robotCard} ${isDefault ? styles.defaultCard : ""}`}
        aria-label={title}
      >
        <div className={styles.robotHead}>
          <div>
            <h2 className={styles.robotTitle}>{title}</h2>
            <p className={styles.robotSub}>{subtitle}</p>
          </div>
          {isDefault ? (
            <span className={`${styles.badge} ${styles.badgeMuted}`}>{t.previewDefault}</span>
          ) : (
            <span className={`${styles.badge} ${active ? styles.badgeActive : styles.badgeIdle}`}>
              {active ? t.loaded(profile?.version ?? 1) : t.tokenTitle}
            </span>
          )}
        </div>

        <ul className={styles.caps} aria-label={t.capsLabel}>
          {(["mobile", "head", "arms", "speaker", "screen"] as const).map((cap) => (
            <li key={cap} className={caps[cap] ? styles.capYes : styles.capNo}>
              {caps[cap] ? <Check size={12} aria-hidden /> : <Minus size={12} aria-hidden />}
              <span>{t.caps[cap]}</span>
              <span className={styles.srOnly}>{caps[cap] ? t.capYes : t.capNo}</span>
            </li>
          ))}
        </ul>

        <div className={styles.stage}>
          <RobotStage
            framing="portrait"
            className={styles.canvas}
            ariaLabel={`${title} simulation`}
            onReady={(instance) => ready(key, instance)}
          />
          <span className={styles.simTag}>
            <Radio size={12} aria-hidden /> {t.simShort}
          </span>
        </div>

        <p
          data-testid={`robot-speech-${key}`}
          lang={plan?.language}
          className={`${styles.speech} ${plan?.captions === "large" ? styles.speechLarge : ""}`}
        >
          {plan ? spokenText(key, plan) : t.noPassport}
        </p>

        {active && plan ? (
          <>
            <dl className={styles.facts}>
              {(() => {
                // Values that differ from the default robot are what the passport changed: mark them.
                const mine = shown(plan);
                const base = isDefault ? mine : shown(DEFAULT_PLAN);
                return mine.map((fact) => (
                  <Fact
                    key={fact.label}
                    label={fact.label}
                    value={fact.value}
                    changed={!isDefault && fact.value !== base.find((b) => b.label === fact.label)?.value}
                    changedLabel={t.changed}
                  />
                ));
              })()}
            </dl>

            <div>
              <h3 className={styles.subhead}>{t.explain.title}</h3>
              {(() => {
                // Only what changed: the facts above already list everything that was applied as written.
                const rows = !isDefault && profile ? explainPlan(profile, plan).filter((row) => row.outcome !== "applied") : [];
                if (!rows.length) return <p className={styles.note}>{t.noAdaptations}</p>;
                return (
                  <ul className={styles.adaptations}>
                    {rows.map((row) => (
                      <li key={row.key} data-outcome={row.outcome}>
                        <span className={styles.explainHead}>
                          <strong>{t.fact[FACT_KEY[row.key]]}</strong>
                          <span>{valueLabel(row.requested)} → {valueLabel(row.applied)}</span>
                          <em className={`${styles.outcome} ${row.outcome === "not_supported" ? styles.outcomeNo : ""}`}>{t.explain.outcome[row.outcome]}</em>
                        </span>
                        {row.reasons.map((reason) => {
                          const message = t.adaptation[reason.code];
                          return <span key={reason.code} className={styles.reason}>{typeof message === "function" ? message(reason.value) : message}</span>;
                        })}
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>

            <div className={styles.actions}>
              {plan.voice ? (
                speaking === key ? (
                  <button type="button" className={styles.btn} onClick={stopSpeaking}>
                    <VolumeX size={16} aria-hidden /> {t.stop}
                  </button>
                ) : (
                  <button type="button" className={styles.btn} onClick={() => speakPlan(key, plan)}>
                    <Volume2 size={16} aria-hidden /> {t.speak}
                  </button>
                )
              ) : null}
              <button
                type="button"
                className={styles.btn}
                onClick={() => performOn(key, plan, caps)}
              >
                <Play size={16} aria-hidden /> {t.replay}
              </button>
            </div>
          </>
        ) : (
          <p className={styles.note}>{t.noPassport}</p>
        )}
      </article>
    );
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t.eyebrow}</p>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.subtitle}>{t.subtitle}</p>
        </div>
        <span className={`${styles.badge} ${styles.badgeWarn} ${styles.simBadge}`}>
          <Radio size={13} aria-hidden /> {t.simNote}
        </span>
      </header>

      <section className={`${styles.panel} ${profile ? styles.panelLoaded : ""}`} aria-labelledby="read-passport">
        <div className={styles.panelHead}>
          <h2 id="read-passport" className={styles.panelTitle}>{t.tokenTitle}</h2>
          {profile ? <span className={`${styles.badge} ${styles.badgeActive}`}>{t.loaded(profile.version)}</span> : null}
        </div>
        <form className={styles.form} onSubmit={readPassport}>
          <label className={styles.label} htmlFor="passport-token">{t.tokenLabel}</label>
          <div className={styles.tokenRow}>
            <input
              id="passport-token"
              className={styles.input}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t.tokenPlaceholder}
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
            />
            <button type="submit" className={`${styles.btn} ${styles.primary}`} disabled={busy}>
              {busy ? t.reading : t.read}
            </button>
          </div>
          <p className={styles.hint}>{t.tokenHelp} {!profile && <Link href="/living-lab/create">{t.noPassportYet}</Link>}</p>
        </form>
        {error ? <p className={styles.error} role="alert" data-testid="console-error">{error}</p> : null}
      </section>

      <section aria-labelledby="robots-title" className={styles.robots}>
        <div className={styles.robotsHead}>
          <h2 id="robots-title" className={styles.panelTitle}>{t.robotsTitle}</h2>
          <p className={styles.legend}>
            {profile ? <><span className={styles.changedTag}>{t.changed}</span> {t.legend}</> : t.robotsLead}
          </p>
        </div>
        <div className={styles.grid}>
          {card(ROBOT_PROFILES[0], plans.a, "a")}
          {card(ROBOT_PROFILES[1], plans.b, "b")}
          {card(null, DEFAULT_PLAN, "default")}
        </div>
      </section>

      <VoiceControl
        lang={lang}
        log={voiceLog}
        speakReplies={speakReplies}
        onToggleSpeak={toggleSpeakReplies}
        onUtterance={handleUtterance}
        aiMode={aiMode}
        onToggleAi={toggleAi}
        thinking={thinking}
        aiNotice={aiNotice}
      />

      <details className={styles.json}>
        <summary>{t.researchTitle}</summary>
        <div className={styles.research}>
          <div className={styles.protocol}>
            <label className={styles.protocolLabel}>
              <input type="checkbox" checked={ward} onChange={(event) => setWard(event.target.checked)} data-testid="ward-protocol" />
              <span><strong>{t.protocol.title}.</strong> {t.protocol.label}</span>
            </label>
            <p className={styles.hint}>{t.protocol.priority}</p>
          </div>
          {profile ? (
            <div>
              <h3 className={styles.subhead}>{t.jsonTitle}</h3>
              <p className={styles.hint}>{t.jsonHint}</p>
              <pre className={styles.pre} data-testid="console-json">{JSON.stringify(profile, null, 2)}</pre>
            </div>
          ) : (
            <p className={styles.hint}>{t.jsonEmpty}</p>
          )}
        </div>
      </details>
    </main>
  );
}

function Fact({ label, value, changed = false, changedLabel }: { label: string; value: string; changed?: boolean; changedLabel?: string }) {
  return (
    <div className={`${styles.fact} ${changed ? styles.factChanged : ""}`}>
      <dt>
        {label}
        {changed && <span className={styles.changedTag}>{changedLabel}</span>}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}
