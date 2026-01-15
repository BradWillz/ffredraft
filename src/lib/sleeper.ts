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

// Get all drafts for a league (can have multiple drafts per league)
export async function getLeagueDrafts(leagueId: string) {
  return sleeperGet(`/league/${leagueId}/drafts`);
}

// Get specific draft details
export async function getDraft(draftId: string) {
  return sleeperGet(`/draft/${draftId}`);
}

// Get all picks from a draft
export async function getDraftPicks(draftId: string) {
  return sleeperGet(`/draft/${draftId}/picks`);
}

// Get traded picks for a league
export async function getTradedPicks(leagueId: string) {
  return sleeperGet(`/league/${leagueId}/traded_picks`);
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

// Get championship game winning lineup
export async function getChampionshipLineup(leagueId: string) {
  try {
    const [bracket, rosters, league] = await Promise.all([
      getWinnersBracket(leagueId),
      getLeagueRosters(leagueId),
      getLeague(leagueId),
    ]);

    const bracketArr = (bracket as any[]) ?? [];
    const rostersArr = (rosters as any[]) ?? [];

    // Find championship match
    let finals = bracketArr.filter((b: any) => b.p === 1);
    if (finals.length === 0 && bracketArr.length > 0) {
      const maxRound = Math.max(...bracketArr.map((b: any) => b.r ?? 0));
      finals = bracketArr.filter((b: any) => b.r === maxRound);
    }

    const finalMatch = finals[0];
    if (!finalMatch) return null;

    const winnerRosterId = finalMatch.w ?? finalMatch.t1 ?? null;
    if (!winnerRosterId) return null;

    const winningRoster = rostersArr.find((r: any) => r.roster_id === winnerRosterId);
    if (!winningRoster) return null;

    // Get championship week matchup
    const playoffWeekStart = league.settings?.playoff_week_start ?? 15;
    const playoffRounds = bracketArr.length > 0 ? Math.max(...bracketArr.map((b: any) => b.r ?? 0)) : 2;
    const championshipWeek = playoffWeekStart + playoffRounds - 1;

    const matchups = await getLeagueMatchups(leagueId, championshipWeek);
    const matchupsArr = (matchups as any[]) ?? [];
    
    const championshipMatchup = matchupsArr.find(
      (m: any) => m.roster_id === winnerRosterId
    );

    if (!championshipMatchup || !championshipMatchup.starters) return null;

    // Get player names for starters
    const players = await getAllPlayers();
    const lineup = championshipMatchup.starters
      .filter((playerId: string) => playerId && playerId !== '0')
      .map((playerId: string) => {
        const player = players[playerId];
        if (!player) return { name: playerId, position: 'FLEX' };
        
        return {
          name: player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim() || playerId,
          position: player.position || 'FLEX'
        };
      });

    return lineup;
  } catch (error) {
    console.error('Error fetching championship lineup:', error);
    return null;
  }
}

// Get last place team's lineup from final regular season week
export async function getLastPlaceLineup(leagueId: string) {
  try {
    const [rosters, users, league] = await Promise.all([
      getLeagueRosters(leagueId),
      getLeagueUsers(leagueId),
      getLeague(leagueId),
    ]);

    const rostersArr = (rosters as any[]) ?? [];
    const usersArr = (users as any[]) ?? [];
    
    const usersById = new Map(usersArr.map((u: any) => [u.user_id, u]));

    // Find last place team based on wins/points
    const teams = rostersArr
      .filter((r: any) => !!r.owner_id)
      .map((r: any) => {
        const settings = r.settings || {};
        const wins = settings.wins ?? 0;
        const pointsFor = (settings.fpts ?? 0) + ((settings.fpts_decimal ?? 0) / 100);
        
        return {
          roster_id: r.roster_id,
          wins,
          pointsFor,
        };
      })
      .sort((a, b) => {
        if (a.wins !== b.wins) return a.wins - b.wins;
        return a.pointsFor - b.pointsFor;
      });

    const lastPlaceRoster = teams[0];
    if (!lastPlaceRoster) return null;

    // Get final regular season week
    const playoffWeekStart = league.settings?.playoff_week_start ?? 15;
    const finalWeek = playoffWeekStart - 1;

    const matchups = await getLeagueMatchups(leagueId, finalWeek);
    const matchupsArr = (matchups as any[]) ?? [];
    
    const lastPlaceMatchup = matchupsArr.find(
      (m: any) => m.roster_id === lastPlaceRoster.roster_id
    );

    if (!lastPlaceMatchup || !lastPlaceMatchup.starters) return null;

    // Get player names for starters
    const players = await getAllPlayers();
    const lineup = lastPlaceMatchup.starters
      .filter((playerId: string) => playerId && playerId !== '0')
      .map((playerId: string) => {
        const player = players[playerId];
        if (!player) return { name: playerId, position: 'FLEX' };
        
        return {
          name: player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim() || playerId,
          position: player.position || 'FLEX'
        };
      });

    return lineup;
  } catch (error) {
    console.error('Error fetching last place lineup:', error);
    return null;
  }
}
