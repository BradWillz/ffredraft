// app/history/page.tsx

import { SLEEPER_LEAGUE_ID } from "@/lib/config";
import {
  getLeagueHistory,
  getLeagueChampionName,
} from "@/lib/sleeper";
import HomeButton from "@/components/HomeButton";

export default async function HistoryPage() {
  const leagues: any[] = await getLeagueHistory(SLEEPER_LEAGUE_ID);

  const history = await Promise.all(
    leagues.map(async (league: any) => {
      const championName = await getLeagueChampionName(league.league_id);

      return {
        season: league.season,
        leagueName: league.name,
        championName,
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
            🏆 League History
          </h1>
          <p className="text-slate-400 text-sm sm:text-base md:text-lg">
            Champions based on Sleeper playoff winners (not regular season record)
          </p>
        </div>

        {/* History List */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-2xl border border-slate-700 overflow-hidden p-4 sm:p-6 md:p-8">
          <div className="space-y-3 sm:space-y-4">
            {history.map((item) => (
              <div 
                key={item.season} 
                className="bg-slate-900/50 rounded-lg sm:rounded-xl p-4 sm:p-6 border border-slate-700 hover:border-blue-500/50 transition-all duration-200"
              >
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  <span className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-yellow-500/20 text-yellow-400 font-bold text-lg sm:text-xl">
                    {item.season}
                  </span>
                  <div className="flex-1 min-w-[200px]">
                    <h3 className="text-base sm:text-xl font-bold text-white">{item.leagueName}</h3>
                    <p className="text-slate-400 text-xs sm:text-base">Season Champion</p>
                  </div>
                  <div className="bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 px-4 sm:px-6 py-2 sm:py-3 rounded-lg border border-yellow-500/30 min-w-[120px] sm:min-w-[140px] text-center">
                    <span className="text-sm sm:text-lg font-bold text-yellow-400">👑 {item.championName}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
