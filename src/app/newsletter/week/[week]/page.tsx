import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWeeklyReport, type ReportTeam } from "@/lib/weekly-report";
import PrintReportButton from "./PrintReportButton";
import styles from "./report.module.css";

type PageProps = { params: Promise<{ week: string }> };

function avatar(team: ReportTeam, size = 52) {
  return <Image src={`/avatars/${team.username}.jpg`} alt="" width={size} height={size} className={styles.avatar} />;
}

function score(value: number) {
  return value.toFixed(2);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { week } = await params;
  return { title: `Week ${week} Report` };
}

export default async function WeeklyNewsletterPage({ params }: PageProps) {
  const week = Number((await params).week);
  if (!Number.isInteger(week) || week < 1 || week > 18) notFound();
  const report = await getWeeklyReport(week);
  const headlineMargin = report.highestScorer.score - report.highestScorer.opponentScore;

  return (
    <main className={styles.shell}>
      <div className={styles.toolbar}>
        <Link href="/the-redraft">Back to league</Link>
        <span>Email preview</span>
        <PrintReportButton />
      </div>

      <article className={styles.report}>
        <header className={styles.masthead}>
          <div className={styles.brandRow}>
            <div className={styles.mark}>TML</div>
            <div><strong>The Main Leagues</strong><span>Fantasy Football League Office</span></div>
            <div className={styles.issue}>Issue {String(week).padStart(2, "0")} / {report.season}</div>
          </div>
          <p className={styles.kicker}>{report.leagueName} · Week {week} report</p>
          <h1>Opening shots fired.</h1>
          <p className={styles.deck}>{report.highestScorer.name} set the pace with {score(report.highestScorer.score)} points, while the first power index separates genuine form from opening-week noise.</p>
          <div className={styles.heroStat}>
            {avatar(report.highestScorer, 76)}
            <div><span>Score of the week</span><strong>{report.highestScorer.name}</strong><small>{score(report.highestScorer.score)} points · won by {score(Math.abs(headlineMargin))}</small></div>
            <b>{score(report.highestScorer.score)}</b>
          </div>
        </header>

        <section className={styles.metricStrip} aria-label="Week at a glance">
          <div><span>Closest finish</span><strong>{score(report.closestGame.margin)}</strong><small>{report.closestGame.team1.name} vs {report.closestGame.team2.name}</small></div>
          <div><span>Biggest win</span><strong>{score(report.biggestWin.margin)}</strong><small>{report.biggestWin.team1.name} vs {report.biggestWin.team2.name}</small></div>
          <div><span>Bench points</span><strong>{score(report.benchLeader.benchPoints)}</strong><small>{report.benchLeader.name}</small></div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}><span>01</span><div><p>Final whistle</p><h2>Week {week} scoreboard</h2></div></div>
          <div className={styles.scoreboard}>
            {report.matchups.map((matchup) => {
              const winner = matchup.team1.score >= matchup.team2.score ? matchup.team1 : matchup.team2;
              return (
                <div key={matchup.id} className={styles.matchup}>
                  {[matchup.team1, matchup.team2].map((team) => (
                    <div key={team.rosterId} className={team === winner ? styles.winner : undefined}>
                      <span>{team === winner ? "W" : "L"}</span>{avatar(team, 34)}<strong>{team.name}</strong><b>{score(team.score)}</b>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>

        <section className={`${styles.section} ${styles.pageBreak}`}>
          <div className={styles.sectionHeading}><span>02</span><div><p>The film room</p><h2>Numbers that mattered</h2></div></div>
          <div className={styles.features}>
            <article className={styles.featureLead}>
              <p>Upset of the week</p>
              {report.upset ? <><h3>{report.upset.winner.name} flipped the forecast</h3><strong>{score(report.upset.winner.score)}–{score(report.upset.loser.score)}</strong><span>Beat {report.upset.loser.name} despite trailing the player-only Sleeper projection by {score(report.upset.projectionGap)}.</span></> : <><h3>The favourites held firm</h3><span>No winning team entered below its opponent on Sleeper&apos;s player-only projections.</span></>}
            </article>
            <article><p>Low score</p><h3>{report.lowestScorer.name}</h3><strong>{score(report.lowestScorer.score)}</strong><span>A week to delete from the group chat.</span></article>
            <article><p>Lineup call</p><h3>{[...report.powerRankings].sort((a, b) => b.lineupEfficiency - a.lineupEfficiency)[0].name}</h3><strong>{[...report.powerRankings].sort((a, b) => b.lineupEfficiency - a.lineupEfficiency)[0].lineupEfficiency.toFixed(0)}%</strong><span>Best share of available roster points reached the lineup.</span></article>
          </div>
          <div className={styles.playerList}>
            <h3>Top starters</h3>
            {report.topPlayers.map((player, index) => (
              <div key={player.playerId}><span>{index + 1}</span><strong>{player.name}</strong><small>{player.position} · {player.nflTeam} · {player.managerName}</small><b>{score(player.points)}</b></div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}><span>03</span><div><p>Form table</p><h2>Power rankings</h2></div></div>
          <p className={styles.intro}>A weekly performance index blending score, winning margin, lineup efficiency, and all-play record. It rewards how well a team played, not just whether it escaped 1–0.</p>
          <div className={styles.rankings}>
            {report.powerRankings.map((team, index) => {
              const movementLabel = team.rankMovement == null
                ? null
                : team.rankMovement > 0
                  ? `↑ ${team.rankMovement}`
                  : team.rankMovement < 0
                    ? `↓ ${Math.abs(team.rankMovement)}`
                    : "—";
              const movementClass = team.rankMovement == null || team.rankMovement === 0
                ? styles.movementNeutral
                : team.rankMovement > 0
                  ? styles.movementUp
                  : styles.movementDown;
              return <div key={team.rosterId} className={styles.rankingRow}>
                <span className={styles.rankNumber}>{index + 1}</span>
                {avatar(team, 42)}
                <div className={styles.rankingCopy}>
                  <strong>{team.name}</strong>
                  <small>{team.allPlayWins}–{report.powerRankings.length - 1 - team.allPlayWins} all-play · {team.lineupEfficiency.toFixed(0)}% efficiency</small>
                  <p>{team.blurb}</p>
                </div>
                <span className={`${styles.movement} ${movementClass}`}>{movementLabel}</span>
                <b className={styles.indexScore}><small>Index</small>{team.powerIndex}</b>
              </div>
            })}
          </div>
          <p className={styles.method}><strong>Power Index (0–100):</strong> 45% PF (your final weekly score) · 20% winning margin · 20% lineup efficiency · 15% all-play record. Arrows show movement from last week.</p>
        </section>

        <section className={`${styles.section} ${styles.pageBreak}`}>
          <div className={styles.sectionHeading}><span>04</span><div><p>Survival pool</p><h2>Last Man Standing</h2></div></div>
          <p className={styles.intro}>One manager falls each week. The lowest scorer still alive is eliminated; previous casualties cannot be eliminated twice. The final survivor wins the LMS pot.</p>
          {report.lastManStanding.eliminated.at(-1) && (() => {
            const latest = report.lastManStanding.eliminated.at(-1)!;
            return <div className={styles.lmsElimination}>
              <div className={styles.skull} aria-hidden="true">☠</div>
              <div>
                <span>Week {latest.week} eliminated</span>
                <h3>{latest.name} is out.</h3>
                <p>{score(latest.score)} points. Lowest eligible scorer, first name in the graveyard.</p>
              </div>
            </div>;
          })()}
          <div className={styles.lmsSummary}>
            <div><strong>{report.lastManStanding.contenders.length}</strong><span>Still standing</span></div>
            <div><strong>{report.lastManStanding.eliminated.length}</strong><span>Eliminated</span></div>
            <div><strong>{Math.max(0, 12 - report.lastManStanding.eliminated.length)}</strong><span>Weeks remaining</span></div>
          </div>
          <div className={styles.lmsRoster}>
            <div className={styles.lmsGroup}>
              <h3>Still alive</h3>
              <div>{report.lastManStanding.contenders.map((team) => <span key={team.rosterId}>{team.name}</span>)}</div>
            </div>
            <div className={styles.lmsGroup}>
              <h3>Graveyard</h3>
              <div>{report.lastManStanding.eliminated.map((team) => <span key={team.rosterId} className={styles.eliminated}><b aria-hidden="true">☠</b> {team.name} · W{team.week}</span>)}</div>
            </div>
          </div>
          {report.lastManStanding.winner && <div className={styles.lmsWinner}><span>Last man standing</span><strong>{report.lastManStanding.winner.name}</strong></div>}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}><span>05</span><div><p>Around the league</p><h2>Side quests</h2></div></div>
          <div className={styles.sideQuests}>
            <article><span>The Power</span><h3>{report.powerHolder?.holderName ?? "Awaiting result"}</h3><p>{report.powerHolder?.reason ?? "Sleeper has not finalized this chapter."}</p></article>
            <article><span>Spin the Wheel</span><h3>{report.wheel?.scenario ?? "No result recorded"}</h3><p>{report.wheel?.winnerName ? `${report.wheel.winnerName} · ${report.wheel.details ?? "Winner recorded"}` : "Commissioner result pending."}</p></article>
            <article><span>Ladbrokes</span><h3>{report.ladbrokes.winners.length ? report.ladbrokes.winners.map((winner) => winner.displayName).join(" · ") : "No entries"}</h3><p>{report.ladbrokes.winners.length ? `${report.ladbrokes.winners[0].correct}/${report.ladbrokes.total} correct · joint winners of the weekly prediction card.` : "No locked entries were recorded."}</p></article>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}><span>06</span><div><p>The table</p><h2>Standings through Week {week}</h2></div></div>
          <div className={styles.standings}>
            {report.standings.map((team, index) => (
              <div key={team.rosterId}><span>{index + 1}</span>{avatar(team, 36)}<strong>{team.name}</strong><small>{team.seasonWins}–{team.seasonLosses}</small><b>{score(team.seasonPoints)} PF</b></div>
            ))}
          </div>
        </section>

        <footer className={styles.footer}>
          <div><strong>Next issue</strong><span>After Sleeper finalizes Week {week + 1}</span></div>
          <Link href="/the-redraft">Open the league office</Link>
          <small>Generated from Sleeper scores, lineups and half-PPR projections, plus The Main Leagues commissioner tools. Projection totals exclude team defence where Sleeper does not publish a matching projection record.</small>
        </footer>
      </article>
    </main>
  );
}