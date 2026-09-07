import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { SLEEPER_LEAGUE_ID } from "@/lib/config";
import { getLeagueMatchups, getLeagueRosters, getLeagueUsers, getNFLState } from "@/lib/sleeper";
import { getDisplayName } from "@/lib/normalize-username";
import { getLowestScorerState, resetLowestScorerState, setLowestScorerState, type LowestScorerState } from "@/lib/lowest-scorer-state";

export const dynamic = "force-dynamic";

type SleeperMatchup = { roster_id: number; matchup_id: number | null; points: number | null };
type SleeperRoster = { roster_id: number; owner_id: string | null };
type SleeperUser = { user_id: string; username?: string; display_name?: string };
type NFLState = { leg?: number; week?: number; season_type?: string };

export type DanceCandidate = {
  rosterId: number;
  name: string;
  opponentName: string;
  score: number;
};

async function getCandidates(week: number): Promise<DanceCandidate[]> {
  const [matchupsResult, rostersResult, usersResult] = await Promise.all([
    getLeagueMatchups(SLEEPER_LEAGUE_ID, week),
    getLeagueRosters(SLEEPER_LEAGUE_ID),
    getLeagueUsers(SLEEPER_LEAGUE_ID),
  ]);
  const matchups = matchupsResult as SleeperMatchup[];
  const rosters = rostersResult as SleeperRoster[];
  const users = usersResult as SleeperUser[];
  const rosterById = new Map(rosters.map((roster) => [roster.roster_id, roster]));
  const userById = new Map(users.map((user) => [user.user_id, user]));
  const nameForRoster = (rosterId: number) => {
    const ownerId = rosterById.get(rosterId)?.owner_id;
    const user = ownerId ? userById.get(ownerId) : undefined;
    return user ? getDisplayName(user.username || user.display_name || user.user_id) : `Team ${rosterId}`;
  };
  const matchupsById = new Map<number, SleeperMatchup[]>();
  matchups.forEach((matchup) => {
    if (matchup.matchup_id === null) return;
    const pairing = matchupsById.get(matchup.matchup_id) ?? [];
    pairing.push(matchup);
    matchupsById.set(matchup.matchup_id, pairing);
  });

  return matchups
    .filter((matchup) => typeof matchup.points === "number")
    .map((matchup) => {
      const opponent = matchup.matchup_id === null
        ? undefined
        : matchupsById.get(matchup.matchup_id)?.find((team) => team.roster_id !== matchup.roster_id);
      return {
        rosterId: matchup.roster_id,
        name: nameForRoster(matchup.roster_id),
        opponentName: opponent ? nameForRoster(opponent.roster_id) : "Bye week",
        score: matchup.points ?? 0,
      };
    })
    .sort((left, right) => left.score - right.score);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const week = Number(url.searchParams.get("week"));
  const state = await getLowestScorerState();
  if (!Number.isInteger(week) || week < 1 || week > 18) return NextResponse.json({ state });
  try {
    const nflState = await getNFLState() as NFLState;
    const currentLeg = nflState.leg ?? nflState.week ?? 0;
    const weekFinalized = nflState.season_type === "off" || currentLeg > week;
    if (!weekFinalized) {
      return NextResponse.json({ state, candidates: [], weekFinalized, candidatesError: `Week ${week} is still live or awaiting final score corrections.` });
    }
    return NextResponse.json({ state, candidates: await getCandidates(week), weekFinalized });
  } catch {
    return NextResponse.json({ state, candidates: [], weekFinalized: false, candidatesError: "Week status is not available yet. Try again after Sleeper finalizes scoring." });
  }
}

export async function PUT(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const state = await request.json() as LowestScorerState;
  if (!Array.isArray(state.forfeits)) return NextResponse.json({ error: "Invalid lowest-scorer state" }, { status: 400 });
  await setLowestScorerState(state);
  return NextResponse.json(state);
}

export async function DELETE() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await resetLowestScorerState();
  return NextResponse.json(await getLowestScorerState());
}