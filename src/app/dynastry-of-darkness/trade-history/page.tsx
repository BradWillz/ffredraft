import type { Metadata } from "next";
import Link from "next/link";
import { DYNASTRY_LEAGUE_ID } from "@/lib/config";
import { getTradeLedger } from "@/lib/trade-history";
import { getTradeGrades } from "@/lib/trade-valuation";
import TradeHistory from "./TradeHistory";
import styles from "./trade-history.module.css";

export const metadata: Metadata = { title: "Dynastry of Darkness · Trade History" };
export const dynamic = "force-dynamic";

export default async function DynastryTradeHistoryPage() {
  const ledger = await getTradeLedger(DYNASTRY_LEAGUE_ID);
  const grades = await getTradeGrades(ledger);
  const seasons = ledger.seasons;
  const totalTrades = seasons.reduce((total, season) => total + season.trades.length, 0);

  return (
    <main className={styles.shell}>
      <div className={styles.inner}>
        <Link href="/dynastry-of-darkness" className={styles.back}>← Dynastry of Darkness</Link>
        <header className={styles.header}>
          <p>The transaction ledger</p>
          <h1>Trade history</h1>
          <span>{totalTrades} trades since {seasons.at(-1)?.season ?? "the start"}. Every player, pick and FAAB dollar that changed hands, and who those picks became.</span>
        </header>
        {grades.error && <p role="alert" className={styles.error}>{grades.error}</p>}
        <TradeHistory seasons={seasons} assessments={grades.assessments} />
        <p className={styles.source}>
          Player and pick values: <a href="https://statsguyfantasy.com" target="_blank" rel="noopener noreferrer">Data from Stats Guy Fantasy</a>.
          Rosters, scoring and stats from Sleeper. Grades updated {new Date(grades.computedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC.
        </p>
      </div>
    </main>
  );
}
