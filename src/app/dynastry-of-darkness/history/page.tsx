// app/dynastry-of-darkness/history/page.tsx

import { DYNASTRY_LEAGUE_ID } from "@/lib/config";
import {
  getLeagueHistory,
  getLeagueChampionName,
  getLeagueRosters,
  getLeagueUsers,
  getChampionshipLineup,
  getLastPlaceLineup,
} from "@/lib/sleeper";
import { getDisplayName, normalizeUsername } from "@/lib/normalize-username";
import ChampionshipTabs from "@/app/history/ChampionshipTabs";
import Link from "next/link";

export default async function HistoryPage() {
  const leagues: any[] = await getLeagueHistory(DYNASTRY_LEAGUE_ID);

  const history = await Promise.all(
    leagues.map(async (league: any) => {
      const [championName, rosters, users, championshipLineup, lastPlaceLineup] = await Promise.all([
        getLeagueChampionName(league.league_id),
        getLeagueRosters(league.league_id),
        getLeagueUsers(league.league_id),
        getChampionshipLineup(league.league_id),
        getLastPlaceLineup(league.league_id),
      ]);

      // Find last place finisher
      const usersById = new Map(
        (users as any[]).map((u: any) => [u.user_id, u])
      );

      const teams = (rosters as any[])
        .filter((r: any) => !!r.owner_id)
        .map((r: any) => {
          const user = usersById.get(r.owner_id);
          const settings = r.settings || {};
          
          const username = user?.username || user?.display_name || user?.user_id || `Team ${r.roster_id}`;
          const displayName = getDisplayName(username);

          const wins = settings.wins ?? 0;
          const losses = settings.losses ?? 0;
          const pointsFor =
            (settings.fpts ?? 0) +
            ((settings.fpts_decimal ?? 0) / 100);

          return {
            name: displayName,
            wins,
            losses,
            pointsFor,
          };
        })
        .sort((a, b) => {
          if (a.wins !== b.wins) return a.wins - b.wins;
          return a.pointsFor - b.pointsFor;
        });

      const lastPlaceName = teams[0]?.name || "Unknown";

      return {
        season: league.season,
        leagueName: league.name,
        championName,
        lastPlaceName,
        championshipLineup,
        lastPlaceLineup,
      };
    })
  );

  // Most recent season first
  history.sort((a, b) => Number(b.season) - Number(a.season));

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
            🏆 Champion's Corner
          </h1>
          <p className="text-purple-200 text-sm sm:text-base md:text-lg">
            Hall of fame trophy cabinet
          </p>
        </div>

        {/* Championship Tabs */}
        <ChampionshipTabs history={history} />
      </div>
    </main>
  );
}
