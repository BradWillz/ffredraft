// app/league-history/page.tsx

import { SLEEPER_LEAGUE_ID } from "@/lib/config";
import { getLeagueHistory, getLeagueRosters, getLeagueUsers } from "@/lib/sleeper";

type HistoryRow = {
  userId: string;
  name: string;
  seasons: Set<string>;
  pf: number;
  pa: number;
};

function formatNumber(value: number) {
  return value.toFixed(2);
}

export default async function LeagueHistoryPage() {
  const leagues: any[] = await getLeagueHistory(SLEEPER_LEAGUE_ID);

  const totals = new Map<string, HistoryRow>();

  for (const league of leagues) {
    const [rosters, users] = await Promise.all([
      getLeagueRosters(league.league_id),
      getLeagueUsers(league.league_id),
    ]);

    const usersById = new Map(
      (users as any[]).map((u: any) => [u.user_id, u])
    );

    for (const roster of rosters as any[]) {
      if (!roster.owner_id) continue;

      const user = usersById.get(roster.owner_id);
      const settings = roster.settings || {};

      const pf =
        (settings.fpts ?? 0) +
        ((settings.fpts_decimal ?? 0) / 100);
      const pa =
        (settings.fpts_against ?? 0) +
        ((settings.fpts_against_decimal ?? 0) / 100);

      const existing = totals.get(roster.owner_id);

      const username = user?.username || user?.display_name || user?.user_id || `Team ${roster.roster_id}`;
      const formattedUsername = username.startsWith('@') ? username : `@${username}`;

      if (existing) {
        existing.pf += pf;
        existing.pa += pa;
        existing.seasons.add(league.season);
      } else {
        totals.set(roster.owner_id, {
          userId: roster.owner_id,
          name: formattedUsername,
          pf,
          pa,
          seasons: new Set([league.season]),
        });
      }
    }
  }

  const rows = Array.from(totals.values()).sort((a, b) => b.pf - a.pf);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-bold text-white mb-4">
            📚 League History
          </h1>
          <p className="text-slate-400 text-lg">
            Aggregated points for & against across all Sleeper seasons
          </p>
        </div>

        {/* Table */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr className="border-b border-slate-700">
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">#</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Team</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Seasons</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">PF (All-time)</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">PA (All-time)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {rows.map((row, index) => (
                  <tr key={row.userId} className="hover:bg-slate-700/30 transition-colors duration-150">
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold text-sm">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-200 font-medium">{row.name}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 font-semibold">
                        {row.seasons.size}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-green-400 font-bold">{formatNumber(row.pf)}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-red-400 font-bold">{formatNumber(row.pa)}</span>
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
