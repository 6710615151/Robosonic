"use client";

// /living-lab: the front door, told as one story. A: the question and the robot that asks it (hero).
// B: your experiment in four stages. C: the robots you will meet. D: the research question and how it
// is answered. E: what is real right now. F: an invitation. Everything shown comes from this browser,
// the server or the robot profiles in lib/hri; there are no invented sessions, counts or live signals.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import { ArrowRight, Box, Bot, Check, CircleCheck, CircleDashed, CircleSlash, Database, IdCard, Minus, Plug, Sparkles, Unplug } from "lucide-react";
import { ROBOT_PROFILES } from "@/lib/hri/robot-profiles";
import type { StationTask } from "@/lib/hri/journey-stations";
import type { Lang } from "../copy";
import { labCopy } from "../lab-copy";
import { findOwnPassport, webglAvailable, type SimState } from "./lab-env";
import HeroRobot from "./HeroRobot";
import { overviewCopy } from "./overview-copy";

type Tone = "ok" | "off" | "neutral" | "pending";
type Icon = ComponentType<{ size?: number; "aria-hidden"?: boolean }>;

// Old links pointed at sections of the single long page; send them to the pages that now hold them.
const LEGACY_HASHES: Record<string, string> = {
  "#calibrate": "/living-lab/create",
  "#research": "/living-lab/research",
  "#robots": "/living-lab/robot",
  "#journey": "/living-lab/meet"
};

const TONE_ICONS: Record<Tone, Icon> = { ok: CircleCheck, off: CircleSlash, neutral: CircleDashed, pending: CircleDashed };

function StatusRow({ icon: ItemIcon, label, state, tone, body }: { icon: Icon; label: string; state: string; tone: Tone; body: string }) {
  const ToneIcon = TONE_ICONS[tone];
  return (
    <li className="llo-env-row">
      <span className="llo-env-icon" aria-hidden="true"><ItemIcon size={18} /></span>
      <div className="llo-env-text">
        <h3>{label}</h3>
        <p>{body}</p>
      </div>
      <span className={`llo-pill is-${tone}`}><ToneIcon size={14} aria-hidden={true} /> {state}</span>
    </li>
  );
}

export type JourneyRobot = { name: string; task: StationTask };

const STAGES = ["create", "experience", "compare", "discover"] as const;
const CAPS = ["mobile", "head", "arms", "speaker", "screen"] as const;

// Sections fade up once as they enter the viewport. Without JS, or with reduced motion, they simply show.
function useReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const items = Array.from(document.querySelectorAll<HTMLElement>(".llx-reveal"));
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -8% 0px" });
    for (const el of items) {
      if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add("is-pending"); io.observe(el); }
    }
    return () => io.disconnect();
  }, []);
}

