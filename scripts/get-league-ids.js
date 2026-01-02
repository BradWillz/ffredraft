// Quick script to get all league IDs and their seasons
const SLEEPER_LEAGUE_ID = "1187453772455809024";

async function getLeagueHistory(startLeagueId) {
  const leagues = [];
  let currentId = startLeagueId;
  let safety = 0;

  while (currentId && safety < 20) {
    const res = await fetch(`https://api.sleeper.app/v1/league/${currentId}`);
    const league = await res.json();
    if (!league || !league.league_id) break;
    leagues.push({ league_id: league.league_id, season: league.season });
    currentId = league.previous_league_id || null;
    safety++;
  }

  return leagues;
}

getLeagueHistory(SLEEPER_LEAGUE_ID).then(leagues => {
  console.log('League IDs by season:');
  leagues.forEach(l => {
    console.log(`${l.season}: ${l.league_id}`);
  });
});
