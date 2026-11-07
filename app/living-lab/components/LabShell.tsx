"use client";

// Shared frame for every /living-lab route: where you can go (tabs) and, one tap away, what is real
// right now (status). Status shows only things this browser or server actually knows:
// WebGL support, that no physical robot is connected, and whether a Gemini key is configured.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { Activity, Bot, Box, ChartColumn, Compass, HeartHandshake, Hospital, IdCard, Sparkles, Unplug, UserPlus } from "lucide-react";
import type { Lang } from "../copy";
import { labCopy } from "../lab-copy";
import { findOwnPassport, webglAvailable, type SimState } from "./lab-env";

type NavKey = "overview" | "create" | "mine" | "robot" | "journey" | "research";
type NavItem = { key: NavKey; href: string; icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>; active: boolean };

export default function LabShell({ lang, aiConfigured }: { lang: Lang; aiConfigured: boolean }) {
  const t = labCopy[lang].shell;
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
  const items: NavItem[] = [
    { key: "overview", href: "/living-lab", icon: Compass, active: pathname === "/living-lab" },
    { key: "create", href: "/living-lab/create", icon: UserPlus, active: under("/living-lab/create") },
    ...(ownToken ? [{ key: "mine" as const, href: `/living-lab/passport/${ownToken}`, icon: IdCard, active: under("/living-lab/passport") }] : []),
    { key: "robot", href: "/living-lab/robot", icon: Bot, active: under("/living-lab/robot") },
    { key: "journey", href: "/living-lab/meet", icon: Hospital, active: under("/living-lab/meet") },
    { key: "research", href: "/living-lab/research", icon: ChartColumn, active: under("/living-lab/research") }
  ];

  const limited = [sim === "off", true, !aiConfigured].filter(Boolean).length;

  // One bar: the lab's own tabs, plus a compact status disclosure at the end. The site header already
  // carries the brand, so the lab adds no second header; status stays one tap away instead of taking
  // a row of chips on every page.
  return (
    <nav className="lab-tabs" aria-label={t.navLabel}>
      <span className="lab-tabs-brand" aria-hidden="true">
        <span className="lab-shell-mark"><HeartHandshake size={16} /></span>
        {t.name}
      </span>
      <ul ref={tabsRef}>
        {items.map(({ key, href, icon: Icon, active }) => (
          <li key={key}>
            <Link href={href} aria-current={active ? "page" : undefined} className={key === "mine" ? "is-mine" : undefined}>
              <Icon size={16} aria-hidden={true} /> {t.nav[key]}
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
  );
}
