import { getDisplayName, getRosterUsername, normalizeUsername } from "./normalize-username";

export type RecordLeague = {
  league_id: string;
  season: string;
  status: string;
  roster_positions?: string[];
  settings?: { last_scored_leg?: number; leg?: number; playoff_week_start?: number };
};
export type RecordNFLState = { season: string; season_type: string; leg?: number; week?: number };
export type RecordUser = { user_id: string; username?: string; display_name?: string; avatar?: string | null; metadata?: { team_name?: string; avatar?: string } };
export type RecordRoster = { roster_id: number; owner_id?: string | null };
export type RecordMatchup = {
  roster_id: number;
  matchup_id: number | null;
  points?: number | null;
  custom_points?: number | null;
  starters?: string[];
  starters_points?: Array<number | null>;
  players_points?: Record<string, number>;
};
export type RecordSeason = {
  league: RecordLeague;
  users: RecordUser[];
  rosters: RecordRoster[];
  weeks: Array<{ week: number; matchups: RecordMatchup[] }>;
};
export type RecordTeam = { key: string; name: string; username: string; teamName: string | null; avatar: string | null };
export type RecordPerformance = {
  id: string;
  season: string;
  week: number;
  regularSeason: boolean;
  team: RecordTeam;
  opponent: RecordTeam;
  points: number;
  opponentPoints: number;
  margin: number;
  combined: number;
  lineup: Array<{ playerId: string; slot: string; points: number | null }>;
};
export type RecordStreak = {
  team: RecordTeam;
  length: number;
  result: "win" | "loss";
  start: { season: string; week: number };
  end: { season: string; week: number };
};

const cents = (points: number) => Math.round(points * 100);
const validScore = (points: unknown): points is number => typeof points === "number" && Number.isFinite(points);

export function completedRecordWeeks(league: RecordLeague, nflState?: RecordNFLState) {
  if (league.status === "pre_draft" || league.status === "drafting") return 0;
  const scored = league.settings?.last_scored_leg ?? 0;
  // The league leg can lag behind the NFL clock after Monday's games.
  const sameSeason = nflState?.season === league.season;
  const finishedSeason = nflState && (Number(nflState.season) > Number(league.season)
    || (sameSeason && ["post", "off"].includes(nflState.season_type)));
  const lastFinishedWeek = finishedSeason ? 18
    : sameSeason && nflState?.season_type === "regular"
      ? (nflState.leg ?? nflState.week ?? 1) - 1
      : (league.settings?.leg ?? 1) - 1;
  const finalized = league.status === "complete" ? scored : Math.min(scored, lastFinishedWeek);
  return Math.max(0, Math.min(18, finalized));
}

function teamFor(season: RecordSeason, rosterId: number, identities: Map<string, string>): RecordTeam {
  const roster = season.rosters.find((item) => item.roster_id === rosterId);
  const user = season.users.find((item) => item.user_id === roster?.owner_id);
  const historicalUsername = getRosterUsername(season.league.league_id, rosterId);
  const username = normalizeUsername(user?.username || user?.display_name || historicalUsername || user?.user_id || `Team ${rosterId}`);
  const knownIdentity = user || historicalUsername;
  return {
    key: user ? identities.get(user.user_id)! : knownIdentity ? username : `${season.league.league_id}:${rosterId}`,
    name: getDisplayName(username),
    username,
    teamName: user?.metadata?.team_name || null,
    avatar: user?.metadata?.avatar || (user?.avatar ? `https://sleepercdn.com/avatars/${user.avatar}` : null),
  };
}

