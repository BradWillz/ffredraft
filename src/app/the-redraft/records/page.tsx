import type { Metadata } from "next";
import Link from "next/link";
import { getRedraftRecords } from "@/lib/league-records-data";
import { recordLeaders, scoringRecords, type RecordPerformance, type RecordTeam } from "@/lib/league-records";
import { getAllPlayers } from "@/lib/sleeper";
import { reportPlayerName, type WeeklyPlayer } from "@/lib/weekly-report-analysis";
import RecordAvatar from "./RecordAvatar";
import styles from "./records.module.css";

export const metadata: Metadata = {
  title: "The Record Book | PlayStation Redraft",
  description: "The highs, lows and all-time receipts from the redraft league.",
};
export const dynamic = "force-dynamic";

const points = (value: number) => value.toFixed(2);

function Team({ team }: { team: RecordTeam }) {
  return <div className={styles.team}>
    <RecordAvatar team={team} />
    <div><strong>{team.name}</strong>{team.teamName && <small>{team.teamName}</small>}</div>
  </div>;
}

function Receipt({ entry, players }: { entry: RecordPerformance; players: Record<string, WeeklyPlayer> }) {
  return <details className={styles.receipt}>
    <summary>Open the lineup receipt</summary>
    {!entry.lineup.length ? <p>Sleeper has no saved starting lineup for this performance.</p> : <table>
      <caption className="sr-only">{entry.team.name}&apos;s starting lineup, {entry.season} Week {entry.week}</caption>
      <thead><tr><th scope="col">Slot</th><th scope="col">Starter</th><th scope="col">Points</th></tr></thead>
      <tbody>{entry.lineup.map((starter, index) => <tr key={`${index}:${starter.playerId}`}>
        <td>{starter.slot}</td>
        <td>{starter.playerId === "0" ? "Empty starting slot" : reportPlayerName(starter.playerId, players)}</td>
        <td>{starter.points === null ? "N/A" : points(starter.points)}</td>
      </tr>)}</tbody>
    </table>}
    <p className={styles.note}>Historical starters and league-scored points from Sleeper. Missing player scores are shown as N/A. Commissioner adjustments can make the team total differ from the starter sum.</p>
    <a href={`https://sleeper.com/leagues/${entry.id.split(":")[0]}/matchup/${entry.week}`} target="_blank" rel="noreferrer">View the week on Sleeper</a>
  </details>;
}

export default async function RecordsPage() {
  const data = await getRedraftRecords();
  const players: Record<string, WeeklyPlayer> = data.performances.length ? await getAllPlayers() : {};
  const records = scoringRecords(data.performances);
  const games = data.performances.length / 2;
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <Link href="/the-redraft" className="league-hub__back">Back to Redraft headquarters</Link>
        <p className="eyebrow">PlayStation Redraft / All-time receipts</p>
        <h1>The Record <span>Book.</span></h1>
        <p className={styles.lede}>Immortal performances. Generational stinkers. Every record has a name attached, and nobody gets to delete the evidence.</p>
        <div className={styles.stats}>
          <span><b>{data.seasons.length}</b> seasons with finalized weeks</span>
          <span><b>{games.toLocaleString()}</b> head-to-head game weeks</span>
          <span><b>10</b> claims to fame (or shame)</span>
        </div>
      </header>

      <div className={styles.content}>
        <aside className={styles.rules}>
          <h2>The small print</h2>
          <p>Scoring records cover finalized head-to-head weeks across the linked Sleeper history{data.seasons.length > 0 ? ` (${data.seasons[0]}-${data.seasons[data.seasons.length - 1]})` : ""}, including playoffs and consolation. Multi-week matchups count as individual weeks, not aggregate playoff results. Byes, unpaired teams and missing scores are excluded; genuine zero scores count. Totals include commissioner overrides.</p>
          <p>Streaks count regular-season wins or losses only, continuing across seasons for the same normalized manager identity. Ties break streaks; playoff and consolation results do not count. Pictures use the same manager avatars as the rest of the site. Historical team names reflect the metadata currently supplied for each season. The current season is included through the last scored week that the NFL clock marks as finished. Data refreshes hourly.</p>
          <p>Each record shows the top five performances, plus anyone tied at the cutoff. Equal record values share the crown.</p>
        </aside>

        {!data.performances.length ? <section className={styles.empty}><h2>The evidence locker is empty.</h2><p>Records will appear once Sleeper has finalized head-to-head weeks.</p></section> : <>
          <div className={styles.heading}><p className="eyebrow">One week. Eternal bragging rights.</p><h2>The highs &amp; the very lows</h2></div>
          <div className={styles.grid}>
            {records.map((record, index) => <article key={record.id} id={record.id} className={styles.card}>
              <div className={styles.cardMeta}><span>Record {String(index + 1).padStart(2, "0")}</span><span>{record.metric === "combined" ? "Combined points" : record.metric === "margin" ? "Winning margin" : "Team points"}</span></div>
              <h3>{record.title}</h3>
              <p className={styles.quip}>{record.quip}</p>
              {record.entries.length === 0 ? <p>No qualifying results yet.</p> : <>
                <div className={styles.value}>{points(record.entries[0][record.metric])}<small>pts</small></div>
                <div className={styles.entries}>{recordLeaders(record.entries, (entry) => entry[record.metric]).map((entry) => <div key={entry.id} className={styles.entry}>
                  <div className={styles.entryMeta}><span>{entry.season} / Week {entry.week}{!entry.regularSeason && " / Postseason"}</span><b>{entry[record.metric] === record.entries[0][record.metric] ? "Record holder" : `${points(entry[record.metric])} pts`}</b></div>
                  <Team team={entry.team} />
                  <p className={styles.scoreline}><strong>{points(entry.points)}</strong> - <strong>{points(entry.opponentPoints)}</strong> vs {entry.opponent.name}{entry.margin === 0 ? " (tie)" : entry.margin > 0 ? " (win)" : " (loss)"}</p>
                  <Receipt entry={entry} players={players} />
                </div>)}</div>
              </>}
            </article>)}
          </div>

          <div className={styles.heading}><p className="eyebrow">Form is temporary. Screenshots are forever.</p><h2>The streak department</h2></div>
          <div className={styles.grid}>
            {(["win", "loss"] as const).map((result) => {
              const entries = data.streaks.filter((streak) => streak.result === result).sort((a, b) => b.length - a.length || a.team.key.localeCompare(b.team.key));
              return <article key={result} className={styles.card}>
                <div className={styles.cardMeta}><span>Regular season only</span><span>Across seasons</span></div>
                <h3>{result === "win" ? "The Final Boss" : "The Longest Sunday"}</h3>
                <p className={styles.quip}>{result === "win" ? "The longest winning streak. The group chat must have been unbearable." : "The longest losing streak. Same time next week for more character building."}</p>
                {entries.length === 0 ? <p>No qualifying streaks yet.</p> : <>
                  <div className={styles.value}>{entries[0].length}<small>straight {result === "win" ? "wins" : "losses"}</small></div>
                  {recordLeaders(entries, (entry) => entry.length).map((entry) => <div key={`${entry.team.key}:${entry.start.season}:${entry.start.week}`} className={styles.entry}>
                    <div className={styles.entryMeta}><span>{entry.start.season} W{entry.start.week} to {entry.end.season} W{entry.end.week}</span><b>{entry.length === entries[0].length ? "Record holder" : `${entry.length} games`}</b></div>
                    <Team team={entry.team} />
                  </div>)}
                </>}
              </article>;
            })}
          </div>
        </>}
      </div>
    </main>
  );
}
