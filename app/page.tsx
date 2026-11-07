import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import RobotViewer from "./components/RobotViewer";
import CopyCommands from "./components/CopyCommands";
import AtlasLogo from "./components/brand/AtlasLogo";
import WaiBot from "./components/brand/WaiBot";
import ThaiConstellation from "./components/brand/ThaiConstellation";
import { getTranslation } from "@/lib/translations";
import {
  ArrowRight,
  Bot,
  Box,
  ClipboardList,
  Database,
  Facebook,
  FolderOpen,
  HeartHandshake,
  Github,
  Move3d,
  Newspaper,
  Globe,
  Play,
  Send,
  Users,
  Youtube
} from "lucide-react";

export const metadata: Metadata = {
  title: "Thailand Humanoid Atlas | Embodied AI & Robotics Database",
  description: "Explore Thailand's humanoid, social, and service robotics ecosystem. Trace robot models, research contributions, public perspectives, physical inventories, and AI-powered ecosystem maps.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Thailand Humanoid Atlas | Embodied AI & Robotics Database",
    description: "Explore Thailand's humanoid, social, and service robotics ecosystem. Trace robot models, research contributions, public perspectives, physical inventories, and AI-powered ecosystem maps.",
    url: "/",
    siteName: "Thailand Humanoid Atlas",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Thailand Humanoid Atlas Logo"
      }
    ],
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Thailand Humanoid Atlas | Embodied AI & Robotics Database",
    description: "Explore Thailand's humanoid, social, and service robotics ecosystem. Trace robot models, research contributions, public perspectives, physical inventories, and AI-powered ecosystem maps.",
    images: ["/logo.png"]
  }
};


