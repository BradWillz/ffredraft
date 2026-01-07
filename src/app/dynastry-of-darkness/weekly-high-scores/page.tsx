// app/dynastry-of-darkness/weekly-high-scores/page.tsx

import { DYNASTRY_LEAGUE_ID } from "@/lib/config";
import { getDisplayName } from "@/lib/normalize-username";
import {
  getLeagueHistory,
  getLeagueMatchups,
  getLeagueRosters,
  getLeagueUsers,
} from "@/lib/sleeper";
import WeeklyHighScoresTable from "@/app/weekly-high-scores/WeeklyHighScoresTable";
import Link from "next/link";

type WeeklyHigh = {
  season: string;
  week: number;
  teamName: string;
  points: number;
  opponentName: string;
};

export default async function WeeklyHighScoresPage() {
  const leagues: any[] = await getLeagueHistory(DYNASTRY_LEAGUE_ID);
  const results: WeeklyHigh[] = [];

  for (const league of leagues) {
    const [rosters, users] = await Promise.all([
      getLeagueRosters(league.league_id),
      getLeagueUsers(league.league_id),
    ]);

    const usersById = new Map(
      (users as any[]).map((u: any) => [u.user_id, u])
    );

    const rosterNameById = new Map<number, string>();

    for (const roster of rosters as any[]) {
      const user = usersById.get(roster.owner_id);
      const username = user?.username || user?.display_name || user?.user_id || `Team ${roster.roster_id}`;
      const displayName = getDisplayName(username);
      rosterNameById.set(roster.roster_id, displayName);
    }

    // naive: check weeks 1-18 (regular + playoffs)
    for (let week = 1; week <= 18; week++) {
      const matchups = (await getLeagueMatchups(
        league.league_id,
        week
      )) as any[];

      if (!matchups || matchups.length === 0) continue;

      let best = null as null | { roster_id: number; points: number; matchup_id: number };

      for (const m of matchups) {
        const pts = m.points ?? 0;
        if (best === null || pts > best.points) {
          best = { roster_id: m.roster_id, points: pts, matchup_id: m.matchup_id };
        }
      }

      if (!best) continue;

      const teamName =
        rosterNameById.get(best.roster_id) ||
        `Team ${best.roster_id}`;

      // Find opponent in same matchup
      const opponent = matchups.find(
        (m) => m.matchup_id === best.matchup_id && m.roster_id !== best.roster_id
      );
      
      const opponentName = opponent
        ? rosterNameById.get(opponent.roster_id) || `Team ${opponent.roster_id}`
        : "N/A";

      results.push({
        season: league.season,
        week,
        teamName,
        points: best.points,
        opponentName,
      });
    }
  }

  // sort by points descending (biggest blowups at the top)
  results.sort((a, b) => b.points - a.points);
  
  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Home Button */}
        <div className="mb-4 sm:mb-6">
          <Link 
            href="/dynastry-of-darkness"
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-800/30 hover:bg-purple-700/40 text-purple-200 rounded-lg transition-all duration-200 backdrop-blur-sm border border-purple-700/50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </Link>
        </div>
        
        {/* Header */}
        <div className="mb-8 sm:mb-12 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
            📈 All-Time Weekly High Scores
          </h1>
          <p className="text-purple-200 text-sm sm:text-base md:text-lg">
            Highest single-week team scores across all seasons (including playoffs)
          </p>
        </div>

        {/* Table */}
        <WeeklyHighScoresTable data={results} />
      </div>
    </main>
  );
}
