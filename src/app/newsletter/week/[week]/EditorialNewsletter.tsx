import Image from "next/image";
import Link from "next/link";
import { Source_Serif_4 } from "next/font/google";
import type { FraudWatch, FraudWatchEntry, ReportTeam, WeeklyReport } from "@/lib/weekly-report";
import type { FraudWatchCommentary, NewsletterCommentary } from "@/lib/newsletter-commentary";
import FaabTable from "./FaabTable";
import PlayerHeadshot from "./PlayerHeadshot";
import legacy from "./report.module.css";
import styles from "./editorial.module.css";

const serif = Source_Serif_4({ subsets: ["latin"], weight: ["400", "600", "700"], style: ["normal", "italic"], variable: "--font-serif" });

type Props = { report: WeeklyReport; week: number; commentary: NewsletterCommentary | null; leagueHref: string };

function score(value: number) {
  return value.toFixed(2);
}

function avatar(username: string, size: number, className = styles.avatar) {
  return <Image src={`/avatars/${username}.jpg`} alt="" width={size} height={size} className={className} />;
}

function oddsColor(percent: number) {
  return `hsl(${Math.round(percent * 1.2)} 78% 48%)`;
}

const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
function countWord(value: number) {
  return NUMBER_WORDS[value] ?? String(value);
}

function joinNames(names: string[]) {
  const unique = [...new Set(names)];
  return unique.length <= 1 ? unique.join("") : `${unique.slice(0, -1).join(", ")} & ${unique.at(-1)}`;
}

function frontPage(report: WeeklyReport, week: number) {
  const leader = report.powerRankings[0];
  const top = report.highestScorer;
  const rivals = report.powerRankings.length - 1;
  let headline: string;
  if (leader.rankMovement != null && leader.rankMovement > 0) headline = `${leader.name} takes control`;
  else if (report.upset) headline = `${report.upset.winner.name} stuns ${report.upset.loser.name}`;
  else if (leader.rosterId === top.rosterId) headline = `${leader.name} tightens the grip`;
  else headline = `${top.name} sets the pace`;

  const clauses = [`${score(top.score)} points.`];
  if (top.allPlayWins === rivals) clauses.push(`An unbeaten ${top.allPlayWins}–0 all-play week.`);
  else clauses.push(`${top.allPlayWins}–${rivals - top.allPlayWins} in the all-play.`);
  if (leader.rankMovement != null && leader.rankMovement > 0) clauses.push("The league has a new team to beat.");
  else if (report.upset) clauses.push(`${report.upset.winner.name} beat the projections by ${score(report.upset.projectionGap)}.`);
  else clauses.push(`${leader.name} still leads the Power List.`);

  return { headline: `Week ${week}: ${headline}`, standfirst: clauses.join(" ") };
}

function record(entry: FraudWatchEntry) {
  return `${entry.wins}–${entry.losses}${entry.ties ? `–${entry.ties}` : ""}`;
}

function luck(value: number) {
  const rounded = value.toFixed(2);
  return value > 0 ? `+${rounded}` : rounded.replace("-", "−");
}

function trimmed(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function ordinal(value: number) {
  const suffix = value % 100 >= 11 && value % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][value % 10] ?? "th";
  return `${value}${suffix}`;
}

function fraudWatchCopy(fraudWatch: FraudWatch, saved: FraudWatchCommentary | undefined) {
  const { primary, mostRobbed } = fraudWatch;
  // Saved prose is only used when it was written about the same subjects this report calculates.
  const matches = saved
    && saved.primaryRosterId === (primary?.rosterId ?? null)
    && saved.mostRobbedRosterId === (mostRobbed?.rosterId ?? null);
  const fallback = {
    headline: primary ? "The record is lying" : "No fraud detected",
    commentary: primary
      ? `${primary.name} is ${record(primary)}, but ${trimmed(primary.allPlayWins)} wins from ${primary.allPlayPossible} all-play matchups are worth only ${primary.expectedWins.toFixed(2)} expected wins. The difference is ${luck(primary.scheduleLuck)} wins of pure schedule luck.`
      : `For once, the table is telling the truth. No record sits more than ${luck(fraudWatch.threshold)} wins ahead of its all-play performance.`,
    mostRobbedCommentary: mostRobbed
      ? `${mostRobbed.name} has beaten ${trimmed(mostRobbed.allPlayWins)} of ${mostRobbed.allPlayPossible} possible all-play opponents, yet the record shows only ${record(mostRobbed)}.`
      : "",
  };
  if (!matches) return fallback;
  return {
    headline: primary ? saved.headline || fallback.headline : "No fraud detected",
    commentary: saved.commentary || fallback.commentary,
    mostRobbedCommentary: saved.mostRobbedCommentary || fallback.mostRobbedCommentary,
  };
}

