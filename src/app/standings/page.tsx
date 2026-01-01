// app/standings/page.tsx

import { SLEEPER_LEAGUE_ID } from "@/lib/config";
import {
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
} from "@/lib/sleeper";
import HomeButton from "@/components/HomeButton";

export default async function StandingsPage() {
  const [league, rosters, users] = await Promise.all([
    getLeague(SLEEPER_LEAGUE_ID),
    getLeagueRosters(SLEEPER_LEAGUE_ID),
    getLeagueUsers(SLEEPER_LEAGUE_ID),
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

      return {
        rosterId: r.roster_id,
        name: formattedUsername,
        wins,
        losses,
        ties,
        pointsFor,
      };
    })
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.pointsFor - a.pointsFor;
    });

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
            🏈 {league.name}
          </h1>
          <p className="text-slate-400 text-sm sm:text-base md:text-lg">
            {league.season} Season Standings
          </p>
        </div>

        {/* Table */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr className="border-b border-slate-700">
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">#</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Team</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Record</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Points For</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {teams.map((team, index) => (
                  <tr key={team.rosterId} className="hover:bg-slate-700/30 transition-colors duration-150">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs sm:text-sm">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-slate-200 font-medium text-sm sm:text-base">{team.name}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <span className="text-slate-200 font-semibold text-sm sm:text-base">
                        <span className="text-green-400">{team.wins}</span>-<span className="text-red-400">{team.losses}</span>
                        {team.ties ? <span className="text-slate-400">-{team.ties}</span> : ""}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <span className="text-yellow-400 font-bold text-sm sm:text-base">{team.pointsFor.toFixed(2)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-6 text-center text-slate-500 text-sm">
          Data pulled live from Sleeper (league ID {SLEEPER_LEAGUE_ID})
        </p>
      </div>
    </main>
  );
}
