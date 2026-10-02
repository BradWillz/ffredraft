import { getAllPlayers } from "./sleeper";
import { getDisplayName, getRosterUsername, normalizeUsername } from "./normalize-username";

const BASE_URL = "https://api.sleeper.app/v1";

type SleeperLeague = { league_id: string; season: string; previous_league_id?: string | null };
type SleeperUser = { user_id: string; username?: string; display_name?: string };
type SleeperRoster = { roster_id: number; owner_id?: string | null };
type SleeperPlayer = { full_name?: string; first_name?: string; last_name?: string; position?: string; team?: string };
type SleeperDraft = { draft_id: string; season: string; type: string; slot_to_roster_id?: Record<string, number> | null };
type SleeperDraftPick = { round: number; draft_slot: number; pick_no: number; roster_id: number; player_id: string; metadata?: { first_name?: string; last_name?: string; position?: string } };
type SleeperPickMove = { season: string; round: number; roster_id: number; owner_id: number; previous_owner_id: number };
type SleeperTrade = {
  transaction_id: string;
  type: string;
  status: string;
  leg: number;
  status_updated: number;
  roster_ids: number[];
  adds?: Record<string, number> | null;
  draft_picks?: SleeperPickMove[];
  waiver_budget?: Array<{ sender: number; receiver: number; amount: number }>;
};

export type TradeManager = { rosterId: number; name: string; username: string };
export type TradeAsset =
  | { kind: "player"; playerId: string; name: string; position: string; team: string }
  | { kind: "pick"; season: string; round: number; originalOwner: string; selection: { pickLabel: string; playerName: string; position: string; pickedBy: string } | null; pending: boolean }
  | { kind: "faab"; amount: number };
export type TradeRecord = {
  id: string;
  season: string;
  week: number;
  timestamp: number;
  sides: Array<{ manager: TradeManager; receives: TradeAsset[] }>;
};
export type TradeSeason = { season: string; trades: TradeRecord[] };

const revalidate = { next: { revalidate: 900 } };

async function sleeper<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, revalidate);
  if (!response.ok) throw new Error(`Sleeper API error: ${response.status} ${path}`);
  return response.json() as Promise<T>;
}

function playerLabel(player: SleeperPlayer | undefined, fallback: string) {
  return player?.full_name || [player?.first_name, player?.last_name].filter(Boolean).join(" ") || fallback;
}

export async function getTradeHistory(startLeagueId: string): Promise<TradeSeason[]> {
  const leagues: SleeperLeague[] = [];
  for (let leagueId: string | null | undefined = startLeagueId; leagueId && leagueId !== "0" && leagues.length < 20;) {
    const league: SleeperLeague = await sleeper<SleeperLeague>(`/league/${leagueId}`);
    leagues.push(league);
    leagueId = league.previous_league_id;
  }

  const players = await getAllPlayers() as Record<string, SleeperPlayer>;
  const seasons = await Promise.all(leagues.map(async (league) => {
    const [users, rosters, drafts, ...legs] = await Promise.all([
      sleeper<SleeperUser[]>(`/league/${league.league_id}/users`),
      sleeper<SleeperRoster[]>(`/league/${league.league_id}/rosters`),
      sleeper<SleeperDraft[]>(`/league/${league.league_id}/drafts`),
      ...Array.from({ length: 19 }, (_, leg) =>
        sleeper<SleeperTrade[]>(`/league/${league.league_id}/transactions/${leg}`).catch(() => [] as SleeperTrade[])),
    ]);
    const usersById = new Map(users.map((user) => [user.user_id, user]));
    const managers = new Map(rosters.map((roster) => {
      const user = roster.owner_id ? usersById.get(roster.owner_id) : undefined;
      // Only use the league-specific override; the generic roster fallback belongs to Redraft.
      const override = user ? null : getRosterUsername(league.league_id, roster.roster_id);
      const username = user?.username || user?.display_name || override || `Team${roster.roster_id}`;
      return [roster.roster_id, { rosterId: roster.roster_id, name: getDisplayName(username), username: normalizeUsername(username) }];
    }));
    const trades = [...new Map(legs.flat()
      .filter((transaction) => transaction.type === "trade" && transaction.status === "complete")
      .map((transaction) => [transaction.transaction_id, transaction])).values()];
    return { league, managers, drafts, trades };
  }));

  const draftsBySeason = new Map<string, { draft: SleeperDraft; picks: SleeperDraftPick[]; managers: Map<number, TradeManager> }>();
  await Promise.all(seasons.flatMap(({ drafts, managers }) => drafts.map(async (summary) => {
    const [draft, picks] = await Promise.all([
      sleeper<SleeperDraft>(`/draft/${summary.draft_id}`),
      sleeper<SleeperDraftPick[]>(`/draft/${summary.draft_id}/picks`),
    ]);
    draftsBySeason.set(draft.season, { draft, picks, managers });
  })));

  const selectionFor = (season: string, round: number, originalRosterId: number) => {
    const draft = draftsBySeason.get(season);
    if (!draft) return null;
    const slot = Object.entries(draft.draft.slot_to_roster_id ?? {}).find(([, rosterId]) => rosterId === originalRosterId)?.[0];
    const pick = slot ? draft.picks.find((candidate) => candidate.round === round && candidate.draft_slot === Number(slot)) : undefined;
    if (!pick) return null;
    const player = players[pick.player_id];
    return {
      pickLabel: `${round}.${String(pick.draft_slot).padStart(2, "0")}`,
      playerName: playerLabel(player, [pick.metadata?.first_name, pick.metadata?.last_name].filter(Boolean).join(" ") || "Unknown player"),
      position: player?.position ?? pick.metadata?.position ?? "",
      pickedBy: draft.managers.get(pick.roster_id)?.name ?? `Team ${pick.roster_id}`,
    };
  };

  return seasons.map(({ league, managers, trades }) => ({
    season: league.season,
    trades: trades
      .sort((left, right) => right.status_updated - left.status_updated)
      .map((trade) => ({
        id: trade.transaction_id,
        season: league.season,
        week: trade.leg,
        timestamp: trade.status_updated,
        sides: trade.roster_ids.map((rosterId) => ({
          manager: managers.get(rosterId) ?? { rosterId, name: `Team ${rosterId}`, username: `Team${rosterId}` },
          receives: [
            ...Object.entries(trade.adds ?? {})
              .filter(([, receiver]) => receiver === rosterId)
              .map(([playerId]): TradeAsset => ({
                kind: "player",
                playerId,
                name: playerLabel(players[playerId], `Player ${playerId}`),
                position: players[playerId]?.position ?? "",
                team: players[playerId]?.team ?? "FA",
              })),
            ...(trade.draft_picks ?? [])
              .filter((pick) => pick.owner_id === rosterId)
              .sort((left, right) => Number(left.season) - Number(right.season) || left.round - right.round)
              .map((pick): TradeAsset => {
                const selection = selectionFor(pick.season, pick.round, pick.roster_id);
                return {
                  kind: "pick",
                  season: pick.season,
                  round: pick.round,
                  originalOwner: managers.get(pick.roster_id)?.name ?? `Team ${pick.roster_id}`,
                  selection,
                  pending: !selection,
                };
              }),
            ...(trade.waiver_budget ?? [])
              .filter((budget) => budget.receiver === rosterId)
              .map((budget): TradeAsset => ({ kind: "faab", amount: budget.amount })),
          ],
        })),
      })),
  }));
}
