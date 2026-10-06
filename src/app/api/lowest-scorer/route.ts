import { NextResponse } from "next/server";
import { SLEEPER_LEAGUE_ID } from "@/lib/config";
import { getLeagueMatchups, getLeagueRosters, getLeagueUsers, getNFLState } from "@/lib/sleeper";
import { getDisplayName } from "@/lib/normalize-username";

export const dynamic = "force-dynamic";

type SleeperMatchup = { roster_id: number; matchup_id: number | null; points: number | null };
type SleeperRoster = { roster_id: number; owner_id: string | null };
type SleeperUser = { user_id: string; username?: string; display_name?: string };
type NFLState = { leg?: number; week?: number; season_type?: string };

type DanceCandidate = {
  rosterId: number;
  name: string;
  opponentName: string;
  score: number;
};

function getCandidates(matchups: SleeperMatchup[], rosters: SleeperRoster[], users: SleeperUser[]): DanceCandidate[] {
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
    .filter((matchup): matchup is SleeperMatchup & { points: number } => typeof matchup.points === "number")
    .map((matchup) => {
      const opponent = matchup.matchup_id === null
        ? undefined
        : matchupsById.get(matchup.matchup_id)?.find((team) => team.roster_id !== matchup.roster_id);
      return {
        rosterId: matchup.roster_id,
        name: nameForRoster(matchup.roster_id),
        opponentName: opponent ? nameForRoster(opponent.roster_id) : "No opponent this week",
        score: matchup.points,
      };
    })
    .sort((left, right) => left.score - right.score);
}

export async function GET() {
  const nflState = await getNFLState() as NFLState;
  const currentLeg = nflState.leg ?? nflState.week ?? 0;
  const lastFinalizedWeek = Math.min(18, nflState.season_type === "off" ? 18 : currentLeg - 1);
  if (lastFinalizedWeek < 1) return NextResponse.json({ assignments: [] });

  const [rostersResult, usersResult, ...matchupsByWeek] = await Promise.all([
    getLeagueRosters(SLEEPER_LEAGUE_ID),
    getLeagueUsers(SLEEPER_LEAGUE_ID),
    ...Array.from({ length: lastFinalizedWeek }, (_, index) => getLeagueMatchups(SLEEPER_LEAGUE_ID, index + 1)),
  ]);
  const rosters = rostersResult as SleeperRoster[];
  const users = usersResult as SleeperUser[];
  const assignments = matchupsByWeek.flatMap((matchupsResult, index) => {
    const lowestScorer = getCandidates(matchupsResult as SleeperMatchup[], rosters, users)[0];
    return lowestScorer ? [{
      week: index + 1,
      dancerName: lowestScorer.name,
      chooserName: lowestScorer.opponentName,
      score: lowestScorer.score,
    }] : [];
  });

  return NextResponse.json({ assignments });
}
