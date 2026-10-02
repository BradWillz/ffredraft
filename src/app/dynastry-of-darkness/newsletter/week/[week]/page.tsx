import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DYNASTRY_LEAGUE_ID } from "@/lib/config";
import { getWeeklyReport, type ReportLeague, type ReportTeam } from "@/lib/weekly-report";
import PrintReportButton from "@/app/newsletter/week/[week]/PrintReportButton";
import styles from "@/app/newsletter/week/[week]/report.module.css";

type PageProps = { params: Promise<{ week: string }> };

export const dynamic = "force-dynamic";

const DYNASTRY_REPORT_LEAGUE: ReportLeague = { leagueId: DYNASTRY_LEAGUE_ID, sideGames: false, playoffByRecord: 5, rookieDraft: true };

function avatar(team: Pick<ReportTeam, "username">, size = 52) {
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
  return { title: `Dynastry of Darkness · Week ${week} Report` };
}

export default async function DynastryNewsletterPage({ params }: PageProps) {
  const week = Number((await params).week);
  if (!Number.isInteger(week) || week < 1 || week > 18) notFound();
  const report = await getWeeklyReport(week, DYNASTRY_REPORT_LEAGUE);
  if (week > report.lastCompletedWeek) notFound();
  const headlineMargin = report.highestScorer.score - report.highestScorer.opponentScore;
  const lineupLeader = [...report.powerRankings].sort((a, b) => b.lineupEfficiency - a.lineupEfficiency)[0];

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

      <article className={styles.report}>
        <header className={styles.masthead}>
          <div className={styles.brandRow}>
            <div className={styles.mark}>DOD</div>
            <div><strong>Dynastry of Darkness</strong><span>Wrestling Dynasty League Office</span></div>
            <div className={styles.issue}>Issue {String(week).padStart(2, "0")} / {report.season}</div>
          </div>
          <p className={styles.kicker}>{report.leagueName} · Week {week} report</p>
          <h1>{week === 1 ? "The bell has rung." : `Week ${week}: the verdict.`}</h1>
          <p className={styles.deck}>{report.highestScorer.name} took the main event with {score(report.highestScorer.score)} points. The weekly review: who delivered, who left points on the bench, and what decided the matchups.</p>
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
          <div className={styles.sectionHeading}><span>01</span><div><p>Final bell</p><h2>Week {week} scoreboard</h2></div></div>
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
            <article><p>Low score</p><h3>{report.lowestScorer.name}</h3><strong>{score(report.lowestScorer.score)}</strong><span>Pinned, one-two-three.</span></article>
            <article><p>Lineup call</p><h3>{lineupLeader.name}</h3><strong>{lineupLeader.lineupEfficiency.toFixed(0)}%</strong><span>Best share of available roster points reached the lineup.</span></article>
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
                  <p>{team.blurb}</p>
                  <span className={styles.rankingAdvice}>{team.advice}</span>
                </div>
                <span className={`${styles.movement} ${movementClass}`}>{movementLabel}</span>
                <b className={styles.indexScore}><small>Index</small>{team.powerIndex}</b>
              </div>;
            })}
          </div>
          <p className={styles.method}><strong>Power Index (0–100), season to date:</strong> 35% total points for · 20% season record · 15% cumulative margin · 15% season lineup efficiency · 15% all-play record. Arrows show movement from last week&apos;s season rankings.</p>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}><span>04</span><div><p>The table</p><h2>Standings through Week {week}</h2></div></div>
          <div className={styles.standings}>
            {report.standings.map((team, index) => (
              <div key={team.rosterId}><span>{index + 1}</span>{avatar(team, 36)}<strong>{team.name}</strong><small>{team.seasonWins}–{team.seasonLosses}</small><b>{score(team.seasonPoints)} PF</b></div>
            ))}
          </div>
        </section>

        {week >= 3 && (
          <section className={`${styles.section} ${styles.pageBreak}`}>
            <div className={styles.sectionHeading}><span>05</span><div><p>Road to the title</p><h2>Playoff chances</h2></div></div>
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

        {report.rookieDraft && (
          <section className={`${styles.section} ${styles.pageBreak}`}>
            <div className={styles.sectionHeading}><span>{week >= 3 ? "06" : "05"}</span><div><p>Future of the dynasty</p><h2>{report.rookieDraft.season} rookie draft order</h2></div></div>
            <p className={styles.intro}>Projected as things stand after Week {week}, with pick ownership after every trade. Each cell shows who is on the clock with that pick.</p>
            <p className={styles.draftSwipe} aria-hidden="true">Swipe for all 12 picks →</p>
            <div className={styles.draftScroll}>
              <div className={styles.draftGrid} role="table" aria-label={`${report.rookieDraft.season} rookie draft order`}>
                <div role="row" className={styles.draftGridRow}>
                  <span role="columnheader" className={styles.draftCorner}>Pick</span>
                  {report.rookieDraft.picks.map((slot) => (
                    <div role="columnheader" key={slot.rosterId} className={`${styles.draftSlotHead} ${slot.pick === 7 ? styles.draftPlayoffStart : ""}`}>
                      <b>{slot.pick}</b>
                      <strong>{slot.name}</strong>
                      <small>{slot.seed == null ? `MPF ${Math.round(slot.maxPoints)}` : `Seed ${slot.seed}`}</small>
                    </div>
                  ))}
                </div>
                {Array.from({ length: report.rookieDraft.rounds }, (_, roundIndex) => (
                  <div role="row" key={roundIndex} className={styles.draftGridRow}>
                    <span role="rowheader" className={styles.draftRound}>R{roundIndex + 1}</span>
                    {report.rookieDraft!.picks.map((slot) => {
                      const owner = slot.owners[roundIndex];
                      return (
                        <div role="cell" key={slot.rosterId} className={`${owner.traded ? styles.draftTraded : styles.draftOwn} ${slot.pick === 7 ? styles.draftPlayoffStart : ""}`} title={owner.traded ? `${owner.name} via ${slot.name}` : owner.name}>
                          <small>{owner.round}.{String(slot.pick).padStart(2, "0")}</small>
                          {avatar(owner, 28)}
                          <strong>{owner.name}</strong>
                          {owner.traded && <em>via {slot.name}</em>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.faabMath}>
              <h3>How the order works</h3>
              <ol>
                <li><strong>Picks 1–6</strong> go to the six teams currently outside the playoff places, ordered by <strong>Max PF (MPF)</strong>: the lowest possible-points total picks first. Max PF is the best lineup each team could have started every week.</li>
                <li><strong>Picks 7–12</strong> go to the playoff teams. Final order is decided by the playoffs: the champion picks 12th, runner-up 11th, third 10th, and so on. Until then they&apos;re shown by projected seed, with the 6th seed at 7 and the top seed at 12.</li>
                <li>Playoff places use the league format: top 5 records, then the highest points-for among the rest.</li>
                <li><strong>Gold cells</strong> are traded picks; the avatar shows the manager who now owns it, and the lime line marks where the playoff teams start.</li>
              </ol>
            </div>
          </section>
        )}

        <footer className={styles.footer}>
          <div><strong>Next issue</strong><span>After Sleeper finalizes Week {week + 1}</span></div>
          <Link href="/dynastry-of-darkness">Open the league office</Link>
          <small>Generated from Sleeper scores, lineups and projections. Projection totals exclude team defence where Sleeper does not publish a matching projection record.</small>
        </footer>
      </article>
    </main>
  );
}
