import { DYNASTRY_LEAGUE_ID, SLEEPER_LEAGUE_ID } from "./config";
import { scoreLadbrokesWeek, getLadbrokesSubmissions } from "./ladbrokes";
import { getDisplayName, normalizeUsername } from "./normalize-username";
import { getPowerState } from "./power";
import { calculateWheelWinner } from "./wheel-winner";
import {
  getAllPlayers,
  getLeague,
  getLeagueMatchups,
  getLeagueRosters,
  getLeagueTransactions,
  getLeagueUsers,
  getTradedPicks,
  getWeeklyPlayerProjections,
  getWeeklyPlayerStats,
} from "./sleeper";
import { getWheelState } from "./wheel-state";
import {
  dumbestDropsOfWeek,
  faabBreakdown,
  leagueScoredPoints,
  matchupSummary,
  maxPointsFor,
  pickOwnersAt,
  rookieDraftOrder,
  simulatePlayoffOdds,
  waiverPickupsOfWeek,
  whiffOfTheWeek,
  type DraftPickTrade,
  type WeeklyPlayer,
  type WeeklyTransaction,
} from "./weekly-report-analysis";

type SleeperLeague = { name?: string; season: string; roster_positions?: string[]; scoring_settings?: Record<string, number>; settings?: { last_scored_leg?: number; leg?: number; playoff_week_start?: number; waiver_budget?: number; draft_rounds?: number } };
type SleeperRoster = { roster_id: number; owner_id?: string | null };
type SleeperUser = { user_id: string; username?: string; display_name?: string; metadata?: { team_name?: string } };
type SleeperMatchup = {
  roster_id: number;
  matchup_id: number | null;
  points?: number | null;
  players?: string[];
  starters?: string[];
  players_points?: Record<string, number>;
};
type SleeperPlayer = WeeklyPlayer;
type PlayerProjection = { pts_half_ppr?: number; pts_ppr?: number; pts_std?: number };

export type ReportTeam = {
  rosterId: number;
  name: string;
  username: string;
  score: number;
  opponentName: string;
  nextOpponentName: string;
  opponentScore: number;
  won: boolean;
  margin: number;
  benchPoints: number;
  lineupEfficiency: number;
  allPlayWins: number;
  projectedPoints: number;
  bestBenchedPlayer: string;
  bestBenchedPoints: number;
  weakestStarter: string;
  weakestStarterPoints: number;
  powerIndex: number;
  rankMovement: number | null;
  blurb: string;
  advice: string;
  starters: Array<{ playerId: string; name: string; points: number | null }>;
  benchPlayers: Array<{ playerId: string; name: string; position: string; points: number }>;
  commentaryFacts: ReturnType<typeof matchupSummary>["commentaryFacts"];
  seasonWins: number;
  seasonLosses: number;
  seasonPoints: number;
};

export type WeeklyReport = {
  leagueName: string;
  // Keeps saved AI commentary for other leagues apart from Redraft's existing cache keys.
  commentaryNamespace?: string;
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
  waiverPickup: {
    available: boolean;
    winners: Array<{ playerId: string; playerName: string; managerName: string; rosterId: number; points: number; started: boolean }>;
  };
  dumbestDrop: {
    available: boolean;
    losers: Array<{ playerId: string; playerName: string; position: string; managerName: string; rosterId: number; points: number }>;
  };
  whiffOfTheWeek: {
    managerName: string;
    opponentName: string;
    incomingPlayer: string;
    outgoingPlayer: string;
    winMargin: number;
  } | null;
  faab: {
    available: boolean;
    budget: number;
    teams: Array<{
      rosterId: number;
      name: string;
      username: string;
      spent: number;
      startedPoints: number;
      pointsPerDollar: number | null;
      players: Array<{ playerId: string; playerName: string; position: string; bid: number; week: number; startedPoints: number }>;
    }>;
  };
  ladbrokes: {
    winners: Array<{ displayName: string; correct: number }>;
    total: number;
  };
  lastManStanding: {
    contenders: Array<{ rosterId: number; name: string; username: string }>;
    eliminated: Array<{ rosterId: number; name: string; username: string; week: number; score: number }>;
    winner: { rosterId: number; name: string; username: string } | null;
  };
  playoffOdds: {
    simulations: number;
    regularSeasonWeeks: number;
    teams: Array<{
      rosterId: number;
      name: string;
      username: string;
      teamName: string;
      wins: number;
      losses: number;
      points: number;
      playoff: number;
      byRecord: number;
      byPoints: number;
    }>;
  };
  rookieDraft: {
    season: string;
    rounds: number;
    picks: Array<{
      pick: number;
      rosterId: number;
      name: string;
      username: string;
      seed: number | null;
      maxPoints: number;
      owners: Array<{ round: number; rosterId: number; name: string; username: string; traded: boolean }>;
    }>;
  } | null;
};

