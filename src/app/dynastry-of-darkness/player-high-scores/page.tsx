// app/dynastry-of-darkness/player-high-scores/page.tsx

import { DYNASTRY_LEAGUE_ID } from "@/lib/config";
import { getDisplayName, getRosterUsername } from "@/lib/normalize-username";
import {
  getLeagueHistory,
  getLeagueMatchups,
  getLeagueRosters,
  getLeagueUsers,
  getAllPlayers,
} from "@/lib/sleeper";
import PlayerAvatar from "@/components/PlayerAvatar";
import Link from "next/link";

type PlayerHigh = {
  playerId: string;
  playerName: string;
  season: string;
  week: number;
  points: number;
  teamName: string;
};

export default async function PlayerHighScoresPage() {
  const leagues: any[] = await getLeagueHistory(DYNASTRY_LEAGUE_ID);
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
      const mappedUsername = getRosterUsername(league.league_id, roster.roster_id);
      const username = mappedUsername || user?.username || user?.display_name || user?.user_id || `Team ${roster.roster_id}`;
      const displayName = getDisplayName(username);
      rosterNameById.set(roster.roster_id, displayName);
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
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-pink-900 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Home Button */}
        <div className="mb-4 sm:mb-6">
          <Link 
            href="/dynastry-of-darkness"
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-800/30 hover:bg-purple-700/40 text-purple-200 rounded-lg transition-all duration-200 backdrop-blur-sm border border-purple-700/50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </Link>
        </div>
        
        {/* Header */}
        <div className="mb-8 sm:mb-12 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4">
            💥 All-Time Player High Scores
          </h1>
          <p className="text-purple-200 text-sm sm:text-base md:text-lg">
            Biggest single-week starter performances in your league
          </p>
        </div>

        {/* Table */}
        <div className="bg-purple-800/30 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-2xl border border-purple-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-purple-900/50">
                <tr className="border-b border-purple-700/50">
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-purple-200 uppercase tracking-wider">#</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-purple-200 uppercase tracking-wider">Player</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-purple-200 uppercase tracking-wider">Team</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-purple-200 uppercase tracking-wider hidden sm:table-cell">Season</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-purple-200 uppercase tracking-wider hidden sm:table-cell">Week</th>
                  <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs font-semibold text-purple-200 uppercase tracking-wider">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-700/30">
                {top.map((row, index) => (
                  <tr key={`${row.season}-${row.week}-${row.teamName}-${row.playerId}-${index}`} className="hover:bg-purple-700/20 transition-colors duration-150">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-500/20 text-purple-300 font-bold text-xs sm:text-sm">
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <PlayerAvatar playerId={row.playerId} playerName={row.playerName} />
                        <span className="text-purple-100 font-bold text-sm sm:text-base">{row.playerName}</span>
                      </div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-purple-200 text-xs sm:text-base">{row.teamName}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center text-purple-200 text-xs sm:text-base hidden sm:table-cell">{row.season}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center text-purple-200 text-xs sm:text-base hidden sm:table-cell">{row.week}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <span className="text-yellow-400 font-bold text-base sm:text-lg">{row.points.toFixed(2)}</span>
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
