import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Overview from "./components/Overview";
import { loadCareRobots } from "./data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HRI Living Lab | Thailand Humanoid Atlas",
  description: "Can robots understand you? Create a Care Passport once, meet simulated care robots that respect it, compare them on a hospital journey and see what the research learns.",
  alternates: { canonical: "/living-lab" }
};

type SearchParams = Promise<{ window?: string }>;

// The Living Lab overview. Passport creation lives at /living-lab/create and the Research Observatory
// at /living-lab/research; old /living-lab?window=… links (the observatory filter) are forwarded there.
export default async function LivingLabPage({ searchParams }: { searchParams: SearchParams }) {
  const { window: range } = await searchParams;
  if (range) redirect(`/living-lab/research?window=${encodeURIComponent(range)}`);

  const lang = ((await cookies()).get("lang")?.value === "th" ? "th" : "en") as "en" | "th";
  const robots = await loadCareRobots();
  return (
    <Overview
      lang={lang}
      registryCount={robots ? robots.length : null}
      dbOnline={robots !== null}
      aiConfigured={Boolean(process.env.GEMINI_API_KEY)}
      journeyRobots={(robots ?? []).filter((r) => r.journeyTask).map((r) => ({ name: r.name, task: r.journeyTask! }))}
    />
  );
}