const PLAYOFF_SIMULATIONS = 10000;

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

// Season-long power index: every completed week is accumulated, so ranks shift week to week
// rather than resetting to a single week's results.
function seasonPowerIndexes(weeklyMatchups: SleeperMatchup[][]) {
  const totals = new Map<number, { points: number; margin: number; scored: number; available: number; allPlayWins: number; allPlayGames: number; wins: number; ties: number; games: number }>();
  for (const matchups of weeklyMatchups) {
    const scores = matchups.map((matchup) => matchup.points ?? 0);
    for (const matchup of matchups) {
      const opponent = matchup.matchup_id == null
        ? undefined
        : matchups.find((candidate) => candidate.matchup_id === matchup.matchup_id && candidate.roster_id !== matchup.roster_id);
      const score = matchup.points ?? 0;
      const playerPoints = matchup.players_points ?? {};
      const availablePoints = (matchup.players ?? []).reduce((total, id) => total + Math.max(0, playerPoints[id] ?? 0), 0);
      const team = totals.get(matchup.roster_id) ?? { points: 0, margin: 0, scored: 0, available: 0, allPlayWins: 0, allPlayGames: 0, wins: 0, ties: 0, games: 0 };
      team.points += score;
      team.margin += score - (opponent?.points ?? score);
      team.scored += score;
      team.available += availablePoints;
      team.allPlayWins += scores.filter((candidate) => candidate < score).length;
      team.allPlayGames += Math.max(0, matchups.length - 1);
      if (opponent) {
        team.games += 1;
        if (score > (opponent.points ?? 0)) team.wins += 1;
        else if (score === (opponent.points ?? 0)) team.ties += 1;
      }
      totals.set(matchup.roster_id, team);
    }
  }

  const metrics = [...totals.entries()].map(([rosterId, team]) => ({
    rosterId,
    points: team.points,
    margin: team.margin,
    lineupEfficiency: team.available > 0 ? Math.min(100, team.scored / team.available * 100) : 0,
    allPlayRate: team.allPlayGames > 0 ? team.allPlayWins / team.allPlayGames * 100 : 0,
    winRate: team.games > 0 ? (team.wins + team.ties * 0.5) / team.games * 100 : 0,
  }));
  const points = metrics.map((team) => team.points);
  const margins = metrics.map((team) => team.margin);
  const efficiencies = metrics.map((team) => team.lineupEfficiency);
  return metrics.map((team) => ({
    rosterId: team.rosterId,
    powerIndex: Math.round(
      percentile(team.points, points) * 0.35
      + team.winRate * 0.2
      + percentile(team.margin, margins) * 0.15
      + percentile(team.lineupEfficiency, efficiencies) * 0.15
      + team.allPlayRate * 0.15,
    ),
  })).sort((left, right) => right.powerIndex - left.powerIndex);
}

export type ReportLeague = {
  leagueId: string;
  // Wheel, The Power, Ladbrokes and Last Man Standing only run in the Redraft league.
  sideGames: boolean;
  playoffByRecord: number;
  rookieDraft: boolean;
  commentaryNamespace?: string;
};

