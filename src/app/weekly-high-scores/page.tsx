// app/weekly-high-scores/page.tsx

import { SLEEPER_LEAGUE_ID } from "@/lib/config";
import {
  getLeagueHistory,
  getLeagueMatchups,
  getLeagueRosters,
  getLeagueUsers,
} from "@/lib/sleeper";
import HomeButton from "@/components/HomeButton";

type WeeklyHigh = {
  season: string;
  week: number;
  teamName: string;
  points: number;
};

export default async function WeeklyHighScoresPage() {
  const leagues: any[] = await getLeagueHistory(SLEEPER_LEAGUE_ID);
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
      const formattedUsername = username.startsWith('@') ? username : `@${username}`;
      rosterNameById.set(roster.roster_id, formattedUsername);
    }

    // naive: check weeks 1-18 (regular + playoffs)
    for (let week = 1; week <= 18; week++) {
      const matchups = (await getLeagueMatchups(
        league.league_id,
        week
      )) as any[];

      if (!matchups || matchups.length === 0) continue;

      let best = null as null | { roster_id: number; points: number };

      for (const m of matchups) {
        const pts = m.points ?? 0;
        if (best === null || pts > best.points) {
          best = { roster_id: m.roster_id, points: pts };
        }
      }

      if (!best) continue;

      const teamName =
        rosterNameById.get(best.roster_id) ||
        `Team ${best.roster_id}`;

      results.push({
        season: league.season,
        week,
        teamName,
        points: best.points,
      });
    }
  }

  // sort by points descending (biggest blowups at the top)
  results.sort((a, b) => b.points - a.points);
  const top = results.slice(0, 20); // top 20 all-time
  
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
            📈 All-Time Weekly High Scores
          </h1>
          <p className="text-slate-400 text-sm sm:text-base md:text-lg">
            Highest single-week team scores across all seasons (including playoffs)
          </p>
        </div>

        {/* Table */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr className="border-b border-slate-700">
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">#</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Season</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Week</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Team</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {top.map((row, index) => (
                  <tr key={`${row.season}-${row.week}-${row.teamName}`} className="hover:bg-slate-700/30 transition-colors duration-150">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs sm:text-sm">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-slate-200 font-medium text-sm sm:text-base">{row.season}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center text-slate-300 text-sm sm:text-base">{row.week}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-slate-200 font-medium text-sm sm:text-base">{row.teamName}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <span className="text-yellow-400 font-bold text-sm sm:text-base">{row.points.toFixed(2)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
