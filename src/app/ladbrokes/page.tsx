// app/ladbrokes/page.tsx

import { SLEEPER_LEAGUE_ID } from "@/lib/config";
import {
  getLeagueHistory,
  getLeagueRosters,
  getLeagueUsers,
} from "@/lib/sleeper";
import HomeButton from "@/components/HomeButton";
import { normalizeUsername, getDisplayName, getRosterUsername } from "@/lib/normalize-username";
import LadbrokesClient from "./LadbrokesClient";

// Shuffle array helper
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default async function LadbrokesPage() {
  const leagues = await getLeagueHistory(SLEEPER_LEAGUE_ID);
  const currentLeague = leagues[0]; // Most recent season
  
  const [rosters, users] = await Promise.all([
    getLeagueRosters(currentLeague.league_id),
    getLeagueUsers(currentLeague.league_id),
  ]);

  const usersById = new Map(
    (users as any[]).map((u: any) => [u.user_id, u])
  );

  const teams = (rosters as any[])
    .map((r: any) => {
      const user = usersById.get(r.owner_id);
      const settings = r.settings || {};
      
      const mappedUsername = getRosterUsername(currentLeague.league_id, r.roster_id);
      const username = mappedUsername || user?.username || user?.display_name || user?.user_id || r.owner_id || `Team ${r.roster_id}`;
      const normalized = normalizeUsername(username);
      const formattedUsername = normalized.startsWith('@') ? normalized : `@${normalized}`;
      const displayName = getDisplayName(username);

      return {
        rosterId: r.roster_id,
        username: formattedUsername,
        displayName: displayName,
      };
    });

  // Generate 6 random matchups
  const shuffledTeams = shuffleArray(teams);
  const matchups = [];
  for (let i = 0; i < Math.min(6, Math.floor(shuffledTeams.length / 2)); i++) {
    matchups.push({
      id: i + 1,
      team1: shuffledTeams[i * 2],
      team2: shuffledTeams[i * 2 + 1],
    });
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <HomeButton />
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
                  <span className="text-4xl">🎰</span>
                  Ladbrokes
                </h1>
                <p className="text-emerald-100 mt-2">
                  Place your bets on this week's matchups
                </p>
              </div>
              <a
                href="/ladbrokes/qr-codes"
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors font-semibold text-sm sm:text-base"
              >
                📱 <span className="hidden sm:inline">QR Codes</span><span className="sm:hidden">Codes</span>
              </a>
            </div>
          </div>

          <LadbrokesClient matchups={matchups} />
        </div>
      </div>
    </main>
  );
}

