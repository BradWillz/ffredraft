import { SLEEPER_LEAGUE_ID } from "./config";
import { scoreLadbrokesWeek, getLadbrokesSubmissions } from "./ladbrokes";
import { getDisplayName, normalizeUsername } from "./normalize-username";
import { getPowerState } from "./power";
import {
  getAllPlayers,
  getLeague,
  getLeagueMatchups,
  getLeagueRosters,
  getLeagueUsers,
  getWeeklyPlayerProjections,
} from "./sleeper";
import { getWheelState } from "./wheel-state";

type SleeperLeague = { name?: string; season: string; settings?: { last_scored_leg?: number } };
type SleeperRoster = { roster_id: number; owner_id?: string | null };
type SleeperUser = { user_id: string; username?: string; display_name?: string };
type SleeperMatchup = {
  roster_id: number;
  matchup_id: number | null;
  points?: number | null;
  players?: string[];
  starters?: string[];
  players_points?: Record<string, number>;
};
type SleeperPlayer = { full_name?: string; first_name?: string; last_name?: string; position?: string; team?: string };
type PlayerProjection = { pts_half_ppr?: number };

export type ReportTeam = {
  rosterId: number;
  name: string;
  username: string;
  score: number;
  opponentName: string;
  opponentScore: number;
  won: boolean;
  margin: number;
  benchPoints: number;
  lineupEfficiency: number;
  allPlayWins: number;
  projectedPoints: number;
  powerIndex: number;
  rankMovement: number | null;
  blurb: string;
  seasonWins: number;
  seasonLosses: number;
  seasonPoints: number;
};

export type WeeklyReport = {
  leagueName: string;
  season: string;
  week: number;
  lastCompletedWeek: number;

  generatedAt: string;
  matchups: Array<{ id: number; team1: ReportTeam; team2: ReportTeam; margin: number }>;
  standings: ReportTeam[];
  powerRankings: ReportTeam[];
  topPlayers: Array<{ playerId: string; name: string; position: string; nflTeam: string; managerName: string; points: number }>;
  highestScorer: ReportTeam;
  lowestScorer: ReportTeam;
  benchLeader: ReportTeam;
  closestGame: { id: number; team1: ReportTeam; team2: ReportTeam; margin: number };
  biggestWin: { id: number; team1: ReportTeam; team2: ReportTeam; margin: number };
  upset: { winner: ReportTeam; loser: ReportTeam; projectionGap: number } | null;
  powerHolder: { holderName: string; reason: string } | null;
  wheel: { scenario: string; winnerName?: string; details?: string } | null;
  ladbrokes: {
    winners: Array<{ displayName: string; correct: number }>;
    total: number;
  };
  lastManStanding: {
    contenders: Array<{ rosterId: number; name: string; username: string }>;
    eliminated: Array<{ rosterId: number; name: string; username: string; week: number; score: number }>;
    winner: { rosterId: number; name: string; username: string } | null;
  };
};

type PublishedLadbrokesState = {
  history?: Array<{
    week: number;
    winners: Array<{ displayName: string; correct: number }>;
    standings: Array<{ total: number }>;
  }>;
};


async function getPublishedLadbrokesWeek(week: number) {
  try {
    const response = await fetch("https://ffredraft.vercel.app/api/ladbrokes", { next: { revalidate: 300 } });
    if (!response.ok) return null;
    const state = await response.json() as PublishedLadbrokesState;
    return state.history?.find((result) => result.week === week) ?? null;
  } catch {
    return null;
  }
}

function percentile(value: number, values: number[]) {
  if (values.length <= 1) return 100;
  return values.filter((candidate) => candidate < value).length / (values.length - 1) * 100;
}

function playerName(playerId: string, players: Record<string, SleeperPlayer>) {
  const player = players[playerId];
  return player?.full_name
    || [player?.first_name, player?.last_name].filter(Boolean).join(" ")
    || playerId;
}

