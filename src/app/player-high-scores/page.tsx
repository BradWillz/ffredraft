// app/player-high-scores/page.tsx

import { SLEEPER_LEAGUE_ID } from "@/lib/config";
import {
  getLeagueHistory,
  getLeagueMatchups,
  getLeagueRosters,
  getLeagueUsers,
  getAllPlayers,
} from "@/lib/sleeper";

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
      const teamName =
        user?.metadata?.team_name ||
        user?.display_name ||
        `Team ${roster.roster_id}`;
      rosterNameById.set(roster.roster_id, teamName);
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
    <main style={{ padding: "2rem" }}>
      <h1>💥 All-Time Player High Scores (Starters)</h1>
      <p style={{ marginBottom: "1rem" }}>
        Biggest single-week starter performances in your league, using league
        scoring (from matchups).
      </p>

      <table style={{ borderCollapse: "collapse", minWidth: "70%" }}>
        <thead>
          <tr>
            <th style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>#</th>
            <th style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>Player</th>
            <th style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>Team</th>
            <th style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>Season</th>
            <th style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>Week</th>
            <th style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>Points</th>
          </tr>
        </thead>
        <tbody>
          {top.map((row, index) => (
            <tr key={`${row.season}-${row.week}-${row.teamName}-${row.playerId}-${index}`}>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                {index + 1}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                {row.playerName}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                {row.teamName}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                {row.season}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                {row.week}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                {row.points.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
