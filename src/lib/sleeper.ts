// lib/sleeper.ts

import { getDisplayName } from "./normalize-username";

const BASE_URL = "https://api.sleeper.app/v1";

async function sleeperGet(path: string) {
  const res = await fetch(`${BASE_URL}${path}`);

  if (!res.ok) {
    throw new Error(`Sleeper API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// ---------- Core league helpers ----------

export async function getLeague(leagueId: string) {
  return sleeperGet(`/league/${leagueId}`);
}

export async function getLeagueRosters(leagueId: string) {
  return sleeperGet(`/league/${leagueId}/rosters`);
}

export async function getLeagueUsers(leagueId: string) {
  return sleeperGet(`/league/${leagueId}/users`);
}

export async function getLeagueMatchups(leagueId: string, week: number) {
  return sleeperGet(`/league/${leagueId}/matchups/${week}`);
}

// Winners bracket = playoff tree
export async function getWinnersBracket(leagueId: string) {
  return sleeperGet(`/league/${leagueId}/winners_bracket`);
}

// Follow previous_league_id chain backwards for history
export async function getLeagueHistory(startLeagueId: string) {
  const leagues: any[] = [];
  let currentId: string | null = startLeagueId;
  let safety = 0;

  while (currentId && safety < 20) {
    const league: any = await getLeague(currentId);
    leagues.push(league);
    currentId = league.previous_league_id ?? null;
    safety++;
  }

  return leagues;
}

// Playoff champion name (what we already wired up)
export async function getLeagueChampionName(leagueId: string) {
  const [bracket, rosters, users] = await Promise.all([
    getWinnersBracket(leagueId),
    getLeagueRosters(leagueId),
    getLeagueUsers(leagueId),
  ]);

  const bracketArr = (bracket as any[]) ?? [];
  const rostersArr = (rosters as any[]) ?? [];
  const usersArr = (users as any[]) ?? [];

  const usersById = new Map(usersArr.map((u: any) => [u.user_id, u]));

  let finals = bracketArr.filter((b: any) => b.p === 1);

  if (finals.length === 0 && bracketArr.length > 0) {
    const maxRound = Math.max(...bracketArr.map((b: any) => b.r ?? 0));
    finals = bracketArr.filter((b: any) => b.r === maxRound);
  }

  const finalMatch = finals[0];
  if (!finalMatch) return "Unknown";

  const winnerRosterId = finalMatch.w ?? finalMatch.t1 ?? null;
  if (!winnerRosterId) return "Unknown";

  const winningRoster = rostersArr.find(
    (r: any) => r.roster_id === winnerRosterId
  );
  if (!winningRoster) return "Unknown";

  const ownerId = winningRoster.owner_id;
  if (!ownerId) return `Team ${winningRoster.roster_id}`;

  const user = usersById.get(ownerId);

  const username = user?.username || user?.display_name || user?.user_id || `Team ${winningRoster.roster_id}`;
  const displayName = getDisplayName(username);

  return displayName;
}

// ---------- Player lookup (for player high-scores page) ----------

// /players/nfl is ~5MB, so we cache it in-memory
let playersCache: any | null = null;

export async function getAllPlayers() {
  if (!playersCache) {
    playersCache = await sleeperGet(`/players/nfl`);
  }
  return playersCache;
}

export async function getPlayerName(playerId: string): Promise<string> {
  const players = await getAllPlayers();
  const player = players[playerId];

  if (!player) return playerId;

  return (
    player.full_name ||
    (player.first_name && player.last_name
      ? `${player.first_name} ${player.last_name}`
      : player.first_name ||
        player.last_name ||
        playerId)
  );
}
