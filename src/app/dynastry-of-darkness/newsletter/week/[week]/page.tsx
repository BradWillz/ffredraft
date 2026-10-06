import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DYNASTRY_REPORT_LEAGUE, getWeeklyReport } from "@/lib/weekly-report";
import { getNewsletterCommentary } from "@/lib/newsletter-commentary";
import PrintReportButton from "@/app/newsletter/week/[week]/PrintReportButton";
import EditorialNewsletter from "@/app/newsletter/week/[week]/EditorialNewsletter";
import styles from "@/app/newsletter/week/[week]/report.module.css";

type PageProps = { params: Promise<{ week: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { week } = await params;
  return { title: `Dynastry of Darkness · Week ${week} Report` };
}

export default async function DynastryNewsletterPage({ params }: PageProps) {
  const week = Number((await params).week);
  if (!Number.isInteger(week) || week < 1 || week > 18) notFound();
  const report = await getWeeklyReport(week, DYNASTRY_REPORT_LEAGUE);
  if (week > report.lastCompletedWeek) notFound();
  const commentary = await getNewsletterCommentary(report);

  return (
    <main className={styles.shell}>
      <div className={styles.toolbar}>
        <Link href="/dynastry-of-darkness">Back to league</Link>
        <span>Email preview</span>
        <PrintReportButton />
      </div>
      <nav className={styles.weekTabs} aria-label="Newsletter weeks">
        {Array.from({ length: report.lastCompletedWeek }, (_, index) => index + 1).map((availableWeek) => (
          <Link
            key={availableWeek}
            href={`/dynastry-of-darkness/newsletter/week/${availableWeek}`}
            aria-current={availableWeek === week ? "page" : undefined}
            className={availableWeek === week ? styles.weekTabActive : styles.weekTab}
          >
            Week {availableWeek}
          </Link>
        ))}
      </nav>
      <EditorialNewsletter
        report={report}
        week={week}
        commentary={commentary}
        leagueHref="/dynastry-of-darkness"
        league="dynasty"
      />
    </main>
  );
}
