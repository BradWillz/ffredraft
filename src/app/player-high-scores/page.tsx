// app/player-high-scores/page.tsx

import { SLEEPER_LEAGUE_ID } from "@/lib/config";
import {
  getLeagueHistory,
  getLeagueMatchups,
  getLeagueRosters,
  getLeagueUsers,
  getAllPlayers,
} from "@/lib/sleeper";
import PlayerAvatar from "@/components/PlayerAvatar";

type PlayerHigh = {
  playerId: string;
  playerName: string;
  season: string;
  week: number;
  points: number;
  teamName: string;
};

export default async function PlayerHighScoresPage() {
  const leagues: any[] = await getLeagueHistory(SLEEPER_LEAGUE_ID);
  const players = await getAllPlayers();

  const entries: PlayerHigh[] = [];

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

    for (let week = 1; week <= 18; week++) {
      const matchups = (await getLeagueMatchups(
        league.league_id,
        week
      )) as any[];

      if (!matchups || matchups.length === 0) continue;

      for (const m of matchups) {
        const starters: string[] = m.starters ?? [];
        const startersPoints: number[] = m.starters_points ?? [];

        if (!starters.length || starters.length !== startersPoints.length) {
          continue;
        }

        const teamName =
          rosterNameById.get(m.roster_id) ||
          `Team ${m.roster_id}`;

        starters.forEach((playerId, idx) => {
          const pts = startersPoints[idx] ?? 0;
          if (pts <= 0) return; // ignore zeros / negatives

          const p = players[playerId];
          const playerName =
            p?.full_name ||
            (p?.first_name && p?.last_name
              ? `${p.first_name} ${p.last_name}`
              : p?.first_name ||
                p?.last_name ||
                playerId);

          entries.push({
            playerId,
            playerName,
            season: league.season,
            week,
            points: pts,
            teamName,
          });
        });
      }
    }
  }

  // sort by points descending, then trim to top N so the table isn't insane
  entries.sort((a, b) => b.points - a.points);
  const top = entries.slice(0, 20); // top 20 all-time

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-bold text-white mb-4">
            💥 All-Time Player High Scores
          </h1>
          <p className="text-slate-400 text-lg">
            Biggest single-week starter performances in your league
          </p>
        </div>

        {/* Table */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr className="border-b border-slate-700">
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">#</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Player</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Team</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Season</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Week</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {top.map((row, index) => (
                  <tr key={`${row.season}-${row.week}-${row.teamName}-${row.playerId}-${index}`} className="hover:bg-slate-700/30 transition-colors duration-150">
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 font-bold text-sm">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <PlayerAvatar playerId={row.playerId} playerName={row.playerName} />
                        <span className="text-slate-200 font-bold">{row.playerName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{row.teamName}</td>
                    <td className="px-6 py-4 text-center text-slate-300">{row.season}</td>
                    <td className="px-6 py-4 text-center text-slate-300">{row.week}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-yellow-400 font-bold text-lg">{row.points.toFixed(2)}</span>
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
