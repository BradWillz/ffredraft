// app/bullrush/standings/page.tsx

import { BULLRUSH_LEAGUE_ID } from "@/lib/config";
import {
  getLeagueHistory,
  getLeagueRosters,
  getLeagueUsers,
} from "@/lib/sleeper";
import StandingsTabs from "@/app/standings/StandingsTabs";
import { normalizeUsername, getDisplayName, getRosterUsername } from "@/lib/normalize-username";
import Link from "next/link";

export default async function StandingsPage() {
  const leagues = await getLeagueHistory(BULLRUSH_LEAGUE_ID);

  // Process each season
  const seasonsData = await Promise.all(
    leagues.map(async (league: any) => {
      const [rosters, users] = await Promise.all([
        getLeagueRosters(league.league_id),
        getLeagueUsers(league.league_id),
      ]);

      const usersById = new Map(
        (users as any[]).map((u: any) => [u.user_id, u])
      );

      const teams = (rosters as any[])
        .map((r: any) => {
          const user = usersById.get(r.owner_id);
          const settings = r.settings || {};
          
          // Check if we have a manual mapping for this roster
          const mappedUsername = getRosterUsername(league.league_id, r.roster_id);
          const username = mappedUsername || user?.username || user?.display_name || user?.user_id || r.owner_id || `Team ${r.roster_id}`;
          const normalized = normalizeUsername(username);
          const formattedUsername = normalized.startsWith('@') ? normalized : `@${normalized}`;
          const displayName = getDisplayName(username);

          const wins = settings.wins ?? 0;
          const losses = settings.losses ?? 0;
          const ties = settings.ties ?? 0;
          const pointsFor =
            (settings.fpts ?? 0) +
            ((settings.fpts_decimal ?? 0) / 100);
          const pointsAgainst =
            (settings.fpts_against ?? 0) +
            ((settings.fpts_against_decimal ?? 0) / 100);

          return {
            rosterId: r.roster_id,
            userId: r.owner_id || `roster_${r.roster_id}`,
            username: formattedUsername,
            name: displayName,
            wins,
            losses,
            ties,
            pointsFor,
            pointsAgainst,
          };
        })
        .sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          return b.pointsFor - a.pointsFor;
        });

      return {
        season: league.season,
        leagueName: league.name,
        teams,
      };
    })
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-red-900 via-orange-900 to-red-800 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Home Button */}
        <div className="mb-4 sm:mb-6">
          <Link 
            href="/bullrush"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-800/30 hover:bg-red-700/40 text-red-200 rounded-lg transition-all duration-200 backdrop-blur-sm border border-red-700/50"
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
            🏈 {seasonsData[0]?.leagueName || "League Standings"}
          </h1>
          <p className="text-red-200 text-sm sm:text-base md:text-lg">
            Season Standings
          </p>
        </div>

        {/* Tabs and Table */}
        <StandingsTabs seasonsData={seasonsData} />

        <p className="mt-6 text-center text-red-400 text-sm">
          Data pulled live from Sleeper (league ID {BULLRUSH_LEAGUE_ID})
        </p>
      </div>
    </main>
  );
}
