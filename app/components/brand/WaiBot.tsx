// "Atlas", the HumanoidTH mascot, as a flat vector illustration. It is drawn from the same silhouette
// as the interactive 3D model (public/teal_v.2.glb, rendered by RobotStage): a screen-faced head with
// twin antennae on a compact humanoid body, in the emerald/ivory "atlas" livery.
// Every pose shares one skeleton; only the arm endpoints, face and props change, so the character stays
// identical across pages. This is an illustration, not an interactive robot.
export type WaiBotPose = "wai" | "welcome" | "explore" | "research" | "loading" | "success" | "empty" | "assistant";

type Pt = [number, number];
type Face = "calm" | "happy" | "look-right" | "look-down" | "dots" | "curious";
type PoseDef = { l: [Pt, Pt]; r: [Pt, Pt]; face: Face; tilt?: number };

const SHOULDER_L: Pt = [64, 130];
const SHOULDER_R: Pt = [136, 130];
const RELAXED_L: [Pt, Pt] = [[56, 160], [60, 188]];
const RELAXED_R: [Pt, Pt] = [[144, 160], [140, 188]];

const POSES: Record<WaiBotPose, PoseDef> = {
  wai: { l: [[58, 162], [95, 151]], r: [[142, 162], [105, 151]], face: "calm" },
  welcome: { l: RELAXED_L, r: [[160, 142], [180, 118]], face: "happy" },
  explore: { l: RELAXED_L, r: [[160, 124], [184, 104]], face: "look-right" },
  research: { l: [[58, 166], [80, 168]], r: [[142, 166], [120, 168]], face: "look-down" },
  loading: { l: RELAXED_L, r: RELAXED_R, face: "dots" },
  success: { l: [[46, 112], [40, 86]], r: [[154, 112], [160, 86]], face: "happy" },
  empty: { l: [[48, 154], [34, 142]], r: [[152, 154], [166, 142]], face: "curious", tilt: -7 },
  assistant: { l: RELAXED_L, r: [[158, 154], [152, 126]], face: "happy" }
};

const LABELS: Record<WaiBotPose, string> = {
  wai: "HumanoidTH robot greeting with a Thai wai",
  welcome: "HumanoidTH robot welcoming you",
  explore: "HumanoidTH robot pointing toward the atlas",
  research: "HumanoidTH robot reviewing data on a tablet",
  loading: "HumanoidTH robot synchronising",
  success: "HumanoidTH robot celebrating",
  empty: "HumanoidTH robot shrugging: nothing here yet",
  assistant: "HumanoidTH robot assistant with a headset"
};

function FaceArt({ face }: { face: Face }) {
  const eye = { fill: "none", stroke: "var(--wb-glow)", strokeWidth: 4.5, strokeLinecap: "round" as const };
  switch (face) {
    case "calm":
      return (
        <g {...eye}>
          <path d="M76 73q8 7 16 0M108 73q8 7 16 0" />
          <path d="M94 89q6 4 12 0" strokeWidth={3} />
        </g>
      );
    case "happy":
      return (
        <g {...eye}>
          <path d="M76 78q8-11 16 0M108 78q8-11 16 0" />
          <path d="M91 88q9 7 18 0" strokeWidth={3} />
        </g>
      );
    case "look-right":
    case "look-down": {
      const [dx, dy] = face === "look-right" ? [6, -1] : [0, 5];
      return (
        <g fill="var(--wb-glow)">
          <rect x={79 + dx} y={64 + dy} width={10} height={15} rx={5} />
          <rect x={111 + dx} y={64 + dy} width={10} height={15} rx={5} />
          <rect x={93 + dx} y={88 + dy} width={14} height={3} rx={1.5} />
        </g>
      );
    }
    case "dots":
      return (
        <g fill="var(--wb-glow)">
          <circle className="wb-dot" cx={86} cy={76} r={4.5} />
          <circle className="wb-dot" cx={100} cy={76} r={4.5} />
          <circle className="wb-dot" cx={114} cy={76} r={4.5} />
        </g>
      );
    case "curious":
      return (
        <g fill="var(--wb-glow)">
          <circle cx={84} cy={72} r={6} />
          <circle cx={116} cy={72} r={4.5} />
          <rect x={94} y={88} width={12} height={3} rx={1.5} />
        </g>
      );
  }
}

function Arm({ shoulder, elbow, hand, wai }: { shoulder: Pt; elbow: Pt; hand: Pt; wai: boolean }) {
  const d = `M${shoulder[0]} ${shoulder[1]}L${elbow[0]} ${elbow[1]}L${hand[0]} ${hand[1]}`;
  return (
    <g>
      <path d={d} fill="none" stroke="var(--wb-line)" strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="var(--wb-shell)" strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={elbow[0]} cy={elbow[1]} r={4.5} fill="var(--wb-panel)" />
      <circle cx={shoulder[0]} cy={shoulder[1]} r={10} fill="var(--wb-panel)" />
      {!wai && <circle cx={hand[0]} cy={hand[1]} r={7.5} fill="var(--wb-shell)" stroke="var(--wb-line)" strokeWidth={1.5} />}
    </g>
  );
}

type WaiBotProps = { pose?: WaiBotPose; size?: number; className?: string; title?: string; decorative?: boolean };

