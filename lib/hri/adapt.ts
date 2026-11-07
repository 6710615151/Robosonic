// Adapt a robot-agnostic HRI Passport profile to one robot's capabilities.
//
// This is the heart of "One Profile. Every Robot Understands You.": the passport never contains
// commands for a specific robot. Each robot applies the same preferences within its own hardware.
// Pure and client-safe: no database, no network. Unit-tested in test/hri-adapt.test.ts.
import { describeDistance } from "./passport";
import { distanceCloseness, SCENE_DISTANCE_RANGE, speedBand, type PublicProfile } from "./public-profile";
import type { RobotProfile } from "./robot-profiles";

export type AdaptationCode =
  | "fixed_base_distance"
  | "fixed_base_speed"
  | "speed_capped"
  | "no_head"
  | "no_arms"
  | "no_speaker"
  | "no_screen"
  | "safety_speed_limit"
  | "safety_distance_limit";

// Who set a limit. Priority, highest first: hardware safety > clinical protocol > the person's
// Care Passport > the robot's own default. A passport can make a robot slower or keep it farther
// away, never faster or closer than a safety rule allows.
export type RuleSource = "hardware" | "clinical";
export const ADAPTATION_PRIORITY = ["hardware", "clinical", "passport", "default"] as const;

export type SafetyRule = {
  source: RuleSource;
  // Upper bound on the movement multiplier (1 = the robot's nominal speed).
  maxSpeedMultiplier?: number;
  // Upper bound on closeness (0 = farthest, 1 = closest across the stage range): a minimum distance.
  maxCloseness?: number;
};

export type PlanAdaptation = { code: AdaptationCode; value?: string; source?: RuleSource };

export type BehaviourPlan = {
  distance: { sceneUnits: number; band: "close" | "medium" | "far"; closeness: number; fixed: boolean };
  movement: { multiplier: number; band: "slow" | "normal" | "fast"; mobile: boolean };
  eyeContact: "direct" | "soft" | "none";
  eyeMechanism: "head_and_eyes" | "screen_cue" | "none";
  greeting: "wai" | "wave" | "none";
  voice: boolean;
  captions: "normal" | "large";
  language: "th" | "en";
  speechRate: number;
  handover: "hand_to_person" | "place_nearby";
  demeanor: "friendly" | "calm";
  adaptations: PlanAdaptation[];
};

// What a robot does when it has not read a passport: wave, walk close at full speed, stare.
export const DEFAULT_PLAN: BehaviourPlan = {
  distance: { sceneUnits: 1.3, band: "close", closeness: distanceCloseness(1.3), fixed: false },
  movement: { multiplier: 1.4, band: "fast", mobile: true },
  eyeContact: "direct",
  eyeMechanism: "head_and_eyes",
  greeting: "wave",
  voice: true,
  captions: "normal",
  language: "th",
  speechRate: 1,
  handover: "hand_to_person",
  demeanor: "friendly",
  adaptations: []
};

const round2 = (value: number) => Number(value.toFixed(2));

// Scene units for a closeness value (the inverse of distanceCloseness).
function sceneUnitsFor(closeness: number) {
  const { far, close } = SCENE_DISTANCE_RANGE;
  return round2(far + closeness * (close - far));
}

