import { unstable_cache } from "next/cache";
import { SLEEPER_LEAGUE_ID } from "./config";
import { buildLeagueRecords, completedRecordWeeks, type RecordLeague, type RecordMatchup, type RecordNFLState, type RecordRoster, type RecordSeason, type RecordUser } from "./league-records";
import { getLeagueHistory, getLeagueMatchups, getLeagueRosters, getLeagueUsers, getNFLState } from "./sleeper";

export const getRedraftRecords = unstable_cache(async () => {
  const [leagues, nflState]: [RecordLeague[], RecordNFLState] = await Promise.all([
    getLeagueHistory(SLEEPER_LEAGUE_ID),
    getNFLState(),
  ]);
  const seasons: RecordSeason[] = [];
  // Keep history requests bounded to one season's weeks at a time.
  for (const league of leagues) {
    const completed = completedRecordWeeks(league, nflState);
    if (!completed) continue;
    const [rosters, users, weeks] = await Promise.all([
      getLeagueRosters(league.league_id) as Promise<RecordRoster[]>,
      getLeagueUsers(league.league_id) as Promise<RecordUser[]>,
      Promise.all(Array.from({ length: completed }, async (_, index) => ({
        week: index + 1,
        matchups: await getLeagueMatchups(league.league_id, index + 1) as RecordMatchup[],
      }))),
    ]);
    seasons.push({ league, rosters, users, weeks });
  }
  return {
    ...buildLeagueRecords(seasons, nflState),
    seasons: seasons.map((season) => season.league.season).sort(),
  };
}, ["redraft-record-book-v2"], { revalidate: 3600 });
