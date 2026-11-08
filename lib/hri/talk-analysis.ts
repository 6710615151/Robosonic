// What the robot keeps noticing while it chats (conversation mode), after the Auto calibrator has finished.
// Pure and client-safe; unit-tested in test/hri-talk-analysis.test.ts. Frames and words are never stored:
// only the counts and averages in `summary()` leave this object.
//
// Applied to the passport (same rules as the calibrator, over a longer and more natural window):
//   eye contact → while the robot looks at the person, the share of visible frames with the head turned
//                 away; mostly away → "soft"
//   distance    → a lean-back during the conversation means "still too close": one step farther
// Recorded for research only, never applied (no validated link to a preference yet):
//   response time (robot stops speaking → reply recognised) and speaking rate (characters per second).
// Never inferred: emotions, anxiety or health, from the face or anything else.
import { AUTO_THRESHOLDS } from "./auto-calibration";
import { headTurn, LeanBackDetector, shoulderWidth, type Landmark } from "./signals";

// Enough visible frames (about 6 s at 10 fps) before the conversation's gaze reading is trusted.
export const TALK_GAZE_MIN_FRAMES = 60;

export type TalkSummary = {
  answers: number;
  meanResponseMs: number | null;
  meanCharsPerSecond: number | null;
  gazeFrames: number;
  avertShare: number | null;
  leanBacks: number;
};

export class TalkAnalyzer {
  private lean = new LeanBackDetector();
  private visible = 0;
  private away = 0;
  private leanBacks = 0;
  private responses: number[] = [];
  private rates: number[] = [];

  // One camera frame. Returns true when the person leaned back (the robot should step back).
  // `detectLean` is off while the Auto calibrator still runs: it counts lean-backs itself.
  frame(tMs: number, landmarks: Landmark[] | null, robotLooking: boolean, detectLean = true): boolean {
    if (!landmarks) return false;
    if (robotLooking) {
      const turn = headTurn(landmarks);
      if (Number.isFinite(turn)) {
        this.visible++;
        if (Math.abs(turn) > AUTO_THRESHOLDS.avertTurn) this.away++;
      }
    }
    if (!detectLean) return false;
    const fired = this.lean.update(tMs, shoulderWidth(landmarks));
    if (fired) this.leanBacks++;
    return fired;
  }

  // A recognised reply. `waitedMs`: from the moment the robot stopped speaking to the result.
  // `speakingMs`: how long the recogniser heard speech, when the browser reports it.
  answer(transcript: string, waitedMs: number, speakingMs?: number) {
    const chars = transcript.replace(/\s+/g, "").length;
    if (!chars) return;
    if (Number.isFinite(waitedMs) && waitedMs >= 0 && waitedMs < 60_000) this.responses.push(waitedMs);
    if (speakingMs && speakingMs > 300) this.rates.push(chars / (speakingMs / 1000));
  }

  summary(): TalkSummary {
    const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
    return {
      answers: this.responses.length,
      meanResponseMs: mean(this.responses),
      meanCharsPerSecond: mean(this.rates),
      gazeFrames: this.visible,
      avertShare: this.visible ? Math.round((this.away / this.visible) * 100) / 100 : null,
      leanBacks: this.leanBacks
    };
  }

  // Eye contact from the whole conversation, or null when there were too few frames to say.
  gaze(): "direct" | "soft" | null {
    if (this.visible < TALK_GAZE_MIN_FRAMES) return null;
    return this.away / this.visible > AUTO_THRESHOLDS.avertShare ? "soft" : "direct";
  }
}
