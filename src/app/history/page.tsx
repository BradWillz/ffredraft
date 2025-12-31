// app/history/page.tsx

import { SLEEPER_LEAGUE_ID } from "@/lib/config";
import {
  getLeagueHistory,
  getLeagueChampionName,
} from "@/lib/sleeper";

export default async function HistoryPage() {
  const leagues: any[] = await getLeagueHistory(SLEEPER_LEAGUE_ID);

  const history = await Promise.all(
    leagues.map(async (league: any) => {
      const championName = await getLeagueChampionName(league.league_id);

      return {
        season: league.season,
        leagueName: league.name,
        championName,
      };
    })
  );

  // Most recent season first
  history.sort((a, b) => Number(b.season) - Number(a.season));

  return (
    <main style={{ padding: "2rem" }}>
      <h1>🏆 League History</h1>
      <p style={{ marginBottom: "1rem" }}>
        Champions based on Sleeper playoff winners (not regular season record).
      </p>

      <ul>
        {history.map((item) => (
          <li key={item.season} style={{ marginBottom: "0.5rem" }}>
            <strong>{item.season}</strong> – {item.leagueName} – Champion:{" "}
            {item.championName}
          </li>
        ))}
      </ul>
    </main>
  );
}