function powerHeadline(team: ReportTeam, index: number, total: number) {
  const movement = team.rankMovement ?? 0;
  if (index === 0) return movement > 0 ? "The new team to beat" : "Still the team to beat";
  if (team.allPlayWins === total - 1) return "Nobody could live with them";
  if (movement >= 2) return "On the charge";
  if (movement <= -2) return "Sliding down the list";
  if (team.allPlayWins === 0) return "Bottom of the all-play";
  if (index === total - 1) return "Running out of excuses";
  if (team.lineupEfficiency >= 95) return "Every lineup call landed";
  if (team.lineupEfficiency < 75) return "Points left on the bench";
  return team.won ? "Job done" : "Still searching";
}

export default function EditorialNewsletter({ report, week, commentary, leagueHref }: Props) {
  const commentaryByRoster = new Map(commentary?.teams.map((team) => [team.rosterId, team]) ?? []);
  const { headline, standfirst } = frontPage(report, week);
  const headlineMargin = report.highestScorer.score - report.highestScorer.opponentScore;
  const lineupCall = [...report.powerRankings].sort((a, b) => b.lineupEfficiency - a.lineupEfficiency)[0];
  const totalTeams = report.powerRankings.length;
  const fraud = report.fraudWatch;
  const fraudCopy = fraudWatchCopy(fraud, commentary?.fraudWatch);

  const upsetStory = {
    key: "upset",
    kicker: "Upset of the week",
    title: report.upset ? `${report.upset.winner.name} flipped the forecast` : "The favourites held firm",
    stat: report.upset ? `${score(report.upset.winner.score)}–${score(report.upset.loser.score)}` : null,
    body: report.upset
      ? `Beat ${report.upset.loser.name} despite trailing the player-only Sleeper projection by ${score(report.upset.projectionGap)}.`
      : "No winning team entered below its opponent on Sleeper's player-only projections.",
    team: report.upset?.winner ?? null,
  };
  const lowStory = { key: "low", kicker: "Low score", title: report.lowestScorer.name, stat: score(report.lowestScorer.score), body: "A week to delete from the group chat.", team: report.lowestScorer };
  const lineupStory = { key: "lineup", kicker: "Lineup call", title: lineupCall.name, stat: `${lineupCall.lineupEfficiency.toFixed(0)}%`, body: "Best share of available roster points reached the lineup.", team: lineupCall };
  const [leadStory, ...supportingStories] = report.upset ? [upsetStory, lowStory, lineupStory] : [lowStory, upsetStory, lineupStory];

  const latestElimination = report.lastManStanding.eliminated.at(-1);
  const lmsWeeksRemaining = Math.max(0, 12 - report.lastManStanding.eliminated.length);

  const waiverManagers = report.waiverPickup.winners.map((winner) => winner.managerName);
  const dropManagers = report.dumbestDrop.losers.map((loser) => loser.managerName);
  const briefs = [
    {
      key: "waiver",
      kicker: "Waiver wire pickup of the week",
      title: report.waiverPickup.winners.length
        ? report.waiverPickup.winners.length === 1
          ? `${report.waiverPickup.winners[0].managerName} strikes gold with ${report.waiverPickup.winners[0].playerName}`
          : `${joinNames(waiverManagers)} share the spoils`
        : report.waiverPickup.available ? "No qualifying pickups" : "Data unavailable",
      lines: [
        ...report.waiverPickup.winners.map((winner) => `${winner.managerName} · ${winner.playerName} · ${score(winner.points)} points · ${winner.started ? "Started" : "Benched"}`),
        ...(!report.waiverPickup.available ? ["Sleeper transactions could not be loaded."] : []),
        ...(report.waiverPickup.available && !report.waiverPickup.winners.length ? ["No scored waiver or free-agent additions on this week's rosters."] : []),
        ...(report.waiverPickup.winners.length > 1 ? ["Shared honours."] : []),
      ],
      tone: styles.toneLime,
    },
    {
      key: "drop",
      kicker: "Dumbest drop of the week",
      title: report.dumbestDrop.losers.length
        ? report.dumbestDrop.losers.length === 1
          ? `${report.dumbestDrop.losers[0].managerName} lets ${report.dumbestDrop.losers[0].playerName} walk`
          : `${joinNames(dropManagers)} share the shame`
        : report.dumbestDrop.available ? "No costly drops" : "Data unavailable",
      lines: [
        ...report.dumbestDrop.losers.map((loser) => `${loser.managerName} · Dropped ${loser.playerName}${loser.position ? ` (${loser.position})` : ""} · ${score(loser.points)} points this week`),
        ...(!report.dumbestDrop.available ? ["Sleeper transactions or stats could not be loaded."] : []),
        ...(report.dumbestDrop.available && !report.dumbestDrop.losers.length ? ["No dropped player recorded a score this week."] : []),
        ...(report.dumbestDrop.losers.length > 1 ? ["Shared shame."] : []),
      ],
      tone: styles.toneOrange,
    },
    ...(report.whiffOfTheWeek ? [{
      key: "whiff",
      kicker: "Whiff of the week",
      title: `${report.whiffOfTheWeek.managerName} benched the win`,
      lines: [
        `Starting ${report.whiffOfTheWeek.incomingPlayer} instead of ${report.whiffOfTheWeek.outgoingPlayer} would have turned the loss into a ${score(report.whiffOfTheWeek.winMargin)}-point win over ${report.whiffOfTheWeek.opponentName}.`,
        "You're not as dull as you look.",
      ],
      tone: styles.toneGold,
    }] : []),
    {
      key: "power",
      kicker: "The Power",
      title: report.powerHolder ? `${report.powerHolder.holderName} holds The Power` : "Awaiting result",
      lines: [report.powerHolder?.reason ?? "Sleeper has not finalized this chapter."],
      tone: styles.toneLime,
    },
    {
      key: "wheel",
      kicker: "Spin the Wheel",
      title: report.wheel?.scenario ?? "No result recorded",
      lines: [report.wheel?.winnerName ? `${report.wheel.winnerName} · ${report.wheel.details ?? "Winner recorded"}` : "Commissioner result pending."],
      tone: styles.toneGold,
    },
    {
      key: "ladbrokes",
      kicker: "Ladbrokes",
      title: report.ladbrokes.winners.length ? `${joinNames(report.ladbrokes.winners.map((winner) => winner.displayName))} read the card` : "No entries",
      lines: [report.ladbrokes.winners.length ? `${report.ladbrokes.winners[0].correct}/${report.ladbrokes.total} correct · joint winners of the weekly prediction card.` : "No locked entries were recorded."],
      tone: styles.toneOrange,
    },
  ];

  const leagueSpent = report.faab.teams.reduce((total, team) => total + team.spent, 0);
  const leagueBudget = report.faab.budget * report.faab.teams.length;
  const buys = report.faab.teams.flatMap((team) => team.players.filter((player) => player.bid > 0).map((player) => ({ ...player, managerName: team.name })));
  const bestValue = [...buys].sort((left, right) => right.startedPoints / right.bid - left.startedPoints / left.bid)[0];
  const priciest = [...buys].sort((left, right) => right.bid - left.bid || right.startedPoints - left.startedPoints)[0];

  return (
    <article className={`${styles.paper} ${serif.variable}`}>
      {/* FRONT PAGE */}
      <header className={styles.frontPage}>
        <div className={styles.nameplate}>
          <div className={styles.mark}>TML</div>
          <div className={styles.titleBlock}>
            <strong>The Main Leagues</strong>
            <span>Fantasy Football League Office</span>
          </div>
          <div className={styles.dateline}>
            <span>Issue {String(week).padStart(2, "0")}</span>
            <span>{report.season} season</span>
          </div>
        </div>
        <div className={styles.folio}>
          <span>{report.leagueName}</span>
          <span>Week {week} edition</span>
          <span>{report.matchups.length} matchups · {totalTeams} managers</span>
        </div>

        <div className={styles.splash}>
          <div className={styles.splashCopy}>
            <p className={styles.kicker}>The lead</p>
            <h1>{headline}</h1>
            <p className={styles.standfirst}>{standfirst}</p>
          </div>
          <figure className={styles.splashFigure}>
            {avatar(report.highestScorer.username, 128, styles.splashAvatar)}
            <figcaption>
              <span>Score of the week</span>
              <strong>{report.highestScorer.name}</strong>
              <b>{score(report.highestScorer.score)}</b>
              <small>{report.highestScorer.opponentName === "Bye week" ? "bye week" : headlineMargin === 0 ? "tied" : `${headlineMargin > 0 ? "won" : "lost"} by ${score(Math.abs(headlineMargin))}`}{report.highestScorer.opponentName !== "Bye week" && ` vs ${report.highestScorer.opponentName}`}</small>
            </figcaption>
          </figure>
        </div>

        <dl className={styles.ticker} aria-label="Week at a glance">
          <div><dt>Score of the week</dt><dd><b>{score(report.highestScorer.score)}</b><span>{report.highestScorer.name}</span></dd></div>
          <div><dt>Closest finish</dt><dd><b>{score(report.closestGame.margin)}</b><span>{report.closestGame.team1.name} vs {report.closestGame.team2.name}</span></dd></div>
          <div><dt>Biggest win</dt><dd><b>{score(report.biggestWin.margin)}</b><span>{report.biggestWin.team1.name} vs {report.biggestWin.team2.name}</span></dd></div>
          <div><dt>Bench points</dt><dd><b>{score(report.benchLeader.benchPoints)}</b><span>{report.benchLeader.name}</span></dd></div>
        </dl>

        <nav className={styles.contents} aria-label="In this issue">
          <span>Inside</span>
          <a href="#week-that-was">The Week That Was</a>
          <a href="#power-list">The Power List</a>
          <a href="#around-the-league">Around the League</a>
          <a href="#state-of-play">The State of Play</a>
          <a href="#market">The Market</a>
        </nav>
      </header>

      {/* THE WEEK THAT WAS */}
      <section id="week-that-was" className={styles.chapter}>
        <header className={styles.chapterHead}>
          <h2>The Week That Was</h2>
          <p>Every result, and the numbers that decided them.</p>
        </header>

        <h3 className={styles.rubric}>Week {week} results</h3>
        <div className={styles.results}>
          {report.matchups.map((matchup) => {
            const winner = matchup.team1.score >= matchup.team2.score ? matchup.team1 : matchup.team2;
            return (
              <div key={matchup.id} className={styles.result}>
                {[matchup.team1, matchup.team2].map((team) => (
                  <div key={team.rosterId} className={team === winner ? styles.resultWinner : undefined}>
                    <span>{team === winner ? "W" : "L"}</span>{avatar(team.username, 28)}<strong>{team.name}</strong><b>{score(team.score)}</b>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <h3 className={styles.rubric}>Numbers that mattered</h3>
        <div className={styles.storyGrid}>
          <article className={styles.leadStory}>
            <p className={styles.kicker}>{leadStory.kicker}</p>
            <h4>{leadStory.title}</h4>
            {leadStory.stat && <b className={styles.leadFigure}>{leadStory.stat}</b>}
            <p className={styles.body}>{leadStory.body}</p>
          </article>
          <div className={styles.sideStories}>
            {supportingStories.map((story) => (
              <article key={story.key} className={styles.sideStory}>
                <p className={styles.kicker}>{story.kicker}</p>
                <h4>{story.title}{story.stat && <b>{story.stat}</b>}</h4>
                <p className={styles.body}>{story.body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className={styles.boxScore}>
          <h4>Top starters</h4>
          <ol>
            {report.topPlayers.map((player) => (
              <li key={player.playerId}><PlayerHeadshot playerId={player.playerId} className={styles.headshot} /><strong>{player.name}</strong><small>{player.position} · {player.nflTeam} · {player.managerName}</small><b>{score(player.points)}</b></li>
            ))}
          </ol>
        </div>
      </section>

      {/* THE POWER LIST */}
      <section id="power-list" className={styles.chapter}>
        <header className={styles.chapterHead}>
          <h2>The Power List</h2>
          <p>Who&apos;s rising, who&apos;s falling and who&apos;s running out of excuses.</p>
        </header>
        <p className={styles.note}>A season-long performance index blending total points, record, cumulative winning margin, lineup efficiency, and all-play record across every week played. It rewards how well a team has played all year, not just whether it escaped 1–0.</p>

        <ol className={styles.powerList}>
          {report.powerRankings.map((team, index) => {
            const copy = commentaryByRoster.get(team.rosterId);
            const movement = team.rankMovement;
            const movementLabel = movement == null ? null : movement > 0 ? `↑${movement}` : movement < 0 ? `↓${Math.abs(movement)}` : "—";
            const movementClass = movement == null || movement === 0 ? styles.moveFlat : movement > 0 ? styles.moveUp : styles.moveDown;
            return (
              <li key={team.rosterId} className={index === 0 ? styles.powerTop : undefined}>
                <div className={styles.powerHead}>
                  <span className={styles.powerRank}>{index + 1}</span>
                  {avatar(team.username, index === 0 ? 56 : 40)}
                  <strong className={styles.powerName}>{team.name}</strong>
                  {movementLabel && <span className={`${styles.move} ${movementClass}`}>{movementLabel}</span>}
                </div>
                <p className={styles.powerMeta}>
                  <span>{team.seasonWins}–{team.seasonLosses}</span>
                  <span>{team.allPlayWins}–{totalTeams - 1 - team.allPlayWins} all-play this week</span>
                  <span>{team.lineupEfficiency.toFixed(0)}% efficiency</span>
                  <span className={styles.powerIndex}>Power Index {team.powerIndex}</span>
                </p>
                <h4 className={styles.powerHeadline}>{powerHeadline(team, index, totalTeams)}</h4>
                <p className={styles.powerCopy}>{copy?.blurb ?? team.blurb}</p>
                <p className={styles.powerAdvice}>{copy?.advice ?? team.advice}</p>
                {team.nextOpponentName !== "your next opponent" && <p className={styles.powerNext}>Next: <b>{team.nextOpponentName}</b></p>}
              </li>
            );
          })}
        </ol>
        <p className={styles.note}><strong>Power Index (0–100), season to date:</strong> 35% total points for · 20% season record · 15% cumulative margin · 15% season lineup efficiency · 15% all-play record. Arrows show movement from last week&apos;s season rankings.</p>
        {commentary && <p className={styles.note}>AI-assisted commentary · {new Date(commentary.generatedAt).toLocaleDateString("en-GB", { timeZone: "UTC" })}</p>}
      </section>

      {/* AROUND THE LEAGUE */}
      <section id="around-the-league" className={styles.chapter}>
        <header className={styles.chapterHead}>
          <h2>Around the League</h2>
          <p>Survival, side quests and the stories from the group chat.</p>
        </header>

        <article className={styles.lms}>
          <p className={styles.kicker}>Last Man Standing</p>
          {latestElimination ? (
            <>
              <h3><span aria-hidden="true">☠</span> {latestElimination.name} enters the graveyard</h3>
              <p className={styles.standfirstSmall}>{score(latestElimination.score)} points sealed his fate. {countWord(report.lastManStanding.contenders.length)} {report.lastManStanding.contenders.length === 1 ? "manager remains" : "managers remain"}.</p>
            </>
          ) : <h3>Everyone still breathing</h3>}
          <p className={styles.body}>One manager falls each week. The lowest scorer still alive is eliminated; previous casualties cannot be eliminated twice. The final survivor wins the LMS pot.</p>
          <dl className={styles.lmsFigures}>
            <div><dt>Still standing</dt><dd>{report.lastManStanding.contenders.length}</dd></div>
            <div><dt>Eliminated</dt><dd>{report.lastManStanding.eliminated.length}</dd></div>
            <div><dt>Weeks remaining</dt><dd>{lmsWeeksRemaining}</dd></div>
          </dl>
          <div className={styles.lmsLists}>
            <div>
              <h4>Still alive</h4>
              <p>{report.lastManStanding.contenders.map((team) => <span key={team.rosterId}>{team.name}</span>)}</p>
            </div>
            <div>
              <h4>Graveyard</h4>
              <p>{report.lastManStanding.eliminated.map((team) => <span key={team.rosterId} className={styles.dead}><b aria-hidden="true">☠</b> <s>{team.name}</s> · W{team.week}</span>)}</p>
            </div>
          </div>
          {report.lastManStanding.winner && <p className={styles.lmsWinner}>Last man standing: <strong>{report.lastManStanding.winner.name}</strong></p>}
        </article>

        <div className={styles.briefs}>
          {briefs.map((brief) => (
            <article key={brief.key} className={`${styles.brief} ${brief.tone}`}>
              <p className={styles.kicker}>{brief.kicker}</p>
              <h4>{brief.title}</h4>
              {brief.lines.map((line) => <p key={line} className={styles.body}>{line}</p>)}
            </article>
          ))}
        </div>
      </section>

      {/* THE STATE OF PLAY */}
      <section id="state-of-play" className={`${styles.chapter} ${styles.chapterBreak}`}>
        <header className={`${styles.chapterHead} ${styles.chapterHeadMajor}`}>
          <p className={styles.kicker}>From the week to the season</p>
          <h2>The State of Play</h2>
          <p>Where everyone stands today — and where the numbers say they&apos;ll finish.</p>
        </header>

        <h3 className={styles.rubric}>League table <small>Through Week {week}</small></h3>
        <table className={styles.table}>
          <thead><tr><th>#</th><th>Manager</th><th>W–L</th><th>PF</th></tr></thead>
          <tbody>
            {report.standings.map((team, index) => (
              <tr key={team.rosterId}>
                <td className={styles.tableRank}>{index + 1}</td>
                <td><span className={styles.tableTeam}>{avatar(team.username, 26)}<strong>{team.name}</strong></span></td>
                <td>{team.seasonWins}–{team.seasonLosses}</td>
                <td className={styles.tablePoints}>{score(team.seasonPoints)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className={styles.rubric}>Fraud Watch <small>Weeks 1–{week}</small></h3>
        <p className={styles.fraudStandfirst}>The standings say one thing. The underlying numbers say another.</p>
        {fraud.primary ? (
          <article className={styles.fraudLead}>
            {avatar(fraud.primary.username, 84, `${styles.avatar} ${styles.fraudAvatar}`)}
            <div>
              <p className={styles.kicker}>Prime suspect</p>
              <h4 className={styles.fraudName}>{fraud.primary.name}</h4>
              <dl className={styles.fraudStats}>
                <div><dt>Actual</dt><dd>{record(fraud.primary)}</dd></div>
                <div><dt>Expected wins</dt><dd>{fraud.primary.expectedWins.toFixed(2)}</dd></div>
                <div className={styles.fraudLuck}><dt>Schedule luck</dt><dd>{luck(fraud.primary.scheduleLuck)}</dd></div>
              </dl>
            </div>
            <div className={styles.fraudVerdict}>
              <h5 className={styles.fraudHeadline}>{fraudCopy.headline}</h5>
              <p className={styles.fraudCopy}>{fraudCopy.commentary}</p>
              <p className={styles.fraudEvidence}>
                All-play {trimmed(fraud.primary.allPlayWins)}–{trimmed(fraud.primary.allPlayLosses)} · {ordinal(fraud.primary.pointsForRank)} in points for · {ordinal(fraud.primary.standingsPosition)} in the table · {ordinal(fraud.primary.powerRank)} on the Power List
              </p>
            </div>
          </article>
        ) : (
          <article className={styles.fraudClear}>
            <h5 className={styles.fraudHeadline}>No fraud detected</h5>
            <p className={styles.fraudCopy}>{fraudCopy.commentary}</p>
          </article>
        )}
        {(fraud.alsoUnderInvestigation.length > 0 || fraud.mostRobbed) && (
          <div className={styles.fraudBelow}>
            {fraud.alsoUnderInvestigation.length > 0 && (
              <div>
                <h5>Also under investigation</h5>
                <ul className={styles.fraudAlso}>
                  {fraud.alsoUnderInvestigation.map((entry) => (
                    <li key={entry.rosterId}>
                      {avatar(entry.username, 28)}
                      <span><strong>{entry.name}</strong><small>{record(entry)} actual · {entry.expectedWins.toFixed(2)} expected</small></span>
                      <b>{luck(entry.scheduleLuck)}</b>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {fraud.mostRobbed && (
              <div>
                <h5>Most robbed</h5>
                <div className={styles.fraudRobbed}>
                  {avatar(fraud.mostRobbed.username, 28)}
                  <span><strong>{fraud.mostRobbed.name}</strong><br /><small>{record(fraud.mostRobbed)} actual · {fraud.mostRobbed.expectedWins.toFixed(2)} expected · <b>{luck(fraud.mostRobbed.scheduleLuck)} wins</b></small></span>
                  <p>{fraudCopy.mostRobbedCommentary}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {week >= 3 && (
          <>
            <h3 className={styles.rubric}>The playoff race</h3>
            <p className={styles.note}>Six teams make the playoffs. Seeds 1–5 go to the best records; the final spot goes to the highest points-for among everyone else. Odds come from {report.playoffOdds.simulations.toLocaleString("en-GB")} simulations of the remaining Week {week + 1}–{report.playoffOdds.regularSeasonWeeks} schedule.</p>
            <ol className={styles.race}>
              {report.playoffOdds.teams.map((team, index) => (
                <li key={team.rosterId} className={index === 5 ? styles.raceCut : undefined}>
                  <span className={styles.tableRank}>{index + 1}</span>
                  {avatar(team.username, 30)}
                  <div><strong>{team.teamName}</strong><small>{team.name} · {team.wins}–{team.losses} · {score(team.points)} PF</small></div>
                  <span className={styles.raceBar} aria-hidden="true"><i style={{ width: `${team.playoff}%`, background: oddsColor(team.playoff) }} /></span>
                  <b style={{ color: oddsColor(team.playoff) }}>{team.playoff.toFixed(1)}%</b>
                </li>
              ))}
            </ol>
            <p className={styles.note}><strong>How it works:</strong> each remaining game is played out using every team&apos;s scoring average so far, pulled toward the league average so early hot and cold streaks don&apos;t count for too much.</p>
          </>
        )}
      </section>

      {/* THE MARKET */}
      <section id="market" className={`${styles.chapter} ${styles.chapterBreak}`}>
        <header className={styles.chapterHead}>
          <h2>The Market</h2>
          <p>${leagueSpent} spent. Who&apos;s actually getting a return?</p>
        </header>
        <p className={styles.note}>Every paid winning waiver bid through Week {week}, and what those players have actually delivered. Points only count while the player was in the buyer&apos;s starting lineup.</p>

        <div className={styles.marketCallouts}>
          <div><span>League FAAB spend</span><b>${leagueSpent}</b><small>of ${leagueBudget} available</small></div>
          {bestValue && <div><span>Best value buy</span><strong>{bestValue.playerName}</strong><small>{bestValue.managerName} · ${bestValue.bid} · {score(bestValue.startedPoints)} started pts · {(bestValue.startedPoints / bestValue.bid).toFixed(2)} per $1</small></div>}
          {priciest && <div><span>Biggest splash</span><strong>{priciest.playerName}</strong><small>{priciest.managerName} · ${priciest.bid} · {score(priciest.startedPoints)} started pts</small></div>}
        </div>

        <h3 className={styles.rubric}>The FAAB ledger</h3>
        <div className={styles.ledger}>
          <FaabTable teams={report.faab.teams} budget={report.faab.budget} />
        </div>
        {!report.faab.available && <p className={styles.note}>Some Sleeper transactions could not be loaded, so totals may be incomplete.</p>}
        <div className={styles.mathBox}>
          <h4>How the math works</h4>
          <ol>
            <li><strong>Spent</strong> adds up every winning waiver bid from Week 1 to Week {week}. Failed bids, free-agent pickups and $0 claims are left out of the table entirely. Remaining budget is ${report.faab.budget} minus spent.</li>
            <li><strong>Started pts</strong> counts a player&apos;s points only in weeks he was in the buyer&apos;s starting lineup, from the week he was claimed onward. Bench weeks, and anything he scores after being dropped, don&apos;t count.</li>
            <li><strong>Pts per $1</strong> is started points ÷ FAAB spent. Example: $10 spent and 45 started points = 4.50 per $1. Managers who haven&apos;t spent anything show &ldquo;—&rdquo;.</li>
            <li><strong>Best value buy</strong> is the single paid claim with the highest started points ÷ bid. <strong>Biggest splash</strong> is the largest single bid.</li>
          </ol>
        </div>
      </section>

      <footer className={legacy.footer}>
        <div><strong>Next issue</strong><span>After Sleeper finalizes Week {week + 1}</span></div>
        <Link href={leagueHref}>Open the league office</Link>
        <small>Generated from Sleeper scores, lineups and half-PPR projections, plus The Main Leagues commissioner tools. Projection totals exclude team defence where Sleeper does not publish a matching projection record.</small>
      </footer>
    </article>
  );
}
