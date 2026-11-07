"use client";

// Shared frame for every /living-lab route: where you can go (tabs) and, one tap away, what is real
// right now (status). Status shows only things this browser or server actually knows:
// WebGL support, that no physical robot is connected, and whether a Gemini key is configured.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { Activity, ArrowRight, Bot, Box, ChartColumn, Compass, HeartHandshake, Hospital, IdCard, Sparkles, Unplug, UserPlus } from "lucide-react";
import type { Lang } from "../copy";
import { labCopy } from "../lab-copy";
import { findOwnPassport, webglAvailable, type SimState } from "./lab-env";

type StageKey = "create" | "experience" | "compare" | "discover";
type NavItem = { key: "overview" | "mine" | StageKey; href: string; icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>; active: boolean; num?: string; label: string };

const STAGE_ORDER: StageKey[] = ["create", "experience", "compare", "discover"];

export default function LabShell({ lang, aiConfigured }: { lang: Lang; aiConfigured: boolean }) {
  const t = labCopy[lang].shell;
  const st = labCopy[lang].stages;
  const pathname = usePathname() ?? "/living-lab";
  const [ownToken, setOwnToken] = useState<string | null>(null);
  const [sim, setSim] = useState<SimState>("pending");
  const tabsRef = useRef<HTMLUListElement>(null);
  useEffect(() => { setSim(webglAvailable() ? "ok" : "off"); }, []);
  // Re-check on every route change: a passport saved or deleted on the previous page shows up here.
  useEffect(() => { setOwnToken(findOwnPassport()); }, [pathname]);
  // On narrow screens the tab row scrolls sideways: keep the current tab in view (no vertical jump).
  useEffect(() => {
    const list = tabsRef.current;
    const current = list?.querySelector<HTMLElement>("[aria-current=\"page\"]");
    if (list && current) list.scrollLeft = Math.max(0, current.offsetLeft - (list.clientWidth - current.offsetWidth) / 2);
  }, [pathname, ownToken]);

  const statusRef = useRef<HTMLDivElement>(null);
  const [statusOpen, setStatusOpen] = useState(false);

  // The status panel closes on navigation, Escape, or a click elsewhere, like any menu.
  useEffect(() => { setStatusOpen(false); }, [pathname]);
  useEffect(() => {
    if (!statusOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setStatusOpen(false);
      statusRef.current?.querySelector("button")?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (!statusRef.current?.contains(event.target as Node)) setStatusOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [statusOpen]);

  const under = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  // The four stages of one experiment, in order. Routes are unchanged; only how they are presented.
  const items: NavItem[] = [
    { key: "overview", href: "/living-lab", icon: Compass, active: pathname === "/living-lab", label: st.home },
    { key: "create", href: "/living-lab/create", icon: UserPlus, active: under("/living-lab/create"), num: st.create.num, label: st.create.name },
    { key: "experience", href: "/living-lab/robot", icon: Bot, active: under("/living-lab/robot"), num: st.experience.num, label: st.experience.name },
    { key: "compare", href: "/living-lab/meet", icon: Hospital, active: under("/living-lab/meet"), num: st.compare.num, label: st.compare.name },
    { key: "discover", href: "/living-lab/research", icon: ChartColumn, active: under("/living-lab/research"), num: st.discover.num, label: st.discover.name },
    ...(ownToken ? [{ key: "mine" as const, href: `/living-lab/passport/${ownToken}`, icon: IdCard, active: under("/living-lab/passport"), label: t.nav.mine }] : [])
  ];
  // Where am I, what is this, what next: one line under the bar on every stage page.
  const activeStage = items.find((i) => i.active && i.num)?.key as StageKey | undefined;
  const current: StageKey | "passport" | null = under("/living-lab/passport") ? "passport" : activeStage ?? null;
  const index = current === "passport" ? 0 : current ? STAGE_ORDER.indexOf(current) : -1;
  const nextKey: StageKey | null = current === "passport" ? "experience" : index >= 0 && index < 3 ? STAGE_ORDER[index + 1] : null;

  const limited = [sim === "off", true, !aiConfigured].filter(Boolean).length;

  // One bar: the lab's own tabs, plus a compact status disclosure at the end. The site header already
  // carries the brand, so the lab adds no second header; status stays one tap away instead of taking
  // a row of chips on every page.
  return (
    <>
    <nav className="lab-tabs" aria-label={t.navLabel}>
      <span className="lab-tabs-brand" aria-hidden="true">
        <span className="lab-shell-mark"><HeartHandshake size={16} /></span>
        {t.name}
      </span>
      <ul ref={tabsRef}>
        {items.map(({ key, href, icon: Icon, active, num, label }) => (
          <li key={key}>
            <Link href={href} aria-current={active ? "page" : undefined} className={key === "mine" ? "is-mine" : key === "overview" ? "is-home" : undefined}>
              {num ? <span className="lab-tab-num" aria-hidden="true">{num}</span> : <Icon size={16} aria-hidden={true} />}
              <span className={key === "overview" ? "lab-tab-home" : undefined}>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="lab-status-menu" ref={statusRef}>
        <button
          type="button"
          aria-expanded={statusOpen}
          aria-controls="lab-status-panel"
          onClick={() => setStatusOpen((open) => !open)}
          data-testid="lab-status-toggle"
        >
          <Activity size={16} aria-hidden={true} />
          <span className="lab-status-summary">{t.statusLabel}</span>
          <span className="visually-hidden">{t.statusHint(limited)}</span>
          <span className="lab-status-count" aria-hidden="true">{limited}</span>
        </button>
        {/* Always in the DOM (screen readers and tests read it); shown only when open. */}
        <div className="lab-status-pop" id="lab-status-panel" hidden={!statusOpen}>
          <p className="lab-status-title">{t.statusLabel}</p>
          <ul className="lab-status" aria-label={t.statusLabel} data-testid="lab-status">
            <li data-state={sim} data-testid="lab-status-sim">
              <Box size={14} aria-hidden={true} />
              <b>{t.sim.label}: <span>{t.sim[sim]}</span></b>
            </li>
            <li data-state="off" data-testid="lab-status-hardware">
              <Unplug size={14} aria-hidden={true} />
              <b>{t.hardware.label}: <span>{t.hardware.off}</span></b>
            </li>
            <li data-state={aiConfigured ? "ok" : "off"} data-testid="lab-status-ai">
              <Sparkles size={14} aria-hidden={true} />
              <b>{t.ai.label}: <span>{aiConfigured ? t.ai.ok : t.ai.off}</span></b>
            </li>
          </ul>
        </div>
      </div>
    </nav>
    {current && (
      <div className="lab-where" data-testid="lab-where">
        <p>
          {current === "passport" ? (
            <span className="lab-where-text">{st.passport.where}</span>
          ) : (
            <>
              <span className="lab-where-stage">{st.stageOf(index + 1)} · {st[current].name}</span>
              <span className="lab-where-text">{st[current].where}</span>
            </>
          )}
        </p>
        {nextKey && (
          <Link className="lab-where-next" href={st[nextKey].href} data-testid="lab-where-next">
            {st.next}: <b>{st[nextKey].num} {st[nextKey].name}</b> <ArrowRight size={14} aria-hidden={true} />
          </Link>
        )}
      </div>
    )}
    </>
  );
}
