"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Mic, MicOff, Send, Sparkles, Volume2, VolumeX } from "lucide-react";
import { EXAMPLE_COMMANDS, type VoiceIntent } from "@/lib/hri/voice-commands";
import { robotCopy, type RobotLang } from "./copy";
import SoundCheck from "./SoundCheck";
import styles from "./robot.module.css";

export type VoiceLogEntry = {
  id: number;
  heard: string;
  intent: VoiceIntent | null;
  results: Array<{ key: string; name: string; done: boolean; reply: string }>;
  /** True when the AI chose the reply. */
  ai?: boolean;
};

// The Web Speech API is not in lib.dom for every TypeScript version, so describe the part we use.
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Props = {
  lang: RobotLang;
  log: VoiceLogEntry[];
  speakReplies: boolean;
  onToggleSpeak: () => void;
  /** Called with each finished phrase, spoken or typed. */
  onUtterance: (text: string) => void;
  aiMode: boolean;
  onToggleAi: () => void;
  thinking: boolean;
  aiNotice: boolean;
};

export default function VoiceControl({
  lang, log, speakReplies, onToggleSpeak, onUtterance, aiMode, onToggleAi, thinking, aiNotice
}: Props) {
  const t = robotCopy[lang];
  const v = t.voice;
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  const recognition = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  const onUtteranceRef = useRef(onUtterance);
  onUtteranceRef.current = onUtterance;

  useEffect(() => {
    setSupported(recognitionCtor() !== null);
    return () => {
      wanted.current = false;
      recognition.current?.stop();
    };
  }, []);

  const stop = useCallback(() => {
    wanted.current = false;
    recognition.current?.stop();
    recognition.current = null;
    setListening(false);
    setInterim("");
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setProblem(null);
    const rec = new Ctor();
    rec.lang = "th-TH";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let live = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          // Ignore what the robot itself is saying through the speakers.
          if (!window.speechSynthesis?.speaking && text.trim()) onUtteranceRef.current(text.trim());
        } else {
          live += text;
        }
      }
      setInterim(live);
    };
    rec.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      wanted.current = false;
      setListening(false);
      setProblem(event.error === "not-allowed" || event.error === "service-not-allowed" ? v.denied : v.failed);
    };
    rec.onend = () => {
      // Browsers end a session after a pause; keep listening until the person presses stop.
      if (wanted.current) {
        try {
          rec.start();
          return;
        } catch {
          // Fall through to a clean stop.
        }
      }
      setListening(false);
      setInterim("");
    };
    recognition.current = rec;
    wanted.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      wanted.current = false;
      setProblem(v.failed);
    }
  }, [v.denied, v.failed]);

  function submitTyped(event: FormEvent) {
    event.preventDefault();
    const text = typed.trim();
    if (!text) return;
    onUtterance(text);
    setTyped("");
  }

  return (
    <section className={styles.panel} aria-labelledby="voice-title" data-testid="voice-panel">
      <h2 id="voice-title" className={styles.panelTitle}>{v.title}</h2>
      <p className={styles.hint}>{v.intro}</p>

      <SoundCheck lang={lang} />

      <div className={styles.voiceRow}>
        <button
          type="button"
          className={`${styles.btn} ${listening ? styles.micOn : styles.mic}`}
          onClick={listening ? stop : start}
          disabled={!supported}
          aria-pressed={listening}
          data-testid="mic-toggle"
        >
          {listening ? <MicOff size={16} aria-hidden /> : <Mic size={16} aria-hidden />}
          {listening ? v.stop : v.start}
          {listening ? <span className={styles.pulse} aria-hidden /> : null}
        </button>
        <button type="button" className={styles.btn} onClick={onToggleSpeak} aria-pressed={speakReplies}>
          {speakReplies ? <Volume2 size={16} aria-hidden /> : <VolumeX size={16} aria-hidden />}
          {speakReplies ? v.mute : v.muted}
        </button>
        <button type="button" className={styles.btn} onClick={onToggleAi} aria-pressed={aiMode} data-testid="ai-toggle">
          <Sparkles size={16} aria-hidden /> {aiMode ? v.aiOn : v.aiOff}
        </button>
      </div>
      {thinking ? <p className={styles.live} role="status" data-testid="ai-thinking">{v.aiThinking}</p> : null}
      {aiNotice ? <p className={styles.error} role="status" data-testid="ai-notice">{v.aiFallback}</p> : null}

      {listening ? (
        <p className={styles.live} aria-live="polite" data-testid="voice-live">
          {interim ? `${v.heardLive}: ${interim}` : v.listening}
        </p>
      ) : null}
      {!supported ? <p className={styles.error} role="status">{v.unsupported}</p> : null}
      {problem ? <p className={styles.error} role="alert">{problem}</p> : null}

      <form className={styles.typeRow} onSubmit={submitTyped}>
        <label className={styles.label} htmlFor="voice-typed" style={{ flexBasis: "100%" }}>{v.typeLabel}</label>
        <input
          id="voice-typed"
          className={styles.input}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={v.typePlaceholder}
          autoComplete="off"
          lang="th"
          data-testid="voice-typed"
        />
        <button type="submit" className={`${styles.btn} ${styles.primary}`} disabled={!typed.trim()}>
          <Send size={16} aria-hidden /> {v.send}
        </button>
      </form>

      <div>
        <h3 className={styles.subhead}>{v.examples}</h3>
        <div className={styles.chips}>
          {EXAMPLE_COMMANDS.map((example) => (
            <button key={example} type="button" className={styles.chip} lang="th" onClick={() => onUtterance(example)}>
              {example}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className={styles.subhead}>{v.logTitle}</h3>
        {log.length === 0 ? (
          <p className={styles.note}>{v.logEmpty}</p>
        ) : (
          <ul className={styles.log} data-testid="voice-log">
            {log.map((entry) => (
              <li key={entry.id} className={styles.logItem}>
                <span className={styles.logHeard} lang="th">
                  {v.heard}: “{entry.heard}”
                  <span className={`${styles.logIntent} ${entry.intent ? "" : styles.logIntentNo}`}>
                    {entry.intent ?? (entry.ai ? v.noAction : v.notUnderstood)}
                  </span>
                  {entry.ai ? <span className={styles.logIntent}>AI</span> : null}
                </span>
                {entry.results.map((result) => (
                  <p key={result.key} className={`${styles.logReply} ${result.done ? "" : styles.logFail}`} lang="th">
                    <strong>{result.name}:</strong> {result.done ? "" : `${v.couldNot} — `}
                    {result.reply}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className={styles.hint}>{aiMode ? v.privacyAi : v.privacy}</p>
    </section>
  );
}
