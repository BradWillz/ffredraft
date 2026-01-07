// app/dynastry-of-darkness/standings/page.tsx

import { DYNASTRY_LEAGUE_ID } from "@/lib/config";
import {
  getLeagueHistory,
  getLeagueRosters,
  getLeagueUsers,
} from "@/lib/sleeper";
import Link from "next/link";
import StandingsTabs from "@/app/standings/StandingsTabs";
import { normalizeUsername, getDisplayName, getRosterUsername } from "@/lib/normalize-username";

export default async function DynastryStandingsPage() {
  const leagues = await getLeagueHistory(DYNASTRY_LEAGUE_ID);

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
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 sm:mb-6">
          <Link 
            href="/dynastry-of-darkness"
            className="inline-flex items-center text-purple-200 hover:text-white transition-colors text-sm sm:text-base"
          >
            ← Back
          </Link>
        </div>
        
        <div className="mb-8 sm:mb-12 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
            🏈 {seasonsData[0]?.leagueName || "League Standings"}
          </h1>
          <p className="text-purple-200 text-sm sm:text-base md:text-lg">
            Season Standings
          </p>
        </div>

        <StandingsTabs seasonsData={seasonsData} />

        <p className="mt-6 text-center text-purple-400 text-sm">
          Data pulled live from Sleeper (league ID {DYNASTRY_LEAGUE_ID})
        </p>
      </div>
    </main>
  );
}
