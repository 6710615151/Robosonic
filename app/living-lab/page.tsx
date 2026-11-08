import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { identityRequired } from "@/lib/hri/identity-server";
import LivingLabClient from "./LivingLabClient";
import { readClientIdentity } from "./identity-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HRI Living Lab | Thailand Humanoid Atlas",
  description: "Meet Atlas, a simulated care robot, as if on a video call. Talk for two minutes and it makes your Care Passport.",
  alternates: { canonical: "/living-lab" }
};

type SearchParams = Promise<{ window?: string }>;

// The Living Lab front door: a video call with the robot. Press Create passport to talk; the robot
// learns how you like to be cared for while you chat. Old /living-lab?window=… links (the research
// filter) are forwarded to the Research page; old #section links are forwarded in the browser.
export default async function LivingLabPage({ searchParams }: { searchParams: SearchParams }) {
  const { window: range } = await searchParams;
  if (range) redirect(`/living-lab/research?window=${encodeURIComponent(range)}`);
  const lang = ((await cookies()).get("lang")?.value === "th" ? "th" : "en") as "en" | "th";
  const identity = await readClientIdentity();
  return <LivingLabClient lang={lang} initialIdentity={identity} identityRequired={identityRequired()} layout="call" />;
}
