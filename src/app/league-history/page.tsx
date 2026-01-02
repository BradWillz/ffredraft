// app/league-history/page.tsx

import { SLEEPER_LEAGUE_ID } from "@/lib/config";
import { normalizeUsername, getDisplayName, getRosterUsername } from "@/lib/normalize-username";
import { getLeagueHistory, getLeagueRosters, getLeagueUsers } from "@/lib/sleeper";
import SeasonTabs from "@/components/SeasonTabs";
import HomeButton from "@/components/HomeButton";

type SeasonRow = {
  userId: string;
  username: string;
  name: string;
  pf: number;
  pa: number;
};

type SeasonData = {
  season: string;
  teams: SeasonRow[];
};

function formatNumber(value: number) {
  return value.toFixed(2);
}

export default async function LeagueHistoryPage() {
  const leagues: any[] = await getLeagueHistory(SLEEPER_LEAGUE_ID);

  const seasonDataMap = new Map<string, Map<string, SeasonRow>>();

  for (const league of leagues) {
    const [rosters, users] = await Promise.all([
      getLeagueRosters(league.league_id),
      getLeagueUsers(league.league_id),
    ]);

    const usersById = new Map(
      (users as any[]).map((u: any) => [u.user_id, u])
    );

    const seasonTeams = new Map<string, SeasonRow>();

    for (const roster of rosters as any[]) {
      const user = usersById.get(roster.owner_id);
      const settings = roster.settings || {};

      const pf =
        (settings.fpts ?? 0) +
        ((settings.fpts_decimal ?? 0) / 100);
      const pa =
        (settings.fpts_against ?? 0) +
        ((settings.fpts_against_decimal ?? 0) / 100);

      // Check if we have a manual mapping for this roster
      const mappedUsername = getRosterUsername(league.league_id, roster.roster_id);
      const username = mappedUsername || user?.username || user?.display_name || user?.user_id || roster.owner_id || `Team ${roster.roster_id}`;
      const normalized = normalizeUsername(username);
      const formattedUsername = normalized.startsWith('@') ? normalized : `@${normalized}`;
      const displayName = getDisplayName(username);

      const userId = roster.owner_id || `roster_${roster.roster_id}`;
      
      seasonTeams.set(userId, {
        userId,
        username: formattedUsername,
        name: displayName,
        pf,
        pa,
      });
    }

    seasonDataMap.set(league.season, seasonTeams);
  }

  // Convert to array and sort by season (most recent first)
  const seasonsData: SeasonData[] = Array.from(seasonDataMap.entries())
    .map(([season, teamsMap]) => ({
      season,
      teams: Array.from(teamsMap.values()).sort((a, b) => b.pf - a.pf),
    }))
    .sort((a, b) => Number(b.season) - Number(a.season));

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
            📚 League History
          </h1>
          <p className="text-slate-400 text-sm sm:text-base md:text-lg">
            Points for & against by season
          </p>
        </div>

        {/* Season Tabs */}
        <SeasonTabs seasonsData={seasonsData} />
      </div>
    </main>
  );
}
