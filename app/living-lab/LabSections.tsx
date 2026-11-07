"use client";

// Landing sections of /living-lab, arranged around the visitor's journey: hero → create a passport →
// robots → hospital journey → research. The calibration itself stays in LivingLabClient.
import Link from "next/link";
import { ArrowRight, Check, Download, Minus } from "lucide-react";
import { describeDistance } from "@/lib/hri/passport";
import { MIN_CARE_CELL, OBSERVATORY_WINDOWS, observatoryCsv, type Comparison, type Mean, type ObservatoryStats, type Share } from "@/lib/hri/observatory";
import { ROBOT_PROFILES } from "@/lib/hri/robot-profiles";
import type { Lang } from "./copy";
import { labCopy } from "./lab-copy";

export type LabRobotEntry = { id: string; name: string; type: string; org: string | null; inJourney: boolean };

const fmt = (value: number | null, digits = 1) => (value === null ? "–" : value.toFixed(digits));
const pct = (value: number | null) => (value === null ? "–" : `${Math.round(value * 100)}%`);

export function SectionHead({ id, eyebrow, title, lead }: { id: string; eyebrow: string; title: string; lead?: string }) {
  return (
    <header className="lab-shead">
      <p className="lab-eyebrow">{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      {lead && <p className="lab-lead">{lead}</p>}
    </header>
  );
}

// The few big stages of a guided flow, shown across the top so people always know where they are.
// Used by passport creation; each stage is a word and a number, never colour alone.
export function CreationStages({ label, stages, current }: { label: string; stages: readonly string[]; current: number }) {
  return (
    <ol className="lab-stages" aria-label={label}>
      {stages.map((stage, i) => (
        <li key={stage} className={i < current ? "done" : i === current ? "current" : ""} aria-current={i === current ? "step" : undefined}>
          <span className="lab-stages-dot" aria-hidden="true">{i < current ? <Check size={13} /> : i + 1}</span>
          <span className="lab-stages-label">{stage}</span>
        </li>
      ))}
    </ol>
  );
}

// Progress through the calibration. Phases come from LivingLabClient's state machine, unchanged.
const MANUAL_STEPS = ["greet", "approach", "care", "gaze", "voice", "confirm", "done"] as const;
const AUTO_STEPS = ["auto", "review", "done"] as const;

export function CalibrationProgress({ lang, phase, auto }: { lang: Lang; phase: string; auto: boolean }) {
  const t = labCopy[lang].calibrate;
  if (phase === "intro") return null;
  const steps: readonly string[] = auto ? AUTO_STEPS : MANUAL_STEPS;
  const at = phase === "saving" ? steps.indexOf(auto ? "review" : "confirm") : steps.indexOf(phase);
  const current = Math.max(0, at);
  return (
    <div className="lab-progress">
      <p className="lab-progress-count" aria-live="polite">{t.stepOf(current + 1, steps.length)} · {t.steps[steps[current] as keyof typeof t.steps]}</p>
      <ol aria-label={t.progressLabel}>
        {steps.map((step, i) => (
          <li key={step} className={i < current ? "done" : i === current ? "current" : ""} aria-current={i === current ? "step" : undefined}>
            <span className="lab-progress-dot" aria-hidden="true">{i < current ? <Check size={11} /> : null}</span>
            <span className="lab-progress-label">{t.steps[step as keyof typeof t.steps]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// compact: the Robot Lab already shows each robot's hardware on its own card, so only the adaptation
// priority and the registry remain.
export function RobotEcosystem({ lang, robots, compact = false }: { lang: Lang; robots: LabRobotEntry[]; compact?: boolean }) {
  const t = labCopy[lang].robots;
  const tiers = labCopy[lang].tiers;
  const caps = ["mobile", "head", "arms", "speaker", "screen"] as const;
  return (
    <section className="lab-section" aria-labelledby="robots">
      <SectionHead id="robots" eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <div className={compact ? "lab-eco is-compact" : "lab-eco"}>
        {!compact && ROBOT_PROFILES.map((robot) => (
          <article key={robot.id} className="lab-robot">
            <div className="lab-robot-head">
              <h3>{robot.name[lang]}</h3>
              <span className="lab-tier sim">{tiers.sim}</span>
            </div>
            <p className="lab-note">{robot.short[lang]}</p>
            <dl className="lab-caps">
              {caps.map((cap) => {
                const has = robot.capabilities[cap];
                return (
                  <div key={cap} className={has ? "has" : "lacks"}>
                    <dt>{t.capabilities[cap]}</dt>
                    <dd>{has ? <Check size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />} {has ? t.yes : t.no}</dd>
                  </div>
                );
              })}
              <div className="has">
                <dt>{t.capabilities.maxSpeed}</dt>
                <dd className="lab-mono">{robot.capabilities.mobile ? `×${robot.capabilities.maxSpeedMultiplier}` : "—"}</dd>
              </div>
            </dl>
          </article>
        ))}
        <aside className="lab-priority" aria-labelledby="lab-priority-title">
          <h3 id="lab-priority-title">{t.priorityTitle}</h3>
          <ol>{t.priority.map((item) => <li key={item}>{item}</li>)}</ol>
          <p className="lab-note">{t.priorityNote}</p>
          {!compact && <Link className="lab-link" href="/living-lab/robot">{t.open} <ArrowRight size={16} aria-hidden="true" /></Link>}
        </aside>
      </div>

      {robots.length > 0 && (
        <div className="lab-registry">
          <h3>{t.registryTitle}</h3>
          <p className="lab-note">{t.registrySub}</p>
          <p className="lab-note">{t.registryJourney} <Link className="lab-link" href="/living-lab/meet">{t.startJourney} <ArrowRight size={16} aria-hidden="true" /></Link></p>
          <ul>
            {/* Journey robots first: they are the ones you can meet with a passport. */}
            {[...robots].sort((x, y) => Number(y.inJourney) - Number(x.inJourney)).slice(0, 12).map((r) => (
              <li key={r.id} data-in-journey={r.inJourney ? "yes" : "no"}>
                <div>
                  <strong>{r.name}</strong>
                  <span>{r.type.replace(/_/g, " ")}{r.org ? ` · ${r.org}` : ""}</span>
                </div>
                <span className={r.inJourney ? "lab-tier api" : "lab-tier future"}>{r.inJourney ? t.inJourney : t.notInJourney}</span>
                {r.inJourney
                  ? <Link href={`/living-lab/meet?robot=${r.id}`} aria-label={`${t.meet}: ${r.name}`}>{t.meet}</Link>
                  : <span className="lab-registry-ref">{t.reference}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// showAction=false when the page already offers its own way in (the code form on /living-lab/meet).
export function JourneyOverview({ lang, passportCode, showAction = true }: { lang: Lang; passportCode: string | null; showAction?: boolean }) {
  const t = labCopy[lang].journey;
  return (
    <section className="lab-section" aria-labelledby="journey">
      <SectionHead id="journey" eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <ol className="lab-stations">
        {t.stations.map((station, i) => (
          <li key={station.key}>
            <span className="lab-mono lab-station-no">S{i + 1}</span>
            <h3>{station.title}</h3>
            <p>{station.body}</p>
          </li>
        ))}
      </ol>
      <div className="lab-protocol">
        <ol>{t.protocol.map((step, i) => <li key={step}><span className="lab-mono">{i + 1}</span> {step}</li>)}</ol>
        <p className="lab-note">{t.protocolNote}</p>
      </div>
      {showAction && <div className="lab-hero-actions">
        <Link className="lab-cta" href={passportCode ? `/living-lab/meet/${passportCode}` : "/living-lab/meet"}>
          {passportCode ? t.startWithCode(passportCode) : t.start} <ArrowRight size={18} aria-hidden="true" />
        </Link>
        {!passportCode && <span className="lab-note">{t.needPassport}</span>}
      </div>}
    </section>
  );
}

// ---------------- Research Observatory ----------------

function MeanBar({ label, value, kind, n, lang }: { label: string; value: Mean; kind: "passport" | "default"; n: string; lang: Lang }) {
  const r = labCopy[lang].research;
  const width = value.mean === null ? 0 : (value.mean / 5) * 100;
  const small = value.n > 0 && value.n < MIN_CARE_CELL;
  const text = value.n === 0 ? `${label}: ${r.noRatings}` : `${label}: ${fmt(value.mean)} / 5, ${n}${small ? `, ${r.smallSample(MIN_CARE_CELL)}` : ""}`;
  return (
    <div className="lab-bar-row" tabIndex={0} aria-label={text} data-tip={text}>
      <span className="lab-bar-label">{label}</span>
      {value.n === 0 ? (
        <span className="lab-bar-empty">{r.noRatings}</span>
      ) : (
        <span className="lab-bar-track"><span className={`lab-bar is-${kind}`} style={{ width: `${width}%` }} /></span>
      )}
      <span className="lab-bar-value"><strong>{fmt(value.mean)}</strong> <small>{n}</small>{small && <em className="lab-small" title={r.smallSample(MIN_CARE_CELL)}>{r.smallShort(MIN_CARE_CELL)}</em>}</span>
    </div>
  );
}

function ComparisonGroup({ title, comparison, lang }: { title?: string; comparison: Comparison; lang: Lang }) {
  const r = labCopy[lang].research;
  return (
    <div className="lab-compare">
      {title && <h4>{title}</h4>}
      <MeanBar label={r.passport} value={comparison.passport} kind="passport" n={r.n(comparison.passport.n)} lang={lang} />
      <MeanBar label={r.default} value={comparison.default} kind="default" n={r.n(comparison.default.n)} lang={lang} />
    </div>
  );
}

function ShareBar({ label, value, lang }: { label: string; value: Share; lang: Lang }) {
  const r = labCopy[lang].research;
  const shown = value.suppressed ? r.suppressed(MIN_CARE_CELL) : pct(value.share);
  const text = `${label}: ${shown}`;
  return (
    <div className="lab-bar-row" tabIndex={0} aria-label={text} data-tip={text}>
      <span className="lab-bar-label">{label}</span>
      <span className="lab-bar-track"><span className="lab-bar is-share" style={{ width: `${(value.share ?? 0) * 100}%` }} /></span>
      <span className="lab-bar-value"><strong>{shown}</strong></span>
    </div>
  );
}

function download(stats: ObservatoryStats) {
  const blob = new Blob([observatoryCsv(stats)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hri-living-lab-aggregates-${stats.window}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ResearchObservatory({ lang, stats }: { lang: Lang; stats: ObservatoryStats | null }) {
  const r = labCopy[lang].research;
  const range = stats?.window ?? "all";
  return (
    <section className="lab-section" aria-labelledby="research">
      <SectionHead id="research" eyebrow={r.eyebrow} title={r.title} lead={r.lead} />
      <p className="lab-provenance" role="note"><span className="lab-tier sim">{labCopy[lang].tiers.sim}</span> {r.provenance}</p>

      <div className="lab-filters">
        <div role="group" aria-label={r.window} className="lab-seg">
          <span className="lab-filter-label">{r.window}</span>
          {OBSERVATORY_WINDOWS.map((w) => (
            <Link key={w} href={w === "all" ? "/living-lab/research" : `/living-lab/research?window=${w}`} scroll={false} aria-current={w === range ? "true" : undefined} className={w === range ? "is-on" : ""}>
              {r.windows[w]}
            </Link>
          ))}
        </div>
        {stats && (
          <button type="button" className="lab-btn-quiet" onClick={() => download(stats)}><Download size={16} aria-hidden="true" /> {r.export}</button>
        )}
      </div>

      {!stats ? (
        <p className="ll-error">{r.offline}</p>
      ) : (
        <>
        <section className="lab-glance" aria-labelledby="glance-title">
          <h3 id="glance-title">{r.glanceTitle}</h3>
          <dl>
            <div><dt>{r.glance.passports}</dt><dd>{stats.preferences.passports}</dd></div>
            <div><dt>{r.glance.participants}</dt><dd>{stats.quality.linkedParticipants}</dd></div>
            <div><dt>{r.glance.ratings}</dt><dd>{stats.quality.stationSessions}</dd></div>
            <div><dt>{r.glance.pairs}</dt><dd>{stats.paired.n}</dd></div>
          </dl>
        </section>
        <div className="lab-obs">
          <article className="lab-panel lab-span-2">
            <p className="lab-q-kicker">{r.comfortTitle}</p>
            <h3>{r.questions.comfort}</h3>
            <p className="lab-note">{r.comfortSub}</p>
            <div className="lab-legend" aria-hidden="true">
              <span><i className="is-passport" /> {r.passport}</span>
              <span><i className="is-default" /> {r.default}</span>
            </div>
            <ComparisonGroup comparison={stats.comfort} lang={lang} />
            <div className="lab-paired">
              <strong className="lab-paired-value">{stats.paired.meanDifference === null ? "–" : `${stats.paired.meanDifference > 0 ? "+" : ""}${stats.paired.meanDifference.toFixed(2)}`}</strong>
              <div>
                <span>{r.paired}</span>
                <span className="lab-note">{stats.paired.n ? r.pairedSub(stats.paired.n) : r.pairedNone}</span>
                {stats.paired.n > 0 && stats.paired.n < MIN_CARE_CELL && <span className="lab-small">{r.pairedSmall(MIN_CARE_CELL)}</span>}
              </div>
            </div>
            {(stats.byStation.length > 0 || stats.byRobot.length > 0) && <h4 className="lab-q-sub">{r.questions.where}</h4>}
            {stats.byStation.length > 0 && (
              <>
                <h4 className="lab-subhead">{r.byStation}</h4>
                <div className="lab-groups">
                  {stats.byStation.map((s) => <ComparisonGroup key={s.task} title={r.stationNames[s.task] ?? s.task} comparison={s} lang={lang} />)}
                </div>
              </>
            )}
            {stats.byRobot.length > 0 && (
              <>
                <h4 className="lab-subhead">{r.byRobot}</h4>
                <div className="lab-groups">
                  {stats.byRobot.map((s) => <ComparisonGroup key={s.robot} title={s.robot} comparison={s} lang={lang} />)}
                </div>
              </>
            )}
            <p className="lab-note lab-order">{r.orderTitle}: {r.orderBody(stats.order.passportFirst, stats.order.defaultFirst, stats.order.unknown)}</p>
          </article>

          <article className="lab-panel">
            <p className="lab-q-kicker">{r.prefsTitle}</p>
            <h3>{r.questions.prefs}</h3>
            <p className="lab-note">{r.prefsSub(stats.preferences.passports)}</p>
            {stats.preferences.passports === 0 ? <p className="lab-note">{r.empty}</p> : (
              <>
                {(Object.keys(r.prefs) as (keyof typeof r.prefs)[]).map((key) => (
                  <ShareBar key={key} label={r.prefs[key]} value={stats.preferences[key]} lang={lang} />
                ))}
                <dl className="lab-kv">
                  <div><dt>{r.avgDistance}</dt><dd>{stats.preferences.avgDistance === null ? "–" : r.distance[describeDistance(stats.preferences.avgDistance).en]}</dd></div>
                  <div><dt>{r.greetingTitle}</dt><dd>{(["wai", "wave", "none"] as const).map((g) => `${r.greetings[g]} ${stats.preferences.greeting[g]}`).join(" · ")}</dd></div>
                </dl>
              </>
            )}
          </article>

          <article className="lab-panel">
            <p className="lab-q-kicker">{r.calibrationTitle}</p>
            <h3>{r.questions.calibration}</h3>
            <p className="lab-note">{r.calibrationSub(stats.calibration.sessions)}</p>
            {(Object.keys(stats.calibration.inputModes) as (keyof typeof stats.calibration.inputModes)[]).map((mode) => (
              <ShareBar
                key={mode}
                label={`${r.inputModes[mode]} (${stats.calibration.inputModes[mode]})`}
                value={{ share: stats.calibration.sessions ? stats.calibration.inputModes[mode] / stats.calibration.sessions : null, n: stats.calibration.sessions }}
                lang={lang}
              />
            ))}
            <p className="lab-note">{r.tooClose(stats.calibration.tooClose)}</p>
          </article>

          <article className="lab-panel">
            <p className="lab-q-kicker">{r.qualityTitle}</p>
            <h3>{r.questions.quality}</h3>
            <dl className="lab-kv">
              <div><dt>{r.quality.participants}</dt><dd className="lab-mono">{stats.quality.linkedParticipants}</dd></div>
              <div><dt>{r.quality.unlinked}</dt><dd className="lab-mono">{stats.quality.unlinkedPassports}</dd></div>
              <div><dt>{r.quality.stations}</dt><dd className="lab-mono">{stats.quality.stationSessions}</dd></div>
              <div><dt>{r.quality.missing}</dt><dd className="lab-mono">{stats.quality.missingRatings}</dd></div>
            </dl>
          </article>

          <article className="lab-panel">
            <h3>{r.limitsTitle}</h3>
            <ul className="lab-limits">{r.limits.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>

          <article className="lab-panel lab-span-2 lab-privacy" data-testid="research-privacy">
            <h3>{r.privacyTitle}</h3>
            <ul className="lab-limits">{r.privacy(MIN_CARE_CELL).map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        </div>
        </>
      )}
    </section>
  );
}
