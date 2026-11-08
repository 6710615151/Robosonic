import type { Metadata } from "next";
import { cookies } from "next/headers";
import { cardCopy, type CardLang } from "../copy";
import { loadCard, type CardState } from "../lookup";
import PassportCardClient, { type CardPassport } from "./PassportCardClient";
import styles from "../passport.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My HRI Passport | HRI Living Lab",
  description: "The owner's view of an HRI Passport: one profile every robot understands.",
  robots: { index: false, follow: false }
};

type Params = Promise<{ token: string }>;

function formatDate(value: Date, lang: CardLang) {
  return new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok"
  }).format(value);
}

function Notice({ lang, title, body }: { lang: CardLang; title: string; body: string }) {
  return (
    <main className={styles.page}>
      <section className={styles.screen}>
        <h1>{title}</h1>
        <p>{body}</p>
        <p className={styles.row}>
          <a className={`${styles.btn} ${styles.primary}`} href="/living-lab/create">{cardCopy[lang].createNew}</a>
          <a className={styles.btn} href="/living-lab">{cardCopy[lang].backToLab}</a>
        </p>
      </section>
    </main>
  );
}

export default async function PassportCardPage({ params }: { params: Params }) {
  const { token } = await params;
  const lang = (((await cookies()).get("lang")?.value === "th" ? "th" : "en") as CardLang);
  const t = cardCopy[lang];

  let result: CardState;
  try {
    result = await loadCard(token);
  } catch (error) {
    console.error("HRI passport card unavailable", error);
    return <Notice lang={lang} title={t.unavailableTitle} body={t.unavailableBody} />;
  }

  if (result.state === "rate_limited") {
    return <Notice lang={lang} title={t.tooManyTitle} body={t.tooManyBody} />;
  }
  if (result.state === "not_found") {
    return <Notice lang={lang} title={t.notFoundTitle} body={t.notFoundBody} />;
  }

  const p = result.passport;
  const expired = p.expiresAt ? p.expiresAt.getTime() <= Date.now() : false;
  const status: CardPassport["passport"]["status"] = p.status !== "active" ? "revoked" : expired ? "expired" : "active";

  return (
    <PassportCardClient
      lang={lang}
      token={token}
      passport={{
        code: p.code,
        greeting: p.greeting,
        comfortDistance: p.comfortDistance,
        speed: p.speed,
        gaze: p.gaze,
        voice: p.voice,
        language: p.language,
        captions: p.captions,
        speechPace: p.speechPace,
        noReach: p.noReach,
        status,
        version: p.version,
        createdAtLabel: formatDate(p.createdAt, lang),
        updatedAtLabel: formatDate(p.updatedAt, lang),
        expiresAtLabel: p.expiresAt ? formatDate(p.expiresAt, lang) : null
      }}
    />
  );
}
