import type { Metadata } from "next";
import { cookies } from "next/headers";
import Overview from "../components/Overview";
import { loadCareRobots } from "../data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HRI Living Lab | Thailand Humanoid Atlas",
  description: "Can robots understand you? Create a Care Passport once, meet simulated care robots that respect it, compare them on a hospital journey and see what the research learns.",
  alternates: { canonical: "/living-lab/about" }
};

// About the Living Lab: what it is, the four stages, the robots, the research and what is real.
// The front door (/living-lab) is the video-call room; this page holds the explanation.
export default async function LivingLabAboutPage() {
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
