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
export default async function CreatePassportPage() {
  const lang = ((await cookies()).get("lang")?.value === "th" ? "th" : "en") as "en" | "th";
  const identity = await readClientIdentity();
  return <LivingLabClient lang={lang} initialIdentity={identity} identityRequired={identityRequired()} />;
}