export function buildLeagueRecords(seasons: RecordSeason[], nflState?: RecordNFLState) {
  const performances: RecordPerformance[] = [];
  const streaks: RecordStreak[] = [];
  const active = new Map<string, RecordStreak>();
  const ordered = [...seasons].sort((a, b) => Number(a.league.season) - Number(b.league.season));
  const identities = new Map<string, string>();
  for (const season of ordered) {
    for (const user of season.users) {
      identities.set(user.user_id, normalizeUsername(user.username || user.display_name || user.user_id));
    }
  }
  for (const season of ordered) {
    // An owner who leaves the league must not carry a streak through a missing season.
    const present = new Set(season.rosters.map((roster) => teamFor(season, roster.roster_id, identities).key));
    for (const key of active.keys()) if (!present.has(key)) active.delete(key);
    for (const { week, matchups } of [...season.weeks].sort((a, b) => a.week - b.week)) {
      if (week < 1 || week > completedRecordWeeks(season.league, nflState)) continue;
      const regularSeason = week < (season.league.settings?.playoff_week_start || 19);
      const eligible = matchups.filter((matchup) => {
        const score = matchup.custom_points ?? matchup.points;
        return matchup.matchup_id != null && validScore(score);
      });
      for (const matchup of eligible) {
        const pair = matchups.filter((item) => item.matchup_id === matchup.matchup_id);
        if (pair.length !== 2) continue;
        const opponent = eligible.find((item) => item.matchup_id === matchup.matchup_id && item.roster_id !== matchup.roster_id);
        if (!opponent) continue;
        const points = (matchup.custom_points ?? matchup.points)!;
        const opponentPoints = (opponent.custom_points ?? opponent.points)!;
        const team = teamFor(season, matchup.roster_id, identities);
        const slots = (season.league.roster_positions ?? []).filter((slot) => !["BN", "IR", "TAXI"].includes(slot));
        const margin = (cents(points) - cents(opponentPoints)) / 100;
        performances.push({
          id: `${season.league.league_id}:${week}:${matchup.roster_id}`,
          season: season.league.season, week, regularSeason, team,
          opponent: teamFor(season, opponent.roster_id, identities),
          points, opponentPoints, margin, combined: (cents(points) + cents(opponentPoints)) / 100,
          lineup: (matchup.starters ?? []).map((playerId, index) => {
            const score = matchup.starters_points?.[index] ?? matchup.players_points?.[playerId];
            return { playerId, slot: slots[index] || "Starter", points: playerId === "0" ? 0 : validScore(score) ? score : null };
          }),
        });
        if (!regularSeason) continue;
        if (margin === 0) {
          active.delete(team.key);
          continue;
        }
        const result = margin > 0 ? "win" : "loss";
        const previous = active.get(team.key);
        if (previous?.result === result) {
          previous.length++;
          previous.end = { season: season.league.season, week };
        } else {
          const streak: RecordStreak = {
            team, result, length: 1,
            start: { season: season.league.season, week },
            end: { season: season.league.season, week },
          };
          active.set(team.key, streak);
          streaks.push(streak);
        }
      }
    }
  }
  return { performances, streaks };
}

export type ScoringRecord = {
  id: string;
  title: string;
  quip: string;
  metric: "points" | "margin" | "combined";
  entries: RecordPerformance[];
};

export function scoringRecords(performances: RecordPerformance[]): ScoringRecord[] {
  const wins = performances.filter((item) => item.margin > 0);
  const losses = performances.filter((item) => item.margin < 0);
  // Each game has two team performances; combined-score records need only one.
  const games = performances.filter((item) => item.team.key < item.opponent.key);
  const ranked = (items: RecordPerformance[], metric: ScoringRecord["metric"], direction: number) =>
    [...items].sort((a, b) => direction * (a[metric] - b[metric]) || a.id.localeCompare(b.id));
  return [
    { id: "lowest", title: "The Historic Stinker", quip: "The lowest score ever. The lineup has been preserved as evidence.", metric: "points", entries: ranked(performances, "points", 1) },
    { id: "highest", title: "The Cheat Code", quip: "The highest score ever. Someone check the difficulty settings.", metric: "points", entries: ranked(performances, "points", -1) },
    { id: "blowout", title: "Stop, They're Already Dead", quip: "The biggest winning margin. A public execution on the scoreboard.", metric: "margin", entries: ranked(wins, "margin", -1) },
    { id: "closest", title: "By the Skin of Their Teeth", quip: "The narrowest win. One stat correction away from disaster.", metric: "margin", entries: ranked(wins, "margin", 1) },
    { id: "unlucky", title: "All That for Nothing", quip: "The highest score in a loss. A masterpiece sent straight to the bin.", metric: "points", entries: ranked(losses, "points", -1) },
    { id: "scrappy", title: "Task Failed Successfully", quip: "The lowest score in a win. No style points, still counts.", metric: "points", entries: ranked(wins, "points", 1) },
    { id: "shootout", title: "Defence Is Optional", quip: "The highest combined score. Two teams, absolutely no chill.", metric: "combined", entries: ranked(games, "combined", -1) },
    { id: "snoozefest", title: "The Snooze Bowl", quip: "The lowest combined score. Somehow they couldn't both lose.", metric: "combined", entries: ranked(games, "combined", 1) },
  ];
}

export function recordLeaders<T>(entries: T[], value: (entry: T) => number) {
  if (!entries.length) return [];
  const cutoff = value(entries[Math.min(4, entries.length - 1)]);
  const last = entries.findIndex((entry, index) => index >= 5 && value(entry) !== cutoff);
  return last === -1 ? entries : entries.slice(0, last);
}
