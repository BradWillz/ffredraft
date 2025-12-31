// lib/sleeper.ts

const BASE_URL = "https://api.sleeper.app/v1";

async function sleeperGet(path: string) {
  const res = await fetch(`${BASE_URL}${path}`);

  if (!res.ok) {
    throw new Error(`Sleeper API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// --- Base helpers ---

export async function getLeague(leagueId: string) {
  return sleeperGet(`/league/${leagueId}`);
}

export async function getLeagueRosters(leagueId: string) {
  return sleeperGet(`/league/${leagueId}/rosters`);
}

export async function getLeagueUsers(leagueId: string) {
  return sleeperGet(`/league/${leagueId}/users`);
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

// Get the *playoff champion* for a league
export async function getLeagueChampionName(leagueId: string) {
  const [bracket, rosters, users] = await Promise.all([
    getWinnersBracket(leagueId),
    getLeagueRosters(leagueId),
    getLeagueUsers(leagueId),
  ]);

  const bracketArr = (bracket as any[]) ?? [];
  const rostersArr = (rosters as any[]) ?? [];
  const usersArr = (users as any[]) ?? [];

  // Map user_id -> user
  const usersById = new Map(
    usersArr.map((u: any) => [u.user_id, u])
  );

  // Find the "championship" matchup:
  // Prefer the one with placement p === 1
  let finals = bracketArr.filter((b: any) => b.p === 1);

  // If no p === 1, fall back to the highest round number
  if (finals.length === 0 && bracketArr.length > 0) {
    const maxRound = Math.max(
      ...bracketArr.map((b: any) => b.r ?? 0)
    );
    finals = bracketArr.filter((b: any) => b.r === maxRound);
  }

  const finalMatch = finals[0];
  if (!finalMatch) {
    return "Unknown";
  }

  // w = winning roster_id in the final
  const winnerRosterId = finalMatch.w ?? finalMatch.t1 ?? null;
  if (!winnerRosterId) {
    return "Unknown";
  }

  const winningRoster = rostersArr.find(
    (r: any) => r.roster_id === winnerRosterId
  );

  if (!winningRoster) {
    return "Unknown";
  }

  const ownerId = winningRoster.owner_id;
  if (!ownerId) {
    return `Team ${winningRoster.roster_id}`;
  }

  const user = usersById.get(ownerId);

  // Prefer team_name from metadata if set, else display_name, else fallback
  const teamName =
    user?.metadata?.team_name ||
    user?.display_name ||
    `Team ${winningRoster.roster_id}`;

  return teamName;
}
