"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Mic, MicOff, Send, Sparkles } from "lucide-react";
import {
  pendingTopics, toState, type FieldKey, type InterviewUpdates, type PendingTopic, type ReviewValues, type Sources
} from "@/lib/hri/interview-ai";
import { findSpeechRecognition, listenOnce, type RecognitionConstructor } from "@/lib/hri/speech-input";
import { copy, type Lang } from "./copy";

export type CameraFacts = {
  waiDetected: boolean; leanBacks: number; tooFast: number; voiceCorrections: number;
  leanIn: boolean; gazeMeasured: boolean; avertShare: number | null;
};
type Turn = { role: "user" | "robot"; text: string };

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const TOPICS: PendingTopic[] = ["voice", "readability", "handover"];

// After the camera has measured what it can, the robot talks with the person (Gemini on the server) about
// what a camera cannot know. The server only returns values that the person's own words back up
// (lib/hri/interview-guard.ts); this component turns that into a spoken, hands-free conversation.
export default function AutoInterview({
  lang, values, sources, camera, say, onUpdates, onSave, onActive, onSkip
}: {
  lang: Lang;
  values: ReviewValues;
  sources: Sources;
  camera: CameraFacts;
  say: (text: string) => void;
  onUpdates: (updates: InterviewUpdates) => FieldKey[];
  onSave: () => void;
  /** The conversation started or stopped. `failed` means the AI could not be reached. */
  onActive: (active: boolean, failed?: boolean) => void;
  /** The person chose not to talk: save with the measured values. */
  onSkip: () => void;
}) {
  const t = copy[lang].interview;
  const [running, setRunning] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [log, setLog] = useState<Turn[]>([]);
  const [typed, setTyped] = useState("");
  const [Recognition, setRecognition] = useState<RecognitionConstructor | null>(null);

  const history = useRef<Turn[]>([]);
  const latest = useRef({ values, sources, camera });
  latest.current = { values, sources, camera };
  const alive = useRef(true);
  const stopListening = useRef<(() => void) | null>(null);
  const busy = useRef(false);
  const callbacks = useRef({ say, onUpdates, onSave, onActive });
  callbacks.current = { say, onUpdates, onSave, onActive };

  useEffect(() => { setRecognition(() => findSpeechRecognition(window)); }, []);
  useEffect(() => () => {
    alive.current = false;
    stopListening.current?.();
  }, []);

  async function waitUntilQuiet() {
    await sleep(600); // speech synthesis starts a moment after speak()
    const started = Date.now();
    while (alive.current && window.speechSynthesis?.speaking && Date.now() - started < 20_000) await sleep(250);
  }

  function listenNext() {
    if (!Recognition || !alive.current) return;
    stopListening.current?.();
    setListening(true);
    stopListening.current = listenOnce(Recognition, lang, ({ alternatives, problem }) => {
      stopListening.current = null;
      setListening(false);
      if (!alive.current) return;
      if (problem === "denied") { setNotice(t.micDenied); return; }
      if (problem) { setNotice(t.noSpeech); return; }
      const text = alternatives[0]?.trim();
      if (text) void ask(text);
    });
  }

  async function ask(text: string, opening = false) {
    if (busy.current) return;
    busy.current = true;
    stopListening.current?.();
    stopListening.current = null;
    setListening(false);
    setThinking(true);
    setNotice(null);
    const current = latest.current;
    let response: Response | null = null;
    try {
      response = await fetch("/api/hri/interview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lang, opening, text: opening ? "" : text, history: history.current.slice(-10),
          state: toState(current.values), pending: pendingTopics(current.sources), camera: current.camera
        })
      });
    } catch { /* network down: handled below */ }
    setThinking(false);
    busy.current = false;
    if (!alive.current) return;

    if (!response || !response.ok) {
      const error = response ? ((await response.json().catch(() => null)) as { error?: string } | null)?.error : undefined;
      setNotice(error === "ai_busy" || error === "rate_limited" ? t.busy : t.unavailable);
      setRunning(false);
      callbacks.current.onActive(false, true);
      return;
    }
    const body = (await response.json().catch(() => null)) as { say?: string; updates?: InterviewUpdates; save?: boolean } | null;
    if (!body?.say) { setNotice(t.unavailable); setRunning(false); callbacks.current.onActive(false, true); return; }

    const turns: Turn[] = [...(opening ? [] : [{ role: "user" as const, text }]), { role: "robot", text: body.say }];
    history.current = [...history.current, ...turns].slice(-10);
    setLog((previous) => [...previous, ...turns]);
    if (body.updates && Object.keys(body.updates).length) callbacks.current.onUpdates(body.updates);
    callbacks.current.say(body.say);
    if (body.save) { callbacks.current.onSave(); return; }
    await waitUntilQuiet();
    listenNext();
  }

  function start() {
    setRunning(true);
    callbacks.current.onActive(true);
    void ask("", true);
  }

  function finish() {
    stopListening.current?.();
    stopListening.current = null;
    setListening(false);
    setRunning(false);
    callbacks.current.onActive(false);
  }

  function submitTyped(event: FormEvent) {
    event.preventDefault();
    const text = typed.trim();
    if (!text || busy.current) return;
    setTyped("");
    void ask(text);
  }

  const open = pendingTopics(sources);

  return (
    <div className="ll-interview" data-testid="auto-interview">
      <h3><Sparkles size={16} aria-hidden="true" /> {t.title}</h3>

      {!running ? (
        <>
          <p>{t.intro}</p>
          <p className="ll-note">{t.disclosure}</p>
          <div className="ll-row">
            <button className="ll-btn primary" onClick={start} data-testid="interview-start">
              <Mic size={16} aria-hidden="true" /> {log.length ? t.resume : t.start}
            </button>
            <button className="ll-btn" onClick={onSkip} data-testid="interview-skip">{t.skip}</button>
          </div>
          {notice && <p className="ll-error" role="status" data-testid="interview-notice">{notice}</p>}
        </>
      ) : (
        <>
          <ul className="ll-topics" aria-label={t.progress}>
            {TOPICS.map((topic) => (
              <li key={topic} className={open.includes(topic) ? "" : "done"}>
                {open.includes(topic) ? "○" : <Check size={13} aria-hidden="true" />} {t.topics[topic]}
              </li>
            ))}
          </ul>

          <ol className="ll-chat" aria-live="polite" data-testid="interview-log">
            {log.map((turn, index) => (
              <li key={index} className={turn.role}>
                <b>{turn.role === "robot" ? t.robotName : t.you}</b> <span lang={lang}>{turn.text}</span>
              </li>
            ))}
          </ol>

          <p className="ll-note" role="status" data-testid="interview-status">
            {thinking ? t.thinking : listening ? t.listening : ""}
          </p>
          {notice && <p className="ll-error" role="status" data-testid="interview-notice">{notice}</p>}

          <div className="ll-row">
            {Recognition && (
              <button className="ll-btn" onClick={listening ? () => { stopListening.current?.(); stopListening.current = null; setListening(false); } : listenNext} disabled={thinking}>
                {listening ? <MicOff size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />} {listening ? t.stopListen : t.speak}
              </button>
            )}
            <button className="ll-btn" onClick={finish}>{t.finish}</button>
          </div>

          <form className="ll-row ll-type" onSubmit={submitTyped}>
            <label htmlFor="interview-typed" className="ll-note" style={{ flexBasis: "100%" }}>{t.typeLabel}</label>
            <input
              id="interview-typed" value={typed} onChange={(event) => setTyped(event.target.value)}
              placeholder={t.typePlaceholder} autoComplete="off" lang={lang} data-testid="interview-typed" maxLength={300}
            />
            <button className="ll-btn" type="submit" disabled={!typed.trim() || thinking}>
              <Send size={16} aria-hidden="true" /> {t.send}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
