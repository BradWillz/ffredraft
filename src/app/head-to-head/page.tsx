// app/head-to-head/page.tsx

import { SLEEPER_LEAGUE_ID } from "@/lib/config";
import {
  getLeagueHistory,
  getLeagueMatchups,
  getLeagueRosters,
  getLeagueUsers,
} from "@/lib/sleeper";

type RecordEntry = {
  wins: number;
  losses: number;
  ties: number;
};

type HeadToHeadRow = {
  teamId: string;
  teamName: string;
  opponentId: string;
  opponentName: string;
  wins: number;
  losses: number;
  ties: number;
};

function getOrInitRecord(
  stats: Map<string, Map<string, RecordEntry>>,
  teamId: string,
  opponentId: string
): RecordEntry {
  let vsMap = stats.get(teamId);
  if (!vsMap) {
    vsMap = new Map<string, RecordEntry>();
    stats.set(teamId, vsMap);
  }

  let rec = vsMap.get(opponentId);
  if (!rec) {
    rec = { wins: 0, losses: 0, ties: 0 };
    vsMap.set(opponentId, rec);
  }

  return rec;
}

export default async function HeadToHeadPage() {
  const leagues: any[] = await getLeagueHistory(SLEEPER_LEAGUE_ID);

  // stats[teamId][opponentId] = { wins, losses, ties } from the perspective of teamId
  const stats = new Map<string, Map<string, RecordEntry>>();
  const namesByUserId = new Map<string, string>();

  for (const league of leagues) {
    const [rosters, users] = await Promise.all([
      getLeagueRosters(league.league_id),
      getLeagueUsers(league.league_id),
    ]);

    // Map user_id -> username
    for (const u of users as any[]) {
      const username = u?.username || u?.display_name || u?.user_id;
      const formattedUsername = username.startsWith('@') ? username : `@${username}`;
      namesByUserId.set(u.user_id, formattedUsername);
    }

    // Map roster_id -> owner user_id
    const ownerByRosterId = new Map<number, string>();
    for (const roster of rosters as any[]) {
      if (!roster.owner_id) continue;
      ownerByRosterId.set(roster.roster_id, roster.owner_id);
    }

    // Loop weeks – we’ll just scan 1–18 like the other pages
    for (let week = 1; week <= 18; week++) {
      const matchups = (await getLeagueMatchups(
        league.league_id,
        week
      )) as any[];

      if (!matchups || matchups.length === 0) continue;

      // Group by matchup_id so we can see who faced who
      const byMatchupId = new Map<number, any[]>();
      for (const m of matchups) {
        const mid = m.matchup_id;
        if (mid == null) continue;
        let arr = byMatchupId.get(mid);
        if (!arr) {
          arr = [];
          byMatchupId.set(mid, arr);
        }
        arr.push(m);
      }

      for (const [, group] of byMatchupId) {
        if (group.length < 2) continue; // need at least a head-to-head

        // For standard leagues this will be 2 teams
        const [m1, m2] = group as any[];

        const u1 = ownerByRosterId.get(m1.roster_id);
        const u2 = ownerByRosterId.get(m2.roster_id);

        if (!u1 || !u2 || u1 === u2) continue;

        const p1 = m1.points ?? 0;
        const p2 = m2.points ?? 0;

        if (p1 === 0 && p2 === 0) continue; // probably an empty or invalid matchup

        if (p1 === p2) {
          // tie
          const r1 = getOrInitRecord(stats, u1, u2);
          const r2 = getOrInitRecord(stats, u2, u1);
          r1.ties += 1;
          r2.ties += 1;
        } else if (p1 > p2) {
          // u1 wins, u2 loses
          const r1 = getOrInitRecord(stats, u1, u2);
          const r2 = getOrInitRecord(stats, u2, u1);
          r1.wins += 1;
          r2.losses += 1;
        } else {
          // u2 wins, u1 loses
          const r1 = getOrInitRecord(stats, u1, u2);
          const r2 = getOrInitRecord(stats, u2, u1);
          r2.wins += 1;
          r1.losses += 1;
        }
      }
    }
  }

  // Flatten into rows: Team, Opponent, W/L/T
  const rows: HeadToHeadRow[] = [];

  for (const [teamId, vsMap] of stats.entries()) {
    for (const [oppId, rec] of vsMap.entries()) {
      if (teamId === oppId) continue;

      rows.push({
        teamId,
        opponentId: oppId,
        teamName: namesByUserId.get(teamId) ?? `@${teamId}`,
        opponentName: namesByUserId.get(oppId) ?? `@${oppId}`,
        wins: rec.wins,
        losses: rec.losses,
        ties: rec.ties,
      });
    }
  }

  // Sort: by team name, then by best win percentage vs that opponent
  rows.sort((a, b) => {
    const nameCompare = a.teamName.localeCompare(b.teamName);
    if (nameCompare !== 0) return nameCompare;

    const gamesA = a.wins + a.losses + a.ties;
    const gamesB = b.wins + b.losses + b.ties;
    const pctA = gamesA ? (a.wins + 0.5 * a.ties) / gamesA : 0;
    const pctB = gamesB ? (b.wins + 0.5 * b.ties) / gamesB : 0;

    return pctB - pctA;
  });

  // Group rows by team
  const groupedByTeam = new Map<string, HeadToHeadRow[]>();
  for (const row of rows) {
    const existing = groupedByTeam.get(row.teamName);
    if (existing) {
      existing.push(row);
    } else {
      groupedByTeam.set(row.teamName, [row]);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-bold text-white mb-4">
            🤝 Head-to-Head Records
          </h1>
          <p className="text-slate-400 text-lg">
            Win / loss / tie records across all seasons in this league tree
          </p>
        </div>

        {/* User Sections */}
        <div className="space-y-8">
          {Array.from(groupedByTeam.entries()).map(([teamName, teamRows]) => (
            <div key={teamName} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
              {/* Team Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4">
                <h2 className="text-2xl font-bold text-white">{teamName}</h2>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-900/50">
                    <tr className="border-b border-slate-700">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Opponent
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        W
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        L
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        T
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {teamRows.map((row) => (
                      <tr 
                        key={`${row.teamId}-${row.opponentId}`}
                        className="hover:bg-slate-700/30 transition-colors duration-150"
                      >
                        <td className="px-6 py-4 text-slate-200 font-medium">
                          {row.opponentName}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-500/20 text-green-400 font-bold">
                            {row.wins}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-500/20 text-red-400 font-bold">
                            {row.losses}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-500/20 text-slate-400 font-bold">
                            {row.ties}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
