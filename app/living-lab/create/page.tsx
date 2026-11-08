import type { Metadata } from "next";
import { cookies } from "next/headers";
import LivingLabClient from "../LivingLabClient";
import { readClientIdentity } from "../identity-actions";
import { identityRequired } from "@/lib/hri/identity-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create your Care Passport | HRI Living Lab",
  description: "Greet a simulated care robot with a wai and teach it your comfortable distance, pace, eye contact and care needs. Takes about a minute; nothing is saved until you agree.",
  alternates: { canonical: "/living-lab/create" }
};

// The guided Care Passport calibration. It used to live on /living-lab; links to /living-lab#calibrate
// are forwarded here by the overview page.
// Default: the video-call room with the "create passport" sheet already open. ?manual=1: the page with
// the answer-by-buttons, voice and Auto flows, for anyone who cannot use a camera or microphone.
export default async function CreatePassportPage({ searchParams }: { searchParams: Promise<{ manual?: string }> }) {
  const manual = (await searchParams).manual === "1";
  const lang = ((await cookies()).get("lang")?.value === "th" ? "th" : "en") as "en" | "th";
  const identity = await readClientIdentity();
  return manual
    ? <LivingLabClient lang={lang} initialIdentity={identity} identityRequired={identityRequired()} startManual />
    : <LivingLabClient lang={lang} initialIdentity={identity} identityRequired={identityRequired()} layout="call" openSheet />;
}
