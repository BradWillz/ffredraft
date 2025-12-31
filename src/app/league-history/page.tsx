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

      const teamName =
        user?.metadata?.team_name ||
        user?.display_name ||
        `Team ${roster.roster_id}`;

      if (existing) {
        existing.pf += pf;
        existing.pa += pa;
        existing.seasons.add(league.season);
      } else {
        totals.set(roster.owner_id, {
          userId: roster.owner_id,
          name: teamName,
          pf,
          pa,
          seasons: new Set([league.season]),
        });
      }
    }
  }

  const rows = Array.from(totals.values()).sort((a, b) => b.pf - a.pf);

  return (
    <main style={{ padding: "2rem" }}>
      <h1>📚 League History – Points For & Against</h1>
      <p style={{ marginBottom: "1rem" }}>
        Aggregated across all Sleeper seasons in this league tree.
      </p>

      <table style={{ borderCollapse: "collapse", minWidth: "60%" }}>
        <thead>
          <tr>
            <th style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>#</th>
            <th style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>Team</th>
            <th style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>Seasons</th>
            <th style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>PF (All-time)</th>
            <th style={{ padding: "0.5rem", borderBottom: "1px solid #ccc" }}>PA (All-time)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.userId}>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                {index + 1}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                {row.name}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                {row.seasons.size}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                {formatNumber(row.pf)}
              </td>
              <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                {formatNumber(row.pa)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
