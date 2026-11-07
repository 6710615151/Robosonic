import type { Metadata } from "next";
import { cookies } from "next/headers";
import { parseWindow } from "@/lib/hri/observatory";
import { ResearchObservatory } from "../LabSections";
import { loadObservatory } from "../data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Research Observatory | HRI Living Lab",
  description: "Anonymous, aggregated results from the HRI Living Lab: comfort with and without a Care Passport, preferences and data quality. Care details stay hidden in groups smaller than five.",
  alternates: { canonical: "/living-lab/research" }
};

type SearchParams = Promise<{ window?: string }>;

// The Research Observatory. It used to be the #research section of /living-lab.
export default async function ResearchPage({ searchParams }: { searchParams: SearchParams }) {
  const lang = ((await cookies()).get("lang")?.value === "th" ? "th" : "en") as "en" | "th";
  const stats = await loadObservatory(parseWindow((await searchParams).window));
  return (
    <main className="lab-page">
      <ResearchObservatory lang={lang} stats={stats} />
    </main>
  );
}
