// app/history/page.tsx

import { SLEEPER_LEAGUE_ID } from "@/lib/config";
import {
  getLeagueHistory,
  getLeagueChampionName,
  getLeagueRosters,
  getLeagueUsers,
} from "@/lib/sleeper";
import { getDisplayName, normalizeUsername } from "@/lib/normalize-username";
import HomeButton from "@/components/HomeButton";
import ChampionshipTabs from "./ChampionshipTabs";

export default async function HistoryPage() {
  const leagues: any[] = await getLeagueHistory(SLEEPER_LEAGUE_ID);

  const history = await Promise.all(
    leagues.map(async (league: any) => {
      const [championName, rosters, users] = await Promise.all([
        getLeagueChampionName(league.league_id),
        getLeagueRosters(league.league_id),
        getLeagueUsers(league.league_id),
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
      };
    })
  );

  // Most recent season first
  history.sort((a, b) => Number(b.season) - Number(a.season));

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Home Button */}
        <div className="mb-4 sm:mb-6">
          <HomeButton />
        </div>
        
        {/* Header */}
        <div className="mb-8 sm:mb-12 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
            🏆 Champion's Corner
          </h1>
          <p className="text-slate-400 text-sm sm:text-base md:text-lg">
            Hall of fame trophy cabinet
          </p>
        </div>

        {/* Championship Tabs */}
        <ChampionshipTabs history={history} />
      </div>
    </main>
  );
}