export default function Overview({ lang, registryCount, dbOnline, aiConfigured, journeyRobots }: {
  lang: Lang;
  // Care robots in the Atlas registry, or null when the database could not be read.
  registryCount: number | null;
  dbOnline: boolean;
  aiConfigured: boolean;
  // Registry robots that play the hospital journey's stations (lib/hri/journey-stations.ts).
  journeyRobots: JourneyRobot[];
}) {
  const o = labCopy[lang].overview;
  const st = labCopy[lang].stages;
  const c = overviewCopy[lang];
  const tiers = labCopy[lang].tiers;
  const router = useRouter();
  const [ownToken, setOwnToken] = useState<string | null>(null);
  const [sim, setSim] = useState<SimState>("pending");
  useReveal();

  useEffect(() => {
    const target = LEGACY_HASHES[window.location.hash];
    if (target) {
      router.replace(target);
      return;
    }
    setOwnToken(findOwnPassport());
    setSim(webglAvailable() ? "ok" : "off");
  }, [router]);

  const s = o.status;
  const simTone: Tone = sim === "ok" ? "ok" : sim === "off" ? "off" : "pending";

  return (
    <main className="lab-page llx">
      {/* A — The question, asked by the robot itself. */}
      <section className="llx-hero" aria-labelledby="llx-title">
        <div className="llx-hero-text">
          <p className="llx-eyebrow">{c.hero.eyebrow}</p>
          <h1 id="llx-title">{c.hero.title}</h1>
          <p className="llx-lead">{c.hero.lead}</p>
          <p className="llx-body">{c.hero.body}</p>
          <div className="llx-actions">
            <Link className="llx-cta" href="/living-lab/create">{c.hero.cta} <ArrowRight size={18} aria-hidden="true" /></Link>
            <Link className="llx-ghost" href="/living-lab/robot">{c.hero.explore}</Link>
          </div>
          <p className="llx-note">{c.hero.ctaNote}</p>
          {!ownToken && <Link className="llx-have" href="/living-lab/meet">{c.hero.haveOne} <ArrowRight size={14} aria-hidden="true" /></Link>}
        </div>
        <HeroRobot label={c.hero.robotLabel} caption={c.hero.robotCaption} greet={c.hero.greet} fallbackCaption={c.hero.fallbackCaption} />
      </section>

      {ownToken && (
        <section className="llx-resume" aria-labelledby="llx-resume-title" data-testid="overview-resume">
          <IdCard size={22} aria-hidden="true" />
          <div>
            <h2 id="llx-resume-title">{c.resume.title}</h2>
            <p>{c.resume.body}</p>
          </div>
          <Link className="llx-cta is-small" href={`/living-lab/passport/${ownToken}`}>{c.resume.open} <ArrowRight size={16} aria-hidden="true" /></Link>
        </section>
      )}

      {/* B — Your experiment: four stages that build on each other. */}
      <section className="llx-section llx-reveal" aria-labelledby="llx-exp-title">
        <header className="llx-head">
          <p className="llx-kicker">{c.experiment.eyebrow}</p>
          <h2 id="llx-exp-title">{c.experiment.title}</h2>
          <p>{c.experiment.lead}</p>
        </header>
        <ol className="llx-stages">
          {STAGES.map((key) => {
            const stage = st[key];
            const done = key === "create" && ownToken !== null;
            return (
              <li key={key} className={done ? "is-done" : undefined}>
                <span className="llx-num" aria-hidden="true">{stage.num}</span>
                <p className="llx-stage-name">{stage.name}{done && <span className="llx-done"><Check size={13} aria-hidden="true" /> {c.experiment.done}</span>}</p>
                <h3>{stage.title}</h3>
                <p>{stage.where}</p>
                <p className="llx-time">{stage.time}</p>
                <Link className="llx-link" href={stage.href}>{stage.cta} <ArrowRight size={15} aria-hidden="true" /></Link>
              </li>
            );
          })}
        </ol>
      </section>

      {/* C — The robots: identities from their real hardware profiles, nothing invented. */}
      <section className="llx-section llx-reveal" aria-labelledby="llx-robots-title">
        <header className="llx-head">
          <p className="llx-kicker">{c.robots.eyebrow}</p>
          <h2 id="llx-robots-title">{c.robots.title}</h2>
          <p>{c.robots.lead}</p>
        </header>
        <div className="llx-robots">
          {ROBOT_PROFILES.map((robot, i) => (
            <article key={robot.id} className={`llx-bot is-${i === 0 ? "a" : "b"}`}>
              <div className="llx-bot-head">
                <span className="llx-bot-letter" aria-hidden="true">{i === 0 ? "A" : "B"}</span>
                <span className="llx-sim">{c.robots.simulated}</span>
              </div>
              <h3>{robot.name[lang]}</h3>
              <p>{robot.short[lang]}</p>
              <ul className="llx-caps" aria-label={c.robots.hardware}>
                {CAPS.map((cap) => {
                  const has = robot.capabilities[cap];
                  return (
                    <li key={cap} className={has ? "has" : "lacks"}>
                      {has ? <Check size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />}
                      <span>{c.robots.caps[cap]}</span>
                      <span className="visually-hidden">: {has ? c.robots.yes : c.robots.no}</span>
                    </li>
                  );
                })}
              </ul>
              {robot.capabilities.mobile && <p className="llx-time">{c.robots.maxSpeed(robot.capabilities.maxSpeedMultiplier)}</p>}
            </article>
          ))}
        </div>
        {journeyRobots.length > 0 && (
          <div className="llx-registry">
            <div>
              <h3>{c.robots.journeyTitle}</h3>
              <p>{c.robots.journeyLead}</p>
            </div>
            <ol>
              {journeyRobots.map((r, i) => (
                <li key={r.name}><span className="llx-num-sm" aria-hidden="true">S{i + 1}</span><span><b>{c.robots.stations[r.task]}</b>{r.name}</span></li>
              ))}
            </ol>
          </div>
        )}
        <Link className="llx-link" href="/living-lab/robot">{c.robots.enter} <ArrowRight size={15} aria-hidden="true" /></Link>
      </section>

      {/* D — The research story: the question, and how it is answered fairly. */}
      <section className="llx-story llx-reveal" aria-labelledby="llx-story-title">
        <div className="llx-story-q">
          <p className="llx-kicker">{c.story.eyebrow}</p>
          <h2 id="llx-story-title">{c.story.question}</h2>
          <p>{c.story.body}</p>
          <p className="llx-measured">{c.story.measured}</p>
        </div>
        <div className="llx-story-how">
          <h3>{o.research.methodTitle}</h3>
          <dl>
            {o.research.method.map(([term, detail]) => (
              <div key={term}><dt>{term}</dt><dd>{detail}</dd></div>
            ))}
          </dl>
          <p className="llx-note">{o.research.disclaimer}</p>
          <Link className="llx-link is-light" href="/living-lab/research">{c.story.action} <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
      </section>

      {/* E — What is real right now. Each row reads something the browser or server actually knows. */}
      <section className="llx-section llx-env llx-reveal" aria-labelledby="llo-env-title" data-testid="overview-status">
        <header className="llx-head">
          <p className="llx-kicker">{s.eyebrow}</p>
          <h2 id="llo-env-title">{s.title}</h2>
          <p>{s.lead}</p>
        </header>
        <ul className="llo-env-list">
          <StatusRow icon={Box} label={s.sim.label} state={s.states[sim]} tone={simTone} body={s.sim[sim]} />
          <StatusRow icon={Bot} label={s.robots.label} state={tiers.sim} tone="neutral" body={s.robots.body(registryCount)} />
          <StatusRow icon={Unplug} label={s.hardware.label} state={s.states.none} tone="neutral" body={s.hardware.body} />
          <StatusRow icon={Plug} label={s.api.label} state={dbOnline ? s.states.live : s.states.off} tone={dbOnline ? "ok" : "off"} body={s.api.body} />
          <StatusRow icon={Database} label={s.data.label} state={dbOnline ? s.states.ok : s.states.off} tone={dbOnline ? "ok" : "off"} body={dbOnline ? s.data.ok : s.data.off} />
          <StatusRow icon={Sparkles} label={s.ai.label} state={aiConfigured ? s.states.configured : s.states.notConfigured} tone={aiConfigured ? "ok" : "off"} body={aiConfigured ? s.ai.ok : s.ai.off} />
        </ul>
      </section>

      {/* F — The invitation. */}
      <section className="llx-final llx-reveal" aria-labelledby="llx-final-title">
        <h2 id="llx-final-title">{c.final.title}</h2>
        <p>{c.final.body}</p>
        <Link className="llx-cta is-light" href="/living-lab/create">{c.final.cta} <ArrowRight size={18} aria-hidden="true" /></Link>
      </section>
    </main>
  );
}