function weeklyPowerIndexes(matchups: SleeperMatchup[]) {
  const scores = matchups.map((matchup) => matchup.points ?? 0);
  const metrics = matchups.map((matchup) => {
    const opponent = matchups.find((candidate) => candidate.matchup_id === matchup.matchup_id && candidate.roster_id !== matchup.roster_id);
    const score = matchup.points ?? 0;
    const playerPoints = matchup.players_points ?? {};
    const availablePoints = (matchup.players ?? []).reduce((total, id) => total + Math.max(0, playerPoints[id] ?? 0), 0);
    return {
      rosterId: matchup.roster_id,
      score,
      margin: score - (opponent?.points ?? 0),
      lineupEfficiency: availablePoints > 0 ? Math.min(100, score / availablePoints * 100) : 0,
      allPlayWins: scores.filter((candidate) => candidate < score).length,
    };
  });
  const margins = metrics.map((team) => team.margin);
  const efficiencies = metrics.map((team) => team.lineupEfficiency);
  return metrics.map((team) => ({
    rosterId: team.rosterId,
    powerIndex: Math.round(
      percentile(team.score, scores) * 0.45
      + percentile(team.margin, margins) * 0.2
      + percentile(team.lineupEfficiency, efficiencies) * 0.2
      + team.allPlayWins / Math.max(1, metrics.length - 1) * 100 * 0.15,
    ),
  })).sort((left, right) => right.powerIndex - left.powerIndex);
}

function teamBlurb(team: ReportTeam, powerRank: number, scoreRank: number, teamCount: number) {
  const score = team.score.toFixed(2);
  const margin = Math.abs(team.margin).toFixed(2);
  const efficiency = team.lineupEfficiency.toFixed(0);
  const bench = team.benchPoints.toFixed(2);
  const opponent = team.opponentName;
  const allPlayVerdict = team.allPlayWins >= teamCount / 2 ? "most of the league" : "most of the league's better scores";

  const blurbs = [
    team.won && team.margin >= 30
      ? `${margin} points over ${opponent}; ${team.name}'s scoreboard came with a complimentary surrender note.`
      : `${score} points from ${team.name}, who beat ${opponent} and still left the lineup looking mildly unfinished.`,
    scoreRank === 1
      ? `${team.name} topped the scoring chart at ${score}, but ${efficiency}% efficiency is a spectacular score carrying avoidable baggage.`
      : `${team.name} found ${score} points, then watched ${opponent} turn them into a winning argument.`,
    team.won && team.allPlayWins < teamCount / 2
      ? `Against ${opponent}, ${team.name} discovered the schedule's oldest trick: a win despite losing to ${allPlayVerdict}.`
      : `${team.name} made ${opponent} pay ${margin} points for a result that looked closer on paper than it felt in practice.`,
    !team.won && team.allPlayWins >= teamCount / 2
      ? `${team.name} would have beaten ${allPlayVerdict}; ${opponent} merely delivered the one verdict that counts.`
      : `A ${margin}-point escape for ${team.name} over ${opponent}. Nothing majestic, but the standings remain legally obliged to respect it.`,
    team.lineupEfficiency < 72
      ? `${bench} points sat on ${team.name}'s bench while ${opponent} collected the win. The sideline had the sharper eye.`
      : `${team.name} handled ${opponent} with ${efficiency}% efficiency: tidy work, though hardly a threat to the league's sleep schedule.`,
    team.margin <= -30
      ? `${opponent} beat ${team.name} by ${margin}; eventually the matchup stopped asking questions and started presenting evidence.`
      : `${team.name} kept ${opponent} close enough to create suspense, then finished the job with ${efficiency}% efficiency.`,
    team.won
      ? `${team.name} took down ${opponent} by ${margin}, a result best described as competent with a low ceiling.`
      : `${team.name} scored ${score} and lost to ${opponent}. Respectable process, dreadful reward, no sympathy issued.`,
    team.lineupEfficiency < 72
      ? `${team.name} left ${bench} points idle and still made ${opponent} work for it. Imagine the damage with adult supervision.`
      : `${team.name} beat ${opponent}; the ${margin}-point margin says victory, while the ${efficiency}% efficiency says do not overreact.`,
    team.margin <= -30
      ? `For ${team.name}, ${opponent} was less an opponent than a closing argument, winning by ${margin}.`
      : `${team.name} edged ${opponent} by ${margin}; a narrow triumph, polished just enough to avoid the word lucky.`,
    team.won
      ? `${opponent} supplied the resistance and ${team.name} supplied ${score} points. The win is real; the aura is not.`
      : `${team.name} lost to ${opponent} despite a ${score}-point effort. Fantasy remains brutally unimpressed by moral victories.`,
    team.lineupEfficiency < 72
      ? `${team.name}'s ${efficiency}% efficiency made ${opponent} look generous. ${bench} bench points remain available for the post-match autopsy.`
      : `${team.name} got past ${opponent} with ${score} points, which is enough for the table and not nearly enough for folklore.`,
    scoreRank === teamCount
      ? `${team.name} finished last at ${score}; ${opponent} did not need brilliance, merely attendance.`
      : `${team.name} and ${opponent} produced a ${margin}-point gap. One got the result; the other got a paragraph.`,
  ];

  return blurbs[Math.min(powerRank - 1, blurbs.length - 1)];
}

