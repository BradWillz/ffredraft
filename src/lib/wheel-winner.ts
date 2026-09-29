import { SLEEPER_LEAGUE_ID } from "./config";
import { getDisplayName } from "./normalize-username";
import {
  getAllPlayers,
  getLeague,
  getLeagueMatchups,
  getLeagueRosters,
  getLeagueUsers,
  getWeeklyPlayerStats,
} from "./sleeper";

type SleeperUser = { user_id: string; username?: string; display_name?: string };
type SleeperRoster = { roster_id: number; owner_id?: string };
type SleeperMatchup = {
  roster_id: number;
  matchup_id: number | null;
  points: number | null;
  starters?: string[];
  players?: string[];
  players_points?: Record<string, number>;
};
type SleeperPlayer = { full_name?: string; first_name?: string; last_name?: string; position?: string; fantasy_positions?: string[] };
type PlayerStats = Record<string, number>;

export type WheelCalculation = { winnerName: string; winnerValue: number; details: string };

type Starter = {
  rosterId: number;
  managerName: string;
  playerId: string;
  playerName: string;
  slot: string;
  position: string;
  points: number;
};

const FLEX_SLOTS = new Set(["FLEX", "WRRB_FLEX", "REC_FLEX", "SUPER_FLEX", "IDP_FLEX"]);
const BENCH_SLOTS = new Set(["BN", "IR", "TAXI"]);
const STATS_SCENARIOS = new Set([
  "Most Total Touchdowns (Team)",
  "Most Receiving Yards (Single Player)",
  "Most Rushing Yards (Single Player)",
  "Most Sacks from a D/ST",
]);

function playerLabel(playerId: string, players: Record<string, SleeperPlayer>) {
  const player = players[playerId];
  return player?.full_name
    || [player?.first_name, player?.last_name].filter(Boolean).join(" ")
    || playerId;
}

function bestBy<T>(items: T[], value: (item: T) => number) {
  return items.reduce<{ item: T; value: number } | null>((best, item) => {
    const candidate = value(item);
    return best === null || candidate > best.value ? { item, value: candidate } : best;
  }, null);
}

function highestStarter(starters: Starter[], bench: Starter[], positions: string[], label: string): WheelCalculation | null {
  const started = starters.filter((starter) => positions.includes(starter.position));
  const pool = started.length > 0 ? started : bench.filter((player) => positions.includes(player.position));
  const best = bestBy(pool, (player) => player.points);
  if (!best) return null;
  const context = started.length > 0 ? `at ${label}` : `at ${label} (rostered, no starting ${label} slot)`;
  return {
    winnerName: best.item.managerName,
    winnerValue: Number(best.value.toFixed(2)),
    details: `${best.item.playerName} scored ${best.value.toFixed(2)} pts ${context}`,
  };
}

function statTotal(stats: PlayerStats | undefined, keys: string[]) {
  if (!stats) return 0;
  return keys.reduce((total, key) => total + (Number(stats[key]) || 0), 0);
}

function highestStarterStat(
  starters: Starter[],
  stats: Record<string, PlayerStats>,
  keys: string[],
  unit: string,
  positions?: string[],
): WheelCalculation | null {
  const matches = positions ? starters.filter((starter) => positions.includes(starter.position)) : starters;
  const best = bestBy(matches, (starter) => statTotal(stats[starter.playerId], keys));
  if (!best || best.value <= 0) return null;
  return {
    winnerName: best.item.managerName,
    winnerValue: best.value,
    details: `${best.item.playerName} recorded ${best.value} ${unit}`,
  };
}

function marginWinner(matchups: SleeperMatchup[], managerName: (rosterId: number) => string, pick: "biggest" | "closest"): WheelCalculation | null {
  const pairs = new Map<number, SleeperMatchup[]>();
  for (const matchup of matchups) {
    if (matchup.matchup_id == null) continue;
    pairs.set(matchup.matchup_id, [...(pairs.get(matchup.matchup_id) ?? []), matchup]);
  }
  const decided = [...pairs.values()]
    .filter((pair) => pair.length === 2 && pair[0].points != null && pair[1].points != null)
    .map((pair) => {
      const winner = (pair[0].points ?? 0) >= (pair[1].points ?? 0) ? pair[0] : pair[1];
      const loser = winner === pair[0] ? pair[1] : pair[0];
      return { winner, loser, margin: Math.abs((pair[0].points ?? 0) - (pair[1].points ?? 0)) };
    })
    .filter((game) => game.margin > 0);
  if (decided.length === 0) return null;
  const game = decided.sort((left, right) => pick === "biggest" ? right.margin - left.margin : left.margin - right.margin)[0];
  return {
    winnerName: managerName(game.winner.roster_id),
    winnerValue: Number(game.margin.toFixed(2)),
    details: `Beat ${managerName(game.loser.roster_id)} by ${game.margin.toFixed(2)} pts`,
  };
}