// `rules` are clinical or site protocols (for example a ward speed limit). The robot's own hardware
// rules (robot.safety) always apply first. With no rules the plan is exactly the capability adaptation.
export function adapt(profile: PublicProfile, robot: RobotProfile, rules: SafetyRule[] = []): BehaviourPlan {
  const preferences = profile.preferences;
  const { capabilities } = robot;
  const adaptations: PlanAdaptation[] = [];

  // A fixed-base robot stays where it is; the preference is still reported, but not applied.
  const fixed = !capabilities.mobile;
  const sceneUnits = fixed ? 0 : preferences.distance.sceneUnits;
  if (fixed) adaptations.push({ code: "fixed_base_distance" });

  // A fixed-base robot does not move, so the movement preference has no effect there.
  let multiplier = preferences.movementSpeed.multiplier;
  if (fixed) {
    multiplier = 0;
    adaptations.push({ code: "fixed_base_speed" });
  } else if (multiplier > capabilities.maxSpeedMultiplier) {
    multiplier = capabilities.maxSpeedMultiplier;
    adaptations.push({ code: "speed_capped", value: `×${capabilities.maxSpeedMultiplier}` });
  }

  // Eye contact needs a head (or at least eyes). A screen can hint at attention, but cannot look.
  let eyeContact: BehaviourPlan["eyeContact"] = preferences.eyeContact.level;
  let eyeMechanism: BehaviourPlan["eyeMechanism"] = "head_and_eyes";
  if (!capabilities.head) {
    eyeContact = "none";
    eyeMechanism = capabilities.screen ? "screen_cue" : "none";
    adaptations.push({ code: "no_head" });
  }

  // Wai and waving need arms; a robot without them asks the person to read the screen instead.
  let greeting: BehaviourPlan["greeting"] = profile.interaction.greeting;
  if (!capabilities.arms && greeting !== "none") {
    greeting = "none";
    adaptations.push({ code: "no_arms" });
  }

  // Handing an item to a person needs arms; otherwise the robot places it nearby, as the passport asks.
  const handover = capabilities.arms ? profile.interaction.handover : "place_nearby";
  if (!capabilities.arms && !adaptations.some((a) => a.code === "no_arms")) {
    adaptations.push({ code: "no_arms" });
  }

  // A robot without a speaker falls back to its screen.
  let voice = profile.interaction.voice;
  if (voice && !capabilities.speaker) {
    voice = false;
    adaptations.push({ code: "no_speaker" });
  }

  // Large captions need a screen; without one the robot speaks only.
  let captions = profile.interaction.captions;
  if (captions === "large" && !capabilities.screen) {
    captions = "normal";
    adaptations.push({ code: "no_screen" });
  }

  // Safety rules last, so they win over every preference above. Hardware before clinical.
  let distanceUnits = sceneUnits;
  const ordered = [...(robot.safety ?? []), ...rules].sort(
    (a, b) => ADAPTATION_PRIORITY.indexOf(a.source) - ADAPTATION_PRIORITY.indexOf(b.source)
  );
  for (const rule of ordered) {
    if (!fixed && rule.maxSpeedMultiplier !== undefined && multiplier > rule.maxSpeedMultiplier) {
      multiplier = rule.maxSpeedMultiplier;
      adaptations.push({ code: "safety_speed_limit", value: `×${rule.maxSpeedMultiplier}`, source: rule.source });
    }
    if (!fixed && rule.maxCloseness !== undefined && distanceCloseness(distanceUnits) > rule.maxCloseness) {
      distanceUnits = sceneUnitsFor(rule.maxCloseness);
      adaptations.push({ code: "safety_distance_limit", value: describeDistance(distanceUnits).en, source: rule.source });
    }
  }

  return {
    distance: {
      sceneUnits: distanceUnits,
      band: describeDistance(distanceUnits).en as "close" | "medium" | "far",
      closeness: distanceCloseness(distanceUnits),
      fixed
    },
    movement: { multiplier, band: speedBand(multiplier), mobile: capabilities.mobile },
    eyeContact,
    eyeMechanism,
    greeting,
    voice,
    captions,
    language: preferences.language.tag,
    speechRate: preferences.speakingSpeed.rate,
    handover,
    demeanor: profile.interaction.demeanor,
    adaptations
  };
}

// ---------------------------------------------------------------------------------------------
// Explanation: for every preference, what the person asked for, what this robot will do, and why.
// Values are stable codes; the UI translates them.

export type PreferenceKey = "distance" | "movement" | "eyeContact" | "greeting" | "voice" | "captions" | "handover";
export type PreferenceOutcome = "applied" | "adapted" | "not_supported";
export type PreferenceExplanation = {
  key: PreferenceKey;
  requested: string;
  applied: string;
  outcome: PreferenceOutcome;
  reasons: PlanAdaptation[];
};

const REASON_KEYS: Record<AdaptationCode, PreferenceKey[]> = {
  fixed_base_distance: ["distance"],
  safety_distance_limit: ["distance"],
  fixed_base_speed: ["movement"],
  speed_capped: ["movement"],
  safety_speed_limit: ["movement"],
  no_head: ["eyeContact"],
  no_arms: ["greeting", "handover"],
  no_speaker: ["voice"],
  no_screen: ["captions"]
};
// Codes that mean the robot cannot do the thing at all (rather than doing a reduced version of it).
const UNSUPPORTED: ReadonlySet<AdaptationCode> = new Set(["fixed_base_distance", "fixed_base_speed", "no_head", "no_arms", "no_speaker", "no_screen"]);

export function explainPlan(profile: PublicProfile, plan: BehaviourPlan): PreferenceExplanation[] {
  const p = profile.preferences;
  const i = profile.interaction;
  const rows: Omit<PreferenceExplanation, "outcome" | "reasons">[] = [
    { key: "distance", requested: p.distance.band, applied: plan.distance.fixed ? "fixed" : plan.distance.band },
    { key: "movement", requested: p.movementSpeed.band, applied: plan.movement.mobile ? speedBand(plan.movement.multiplier) : "stationary" },
    { key: "eyeContact", requested: p.eyeContact.level, applied: plan.eyeMechanism === "screen_cue" ? "screen_cue" : plan.eyeContact },
    { key: "greeting", requested: i.greeting, applied: plan.greeting },
    { key: "voice", requested: i.voice ? "spoken" : "text", applied: plan.voice ? "spoken" : "text" },
    { key: "captions", requested: i.captions, applied: plan.captions },
    { key: "handover", requested: i.handover, applied: plan.handover }
  ];
  return rows.map((row) => {
    // A reason only counts when it changed something the person asked for: a robot without arms
    // does not "fail" a greeting of "none".
    const reasons = plan.adaptations.filter((a) => REASON_KEYS[a.code].includes(row.key) && row.requested !== row.applied);
    const outcome: PreferenceOutcome = reasons.length === 0
      ? "applied"
      : reasons.some((r) => UNSUPPORTED.has(r.code)) ? "not_supported" : "adapted";
    return { ...row, outcome, reasons };
  });
}
