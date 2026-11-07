"use client";

// The first thing on pages that need a passport (/living-lab/meet): if this browser made one, a
// one-tap start with it; if not, why a passport is needed and how to make one. The token goes in a
// POST body to the server action, never into a URL.
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, IdCard, UserPlus } from "lucide-react";
import type { Lang } from "../copy";
import { labCopy } from "../lab-copy";
import { startJourneyFromToken } from "../robot/actions";
import { findOwnPassport } from "./lab-env";

export default function OwnPassportStart({ lang, robot }: { lang: Lang; robot?: string }) {
  const t = labCopy[lang].needPassport;
  const [own, setOwn] = useState<string | null | undefined>(undefined);
  useEffect(() => { setOwn(findOwnPassport()); }, []);
  if (own === undefined) return null; // until the browser has been checked: no flash of the wrong offer

  return own ? (
    <div className="lab-callout" data-testid="meet-own">
      <div>
        <h2>{t.ownTitle}</h2>
        <p className="lab-note">{t.ownBody}</p>
      </div>
      <form action={startJourneyFromToken}>
        <input type="hidden" name="token" value={own} />
        {robot && <input type="hidden" name="robot" value={robot} />}
        <button type="submit" className="lab-cta"><IdCard size={18} aria-hidden="true" /> {t.useOwn} <ArrowRight size={18} aria-hidden="true" /></button>
      </form>
    </div>
  ) : (
    <div className="lab-callout" data-testid="meet-empty">
      <div>
        <h2>{t.emptyTitle}</h2>
        <p className="lab-note">{t.emptyBody}</p>
      </div>
      <Link className="lab-cta" href="/living-lab/create"><UserPlus size={18} aria-hidden="true" /> {t.create}</Link>
    </div>
  );
}