export async function getWeeklyReport(week: number): Promise<WeeklyReport> {
  const [leagueResult, rosterResult, userResult, playersResult, projectionsResult, wheelState, powerState, submissions] = await Promise.all([
    getLeague(SLEEPER_LEAGUE_ID),
    getLeagueRosters(SLEEPER_LEAGUE_ID),
    getLeagueUsers(SLEEPER_LEAGUE_ID),
    getAllPlayers(),
    getWeeklyPlayerProjections("2026", week),
    getWheelState(),
    getPowerState(),
    getLadbrokesSubmissions(week),
  ]);
  const league = leagueResult as SleeperLeague;
  const rosters = rosterResult as SleeperRoster[];
  const users = userResult as SleeperUser[];
  const players = playersResult as Record<string, SleeperPlayer>;
  const projections = projectionsResult as Record<string, PlayerProjection>;
  const weeklyMatchups = await Promise.all(
    Array.from({ length: week }, (_, index) => getLeagueMatchups(SLEEPER_LEAGUE_ID, index + 1) as Promise<SleeperMatchup[]>),
  );
  const matchups = weeklyMatchups.at(-1) ?? [];
  if (matchups.length === 0) throw new Error(`No Sleeper matchups found for Week ${week}`);

  const usersById = new Map(users.map((user) => [user.user_id, user]));
  const rosterNames = new Map(rosters.map((roster) => {
    const user = roster.owner_id ? usersById.get(roster.owner_id) : undefined;
    const username = user?.username || user?.display_name || user?.user_id || `Team${roster.roster_id}`;
    return [roster.roster_id, { name: getDisplayName(username), username: normalizeUsername(username) }];
  }));
  const seasonRecords = new Map<number, { wins: number; losses: number; points: number }>();
  for (const weekMatchups of weeklyMatchups) {
    const groups = new Map<number, SleeperMatchup[]>();
    for (const matchup of weekMatchups) {
      if (matchup.matchup_id == null) continue;
      groups.set(matchup.matchup_id, [...(groups.get(matchup.matchup_id) ?? []), matchup]);
      const record = seasonRecords.get(matchup.roster_id) ?? { wins: 0, losses: 0, points: 0 };
      record.points += matchup.points ?? 0;
      seasonRecords.set(matchup.roster_id, record);
    }
    for (const pair of groups.values()) {
      if (pair.length !== 2) continue;
      const [team1, team2] = pair;
      if ((team1.points ?? 0) > (team2.points ?? 0)) {
        seasonRecords.get(team1.roster_id)!.wins += 1;
        seasonRecords.get(team2.roster_id)!.losses += 1;
      } else if ((team2.points ?? 0) > (team1.points ?? 0)) {
        seasonRecords.get(team2.roster_id)!.wins += 1;
        seasonRecords.get(team1.roster_id)!.losses += 1;
      }
    }
  }

  const scores = matchups.map((matchup) => matchup.points ?? 0);
  const rawTeams = matchups.map((matchup) => {
    const opponent = matchups.find((candidate) => candidate.matchup_id === matchup.matchup_id && candidate.roster_id !== matchup.roster_id);
    const score = matchup.points ?? 0;
    const opponentScore = opponent?.points ?? 0;
    const playerPoints = matchup.players_points ?? {};
    const starters = new Set(matchup.starters ?? []);
    const benchPoints = (matchup.players ?? []).filter((id) => !starters.has(id)).reduce((total, id) => total + (playerPoints[id] ?? 0), 0);
    const availablePoints = (matchup.players ?? []).reduce((total, id) => total + Math.max(0, playerPoints[id] ?? 0), 0);
    const identity = rosterNames.get(matchup.roster_id) ?? { name: `Team ${matchup.roster_id}`, username: `Team${matchup.roster_id}` };
    const opponentIdentity = opponent ? rosterNames.get(opponent.roster_id) : undefined;
    const record = seasonRecords.get(matchup.roster_id) ?? { wins: 0, losses: 0, points: score };
    return {
      rosterId: matchup.roster_id,
      name: identity.name,
      username: identity.username,
      score,
      opponentName: opponentIdentity?.name ?? "Bye week",
      opponentScore,
      won: score > opponentScore,
      margin: score - opponentScore,
      benchPoints,
      lineupEfficiency: availablePoints > 0 ? Math.min(100, score / availablePoints * 100) : 0,
      allPlayWins: scores.filter((candidate) => candidate < score).length,
      projectedPoints: (matchup.starters ?? []).reduce((total, id) => total + (projections[id]?.pts_half_ppr ?? 0), 0),
      powerIndex: 0,
      rankMovement: null,
      blurb: "",
      seasonWins: record.wins,
      seasonLosses: record.losses,
      seasonPoints: record.points,
    } satisfies ReportTeam;
  });
  const currentIndexes = new Map(weeklyPowerIndexes(matchups).map((team) => [team.rosterId, team.powerIndex]));
  const previousRanks = week > 1
    ? new Map(weeklyPowerIndexes(weeklyMatchups[week - 2]).map((team, index) => [team.rosterId, index + 1]))
    : new Map<number, number>();
  const rankedRosterIds = [...rawTeams]
    .sort((left, right) => (currentIndexes.get(right.rosterId) ?? 0) - (currentIndexes.get(left.rosterId) ?? 0))
    .map((team) => team.rosterId);
  const scoreRanks = new Map([...rawTeams].sort((left, right) => right.score - left.score).map((team, index) => [team.rosterId, index + 1]));
  const teams = rawTeams.map((team) => {
    const currentRank = rankedRosterIds.indexOf(team.rosterId) + 1;
    const previousRank = previousRanks.get(team.rosterId);
    const rankedTeam = {
      ...team,
      powerIndex: currentIndexes.get(team.rosterId) ?? 0,
      rankMovement: previousRank == null ? null : previousRank - currentRank,
    };
    return {
      ...rankedTeam,
      blurb: teamBlurb(rankedTeam, currentRank, scoreRanks.get(team.rosterId) ?? rawTeams.length, rawTeams.length),
    };
  });
  const teamsByRoster = new Map(teams.map((team) => [team.rosterId, team]));
  const grouped = new Map<number, SleeperMatchup[]>();
  for (const matchup of matchups) {
    if (matchup.matchup_id == null) continue;
    grouped.set(matchup.matchup_id, [...(grouped.get(matchup.matchup_id) ?? []), matchup]);
  }
  const reportMatchups = Array.from(grouped.entries()).flatMap(([id, pair]) => {
    const team1 = teamsByRoster.get(pair[0]?.roster_id);
    const team2 = teamsByRoster.get(pair[1]?.roster_id);
    return team1 && team2 ? [{ id, team1, team2, margin: Math.abs(team1.score - team2.score) }] : [];
  }).sort((left, right) => left.id - right.id);
  const sortedByScore = [...teams].sort((left, right) => right.score - left.score);
  const sortedByBench = [...teams].sort((left, right) => right.benchPoints - left.benchPoints);
  const topPlayers = matchups.flatMap((matchup) => (matchup.starters ?? []).map((playerId) => ({
    playerId,
    name: playerName(playerId, players),
    position: players[playerId]?.position ?? "FLEX",
    nflTeam: players[playerId]?.team ?? "FA",
    managerName: teamsByRoster.get(matchup.roster_id)?.name ?? `Team ${matchup.roster_id}`,
    points: matchup.players_points?.[playerId] ?? 0,
  }))).sort((left, right) => right.points - left.points).slice(0, 5);
  const upsets = reportMatchups.flatMap((matchup) => {
    const winner = matchup.team1.score >= matchup.team2.score ? matchup.team1 : matchup.team2;
    const loser = winner === matchup.team1 ? matchup.team2 : matchup.team1;
    const projectionGap = loser.projectedPoints - winner.projectedPoints;
    return projectionGap > 0 ? [{ winner, loser, projectionGap }] : [];
  }).sort((left, right) => right.projectionGap - left.projectionGap);
  const wheelResult = wheelState.weekResults.find((result) => result.week === week);
  const wheelWinner = wheelState.weekWinners.find((winner) => winner.week === week);
  const wheel = wheelResult
    ? { scenario: wheelResult.scenario, winnerName: wheelWinner?.winnerName, details: wheelWinner?.details }
    : week === 1
      ? { scenario: "Highest Bench Score", winnerName: "Tee", details: "Highest points on bench" }
      : null;
  const powerHolder = powerState.history.find((entry) => entry.week === week);
  const owners = teams.map((team) => ({ rosterId: team.rosterId, ownerId: "", displayName: team.name, username: `@${team.username}` }));
  const ladbrokes = scoreLadbrokesWeek(week, matchups, submissions, owners);
  const publishedLadbrokes = submissions.length === 0 ? await getPublishedLadbrokesWeek(week) : null;
  const ladbrokesWinners = publishedLadbrokes?.winners ?? ladbrokes.winners;
  const ladbrokesTotal = publishedLadbrokes?.standings[0]?.total ?? ladbrokes.standings[0]?.total ?? reportMatchups.length;
  const eliminatedRosterIds = new Set<number>();
  const completedLmsWeeks = Math.min(week, 12, Number(league.settings?.last_scored_leg ?? 0));
  const eliminated = weeklyMatchups.slice(0, completedLmsWeeks).flatMap((weekMatchups, index) => {
    const eligible = weekMatchups
      .filter((matchup) => !eliminatedRosterIds.has(matchup.roster_id) && matchup.points != null)
      .sort((left, right) => (left.points ?? 0) - (right.points ?? 0) || left.roster_id - right.roster_id);
    if (eligible.length <= 1) return [];
    const lowest = eligible[0];
    eliminatedRosterIds.add(lowest.roster_id);
    const identity = rosterNames.get(lowest.roster_id) ?? { name: `Team ${lowest.roster_id}`, username: `Team${lowest.roster_id}` };
    return [{ rosterId: lowest.roster_id, name: identity.name, username: identity.username, week: index + 1, score: lowest.points ?? 0 }];
  });
  const contenders = rosters
    .filter((roster) => !eliminatedRosterIds.has(roster.roster_id))
    .map((roster) => {
      const identity = rosterNames.get(roster.roster_id) ?? { name: `Team ${roster.roster_id}`, username: `Team${roster.roster_id}` };
      return { rosterId: roster.roster_id, name: identity.name, username: identity.username };
    });

  return {
    leagueName: league.name ?? "Left, Down, Wide to the Right, Up",
    season: league.season,
    week,
    lastCompletedWeek: Number(league.settings?.last_scored_leg ?? 0),
    generatedAt: new Date().toISOString(),
    matchups: reportMatchups,
    standings: [...teams].sort((left, right) => right.seasonWins - left.seasonWins || right.seasonPoints - left.seasonPoints),
    powerRankings: [...teams].sort((left, right) => right.powerIndex - left.powerIndex),
    topPlayers,
    highestScorer: sortedByScore[0],
    lowestScorer: sortedByScore.at(-1)!,
    benchLeader: sortedByBench[0],
    closestGame: [...reportMatchups].sort((left, right) => left.margin - right.margin)[0],
    biggestWin: [...reportMatchups].sort((left, right) => right.margin - left.margin)[0],
    upset: upsets[0] ?? null,
    powerHolder: powerHolder ? { holderName: powerHolder.holderName, reason: powerHolder.reason } : null,
    wheel,
    ladbrokes: {
      winners: ladbrokesWinners.map((winner) => ({ displayName: winner.displayName, correct: winner.correct })),
      total: ladbrokesTotal,
    },
    lastManStanding: {
      contenders,
      eliminated,
      winner: contenders.length === 1 ? contenders[0] : null,
    },
  };
}