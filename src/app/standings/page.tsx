// app/standings/page.tsx

import { SLEEPER_LEAGUE_ID } from "@/lib/config";
import {
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
} from "@/lib/sleeper";

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

      const wins = settings.wins ?? 0;
      const losses = settings.losses ?? 0;
      const ties = settings.ties ?? 0;
      const pointsFor =
        (settings.fpts ?? 0) +
        ((settings.fpts_decimal ?? 0) / 100);

      return {
        rosterId: r.roster_id,
        name: user?.display_name ?? `Team ${r.roster_id}`,
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
    <main style={{ padding: "2rem" }}>
      <h1>
        {league.name} – Standings ({league.season})
      </h1>

      <table style={{ marginTop: "1rem", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>#</th>
            <th style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>Team</th>
            <th style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>Record</th>
            <th style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>Points For</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, index) => (
            <tr key={team.rosterId}>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                {index + 1}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                {team.name}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                {team.wins}-{team.losses}
                {team.ties ? `-${team.ties}` : ""}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                {team.pointsFor.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: "1rem", fontSize: "0.85rem", opacity: 0.7 }}>
        Data pulled live from Sleeper (league ID {SLEEPER_LEAGUE_ID})
      </p>
    </main>
  );
}
