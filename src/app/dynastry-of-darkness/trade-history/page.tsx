import type { Metadata } from "next";
import Link from "next/link";
import { DYNASTRY_LEAGUE_ID } from "@/lib/config";
import { getTradeHistory } from "@/lib/trade-history";
import TradeHistory from "./TradeHistory";
import styles from "./trade-history.module.css";

export const metadata: Metadata = { title: "Dynastry of Darkness · Trade History" };
export const dynamic = "force-dynamic";

export default async function DynastryTradeHistoryPage() {
  const seasons = await getTradeHistory(DYNASTRY_LEAGUE_ID);
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
        <TradeHistory seasons={seasons} />
      </div>
    </main>
  );
}
