import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { getTranslation } from "@/lib/translations";
import { isAdmin } from "@/lib/auth";
import { REDACTED, isRedactedTable, redactRows } from "@/lib/public-redaction";
import { Download, Search, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Raw Database Browser",
  robots: { index: false, follow: false }
};

type SearchParams = Promise<{ table?: string; q?: string }>;

const tableOptions = [
  { value: "sources", label: "Source Records" },
  { value: "robots", label: "Robot Models" },
  { value: "owned_inventory", label: "Owned Inventory" },
  { value: "contributions", label: "Contributions" },
  { value: "submissions", label: "Submitted Data" },
  { value: "perspective_annotations", label: "Perspective Annotations" },
  { value: "pull_jobs", label: "Source Pull Jobs" }
] as const;

export default async function DatabasePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const table = tableOptions.some(t => t.value === params.table) ? params.table! : "sources";
  const q = params.q ?? "";

  const cookieStore = await cookies();
  const lang = (cookieStore.get("lang")?.value || "en") as "en" | "th";
  const t = getTranslation(lang);

  let data: any[] = [];

  try {
    switch (table) {
      case "robots":
        data = await prisma.robotModel.findMany({
          where: q ? { canonicalName: { contains: q, mode: "insensitive" } } : {},
          orderBy: { createdAt: "desc" },
          take: 250
        });
        break;
      case "owned_inventory":
        data = await prisma.ownedInventory.findMany({
          where: q ? { displayName: { contains: q, mode: "insensitive" } } : {},
          orderBy: { createdAt: "desc" },
          take: 250
        });
        break;
      case "contributions":
        data = await prisma.contribution.findMany({
          where: q ? { title: { contains: q, mode: "insensitive" } } : {},
          orderBy: { createdAt: "desc" },
          take: 250
        });
        break;
      case "submissions":
        data = await prisma.submittedData.findMany({
          where: q ? { title: { contains: q, mode: "insensitive" } } : {},
          orderBy: { createdAt: "desc" },
          take: 250
        });
        break;
      case "perspective_annotations":
        data = await prisma.perspectiveAnnotation.findMany({
          where: q ? { perspectiveTheme: { contains: q, mode: "insensitive" } } : {},
          orderBy: { createdAt: "desc" },
          take: 250
        });
        break;
      case "pull_jobs":
        data = await prisma.sourcePullJob.findMany({
          where: q ? { query: { contains: q, mode: "insensitive" } } : {},
          orderBy: { createdAt: "desc" },
          take: 250
        });
        break;
      default:
        data = await prisma.sourceRecord.findMany({
          where: q ? { title: { contains: q, mode: "insensitive" } } : {},
          orderBy: { createdAt: "desc" },
          take: 250
        });
    }
  } catch (error) {
    console.error("Database query failed in database browser page:", error);
  }

  // Strip contact details, review notes and masked inventory fields before rendering for non-admins.
  const admin = await isAdmin();
  data = redactRows(table, data, admin);
  const redacted = !admin && isRedactedTable(table);

  // Column headers based on keys in records
  const headers = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <>
      <div className="topline">
        <div>
          <p className="kicker">{lang === "th" ? "ข้อมูลดิบ" : "Raw tables"}</p>
          <h1>{t.databaseTitle}</h1>
          <p className="muted">{t.databaseDesc}</p>
        </div>
        <div className="toolbar">
          <a className="button primary" href={`/api/export?table=${table}`} download>
            <Download size={15} aria-hidden="true" /> Export CSV ({table.replace(/_/g, " ")})
          </a>
        </div>
      </div>

      {redacted && (
        <div className="notice" role="note">
          <ShieldCheck size={14} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 6 }} />
          {lang === "th"
            ? "ข้อมูลติดต่อ บันทึกการตรวจสอบ และข้อมูลที่ปิดบังของคลังอุปกรณ์จะแสดงเป็น [restricted] สำหรับผู้ที่ไม่ใช่ผู้ดูแลระบบ (รวมถึงไฟล์ CSV)"
            : "Contact details, internal review notes and masked inventory fields show as [restricted] unless you are signed in as an administrator. CSV exports follow the same rule."}
        </div>
      )}

      {/* Selector & Search Form */}
      <form method="GET" className="panel db-form">
        <label>
          {lang === "th" ? "เลือกตาราง" : "Table selection"}
          <select name="table" defaultValue={table}>
            {tableOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label>
          {lang === "th" ? "ค้นหาข้อความในตาราง" : "Text Search within table"}
          <input name="q" defaultValue={q} placeholder={`Search fields in ${table}...`} />
        </label>

        <button type="submit" className="primary query-btn">
          <Search size={15} aria-hidden="true" /> Query
        </button>
      </form>

      {/* Dense Monospace Grid view */}
      <section className="panel db-preview">
        <div className="db-preview-head">
          <h2>Table Preview: <code>{table}</code></h2>
          <span className="badge">{data.length} records · max 250</span>
        </div>

        <div className="table-wrap db-table">
          <table>
            <thead>
              <tr>
                {headers.map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx}>
                  {headers.map(h => {
                    const val = row[h];
                    let displayVal = "";
                    if (val === null || val === undefined) {
                      displayVal = "NULL";
                    } else if (val instanceof Date) {
                      displayVal = val.toLocaleString();
                    } else if (typeof val === "object") {
                      displayVal = JSON.stringify(val);
                    } else {
                      displayVal = String(val);
                    }
                    const cls = val === null || val === undefined ? "is-null" : val === REDACTED ? "is-redacted" : undefined;
                    // Truncate by code point, not UTF-16 unit, so emoji/maths symbols are never split
                    // (a split surrogate pair made the server and client text differ).
                    const chars = Array.from(displayVal);
                    return (
                      <td key={h} className={cls}>
                        {chars.length > 50 ? `${chars.slice(0, 48).join("")}...` : displayVal}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!data.length && (
                <tr>
                  <td className="empty" colSpan={headers.length || 1}>
                    No records found in this table query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