export const REDRAFT_REPORT_LEAGUE: ReportLeague = { leagueId: SLEEPER_LEAGUE_ID, sideGames: true, playoffByRecord: 5, rookieDraft: false };
export const DYNASTRY_REPORT_LEAGUE: ReportLeague = { leagueId: DYNASTRY_LEAGUE_ID, sideGames: false, playoffByRecord: 5, rookieDraft: true, commentaryNamespace: "dynasty" };

export async function getWeeklyReport(week: number, reportLeague: ReportLeague = REDRAFT_REPORT_LEAGUE): Promise<WeeklyReport> {
  const { leagueId, sideGames } = reportLeague;
  const league = await getLeague(leagueId) as SleeperLeague;
  const [rosterResult, userResult, playersResult, projectionsResult, wheelState, powerState, submissions, transactions, statsResult] = await Promise.all([
    getLeagueRosters(leagueId),
    getLeagueUsers(leagueId),
    getAllPlayers(),
    getWeeklyPlayerProjections(league.season, week),
    sideGames ? getWheelState() : null,
    sideGames ? getPowerState() : null,
    sideGames ? getLadbrokesSubmissions(week) : [],
    getLeagueTransactions(leagueId, week)
      .then((result) => Array.isArray(result) ? result as WeeklyTransaction[] : null)
      .catch(() => null),
    getWeeklyPlayerStats(league.season, week)
      .then((result) => result as Record<string, Record<string, number>>)
      .catch(() => null),
  ]);
  const rosters = rosterResult as SleeperRoster[];
  const users = userResult as SleeperUser[];
  const players = playersResult as Record<string, SleeperPlayer>;
  const projections = projectionsResult as Record<string, PlayerProjection>;
  const receptionPoints = league.scoring_settings?.rec ?? 0.5;
  const projectionKey = receptionPoints >= 1 ? "pts_ppr" : receptionPoints > 0 ? "pts_half_ppr" : "pts_std";
  const weeklyMatchups = await Promise.all(
    Array.from({ length: week }, (_, index) => getLeagueMatchups(leagueId, index + 1) as Promise<SleeperMatchup[]>),
  );
  const earlierTransactions = await Promise.all(
    Array.from({ length: week - 1 }, (_, index) => getLeagueTransactions(leagueId, index + 1)
      .then((result) => Array.isArray(result) ? result as WeeklyTransaction[] : null)
      .catch(() => null)),
  );
  const regularSeasonWeeks = Math.max(week, Number(league.settings?.playoff_week_start ?? 15) - 1);
  const futureMatchups = await Promise.all(
    Array.from({ length: regularSeasonWeeks - week }, (_, index) =>
      (getLeagueMatchups(leagueId, week + 1 + index) as Promise<SleeperMatchup[]>).catch(() => [] as SleeperMatchup[])),
  );
  let nextWeekMatchups: SleeperMatchup[] = futureMatchups[0] ?? [];
  if (futureMatchups.length === 0) {
    try {
      nextWeekMatchups = await getLeagueMatchups(leagueId, week + 1) as SleeperMatchup[];
    } catch {
      nextWeekMatchups = [];
    }
  }
  const matchups = weeklyMatchups.at(-1) ?? [];
  if (matchups.length === 0) throw new Error(`No Sleeper matchups found for Week ${week}`);

  const usersById = new Map(users.map((user) => [user.user_id, user]));
  const rosterNames = new Map(rosters.map((roster) => {
    const user = roster.owner_id ? usersById.get(roster.owner_id) : undefined;
    const username = user?.username || user?.display_name || user?.user_id || `Team${roster.roster_id}`;
    return [roster.roster_id, {
      name: getDisplayName(username),
      username: normalizeUsername(username),
      teamName: user?.metadata?.team_name?.trim() || getDisplayName(username),
    }];
  }));
  const nextOpponentNames = new Map<number, string>();
  for (const matchup of nextWeekMatchups) {
    const opponent = matchup.matchup_id == null ? undefined : nextWeekMatchups.find((candidate) => candidate.matchup_id === matchup.matchup_id && candidate.roster_id !== matchup.roster_id);
    nextOpponentNames.set(matchup.roster_id, rosterNames.get(opponent?.roster_id ?? 0)?.name ?? "your next opponent");
  }
  const seasonRecords = new Map<number, { wins: number; losses: number; ties: number; points: number; scores: number[] }>();
  for (const weekMatchups of weeklyMatchups) {
    const groups = new Map<number, SleeperMatchup[]>();
    for (const matchup of weekMatchups) {
      if (matchup.matchup_id == null) continue;
      groups.set(matchup.matchup_id, [...(groups.get(matchup.matchup_id) ?? []), matchup]);
      const record = seasonRecords.get(matchup.roster_id) ?? { wins: 0, losses: 0, ties: 0, points: 0, scores: [] };
      record.points += matchup.points ?? 0;
      record.scores.push(matchup.points ?? 0);
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
      } else {
        seasonRecords.get(team1.roster_id)!.ties += 1;
        seasonRecords.get(team2.roster_id)!.ties += 1;
      }
    }
  }

  const scores = matchups.map((matchup) => matchup.points ?? 0);
  const rawTeams = matchups.map((matchup) => {
    const opponent = matchup.matchup_id == null ? undefined : matchups.find((candidate) => candidate.matchup_id === matchup.matchup_id && candidate.roster_id !== matchup.roster_id);
    const score = matchup.points ?? 0;
    const opponentScore = opponent?.points ?? 0;
    const playerPoints = matchup.players_points ?? {};
    const starters = new Set(matchup.starters ?? []);
    const benchPoints = (matchup.players ?? []).filter((id) => !starters.has(id)).reduce((total, id) => total + (playerPoints[id] ?? 0), 0);
    const availablePoints = (matchup.players ?? []).reduce((total, id) => total + Math.max(0, playerPoints[id] ?? 0), 0);
    const bestBenchedPlayer = (matchup.players ?? [])
      .filter((id) => !starters.has(id))
      .map((id) => ({ id, points: playerPoints[id] ?? 0 }))
      .sort((left, right) => right.points - left.points)[0];
    const weakestStarter = (matchup.starters ?? [])
      .map((id) => ({ id, points: playerPoints[id] ?? 0 }))
      .sort((left, right) => left.points - right.points)[0];
    const identity = rosterNames.get(matchup.roster_id) ?? { name: `Team ${matchup.roster_id}`, username: `Team${matchup.roster_id}` };
    const opponentIdentity = opponent ? rosterNames.get(opponent.roster_id) : undefined;
    const record = seasonRecords.get(matchup.roster_id) ?? { wins: 0, losses: 0, ties: 0, points: score, scores: [score] };
    return {
      rosterId: matchup.roster_id,
      name: identity.name,
      username: identity.username,
      score,
      opponentName: opponentIdentity?.name ?? "Bye week",
      nextOpponentName: nextOpponentNames.get(matchup.roster_id) ?? "your next opponent",
      opponentScore,
      won: score > opponentScore,
      margin: score - opponentScore,
      benchPoints,
      lineupEfficiency: availablePoints > 0 ? Math.min(100, score / availablePoints * 100) : 0,
      allPlayWins: scores.filter((candidate) => candidate < score).length,
      projectedPoints: (matchup.starters ?? []).reduce((total, id) => total + (projections[id]?.[projectionKey] ?? 0), 0),
      bestBenchedPlayer: bestBenchedPlayer ? playerName(bestBenchedPlayer.id, players) : "the unused bench",
      bestBenchedPoints: bestBenchedPlayer?.points ?? 0,
      weakestStarter: weakestStarter ? playerName(weakestStarter.id, players) : "the weakest starter",
      weakestStarterPoints: weakestStarter?.points ?? 0,
      powerIndex: 0,
      rankMovement: null,
      starters: (matchup.starters ?? []).filter((playerId) => playerId !== "0").map((playerId) => ({
        playerId,
        name: playerName(playerId, players),
        points: playerPoints[playerId] ?? null,
      })),
      benchPlayers: (matchup.players ?? [])
        .filter((playerId) => playerId !== "0" && !starters.has(playerId) && Number.isFinite(playerPoints[playerId]))
        .map((playerId) => ({
          playerId,
          name: playerName(playerId, players),
          position: players[playerId]?.position ?? "",
          points: playerPoints[playerId],
        }))
        .sort((left, right) => right.points - left.points)
        .slice(0, 5),
      ...matchupSummary(
        identity.name,
        opponentIdentity?.name ?? "Bye week",
        matchup,
        opponent,
        players,
        league.roster_positions ?? [],
        scores.filter((candidate) => candidate < score).length,
        Math.max(0, matchups.length - 1),
        nextOpponentNames.get(matchup.roster_id) ?? "your next opponent",
      ),
      seasonWins: record.wins,
      seasonLosses: record.losses,
      seasonPoints: record.points,
    } satisfies ReportTeam;
  });
  const currentIndexes = new Map(seasonPowerIndexes(weeklyMatchups).map((team) => [team.rosterId, team.powerIndex]));
  const previousRanks = week > 1
    ? new Map(seasonPowerIndexes(weeklyMatchups.slice(0, week - 1)).map((team, index) => [team.rosterId, index + 1]))
    : new Map<number, number>();
  const rankedRosterIds = [...rawTeams]
    .sort((left, right) => (currentIndexes.get(right.rosterId) ?? 0) - (currentIndexes.get(left.rosterId) ?? 0))
    .map((team) => team.rosterId);
  const teams = rawTeams.map((team) => {
    const currentRank = rankedRosterIds.indexOf(team.rosterId) + 1;
    const previousRank = previousRanks.get(team.rosterId);
    return {
      ...team,
      powerIndex: currentIndexes.get(team.rosterId) ?? 0,
      rankMovement: previousRank == null ? null : previousRank - currentRank,
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
  const whiff = sideGames ? whiffOfTheWeek(matchups, players, league.roster_positions ?? []) : null;
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
  const wheelResult = wheelState?.weekResults.find((result) => result.week === week);
  const wheelWinner = wheelState?.weekWinners.find((winner) => winner.week === week);
  const autoWheelWinner = wheelResult && !wheelWinner
    ? await calculateWheelWinner(week, wheelResult.scenario).catch(() => null)
    : null;
  const wheel = wheelResult
    ? {
      scenario: wheelResult.scenario,
      winnerName: wheelWinner?.winnerName ?? autoWheelWinner?.winnerName,
      details: wheelWinner?.details ?? autoWheelWinner?.details,
    }
    : sideGames && week === 1
      ? { scenario: "Highest Bench Score", winnerName: "Tee", details: "Highest points on bench" }
      : null;
  const powerHolder = powerState?.history.find((entry) => entry.week === week);
  const owners = teams.map((team) => ({ rosterId: team.rosterId, ownerId: "", displayName: team.name, username: `@${team.username}` }));
  const ladbrokes = scoreLadbrokesWeek(week, matchups, submissions, owners);
  const publishedLadbrokes = sideGames && submissions.length === 0 ? await getPublishedLadbrokesWeek(week) : null;
  const ladbrokesWinners = publishedLadbrokes?.winners ?? ladbrokes.winners;
  const ladbrokesTotal = publishedLadbrokes?.standings[0]?.total ?? ladbrokes.standings[0]?.total ?? reportMatchups.length;
  const eliminatedRosterIds = new Set<number>();
  const completedLmsWeeks = sideGames ? Math.min(week, 12, Number(league.settings?.last_scored_leg ?? 0)) : 0;
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
  const remainingSchedule = futureMatchups.map((weekMatchups) => {
    const pairs = new Map<number, number[]>();
    for (const matchup of weekMatchups) {
      if (matchup.matchup_id == null) continue;
      pairs.set(matchup.matchup_id, [...(pairs.get(matchup.matchup_id) ?? []), matchup.roster_id]);
    }
    return [...pairs.values()].filter((pair) => pair.length === 2).map(([home, away]) => [home, away] as [number, number]);
  });
  const playoffOdds = simulatePlayoffOdds(
    rosters.map((roster) => {
      const record = seasonRecords.get(roster.roster_id) ?? { wins: 0, losses: 0, ties: 0, points: 0, scores: [] };
      return { rosterId: roster.roster_id, wins: record.wins, losses: record.losses, ties: record.ties, points: record.points, scores: record.scores };
    }),
    remainingSchedule,
    { simulations: PLAYOFF_SIMULATIONS, seed: Number(league.season) * 100 + week, byRecord: reportLeague.playoffByRecord },
  );
  const rookieDraft = reportLeague.rookieDraft ? await (async () => {
    const draftSeason = String(Number(league.season) + 1);
    const rounds = Number(league.settings?.draft_rounds ?? 4);
    const currentLeg = Math.max(week, Number(league.settings?.leg ?? league.settings?.last_scored_leg ?? week));
    const [tradedPicks, laterTransactions] = await Promise.all([
      getTradedPicks(leagueId) as Promise<DraftPickTrade[]>,
      Promise.all(Array.from({ length: currentLeg - week }, (_, index) =>
        (getLeagueTransactions(leagueId, week + 1 + index) as Promise<Array<{ type: string; status: string; status_updated?: number; draft_picks?: DraftPickTrade[] }>>)),
      ),
    ]);
    const laterTrades = laterTransactions.flat()
      .filter((transaction) => transaction.type === "trade" && transaction.status === "complete" && transaction.draft_picks?.length)
      .sort((left, right) => (left.status_updated ?? 0) - (right.status_updated ?? 0))
      .map((transaction) => transaction.draft_picks ?? []);
    const ownerOf = pickOwnersAt(tradedPicks, laterTrades, draftSeason);
    const maxPoints = new Map<number, number>();
    for (const weekMatchups of weeklyMatchups) {
      for (const matchup of weekMatchups) {
        maxPoints.set(matchup.roster_id, (maxPoints.get(matchup.roster_id) ?? 0) + maxPointsFor(matchup, players, league.roster_positions ?? []));
      }
    }
    const identityOf = (rosterId: number) => rosterNames.get(rosterId) ?? { name: `Team ${rosterId}`, username: `Team${rosterId}` };
    const order = rookieDraftOrder(rosters.map((roster) => {
      const record = seasonRecords.get(roster.roster_id) ?? { wins: 0, ties: 0, points: 0 };
      return { rosterId: roster.roster_id, wins: record.wins, ties: record.ties, points: record.points, maxPoints: maxPoints.get(roster.roster_id) ?? 0 };
    }), reportLeague.playoffByRecord);
    return {
      season: draftSeason,
      rounds,
      picks: order.map((entry) => ({
        ...entry,
        name: identityOf(entry.rosterId).name,
        username: identityOf(entry.rosterId).username,
        maxPoints: Math.round((maxPoints.get(entry.rosterId) ?? 0) * 100) / 100,
        owners: Array.from({ length: rounds }, (_, index) => {
          const ownerId = ownerOf(index + 1, entry.rosterId);
          return { round: index + 1, rosterId: ownerId, name: identityOf(ownerId).name, username: identityOf(ownerId).username, traded: ownerId !== entry.rosterId };
        }),
      })),
    };
  })().catch(() => null) : null;
  const transactionsOrEmpty = transactions ?? [];
  // Dropped players usually aren't rostered, so score them from raw stats with league scoring; rostered points win when present.
  const droppedPlayerPoints: Record<string, number> = {};
  for (const playerId of new Set(transactionsOrEmpty.flatMap((transaction) => Object.keys(transaction.drops ?? {})))) {
    const rosteredPoints = matchups.find((matchup) => matchup.players_points?.[playerId] != null)?.players_points?.[playerId];
    const points = rosteredPoints ?? leagueScoredPoints(statsResult?.[playerId], league.scoring_settings ?? {});
    if (points != null) droppedPlayerPoints[playerId] = points;
  }
  const faabTeams = new Map(faabBreakdown([...earlierTransactions, transactions].map((weekTransactions) => weekTransactions ?? []), weeklyMatchups)
    .map((team) => [team.rosterId, team]));

  return {
    leagueName: league.name ?? "Left, Down, Wide to the Right, Up",
    commentaryNamespace: reportLeague.commentaryNamespace,
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
    waiverPickup: {
      available: transactions !== null,
      winners: waiverPickupsOfWeek(transactions ?? [], matchups).map((pickup) => ({
        ...pickup,
        playerName: playerName(pickup.playerId, players),
        managerName: rosterNames.get(pickup.rosterId)?.name ?? `Team ${pickup.rosterId}`,
      })),
    },
    dumbestDrop: {
      available: transactions !== null && statsResult !== null,
      losers: dumbestDropsOfWeek(transactionsOrEmpty, droppedPlayerPoints).map((drop) => ({
        ...drop,
        playerName: playerName(drop.playerId, players),
        position: players[drop.playerId]?.position ?? (/^[A-Z]{2,3}$/.test(drop.playerId) ? "DEF" : ""),
        managerName: rosterNames.get(drop.rosterId)?.name ?? `Team ${drop.rosterId}`,
      })),
    },
    whiffOfTheWeek: whiff ? {
      managerName: rosterNames.get(whiff.rosterId)?.name ?? `Team ${whiff.rosterId}`,
      opponentName: rosterNames.get(whiff.opponentRosterId)?.name ?? `Team ${whiff.opponentRosterId}`,
      incomingPlayer: playerName(whiff.incomingId, players),
      outgoingPlayer: whiff.outgoingId === "0" ? "the empty slot" : playerName(whiff.outgoingId, players),
      winMargin: whiff.winMargin,
    } : null,
    faab: {
      available: transactions !== null && earlierTransactions.every((weekTransactions) => weekTransactions !== null),
      budget: Number(league.settings?.waiver_budget ?? 100),
      teams: rosters.map((roster) => {
        const identity = rosterNames.get(roster.roster_id) ?? { name: `Team ${roster.roster_id}`, username: `Team${roster.roster_id}` };
        const team = faabTeams.get(roster.roster_id) ?? { spent: 0, startedPoints: 0, players: [] };
        return {
          rosterId: roster.roster_id,
          name: identity.name,
          username: identity.username,
          spent: team.spent,
          startedPoints: team.startedPoints,
          pointsPerDollar: team.spent > 0 ? Math.round(team.startedPoints / team.spent * 100) / 100 : null,
          players: team.players.map((player) => ({
            ...player,
            playerName: playerName(player.playerId, players),
            position: players[player.playerId]?.position ?? "",
          })),
        };
      }).sort((left, right) => right.spent - left.spent || right.startedPoints - left.startedPoints),
    },
    ladbrokes: {
      winners: ladbrokesWinners.map((winner) => ({ displayName: winner.displayName, correct: winner.correct })),
      total: ladbrokesTotal,
    },
    lastManStanding: {
      contenders,
      eliminated,
      winner: contenders.length === 1 ? contenders[0] : null,
    },
    playoffOdds: {
      simulations: PLAYOFF_SIMULATIONS,
      regularSeasonWeeks,
      teams: rosters.map((roster) => {
        const identity = rosterNames.get(roster.roster_id) ?? { name: `Team ${roster.roster_id}`, username: `Team${roster.roster_id}`, teamName: `Team ${roster.roster_id}` };
        const record = seasonRecords.get(roster.roster_id) ?? { wins: 0, losses: 0, points: 0 };
        const odds = playoffOdds.get(roster.roster_id) ?? { playoff: 0, byRecord: 0, byPoints: 0 };
        return { rosterId: roster.roster_id, ...identity, wins: record.wins, losses: record.losses, points: record.points, ...odds };
      }).sort((left, right) => right.playoff - left.playoff || right.points - left.points),
    },
    rookieDraft,
  };
}