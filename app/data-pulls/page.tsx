import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslation } from "@/lib/translations";
import WaiBot from "../components/brand/WaiBot";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "API Data Ingestion",
  robots: { index: false, follow: false }
};

export default async function DataPullsPage() {
  const cookieStore = await cookies();
  const lang = (cookieStore.get("lang")?.value || "en") as "en" | "th";
  const t = getTranslation(lang);

  const jobs = await prisma.sourcePullJob.findMany({ orderBy: { createdAt: "desc" }, take: 50 });

  return (
    <div className="data-pulls-page">
      <div className="topline">
        <div>
          <p className="kicker">{lang === "th" ? "ไปป์ไลน์ดึงข้อมูล" : "Ingestion pipeline"}</p>
          <h1>{t.dataPullsTitle}</h1>
          <p className="muted">{t.dataPullsDesc}</p>
        </div>
      </div>
      <div className="notice" style={{ marginBottom: 14 }}>
        Pull jobs save source records for later relevance and perspective review. They do not publish community submissions automatically.
      </div>

      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table>
          <thead><tr><th>Adapter</th><th>Query</th><th>Status</th><th>Found</th><th>Saved</th><th>Error / missing key</th></tr></thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td><strong>{job.adapter}</strong></td>
                <td>{job.query}</td>
                <td><span className={`badge ${job.status === "SUCCEEDED" ? "ok" : job.status === "FAILED" ? "danger" : "warn"}`}>{job.status}</span></td>
                <td className="num">{job.recordsFound}</td>
                <td className="num">{job.recordsSaved}</td>
                <td>{job.errorMessage}</td>
              </tr>
            ))}
            {!jobs.length && <tr><td className="empty" colSpan={6}><div className="empty-state"><WaiBot pose="empty" size={80} decorative /><span>No jobs yet.</span></div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
