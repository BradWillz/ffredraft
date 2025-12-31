// app/weekly-high-scores/page.tsx

import { SLEEPER_LEAGUE_ID } from "@/lib/config";
import {
  getLeagueHistory,
  getLeagueMatchups,
  getLeagueRosters,
  getLeagueUsers,
} from "@/lib/sleeper";

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
      const teamName =
        user?.metadata?.team_name ||
        user?.display_name ||
        `Team ${roster.roster_id}`;
      rosterNameById.set(roster.roster_id, teamName);
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
    <main style={{ padding: "2rem" }}>
      <h1>📈 All-Time Weekly High Scores (Teams)</h1>
      <p style={{ marginBottom: "1rem" }}>
        Highest single-week team scores across all seasons (including playoffs).
      </p>

      <table style={{ borderCollapse: "collapse", minWidth: "60%" }}>
        <thead>
          <tr>
            <th style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>#</th>
            <th style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>Season</th>
            <th style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>Week</th>
            <th style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>Team</th>
            <th style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>Points</th>
          </tr>
        </thead>
        <tbody>
          {top.map((row, index) => (
            <tr key={`${row.season}-${row.week}-${row.teamName}`}>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                {index + 1}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                {row.season}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                {row.week}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                {row.teamName}
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