export default function WaiBot({ pose = "wai", size = 200, className, title, decorative = false }: WaiBotProps) {
  const def = POSES[pose];
  const wai = pose === "wai";
  const label = title ?? LABELS[pose];
  return (
    <svg
      className={`waibot waibot--${pose}${className ? ` ${className}` : ""}`}
      width={size}
      height={size * 1.2}
      viewBox="0 0 200 240"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
    >
      <ellipse cx={100} cy={233} rx={44} ry={5} fill="var(--wb-shadow)" />
      {/* Legs stay planted while the upper body bows. */}
      <g>
        <rect x={79} y={192} width={17} height={34} rx={7} fill="var(--wb-deep)" />
        <rect x={104} y={192} width={17} height={34} rx={7} fill="var(--wb-deep)" />
        <rect x={73} y={222} width={27} height={10} rx={5} fill="var(--wb-shell)" stroke="var(--wb-line)" strokeWidth={1.5} />
        <rect x={100} y={222} width={27} height={10} rx={5} fill="var(--wb-shell)" stroke="var(--wb-line)" strokeWidth={1.5} />
      </g>
      <g className="wb-upper" transform={def.tilt ? `rotate(${def.tilt} 100 190)` : undefined}>
        {pose === "assistant" && (
          <path d="M50 66Q100 2 150 66" fill="none" stroke="var(--wb-ink)" strokeWidth={4} strokeLinecap="round" />
        )}
        <g stroke="var(--wb-ink)" strokeWidth={3} strokeLinecap="round">
          <path d="M84 34 80 13M116 34l4-21" />
        </g>
        <circle className="wb-tip" cx={80} cy={12} r={4.2} fill="var(--wb-glow)" />
        <circle className="wb-tip wb-tip--b" cx={120} cy={12} r={4.2} fill="var(--wb-glow)" />
        <rect x={43} y={58} width={11} height={28} rx={5.5} fill="var(--wb-panel)" />
        <rect x={146} y={58} width={11} height={28} rx={5.5} fill="var(--wb-panel)" />
        <rect x={52} y={31} width={96} height={81} rx={18} fill="var(--wb-shell)" stroke="var(--wb-line)" strokeWidth={1.5} />
        <path d="M100 34.5l4.2 4.2-4.2 4.2-4.2-4.2z" fill="var(--wb-gold)" />
        <rect x={61} y={47} width={78} height={55} rx={12} fill="var(--wb-visor)" />
        <path d="M67 53h22" stroke="#fff" strokeOpacity={0.12} strokeWidth={3} strokeLinecap="round" />
        <FaceArt face={def.face} />
        {pose === "assistant" && (
          <g>
            <path d="M152 82q2 20-22 20" fill="none" stroke="var(--wb-ink)" strokeWidth={3} strokeLinecap="round" />
            <circle cx={128} cy={102} r={3.5} fill="var(--wb-glow)" />
          </g>
        )}
        <rect x={90} y={111} width={20} height={11} rx={3} fill="var(--wb-ink)" />
        <path d="M66 122Q100 114 134 122L130 184Q100 193 70 184Z" fill="var(--wb-shell)" stroke="var(--wb-line)" strokeWidth={1.5} />
        <path d="M80 128h40l-4 28-16 10-16-10z" fill="var(--wb-deep)" />
        <path d="M100 135l9 10-9 10-9-10z" fill="none" stroke="var(--wb-gold)" strokeWidth={1.6} />
        <circle className="wb-core" cx={100} cy={145} r={2.6} fill="var(--wb-glow)" />
        <rect x={75} y={182} width={50} height={13} rx={5} fill="var(--wb-panel)" />
        {pose === "research" && (
          <g>
            <rect x={72} y={146} width={56} height={32} rx={4} fill="var(--wb-visor)" stroke="var(--wb-gold)" strokeWidth={1.2} />
            <path d="M78 171l9-7 8 4 10-10 9 5 8-6" fill="none" stroke="var(--wb-glow)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M78 174h44" stroke="var(--wb-gold)" strokeOpacity={0.5} strokeWidth={1} />
          </g>
        )}
        <Arm shoulder={SHOULDER_L} elbow={def.l[0]} hand={def.l[1]} wai={wai} />
        <Arm shoulder={SHOULDER_R} elbow={def.r[0]} hand={def.r[1]} wai={wai} />
        {wai && (
          <g>
            <path d="M100 123c8.5 10 8.5 28 0 38-8.5-10-8.5-28 0-38z" fill="var(--wb-shell)" stroke="var(--wb-line)" strokeWidth={1.5} />
            <path d="M100 127v31" stroke="var(--wb-line)" strokeWidth={1.2} />
          </g>
        )}
        {pose === "explore" && <path d="M188 101l7-6" stroke="var(--wb-shell)" strokeWidth={5} strokeLinecap="round" />}
        {pose === "success" && (
          <g fill="var(--wb-glow)">
            <path d="M28 64l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
            <path d="M172 60l2.2 5 5 2.2-5 2.2-2.2 5-2.2-5-5-2.2 5-2.2z" />
          </g>
        )}
        {pose === "empty" && (
          <text x={160} y={44} fontSize={30} fontWeight={700} fill="var(--wb-gold)" fontFamily="var(--font-display)">?</text>
        )}
      </g>
    </svg>
  );
}
