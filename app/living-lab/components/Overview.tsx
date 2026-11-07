"use client";

// /living-lab: the front door. It answers three questions in order: what is this (hero), what can I do
// and how do the parts connect (how it works), and what is real right now (lab environment). A short
// research introduction closes it. Everything shown comes from this browser or the server; there are
// no invented sessions, counts or progress.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import { ArrowRight, Box, Bot, ChartColumn, CircleCheck, CircleDashed, CircleSlash, Database, Hospital, IdCard, Plug, Sparkles, Unplug, UserPlus } from "lucide-react";
import WaiBot from "@/app/components/brand/WaiBot";
import type { Lang } from "../copy";
import { labCopy } from "../lab-copy";
import { findOwnPassport, webglAvailable, type SimState } from "./lab-env";

type Tone = "ok" | "off" | "neutral" | "pending";
type Icon = ComponentType<{ size?: number; "aria-hidden"?: boolean }>;

// Old links pointed at sections of the single long page; send them to the pages that now hold them.
const LEGACY_HASHES: Record<string, string> = {
  "#calibrate": "/living-lab/create",
  "#research": "/living-lab/research",
  "#robots": "/living-lab/robot",
  "#journey": "/living-lab/meet"
};

const STEP_ICONS: Record<string, Icon> = { passport: UserPlus, robot: Bot, journey: Hospital, research: ChartColumn };
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

export default function Overview({ lang, registryCount, dbOnline, aiConfigured }: {
  lang: Lang;
  // Care robots in the Atlas registry, or null when the database could not be read.
  registryCount: number | null;
  dbOnline: boolean;
  aiConfigured: boolean;
}) {
  const o = labCopy[lang].overview;
  const tiers = labCopy[lang].tiers;
  const router = useRouter();
  const [ownToken, setOwnToken] = useState<string | null>(null);
  const [sim, setSim] = useState<SimState>("pending");

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
    <main className="lab-page llo">
      <section className="llo-hero" aria-labelledby="llo-title">
        <div className="llo-hero-text">
          <p className="lab-eyebrow">{o.hero.eyebrow}</p>
          <h1 id="llo-title">{o.hero.title}</h1>
          <p className="llo-lead">{o.hero.lead}</p>
          <div className="llo-actions">
            <Link className="lab-cta llo-cta" href="/living-lab/create">
              {o.hero.cta} <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="lab-btn-quiet llo-secondary" href="/living-lab/robot">
              <Bot size={18} aria-hidden="true" /> {o.hero.explore}
            </Link>
          </div>
          <p className="lab-note">{o.hero.ctaNote}</p>
          <Link className="lab-link llo-have" href="/living-lab/meet">{o.hero.haveOne}</Link>
        </div>

        <figure className="llo-figure" aria-label={o.hero.figureLabel}>
          <div className="llo-arch">
            <WaiBot pose="wai" size={250} className="llo-bot" title={o.hero.figureLabel} />
          </div>
          <div className="llo-sample">
            <span className="llo-sample-kicker">{o.hero.sampleKicker}</span>
            <strong>Care Passport</strong>
            <dl>
              {o.hero.sample.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          </div>
          <figcaption className="lab-note">{o.hero.figureCaption}</figcaption>
        </figure>
      </section>

      {ownToken && (
        <section className="llo-resume" aria-labelledby="llo-resume-title" data-testid="overview-resume">
          <span className="llo-resume-icon" aria-hidden="true"><IdCard size={22} /></span>
          <div>
            <p className="lab-eyebrow">{o.resume.eyebrow}</p>
            <h2 id="llo-resume-title">{o.resume.title}</h2>
            <p>{o.resume.body}</p>
          </div>
          <Link className="lab-cta" href={`/living-lab/passport/${ownToken}`}>
            {o.resume.open} <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>
      )}

      <section className="llo-section" aria-labelledby="llo-how-title">
        <header className="llo-head">
          <p className="lab-eyebrow">{o.how.eyebrow}</p>
          <h2 id="llo-how-title">{o.how.title}</h2>
          <p className="llo-lead">{o.how.lead}</p>
        </header>
        <ol className="llo-path">
          {o.how.steps.map((step, i) => {
            const StepIcon = STEP_ICONS[step.key];
            return (
              <li key={step.key} className={`llo-step is-${step.key}`}>
                <div className="llo-step-node" aria-hidden="true">
                  <span className="llo-step-num">{i + 1}</span>
                  <StepIcon size={18} />
                </div>
                <div className="llo-step-body">
                  <p className="llo-step-meta">{step.meta}</p>
                  <h3>{step.title}</h3>
                  <p className="llo-for">
                    <span className="visually-hidden">{o.how.forLabel}: </span>
                    {step.for.map((who) => (
                      <span key={who} className="llo-tag">{o.how.audiences[who as keyof typeof o.how.audiences]}</span>
                    ))}
                  </p>
                  <p>{step.body}</p>
                  <p className="lab-note">{step.note}</p>
                  <Link className="lab-link" href={step.href}>{step.action} <ArrowRight size={16} aria-hidden="true" /></Link>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="llo-section llo-env" aria-labelledby="llo-env-title" data-testid="overview-status">
        <header className="llo-head">
          <p className="lab-eyebrow">{s.eyebrow}</p>
          <h2 id="llo-env-title">{s.title}</h2>
          <p className="lab-note">{s.lead}</p>
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

      <section className="llo-section llo-why" aria-labelledby="llo-why-title">
        <div className="llo-why-text">
          <p className="lab-eyebrow">{o.research.eyebrow}</p>
          <h2 id="llo-why-title">{o.research.title}</h2>
          {o.research.body.map((para) => <p key={para}>{para}</p>)}
          <p className="lab-note">{o.research.disclaimer}</p>
          <Link className="lab-link" href="/living-lab/research">{o.research.action} <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <div className="llo-method">
          <h3>{o.research.methodTitle}</h3>
          <dl>
            {o.research.method.map(([term, detail]) => (
              <div key={term}><dt>{term}</dt><dd>{detail}</dd></div>
            ))}
          </dl>
        </div>
      </section>
    </main>
  );
}
