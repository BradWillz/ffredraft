// app/standings/page.tsx

import { SLEEPER_LEAGUE_ID } from "@/lib/config";
import {
  getLeagueHistory,
  getLeagueRosters,
  getLeagueUsers,
} from "@/lib/sleeper";
import HomeButton from "@/components/HomeButton";
import StandingsTabs from "./StandingsTabs";

export default async function StandingsPage() {
  const leagues = await getLeagueHistory(SLEEPER_LEAGUE_ID);

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
        .filter((r: any) => !!r.owner_id)
        .map((r: any) => {
          const user = usersById.get(r.owner_id);
          const settings = r.settings || {};
          
          const username = user?.username || user?.display_name || user?.user_id || `Team ${r.roster_id}`;
          const formattedUsername = username.startsWith('@') ? username : `@${username}`;

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
            name: formattedUsername,
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
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Home Button */}
        <div className="mb-4 sm:mb-6">
          <HomeButton />
        </div>
        
        {/* Header */}
        <div className="mb-8 sm:mb-12 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
            🏈 {seasonsData[0]?.leagueName || "League Standings"}
          </h1>
          <p className="text-slate-400 text-sm sm:text-base md:text-lg">
            Season Standings
          </p>
        </div>

        {/* Tabs and Table */}
        <StandingsTabs seasonsData={seasonsData} />

        <p className="mt-6 text-center text-slate-500 text-sm">
          Data pulled live from Sleeper (league ID {SLEEPER_LEAGUE_ID})
        </p>
      </div>
    </main>
  );
}
