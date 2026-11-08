import type { Metadata } from "next";
import { cookies } from "next/headers";
import { identityRequired } from "@/lib/hri/identity-server";
import LivingLabClient from "./LivingLabClient";
import { readClientIdentity } from "./identity-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HRI Living Lab | Thailand Humanoid Atlas",
  description: "Meet Atlas, a simulated care robot, as if on a video call. Talk for two minutes and it makes your Care Passport.",
  alternates: { canonical: "/living-lab" }
};

// The Living Lab: one page, a video call with the robot. Camera and microphone open on arrival; hold up
// a passport QR and the robot reads it; press Create passport to talk and the robot makes one.
export default async function LivingLabPage() {
  const lang = ((await cookies()).get("lang")?.value === "th" ? "th" : "en") as "en" | "th";
  const identity = await readClientIdentity();
  return <LivingLabClient lang={lang} initialIdentity={identity} identityRequired={identityRequired()} layout="call" />;
}
