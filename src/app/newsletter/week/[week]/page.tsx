import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWeeklyReport, type ReportTeam } from "@/lib/weekly-report";
import { getNewsletterCommentary } from "@/lib/newsletter-commentary";
import PrintReportButton from "./PrintReportButton";
import FaabTable from "./FaabTable";
import styles from "./report.module.css";

type PageProps = { params: Promise<{ week: string }> };

export const dynamic = "force-dynamic";

function avatar(team: ReportTeam, size = 52) {
  return <Image src={`/avatars/${team.username}.jpg`} alt="" width={size} height={size} className={styles.avatar} />;
}

function score(value: number) {
  return value.toFixed(2);
}

function oddsColor(percent: number) {
  return `hsl(${Math.round(percent * 1.2)} 78% 48%)`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { week } = await params;
  return { title: `Week ${week} Report` };
}

export default async function WeeklyNewsletterPage({ params }: PageProps) {
  const week = Number((await params).week);
  if (!Number.isInteger(week) || week < 1 || week > 18) notFound();
  const report = await getWeeklyReport(week);
  if (week > report.lastCompletedWeek) notFound();
  const commentary = await getNewsletterCommentary(report);
  const commentaryByRoster = new Map(commentary?.teams.map((team) => [team.rosterId, team]) ?? []);
  const headlineMargin = report.highestScorer.score - report.highestScorer.opponentScore;

  return (
    <main className={styles.shell}>
      <div className={styles.toolbar}>
        <Link href="/the-redraft">Back to league</Link>
        <span>Email preview</span>
        <PrintReportButton />
      </div>
      <nav className={styles.weekTabs} aria-label="Newsletter weeks">
        {Array.from({ length: report.lastCompletedWeek }, (_, index) => index + 1).map((availableWeek) => (
          <Link
            key={availableWeek}
            href={`/newsletter/week/${availableWeek}`}
            aria-current={availableWeek === week ? "page" : undefined}
            className={availableWeek === week ? styles.weekTabActive : styles.weekTab}
          >
            Week {availableWeek}
          </Link>
        ))}
      </nav>

      <article className={styles.report}>
        <header className={styles.masthead}>
          <div className={styles.brandRow}>
            <div className={styles.mark}>TML</div>
            <div><strong>The Main Leagues</strong><span>Fantasy Football League Office</span></div>
            <div className={styles.issue}>Issue {String(week).padStart(2, "0")} / {report.season}</div>
          </div>
          <p className={styles.kicker}>{report.leagueName} · Week {week} report</p>
          <h1>{week === 1 ? "Opening shots fired." : `Week ${week}: the verdict.`}</h1>
          <p className={styles.deck}>{report.highestScorer.name} set the pace with {score(report.highestScorer.score)} points. The weekly review: who delivered, who left points behind, and what decided the matchups.</p>
          <div className={styles.heroStat}>
            {avatar(report.highestScorer, 76)}
            <div><span>Score of the week</span><strong>{report.highestScorer.name}</strong><small>{score(report.highestScorer.score)} points · {report.highestScorer.opponentName === "Bye week" ? "bye week" : headlineMargin === 0 ? "tied" : `${headlineMargin > 0 ? "won" : "lost"} by ${score(Math.abs(headlineMargin))}`}</small></div>
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
          <p className={styles.intro}>A season-long performance index blending total points, record, cumulative winning margin, lineup efficiency, and all-play record across every week played. It rewards how well a team has played all year, not just whether it escaped 1–0.</p>
          <div className={styles.rankings}>
            {report.powerRankings.map((team, index) => {
              const copy = commentaryByRoster.get(team.rosterId);
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
                  <small>{team.seasonWins}–{team.seasonLosses} record · {team.allPlayWins}–{report.powerRankings.length - 1 - team.allPlayWins} all-play this week · {team.lineupEfficiency.toFixed(0)}% efficiency</small>
                  <p>{copy?.blurb ?? team.blurb}</p>
                  <span className={styles.rankingAdvice}>{copy?.advice ?? team.advice}</span>
                </div>
                <span className={`${styles.movement} ${movementClass}`}>{movementLabel}</span>
                <b className={styles.indexScore}><small>Index</small>{team.powerIndex}</b>
              </div>
            })}
          </div>
          <p className={styles.method}><strong>Power Index (0–100), season to date:</strong> 35% total points for · 20% season record · 15% cumulative margin · 15% season lineup efficiency · 15% all-play record. Arrows show movement from last week&apos;s season rankings.</p>
          {commentary && <p className={styles.method}>AI-assisted commentary · {new Date(commentary.generatedAt).toLocaleDateString("en-GB", { timeZone: "UTC" })}</p>}
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
            <article>
              <span>Waiver wire pickup of the week</span>
              <h3>{report.waiverPickup.winners.length ? [...new Set(report.waiverPickup.winners.map((winner) => winner.managerName))].join(" · ") : report.waiverPickup.available ? "No qualifying pickups" : "Data unavailable"}</h3>
              {report.waiverPickup.winners.map((winner) => <p key={`${winner.rosterId}:${winner.playerId}`}>{winner.managerName} · {winner.playerName} · {score(winner.points)} points · {winner.started ? "Started" : "Benched"}</p>)}
              {!report.waiverPickup.available && <p>Sleeper transactions could not be loaded.</p>}
              {report.waiverPickup.available && !report.waiverPickup.winners.length && <p>No scored waiver or free-agent additions on this week&apos;s rosters.</p>}
              {report.waiverPickup.winners.length > 1 && <p>Shared honours.</p>}
            </article>
            <article>
              <span>Dumbest drop of the week</span>
              <h3>{report.dumbestDrop.losers.length ? [...new Set(report.dumbestDrop.losers.map((loser) => loser.managerName))].join(" · ") : report.dumbestDrop.available ? "No costly drops" : "Data unavailable"}</h3>
              {report.dumbestDrop.losers.map((loser) => <p key={`${loser.rosterId}:${loser.playerId}`}>Dropped {loser.playerName}{loser.position ? ` (${loser.position})` : ""} · {score(loser.points)} points this week</p>)}
              {!report.dumbestDrop.available && <p>Sleeper transactions or stats could not be loaded.</p>}
              {report.dumbestDrop.available && !report.dumbestDrop.losers.length && <p>No dropped player recorded a score this week.</p>}
              {report.dumbestDrop.losers.length > 1 && <p>Shared shame.</p>}
            </article>
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

        {week >= 3 && (
          <section className={`${styles.section} ${styles.pageBreak}`}>
            <div className={styles.sectionHeading}><span>07</span><div><p>The race</p><h2>Playoff chances</h2></div></div>
            <p className={styles.intro}>Six teams make the playoffs. Seeds 1–5 go to the best records; the final spot goes to the highest points-for among everyone else. Odds come from {report.playoffOdds.simulations.toLocaleString("en-GB")} simulations of the remaining Week {week + 1}–{report.playoffOdds.regularSeasonWeeks} schedule.</p>
            <div className={styles.playoffGrid}>
              {report.playoffOdds.teams.map((team, index) => (
                <div key={team.rosterId} className={index === 5 ? styles.playoffCutLine : undefined}>
                  <Image src={`/avatars/${team.username}.jpg`} alt="" width={40} height={40} className={styles.avatar} />
                  <div className={styles.playoffTeam}>
                    <strong>{team.teamName}</strong>
                    <small>{team.name} · {team.wins}–{team.losses} · {score(team.points)} PF</small>
                  </div>
                  <b style={{ background: oddsColor(team.playoff) }}>{team.playoff.toFixed(1)}%</b>
                </div>
              ))}
            </div>
            <p className={styles.method}><strong>How it works:</strong> each remaining game is played out using every team&apos;s scoring average so far, pulled toward the league average so early hot and cold streaks don&apos;t count for too much.</p>
          </section>
        )}

        <section className={`${styles.section} ${styles.pageBreak}`}>
          <div className={styles.sectionHeading}><span>{week >= 3 ? "08" : "07"}</span><div><p>The market</p><h2>FAAB breakdown</h2></div></div>
          <p className={styles.intro}>Every paid winning waiver bid through Week {week}, and what those players have actually delivered. Points only count while the player was in the buyer&apos;s starting lineup.</p>
          {(() => {
            const buys = report.faab.teams.flatMap((team) => team.players.filter((player) => player.bid > 0).map((player) => ({ ...player, managerName: team.name })));
            const bestValue = [...buys].sort((left, right) => right.startedPoints / right.bid - left.startedPoints / left.bid)[0];
            const priciest = [...buys].sort((left, right) => right.bid - left.bid || right.startedPoints - left.startedPoints)[0];
            if (!bestValue || !priciest) return null;
            return <div className={styles.faabHighlights}>
              <div><span>Best value buy</span><strong>{bestValue.playerName}</strong><small>{bestValue.managerName} · ${bestValue.bid} · {score(bestValue.startedPoints)} started pts · {(bestValue.startedPoints / bestValue.bid).toFixed(2)} per $1</small></div>
              <div><span>Biggest splash</span><strong>{priciest.playerName}</strong><small>{priciest.managerName} · ${priciest.bid} · {score(priciest.startedPoints)} started pts</small></div>
              <div><span>League total spent</span><strong>${report.faab.teams.reduce((total, team) => total + team.spent, 0)}</strong><small>of ${report.faab.budget * report.faab.teams.length} available</small></div>
            </div>;
          })()}
          <FaabTable teams={report.faab.teams} budget={report.faab.budget} />
          {!report.faab.available && <p className={styles.method}>Some Sleeper transactions could not be loaded, so totals may be incomplete.</p>}
          <div className={styles.faabMath}>
            <h3>How the math works</h3>
            <ol>
              <li><strong>Spent</strong> adds up every winning waiver bid from Week 1 to Week {week}. Failed bids, free-agent pickups and $0 claims are left out of the table entirely. Remaining budget is ${report.faab.budget} minus spent.</li>
              <li><strong>Started pts</strong> counts a player&apos;s points only in weeks he was in the buyer&apos;s starting lineup, from the week he was claimed onward. Bench weeks, and anything he scores after being dropped, don&apos;t count.</li>
              <li><strong>Pts per $1</strong> is started points ÷ FAAB spent. Example: $10 spent and 45 started points = 4.50 per $1. Managers who haven&apos;t spent anything show &ldquo;—&rdquo;.</li>
              <li><strong>Best value buy</strong> is the single paid claim with the highest started points ÷ bid. <strong>Biggest splash</strong> is the largest single bid.</li>
            </ol>
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