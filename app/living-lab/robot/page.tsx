import type { Metadata } from "next";
import { cookies } from "next/headers";
import RobotConsoleClient from "./RobotConsoleClient";
import type { RobotLang } from "./copy";
import { RobotEcosystem } from "../LabSections";
import { loadCareRobots } from "../data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Robot console | HRI Living Lab",
  description:
    "Read a real HRI Passport and watch two simulated robots apply the same profile within their own hardware.",
  alternates: { canonical: "/living-lab/robot" },
  robots: { index: false, follow: false }
};

export default async function RobotConsolePage() {
  const lang = (((await cookies()).get("lang")?.value === "th" ? "th" : "en") as RobotLang);
  const robots = await loadCareRobots();
  return (
    <>
      <RobotConsoleClient lang={lang} />
      {/* Capability comparison, moved here from the old single-page Living Lab. */}
      <div className="lab-page lab-after">
        <RobotEcosystem lang={lang} robots={robots ?? []} />
      </div>
    </>
  );
}
