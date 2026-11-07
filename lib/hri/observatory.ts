// Research Observatory: aggregate statistics for the Living Lab page. Pure (no Prisma), so every
// rule below is unit-tested in test/hri-observatory.test.ts. The page passes in database rows.
//
// Data rules:
// - Aggregates only. No row, code, nickname, email or event ever leaves this module.
// - Every number carries its sample size (n).
// - Care-need shares (no-reach, large captions) are suppressed below MIN_CARE_CELL people, so a
//   small cohort cannot be used to infer one person's care needs.
// - Anxiety is never aggregated here.
// - Everything is simulation data: people rated 3D browser robots, not physical robots.

export const MIN_CARE_CELL = 5;
export const OBSERVATORY_WINDOWS = ["all", "30d", "7d"] as const;
export type ObservatoryWindow = (typeof OBSERVATORY_WINDOWS)[number];

export function parseWindow(raw: unknown): ObservatoryWindow {
  return OBSERVATORY_WINDOWS.includes(raw as ObservatoryWindow) ? (raw as ObservatoryWindow) : "all";
}

// Earliest date a window includes, or null for all time.
export function windowStart(window: ObservatoryWindow, now: Date): Date | null {
  if (window === "all") return null;
  const days = window === "30d" ? 30 : 7;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export type PassportRow = {
  comfortDistance: number;
  speed: number;
  gaze: string;
  voice: boolean;
  greeting: string;
  captions: string;
  noReach: boolean;
  participantId: string | null;
};
export type CalibrationRow = { inputMode: string; summary: unknown };
export type StationRow = { summary: unknown };

export type Mean = { mean: number | null; n: number };
export type Share = { share: number | null; n: number; suppressed?: boolean };
export type Comparison = { passport: Mean; default: Mean };

export type ObservatoryStats = {
  window: ObservatoryWindow;
  comfort: Comparison;
  // Mean difference passport − default, only from people who rated both conditions at the same station.
  paired: { meanDifference: number | null; n: number };
  byStation: ({ task: string } & Comparison)[];
  byRobot: ({ robot: string } & Comparison)[];
  order: { passportFirst: number; defaultFirst: number; unknown: number };
  preferences: {
    passports: number;
    avgDistance: number | null;
    softGaze: Share;
    slower: Share;
    voiceOn: Share;
    noReach: Share;
    largeCaptions: Share;
    greeting: Record<"wai" | "wave" | "none", number>;
  };
  calibration: {
    sessions: number;
    inputModes: Record<"buttons" | "voice" | "camera" | "auto", number>;
    tooClose: number;
  };
  quality: {
    linkedParticipants: number;
    unlinkedPassports: number;
    stationSessions: number;
    ratedStations: number;
    missingRatings: number;
  };
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const isRating = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
const finite = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

function mean(values: number[]): Mean {
  return { mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null, n: values.length };
}

function share(count: number, total: number, minimum = 1): Share {
  if (total === 0) return { share: null, n: 0 };
  if (total < minimum) return { share: null, n: total, suppressed: true };
  return { share: count / total, n: total };
}

type Rated = { mode: "passport" | "default"; comfort: number; task: string; robot: string; order: number | null; journey: string | null };

function compare(rows: Rated[]): Comparison {
  return {
    passport: mean(rows.filter((r) => r.mode === "passport").map((r) => r.comfort)),
    default: mean(rows.filter((r) => r.mode === "default").map((r) => r.comfort))
  };
}

function groupBy<K extends string>(rows: Rated[], key: (r: Rated) => K) {
  const groups = new Map<K, Rated[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return groups;
}

export function computeObservatory(input: {
  window: ObservatoryWindow;
  passports: PassportRow[];
  calibrations: CalibrationRow[];
  stations: StationRow[];
}): ObservatoryStats {
  const { passports, calibrations, stations } = input;

  const rated: Rated[] = [];
  let missingRatings = 0;
  for (const station of stations) {
    const s = asRecord(station.summary);
    const mode = s.mode === "passport" || s.mode === "default" ? s.mode : null;
    if (!mode || !isRating(s.comfort)) {
      missingRatings++;
      continue;
    }
    rated.push({
      mode,
      comfort: s.comfort,
      task: typeof s.task === "string" ? s.task : "unknown",
      robot: typeof s.robot === "string" ? s.robot : "unknown",
      order: s.order === 1 || s.order === 2 ? s.order : null,
      journey: typeof s.journey === "string" ? s.journey : null
    });
  }

  // Within-person pairs: the same journey run rated both conditions at the same station.
  const differences: number[] = [];
  for (const [, rows] of groupBy(rated.filter((r) => r.journey), (r) => `${r.journey}|${r.task}` as string)) {
    const p = rows.find((r) => r.mode === "passport");
    const d = rows.find((r) => r.mode === "default");
    if (p && d) differences.push(p.comfort - d.comfort);
  }

  const order = { passportFirst: 0, defaultFirst: 0, unknown: 0 };
  for (const row of rated) {
    if (row.order !== 1) {
      if (row.order === null) order.unknown++;
      continue;
    }
    if (row.mode === "passport") order.passportFirst++;
    else order.defaultFirst++;
  }

  const n = passports.length;
  const count = (fn: (p: PassportRow) => boolean) => passports.filter(fn).length;
  const greeting = { wai: 0, wave: 0, none: 0 };
  for (const p of passports) {
    const g = p.greeting === "wave" || p.greeting === "none" ? p.greeting : "wai";
    greeting[g]++;
  }

  const inputModes = { buttons: 0, voice: 0, camera: 0, auto: 0 };
  for (const c of calibrations) {
    if (c.inputMode in inputModes) inputModes[c.inputMode as keyof typeof inputModes]++;
  }

  const linked = new Set(passports.map((p) => p.participantId).filter((id): id is string => Boolean(id)));

  return {
    window: input.window,
    comfort: compare(rated),
    paired: { meanDifference: differences.length ? differences.reduce((a, b) => a + b, 0) / differences.length : null, n: differences.length },
    byStation: [...groupBy(rated, (r) => r.task)].map(([task, rows]) => ({ task, ...compare(rows) })).sort((a, b) => a.task.localeCompare(b.task)),
    byRobot: [...groupBy(rated, (r) => r.robot)].map(([robot, rows]) => ({ robot, ...compare(rows) })).sort((a, b) => a.robot.localeCompare(b.robot)),
    order,
    preferences: {
      passports: n,
      avgDistance: n ? passports.reduce((a, p) => a + p.comfortDistance, 0) / n : null,
      softGaze: share(count((p) => p.gaze === "soft"), n),
      slower: share(count((p) => p.speed < 1), n),
      voiceOn: share(count((p) => p.voice), n),
      noReach: share(count((p) => p.noReach), n, MIN_CARE_CELL),
      largeCaptions: share(count((p) => p.captions === "large"), n, MIN_CARE_CELL),
      greeting
    },
    calibration: {
      sessions: calibrations.length,
      inputModes,
      tooClose: calibrations.reduce((a, c) => a + finite(asRecord(c.summary).tooClose), 0)
    },
    quality: {
      linkedParticipants: linked.size,
      unlinkedPassports: count((p) => !p.participantId),
      stationSessions: stations.length,
      ratedStations: rated.length,
      missingRatings
    }
  };
}

// Aggregates as CSV rows (metric, group, condition, value, n). Never row-level data.
export function observatoryCsv(stats: ObservatoryStats): string {
  const rows: (string | number)[][] = [["metric", "group", "condition", "value", "n", "window"]];
  const add = (metric: string, group: string, condition: string, value: number | null, n: number) =>
    rows.push([metric, group, condition, value === null ? "" : Number(value.toFixed(4)), n, stats.window]);
  add("comfort_mean", "all", "passport", stats.comfort.passport.mean, stats.comfort.passport.n);
  add("comfort_mean", "all", "default", stats.comfort.default.mean, stats.comfort.default.n);
  add("comfort_paired_difference", "all", "passport_minus_default", stats.paired.meanDifference, stats.paired.n);
  for (const s of stats.byStation) {
    add("comfort_mean", `station:${s.task}`, "passport", s.passport.mean, s.passport.n);
    add("comfort_mean", `station:${s.task}`, "default", s.default.mean, s.default.n);
  }
  for (const r of stats.byRobot) {
    add("comfort_mean", `robot:${r.robot}`, "passport", r.passport.mean, r.passport.n);
    add("comfort_mean", `robot:${r.robot}`, "default", r.default.mean, r.default.n);
  }
  const p = stats.preferences;
  for (const [name, value] of Object.entries({ soft_gaze: p.softGaze, slower_movement: p.slower, voice_on: p.voiceOn, no_reach: p.noReach, large_captions: p.largeCaptions })) {
    add(`share_${name}`, "passports", "", value.share, value.n);
  }
  for (const [mode, c] of Object.entries(stats.calibration.inputModes)) add("calibration_sessions", `input:${mode}`, "", c, stats.calibration.sessions);
  const escape = (cell: string | number) => {
    const text = String(cell);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return rows.map((row) => row.map(escape).join(",")).join("\n") + "\n";
}
