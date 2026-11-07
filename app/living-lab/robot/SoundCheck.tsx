"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { robotCopy, type RobotLang } from "./copy";
import styles from "./robot.module.css";

type Verdict = "idle" | "starting" | "silent" | "quiet" | "good" | "loud" | "denied" | "nomic";

const SEGMENTS = 20;

// Map the RMS of the waveform (0..1) to a bar level. A square-root curve so normal speech fills most of the bar.
function toLevel(rms: number): number {
  return Math.min(1, Math.sqrt(rms) * 1.6);
}

export default function SoundCheck({ lang }: { lang: RobotLang }) {
  const c = robotCopy[lang].sound;
  const [running, setRunning] = useState(false);
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [verdict, setVerdict] = useState<Verdict>("idle");
  const [device, setDevice] = useState<string | null>(null);
  const [thaiVoice, setThaiVoice] = useState<boolean | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const stream = useRef<MediaStream | null>(null);
  const context = useRef<AudioContext | null>(null);
  const frame = useRef<number | null>(null);
  const loudest = useRef(0);

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    void context.current?.close().catch(() => undefined);
    context.current = null;
    setRunning(false);
    setLevel(0);
  }, []);

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) {
      setThaiVoice(false);
      return;
    }
    // Voices load asynchronously in Chrome and Edge.
    const read = () => setThaiVoice(synth.getVoices().some((voice) => voice.lang.toLowerCase().startsWith("th")));
    read();
    synth.addEventListener("voiceschanged", read);
    return () => {
      synth.removeEventListener("voiceschanged", read);
      synth.cancel();
      stop();
    };
  }, [stop]);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setVerdict("nomic");
      return;
    }
    setVerdict("starting");
    loudest.current = 0;
    setPeak(0);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      setDevice(media.getAudioTracks()[0]?.label || null);

      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      context.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(media).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);

      setRunning(true);
      const startedAt = performance.now();
      let smooth = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        let max = 0;
        for (const sample of samples) {
          const v = (sample - 128) / 128;
          sum += v * v;
          max = Math.max(max, Math.abs(v));
        }
        const rms = Math.sqrt(sum / samples.length);
        // Fast attack, slow release, so the bar is readable.
        smooth = Math.max(toLevel(rms), smooth * 0.85);
        setLevel(smooth);
        loudest.current = Math.max(loudest.current, toLevel(rms));
        setPeak(loudest.current);

        const elapsed = performance.now() - startedAt;
        if (max > 0.98) setVerdict("loud");
        else if (loudest.current > 0.45) setVerdict("good");
        else if (loudest.current > 0.12) setVerdict("quiet");
        else if (elapsed > 2500) setVerdict("silent");
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setVerdict(name === "NotFoundError" ? "nomic" : "denied");
      stop();
    }
  }

  function testVoice() {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(c.sample);
    utterance.lang = "th-TH";
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synth.speak(utterance);
  }

  const lit = Math.round(level * SEGMENTS);
  const peakAt = Math.min(SEGMENTS - 1, Math.round(peak * SEGMENTS) - 1);
  const message =
    verdict === "idle" ? c.idle
    : verdict === "starting" ? c.starting
    : verdict === "silent" ? c.silent
    : verdict === "quiet" ? c.quiet
    : verdict === "good" ? c.good
    : verdict === "loud" ? c.loud
    : verdict === "denied" ? c.denied
    : c.nomic;
  const tone = verdict === "good" ? styles.soundGood : verdict === "idle" || verdict === "starting" ? "" : styles.soundWarn;

  return (
    <div className={styles.sound} data-testid="sound-check">
      <h3 className={styles.subhead}>{c.title}</h3>

      <div className={styles.voiceRow}>
        <button
          type="button"
          className={styles.btn}
          onClick={running ? stop : start}
          aria-pressed={running}
          data-testid="sound-mic"
        >
          {running ? <MicOff size={16} aria-hidden /> : <Mic size={16} aria-hidden />}
          {running ? c.stopMic : c.testMic}
        </button>
        <button type="button" className={styles.btn} onClick={testVoice} data-testid="sound-voice">
          <Volume2 size={16} aria-hidden /> {speaking ? c.speaking : c.testVoice}
        </button>
      </div>

      <div
        className={styles.meter}
        role="meter"
        aria-label={c.meter}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(level * 100)}
        data-testid="sound-meter"
      >
        {Array.from({ length: SEGMENTS }, (_, index) => {
          const zone = index >= SEGMENTS * 0.85 ? styles.segHot : index >= SEGMENTS * 0.6 ? styles.segMid : styles.segLow;
          return (
            <span
              key={index}
              className={`${styles.seg} ${zone} ${index < lit ? styles.segOn : ""} ${running && index === peakAt ? styles.segPeak : ""}`}
            />
          );
        })}
      </div>

      <p className={`${styles.soundMsg} ${tone}`} role="status" data-testid="sound-verdict" data-verdict={verdict}>
        {message}
      </p>
      {device ? <p className={styles.hint}>{c.device}: {device}</p> : null}
      {thaiVoice === false ? <p className={styles.error} role="status">{c.noThaiVoice}</p> : null}
    </div>
  );
}
