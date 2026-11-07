import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { normalizePassportCode } from "@/lib/hri/passport";
import { JourneyOverview } from "../LabSections";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Meet a Robot with Your HRI Passport | Thailand Humanoid Atlas",
  alternates: { canonical: "/living-lab/meet" }
};

type SearchParams = Promise<{ code?: string; robot?: string; error?: string }>;

export default async function MeetEntryPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const robotQuery = params.robot ? `?robot=${encodeURIComponent(params.robot)}` : "";
  if (params.code) {
    const code = normalizePassportCode(params.code);
    if (code.length === 6) redirect(`/living-lab/meet/${code}${robotQuery}`);
  }
  const lang = ((await cookies()).get("lang")?.value || "en") as "en" | "th";
  const th = lang === "th";

  return (
    <main className="lab-page lab-meet">
      <header className="lab-meet-head">
        <p className="lab-eyebrow">{th ? "เส้นทางโรงพยาบาล" : "Hospital journey"}</p>
        <h1>{th ? "พบหุ่นยนต์ด้วย HRI Passport" : "Meet a robot with your HRI Passport"}</h1>
        <p className="lab-lead">
          {th
            ? "ใส่รหัส 6 ตัวจากพาสปอร์ตของคุณ หรือสแกน QR ที่ได้จาก Living Lab รหัสอยู่บนการ์ดพาสปอร์ต ใต้ QR"
            : "Enter the 6-character code from your passport, or scan the QR code you got in the Living Lab. The code is printed on your passport card, next to the QR."}
        </p>
      </header>

      <section className="lab-meet-card" aria-labelledby="meet-code-title">
        <h2 id="meet-code-title" className="visually-hidden">{th ? "ใส่รหัสพาสปอร์ต" : "Enter your passport code"}</h2>
        {params.error === "not_found" && (
          <p className="lab-meet-alert" role="alert">
            {th ? "ไม่พบพาสปอร์ตรหัสนี้ ตรวจรหัสบนการ์ดอีกครั้ง หรือสร้างพาสปอร์ตใหม่" : "No passport with that code. Check the code on your card, or create a new passport."}
          </p>
        )}
        {params.error === "rate_limited" && (
          <p className="lab-meet-alert" role="alert">
            {th ? "ลองรหัสผิดหลายครั้งเกินไป กรุณารอประมาณ 10 นาทีแล้วลองใหม่" : "Too many incorrect codes. Please wait about 10 minutes and try again."}
          </p>
        )}
        <form method="get" action="/living-lab/meet" className="lab-meet-form">
          <label htmlFor="meet-code">{th ? "รหัสพาสปอร์ต" : "Passport code"}</label>
          <input
            id="meet-code"
            name="code"
            required
            minLength={6}
            maxLength={7}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="7KQ4MZ"
            aria-describedby="meet-code-hint"
          />
          <p id="meet-code-hint" className="lab-note">{th ? "ตัวอักษรและตัวเลข 6 ตัว ไม่ต้องสนใจตัวพิมพ์เล็กใหญ่" : "6 letters and numbers. Upper or lower case both work."}</p>
          {params.robot && <input type="hidden" name="robot" value={params.robot} />}
          <button type="submit" className="lab-cta">{th ? "พบหุ่นยนต์" : "Meet the robot"}</button>
        </form>
        <p className="lab-meet-alt">
          <Link className="lab-link" href="/living-lab/create">{th ? "ยังไม่มีพาสปอร์ต? สร้างใน Living Lab →" : "No passport yet? Create one in the Living Lab →"}</Link>
        </p>
      </section>

      {/* What the journey involves, moved here from the old single-page Living Lab. */}
      <JourneyOverview lang={lang} passportCode={null} showAction={false} />
    </main>
  );
}
