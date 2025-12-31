// lib/sleeper.ts

const BASE_URL = "https://api.sleeper.app/v1";

// Generic helper to call Sleeper
async function sleeperGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    // Next.js can cache this if you like; keep it simple for now
    // next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`Sleeper API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// Type for Sleeper league data
interface SleeperLeague {
  name: string;
  season: string;
  league_id: string;
  // Add more fields as needed
}

// Get basic league info (name, season, etc.)
export async function getLeague(leagueId: string): Promise<SleeperLeague> {
  return sleeperGet<SleeperLeague>(`/league/${leagueId}`);
}
