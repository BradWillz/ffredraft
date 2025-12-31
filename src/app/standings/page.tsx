// app/standings/page.tsx

import { SLEEPER_LEAGUE_ID } from "@/lib/config";
import { getLeague } from "@/lib/sleeper";

export default async function StandingsPage() {
  // This runs on the server and calls Sleeper
  const league = await getLeague(SLEEPER_LEAGUE_ID);

  return (
    <main style={{ padding: "2rem" }}>
      <h1>🏈 {league.name}</h1>
      <p>Season: {league.season}</p>

      <p style={{ marginTop: "1rem", fontSize: "0.9rem", opacity: 0.8 }}>
        Data live from Sleeper (league ID {SLEEPER_LEAGUE_ID})
      </p>
    </main>
  );
}
