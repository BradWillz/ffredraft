import { SLEEPER_LEAGUE_ID } from "./config";
import { getDisplayName } from "./normalize-username";
import { getLeague, getLeagueMatchups, getLeagueRosters, getLeagueUsers } from "./sleeper";
import { sharedGet } from "./shared-store";

const TUCKER_USER_ID = "471803748163776512";
export const POWER_OVERRIDE_KEY = "redraft:2026:power-override";

type SleeperUser = { user_id: string; username?: string; display_name?: string };
type SleeperRoster = { roster_id: number; owner_id?: string };
type SleeperMatchup = { roster_id: number; matchup_id: number | null; points: number | null };

export type PowerOverride = { effectiveWeek: number; rosterId: number };
export type PowerHolder = {
  week: number;
  holderName: string;
  rosterId: number;
  reason: string;
  points?: number;
  opponentName?: string;
};

function rosterName(rosterId: number, rosters: SleeperRoster[], users: SleeperUser[]) {
  const roster = rosters.find((item) => item.roster_id === rosterId);
  const user = users.find((item) => item.user_id === roster?.owner_id);
  return user ? getDisplayName(user.username || user.display_name || user.user_id) : `Team ${rosterId}`;
}

export async function getPowerState() {
  const [league, rawRosters, rawUsers, override] = await Promise.all([
    getLeague(SLEEPER_LEAGUE_ID),
    getLeagueRosters(SLEEPER_LEAGUE_ID),
    getLeagueUsers(SLEEPER_LEAGUE_ID),
    sharedGet<PowerOverride>(POWER_OVERRIDE_KEY),
  ]);
  const rosters = rawRosters as SleeperRoster[];
  const users = rawUsers as SleeperUser[];
  const tuckerRoster = rosters.find((roster) => roster.owner_id === TUCKER_USER_ID);
  if (!tuckerRoster) throw new Error("Tucker's roster was not found in the 2026 Redraft league");

  let holderRosterId = tuckerRoster.roster_id;
  const history: PowerHolder[] = [{
    week: 0,
    holderName: "Tucker",
    rosterId: holderRosterId,
    reason: "Carried THE POWER into Week 1",
  }];
  const lastCompletedWeek = Number(league.settings?.last_scored_leg ?? 0);

  for (let week = 1; week <= lastCompletedWeek; week += 1) {
    if (override?.effectiveWeek === week) {
      holderRosterId = override.rosterId;
      history.push({ week: week - 1, holderName: rosterName(holderRosterId, rosters, users), rosterId: holderRosterId, reason: "Commissioner override" });
    }

    const matchups = await getLeagueMatchups(SLEEPER_LEAGUE_ID, week) as SleeperMatchup[];
    const holder = matchups.find((matchup) => matchup.roster_id === holderRosterId);
    const opponent = matchups.find((matchup) => matchup.matchup_id === holder?.matchup_id && matchup.roster_id !== holderRosterId);
    const holderName = rosterName(holderRosterId, rosters, users);

    if (!holder || !opponent || holder.points == null || opponent.points == null) {
      history.push({ week, holderName, rosterId: holderRosterId, reason: "Retained (bye or incomplete matchup)" });
      continue;
    }

    if (opponent.points > holder.points) {
      const previousHolder = holderName;
      holderRosterId = opponent.roster_id;
      history.push({ week, holderName: rosterName(holderRosterId, rosters, users), rosterId: holderRosterId, reason: `Defeated ${previousHolder}`, points: opponent.points, opponentName: previousHolder });
    } else {
      history.push({ week, holderName, rosterId: holderRosterId, reason: opponent.points === holder.points ? "Retained after a tie" : `Retained by defeating ${rosterName(opponent.roster_id, rosters, users)}`, points: holder.points, opponentName: rosterName(opponent.roster_id, rosters, users) });
    }
  }

  return {
    currentHolder: history.at(-1)!,
    history,
    lastCompletedWeek,
    nextWeek: lastCompletedWeek + 1,
    rosters: rosters.map((roster) => ({ rosterId: roster.roster_id, name: rosterName(roster.roster_id, rosters, users) })),
    override,
  };
}