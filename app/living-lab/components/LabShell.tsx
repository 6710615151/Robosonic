"use client";

// Shared frame for every /living-lab route: who this is (brand), what is real right now (status),
// and where you can go (tabs). Status shows only things this browser or server actually knows:
// WebGL support, that no physical robot is connected, and whether a Gemini key is configured.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { Bot, Box, ChartColumn, Compass, HeartHandshake, Hospital, IdCard, Sparkles, Unplug, UserPlus } from "lucide-react";
import type { Lang } from "../copy";
import { labCopy } from "../lab-copy";

type NavKey = "overview" | "create" | "mine" | "robot" | "journey" | "research";
type NavItem = { key: NavKey; href: string; icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>; active: boolean };
type SimState = "pending" | "ok" | "off";

// Same key the creation flow and the passport card use for the owner's edit key.
const EDIT_KEY_PREFIX = "hri-passport-edit:";

function findOwnPassport(): string | null {
  try {
    let found: string | null = null;
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(EDIT_KEY_PREFIX) && key.length > EDIT_KEY_PREFIX.length) found = key.slice(EDIT_KEY_PREFIX.length);
    }
    return found;
  } catch {
    return null; // storage blocked (private mode): just no shortcut
  }
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

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

  const under = (path: string) => pathname === path || pathname.startsWith(`${path}/`);
  const items: NavItem[] = [
    { key: "overview", href: "/living-lab", icon: Compass, active: pathname === "/living-lab" },
    { key: "create", href: "/living-lab#calibrate", icon: UserPlus, active: false },
    ...(ownToken ? [{ key: "mine" as const, href: `/living-lab/passport/${ownToken}`, icon: IdCard, active: under("/living-lab/passport") }] : []),
    { key: "robot", href: "/living-lab/robot", icon: Bot, active: under("/living-lab/robot") },
    { key: "journey", href: "/living-lab/meet", icon: Hospital, active: under("/living-lab/meet") },
    { key: "research", href: "/living-lab#research", icon: ChartColumn, active: false }
  ];

  return (
    <>
      <header className="lab-shell">
        <Link href="/living-lab" className="lab-shell-brand">
          <span className="lab-shell-mark" aria-hidden="true"><HeartHandshake size={20} /></span>
          <span>
            <strong>{t.name}</strong>
            <small>{t.tagline}</small>
          </span>
        </Link>
        <ul className="lab-status" aria-label={t.statusLabel} data-testid="lab-status">
          <li data-state={sim} data-testid="lab-status-sim">
            <Box size={14} aria-hidden={true} />
            <b className="lab-status-long">{t.sim.label}: <span>{t.sim[sim]}</span></b>
            <b className="lab-status-short">{t.short.sim[sim]}</b>
          </li>
          <li data-state="off" data-testid="lab-status-hardware">
            <Unplug size={14} aria-hidden={true} />
            <b className="lab-status-long">{t.hardware.label}: <span>{t.hardware.off}</span></b>
            <b className="lab-status-short">{t.short.hardware}</b>
          </li>
          <li data-state={aiConfigured ? "ok" : "off"} data-testid="lab-status-ai">
            <Sparkles size={14} aria-hidden={true} />
            <b className="lab-status-long">{t.ai.label}: <span>{aiConfigured ? t.ai.ok : t.ai.off}</span></b>
            <b className="lab-status-short">{aiConfigured ? t.short.ai.ok : t.short.ai.off}</b>
          </li>
        </ul>
      </header>

      <nav className="lab-tabs" aria-label={t.navLabel}>
        <ul ref={tabsRef}>
          {items.map(({ key, href, icon: Icon, active }) => (
            <li key={key}>
              <Link href={href} aria-current={active ? "page" : undefined} className={key === "mine" ? "is-mine" : undefined}>
                <Icon size={16} aria-hidden={true} /> {t.nav[key]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