export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const cookieStore = await cookies();
  const lang = (cookieStore.get("lang")?.value || "en") as "en" | "th";
  const t = getTranslation(lang);

  let sourcesCount: number | null = null;
  let acceptedCount: number | null = null;
  let robotsCount: number | null = null;
  let contributionsCount: number | null = null;
  let inventoryCount: number | null = null;
  let pendingReviewsCount: number | null = null;
  let platforms: any[] = [];
  let yearRangeStr = "No date data";
  let latestPipelineRun: any = null;
  let dbOffline = false;

  try {
    const [
      sCount,
      aCount,
      rCount,
      cCount,
      iCount,
      prCount,
      plts,
      dateRange,
      pipelineRun
    ] = await Promise.all([
      prisma.sourceRecord.count(),
      prisma.sourceRecord.count({ where: { relevanceStatus: "ACCEPTED" } }),
      prisma.robotModel.count(),
      prisma.contribution.count(),
      prisma.ownedInventory.count(),
      prisma.submittedData.count({ where: { status: { in: ["QUEUED", "NEEDS_REVIEW"] } } }),
      prisma.sourceRecord.groupBy({ by: ["platform"], _count: { _all: true } }),
      prisma.sourceRecord.aggregate({ _min: { publishedAt: true }, _max: { publishedAt: true } }),
      prisma.pipelineRun.findFirst({ orderBy: { startedAt: "desc" } })
    ]);

    sourcesCount = sCount;
    acceptedCount = aCount;
    robotsCount = rCount;
    contributionsCount = cCount;
    inventoryCount = iCount;
    pendingReviewsCount = prCount;
    
    if (plts && plts.length > 0) {
      platforms = [...plts]
        .sort((a, b) => (b._count?._all ?? 0) - (a._count?._all ?? 0))
        .slice(0, 9);
    }
    
    if (pipelineRun) {
      latestPipelineRun = pipelineRun;
    }

    const minYear = dateRange._min.publishedAt ? dateRange._min.publishedAt.getFullYear() : "N/A";
    const maxYear = dateRange._max.publishedAt ? dateRange._max.publishedAt.getFullYear() : "N/A";
    yearRangeStr = minYear !== "N/A" || maxYear !== "N/A" ? `${minYear} – ${maxYear}` : "No date data";
  } catch (error) {
    console.error("Database connection failed in overview page:", error);
    dbOffline = true;
  }

  // Format date for Pipeline status card
  let lastUpdatedStr = lang === "th" ? "ล่าสุด: ไม่มีข้อมูล" : "Last: N/A";
  if (latestPipelineRun?.finishedAt) {
    const finishedDate = new Date(latestPipelineRun.finishedAt);
    lastUpdatedStr = `${lang === "th" ? "ล่าสุด" : "Last"}: ${finishedDate.getMonth() + 1}/${finishedDate.getDate()}/${finishedDate.getFullYear()}`;
  }

  const cliCommands = [
    "python -m humanoid_atlas db init",
    "python -m humanoid_atlas ingest seeds --file data/seeds/robot_models.seed.yml",
    "python -m humanoid_atlas ingest seeds --file data/seeds/inventory.seed.yml"
  ];

  const formatMetric = (value: number | null) => value?.toLocaleString() ?? "Unavailable";

  const th = lang === "th";
  const explore = [
    { href: "/perspectives", title: t.perspectivesTitle, sub: th ? "เสียงสาธารณะและสื่อ" : "Public & media voice", icon: Newspaper },
    { href: "/contributions", title: t.contributors, sub: th ? "นักวิจัยและนักพัฒนา" : "Researchers & developers", icon: Users },
    { href: "/robots", title: t.robotsTitle, sub: th ? "แคตตาล็อกรุ่นหุ่นยนต์" : "Robot model catalog", icon: Bot },
    { href: "/inventory", title: t.inventoryTitle, sub: th ? "สินทรัพย์ทางกายภาพ" : "Physical assets", icon: Box }
  ];

  return (
    <div className="ov">
      {/* Hero: brand statement + interactive 3D robot (RobotViewer) */}
      <section className="ov-hero" aria-labelledby="ov-title">
        <div className="ov-hero-copy">
          <p className="ov-eyebrow">
            <span>{th ? "คอนโซลวิจัยระบบ" : "Research Console"}</span>
            <span aria-hidden="true">/</span>
            <span>{th ? "ภาพรวมและสรุปคลังข้อมูล" : "Overview & Corpus Summary"}</span>
          </p>
          <h1 id="ov-title" className="ov-title">
            Thailand <br />Humanoid <em>Atlas</em>
          </h1>
          <p className="ov-tagline">{th ? "แผนที่ระบบนิเวศมนุษย์–หุ่นยนต์ของประเทศไทย" : "Mapping Thailand\u2019s human–robot ecosystem"}</p>
          <p className="ov-desc">{t.overviewDesc}</p>

          <div className="ov-actions">
            <Link className="button signal" href="/living-lab">
              <HeartHandshake size={16} aria-hidden="true" />
              {th ? "เข้า Living Lab" : "Enter the Living Lab"}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <Link className="button ov-ghost" href="/data-pulls">
              <Play size={13} fill="currentColor" aria-hidden="true" /> {t.runDataPull}
            </Link>
            <Link className="button ov-ghost" href="/database">
              <FolderOpen size={15} aria-hidden="true" /> {t.browseDatabase}
            </Link>
            <Link className="button ov-ghost" href="/submit-data">
              <Send size={15} aria-hidden="true" /> {t.submitRecord}
            </Link>
            <Link className="button ov-ghost" href="/admin">
              <ClipboardList size={15} aria-hidden="true" /> {t.reviewQueue}
              <span className="ov-count">{pendingReviewsCount ?? "—"}</span>
            </Link>
          </div>
        </div>

        <div className="ov-stage">
          <ThaiConstellation className="ov-constellation" />
          <div className="ov-halo" aria-hidden="true" />
          <div className="ov-plinth" aria-hidden="true" />
          <div className="ov-robot">
            <RobotViewer />
          </div>
          <p className="ov-annot ov-annot--top" aria-hidden="true">{th ? "โมเดล 3 มิติ · ไหว้ทักทาย" : "Live 3D model · Wai greeting"}</p>
          <p className="ov-annot ov-annot--bottom">
            <Move3d size={13} aria-hidden="true" /> {th ? "ลากเพื่อหมุน · หุ่นมองตามเคอร์เซอร์" : "Drag to rotate · follows your pointer"}
          </p>
        </div>
      </section>

      {dbOffline && (
        <div className="notice danger" role="status">
          <strong>Database Offline:</strong> Live PostgreSQL is unavailable. Overview metrics are not being substituted.
        </div>
      )}

      {/* Primary metrics + status */}
      <section className="ov-metrics" aria-label={th ? "ตัวชี้วัดคลังข้อมูล" : "Corpus metrics"}>
        <article className="metric-card">
          <div className="metric-icon"><Database size={18} /></div>
          <div>
            <p>{t.totalSources}</p>
            <strong>{formatMetric(sourcesCount)}</strong>
            <small>{th ? `อนุมัติแล้ว: ${formatMetric(acceptedCount)}` : `Accepted: ${formatMetric(acceptedCount)}`}</small>
          </div>
        </article>
        <article className="metric-card">
          <div className="metric-icon"><Bot size={18} /></div>
          <div>
            <p>{t.robotModels}</p>
            <strong>{formatMetric(robotsCount)}</strong>
            <small>{th ? "รุ่นที่ลงทะเบียน" : "Registered models"}</small>
          </div>
        </article>
        <article className="metric-card">
          <div className="metric-icon"><Box size={18} /></div>
          <div>
            <p>{t.ownedUnits}</p>
            <strong>{formatMetric(inventoryCount)}</strong>
            <small>{th ? "คลังอุปกรณ์ของทีม" : "Team inventory"}</small>
          </div>
        </article>
        <article className="metric-card">
          <div className="metric-icon"><Users size={18} /></div>
          <div>
            <p>{t.contributors}</p>
            <strong>{formatMetric(contributionsCount)}</strong>
            <small>{th ? "คลังโค้ดและเอกสาร" : "Repos & papers"}</small>
          </div>
        </article>

        <article className="ov-status">
          <div>
            <p className="ov-label">{t.pipelineStatus}</p>
            {latestPipelineRun ? (
              <span className="ov-pill ok"><i aria-hidden="true" />{latestPipelineRun.pipelineName}: {latestPipelineRun.status}</span>
            ) : (
              <span className="ov-pill"><i aria-hidden="true" />{th ? "ไม่มีการทำงานล่าสุด" : "No active runs"}</span>
            )}
            <small>{lastUpdatedStr}</small>
          </div>
          <div>
            <p className="ov-label">{t.temporalCoverage}</p>
            <strong className="ov-years">{yearRangeStr}</strong>
            <small>{t.activeMediaPubs}</small>
          </div>
        </article>
      </section>

      {/* Sources by ingestion platform */}
      <section className="panel ov-platforms">
        <h2>{t.sourcesByPlatform}</h2>
        <div className="ov-platform-grid">
          {platforms.map((p) => {
            const name = String(p.platform || "unknown").toLowerCase();
            let logoClass = "website";
            let IconComponent = Globe;
            if (name.includes("facebook")) { logoClass = "facebook"; IconComponent = Facebook; }
            else if (name.includes("youtube")) { logoClass = "youtube"; IconComponent = Youtube; }
            else if (name.includes("github")) { logoClass = "github"; IconComponent = Github; }
            const count = p._count?._all ?? p._count ?? 0;
            const share = sourcesCount ? Math.max(2, Math.round((Number(count) / sourcesCount) * 100)) : 0;
            return (
              <div className={`ov-platform ${logoClass}`} key={p.platform || "unknown"}>
                <span className="ov-platform-icon"><IconComponent size={15} /></span>
                <div className="ov-platform-body">
                  <p>{p.platform || "unknown"}</p>
                  <strong>{Number(count).toLocaleString()}</strong>
                </div>
                <div className="ov-platform-bar" aria-hidden="true"><span style={{ width: `${share}%` }} /></div>
              </div>
            );
          })}
          {!platforms.length && (
            <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
              <WaiBot pose="empty" size={84} decorative />
              <span>{th ? "ยังไม่มีแหล่งข้อมูลในฐานข้อมูล" : "No source records in the database yet."}</span>
            </div>
          )}
        </div>
      </section>

      {/* Explore the ecosystem: shortcuts to existing pages */}
      <section className="ov-explore" aria-labelledby="ov-explore-title">
        <div className="ov-explore-head">
          <h2 id="ov-explore-title">{th ? "สำรวจระบบนิเวศ" : "Explore the ecosystem"}</h2>
          <Link href="/network" className="ov-link">
            {th ? "ดูเครือข่ายความสัมพันธ์" : "Open the relationship network"} <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <div className="ov-explore-grid">
          {explore.map(({ href, title, sub, icon: Icon }, i) => (
            <Link key={href} href={href} className="ov-tile">
              <span className="ov-tile-index" aria-hidden="true">0{i + 1}</span>
              <span className="ov-tile-icon" aria-hidden="true"><Icon size={20} /></span>
              <strong>{title}</strong>
              <span className="ov-tile-sub">{sub}</span>
              <span className="ov-tile-go" aria-hidden="true"><ArrowRight size={16} /></span>
            </Link>
          ))}
          <Link href="/living-lab" className="ov-tile ov-tile--lab">
            <WaiBot pose="assistant" size={92} decorative className="ov-tile-bot" />
            <strong>HRI Living Lab</strong>
            <span className="ov-tile-sub">{th ? "ทดลองปฏิสัมพันธ์มนุษย์–หุ่นยนต์ด้วย HRI Passport" : "Try human–robot interaction with an HRI Passport"}</span>
            <span className="ov-tile-go" aria-hidden="true"><ArrowRight size={16} /></span>
          </Link>
        </div>
      </section>

      {/* Database Empty State Guide */}
      <section className="terminal-panel">
        <div className="terminal-header">
          <h3>{t.emptyStateTitle}</h3>
          <CopyCommands commands={cliCommands} />
        </div>
        <p>{t.emptyStateDesc}</p>
        <div className="command-grid">
          <div className="command-card">
            <div className="step">1</div>
            <strong>Initialize DB tables</strong>
            <code>python -m humanoid_atlas db init</code>
          </div>
          <div className="command-card">
            <div className="step">2</div>
            <strong>Seed robot models</strong>
            <code>python -m humanoid_atlas ingest seeds --file data/seeds/robot_models.seed.yml</code>
          </div>
          <div className="command-card">
            <div className="step">3</div>
            <strong>Seed inventory and relations</strong>
            <code>python -m humanoid_atlas ingest seeds --file data/seeds/inventory.seed.yml</code>
          </div>
        </div>
      </section>

      <footer className="ov-footer">
        <AtlasLogo width={120} tone="ink" />
        <p>{th ? "แอตลาสวิจัยแบบเปิด เพื่อหุ่นยนต์ ผู้คน และเทคโนโลยี" : "An open research atlas for robotics, people and technology."}</p>
        <span>{th ? "แหล่งข้อมูล" : "Sources"}: OpenAlex · GitHub · GDELT · YouTube</span>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                "@id": "https://humanoid.or.th/#website",
                "url": "https://humanoid.or.th/",
                "name": "Thailand Humanoid Atlas",
                "description": "Research database, registry, and analysis platform tracking the humanoid, social, and service robotics ecosystem in Thailand.",
                "publisher": {
                  "@id": "https://humanoid.or.th/#organization"
                }
              },
              {
                "@type": "Organization",
                "@id": "https://humanoid.or.th/#organization",
                "name": "Thailand Humanoid Atlas Project",
                "url": "https://humanoid.or.th/",
                "logo": "https://humanoid.or.th/logo.png"
              },
              {
                "@type": "WebApplication",
                "@id": "https://humanoid.or.th/#webapplication",
                "name": "Thailand Humanoid Atlas Platform",
                "url": "https://humanoid.or.th/",
                "applicationCategory": "ResearchApplication",
                "operatingSystem": "All",
                "description": "An interactive, open-source database cataloging humanoid robot models, academic contributions, public media sentiment, and physical inventory assets in Thailand."
              }
            ]
          })
        }}
      />
    </div>
  );
}