export async function calculateWheelWinner(week: number, scenario: string): Promise<WheelCalculation | null> {
  const league = await getLeague(SLEEPER_LEAGUE_ID);
  const [matchupResult, rosterResult, userResult, playerResult] = await Promise.all([
    getLeagueMatchups(SLEEPER_LEAGUE_ID, week),
    getLeagueRosters(SLEEPER_LEAGUE_ID),
    getLeagueUsers(SLEEPER_LEAGUE_ID),
    getAllPlayers(),
  ]);
  const stats = STATS_SCENARIOS.has(scenario)
    ? await getWeeklyPlayerStats(league.season, week) as Record<string, PlayerStats>
    : {};

  const matchups = (matchupResult as SleeperMatchup[]) ?? [];
  if (matchups.length === 0) return null;
  const rosters = rosterResult as SleeperRoster[];
  const users = userResult as SleeperUser[];
  const players = playerResult as Record<string, SleeperPlayer>;

  const usersById = new Map(users.map((user) => [user.user_id, user]));
  const managerName = (rosterId: number) => {
    const roster = rosters.find((candidate) => candidate.roster_id === rosterId);
    const user = roster?.owner_id ? usersById.get(roster.owner_id) : undefined;
    return user ? getDisplayName(user.username || user.display_name || user.user_id) : `Team ${rosterId}`;
  };

  const slots = (league.roster_positions as string[] | undefined ?? []).filter((slot) => !BENCH_SLOTS.has(slot));
  const lineupEntry = (matchup: SleeperMatchup, playerId: string, slot: string): Starter[] => {
    if (!playerId || playerId === "0") return [];
    const player = players[playerId];
    return [{
      rosterId: matchup.roster_id,
      managerName: managerName(matchup.roster_id),
      playerId,
      playerName: playerLabel(playerId, players),
      slot,
      position: player?.position ?? player?.fantasy_positions?.[0] ?? "FLEX",
      points: matchup.players_points?.[playerId] ?? 0,
    }];
  };
  const starters: Starter[] = matchups.flatMap((matchup) =>
    (matchup.starters ?? []).flatMap((playerId, index) => lineupEntry(matchup, playerId, slots[index] ?? "FLEX")));
  const bench: Starter[] = matchups.flatMap((matchup) => {
    const startingIds = new Set(matchup.starters ?? []);
    return (matchup.players ?? [])
      .filter((playerId) => !startingIds.has(playerId))
      .flatMap((playerId) => lineupEntry(matchup, playerId, "BN"));
  });

  switch (scenario) {
    case "Highest Scoring Starting QB":
      return highestStarter(starters, bench, ["QB"], "QB");
    case "Highest Scoring Kicker":
      return highestStarter(starters, bench, ["K"], "K");
    case "Highest Scoring Defense":
      return highestStarter(starters, bench, ["DEF", "DST"], "D/ST");
    case "Highest Scoring RB":
      return highestStarter(starters, bench, ["RB"], "RB");
    case "Highest Scoring WR":
      return highestStarter(starters, bench, ["WR"], "WR");
    case "Highest Scoring TE":
      return highestStarter(starters, bench, ["TE"], "TE");
    case "Highest Scoring Flex Player": {
      const flexStarters = starters.filter((starter) => FLEX_SLOTS.has(starter.slot));
      const best = bestBy(flexStarters, (starter) => starter.points);
      if (!best) return null;
      return {
        winnerName: best.item.managerName,
        winnerValue: Number(best.value.toFixed(2)),
        details: `${best.item.playerName} scored ${best.value.toFixed(2)} pts from the flex`,
      };
    }
    case "Most Sacks from a D/ST":
      return highestStarterStat(starters, stats, ["sack"], "sacks", ["DEF", "DST"]);
    case "Most Receiving Yards (Single Player)":
      return highestStarterStat(starters, stats, ["rec_yd"], "receiving yards");
    case "Most Rushing Yards (Single Player)":
      return highestStarterStat(starters, stats, ["rush_yd"], "rushing yards");
    case "Most Total Touchdowns (Team)": {
      const totals = new Map<number, number>();
      for (const starter of starters) {
        const touchdowns = statTotal(stats[starter.playerId], ["pass_td", "rush_td", "rec_td", "def_td", "st_td"]);
        totals.set(starter.rosterId, (totals.get(starter.rosterId) ?? 0) + touchdowns);
      }
      const best = bestBy([...totals.entries()], ([, touchdowns]) => touchdowns);
      if (!best || best.value <= 0) return null;
      return {
        winnerName: managerName(best.item[0]),
        winnerValue: best.value,
        details: `${best.value} total touchdowns (passing, rushing, receiving) from the starting lineup`,
      };
    }
    case "Highest Bench Score": {
      const benchTotals = matchups.map((matchup) => {
        const startersSet = new Set(matchup.starters ?? []);
        const points = matchup.players_points ?? {};
        const total = (matchup.players ?? [])
          .filter((playerId) => !startersSet.has(playerId))
          .reduce((sum, playerId) => sum + (points[playerId] ?? 0), 0);
        return { rosterId: matchup.roster_id, total };
      });
      const best = bestBy(benchTotals, (team) => team.total);
      if (!best) return null;
      return {
        winnerName: managerName(best.item.rosterId),
        winnerValue: Number(best.value.toFixed(2)),
        details: `${best.value.toFixed(2)} pts left on the bench`,
      };
    }
    case "Biggest Blowout Win":
      return marginWinner(matchups, managerName, "biggest");
    case "Closest Matchup Winner":
      return marginWinner(matchups, managerName, "closest");
    default: {
      const best = bestBy(matchups, (matchup) => matchup.points ?? 0);
      if (!best) return null;
      return {
        winnerName: managerName(best.item.roster_id),
        winnerValue: Number(best.value.toFixed(2)),
        details: `${best.value.toFixed(2)} pts (highest scoring team)`,
      };
    }
  }
}
