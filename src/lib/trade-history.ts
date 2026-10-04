import { getAllPlayers } from "./sleeper";
import { getDisplayName, getRosterUsername, normalizeUsername } from "./normalize-username";

const BASE_URL = "https://api.sleeper.app/v1";

export type SleeperLeague = {
  league_id: string;
  season: string;
  status?: string;
  previous_league_id?: string | null;
  roster_positions: string[];
  total_rosters: number;
  scoring_settings?: Record<string, number>;
  settings?: { playoff_week_start?: number; last_scored_leg?: number };
};
type SleeperUser = { user_id: string; username?: string; display_name?: string };
export type SleeperRoster = {
  roster_id: number;
  owner_id?: string | null;
  players?: string[] | null;
  settings?: { wins?: number; losses?: number; ties?: number; fpts?: number; fpts_decimal?: number };
};
export type SleeperPlayer = { full_name?: string; first_name?: string; last_name?: string; position?: string; team?: string; age?: number; birth_date?: string };
export type SleeperDraft = {
  draft_id: string;
  season: string;
  type: string;
  status?: string;
  start_time?: number | null;
  last_picked?: number | null;
  slot_to_roster_id?: Record<string, number | null> | null;
};
export type SleeperDraftPick = { round: number; draft_slot: number; pick_no: number; roster_id: number; player_id: string; metadata?: { first_name?: string; last_name?: string; position?: string } };
type SleeperPickMove = { season: string; round: number; roster_id: number; owner_id: number; previous_owner_id: number };
export type SleeperTransaction = {
  transaction_id: string;
  type: string;
  status: string;
  leg: number;
  status_updated: number;
  roster_ids: number[];
  adds?: Record<string, number> | null;
  drops?: Record<string, number> | null;
  draft_picks?: SleeperPickMove[];
  waiver_budget?: Array<{ sender: number; receiver: number; amount: number }>;
};

export type TradeManager = { rosterId: number; name: string; username: string };
export type PickSelection = { pickLabel: string; playerId: string; playerName: string; position: string; pickedBy: string };
export type TradeAsset =
  | { kind: "player"; playerId: string; name: string; position: string; team: string }
  | { kind: "pick"; season: string; round: number; originalRosterId: number; originalOwner: string; selection: PickSelection | null; pending: boolean }
  | { kind: "faab"; amount: number };
export type TradeRecord = {
  id: string;
  leagueId: string;
  season: string;
  week: number;
  timestamp: number;
  rosterSlots: string[];
  teamCount: number;
  sides: Array<{ manager: TradeManager; receives: TradeAsset[]; givesUp: TradeAsset[] | null }>;
};
export type TradeSeason = { season: string; trades: TradeRecord[] };
export type LeagueData = { league: SleeperLeague; rosters: SleeperRoster[]; transactions: SleeperTransaction[]; managers: Map<number, TradeManager> };
export type DraftData = { draft: SleeperDraft; picks: SleeperDraftPick[] };
// Leagues are ordered newest first, following previous_league_id.
export type TradeLedger = { seasons: TradeSeason[]; leagues: LeagueData[]; drafts: DraftData[]; players: Record<string, SleeperPlayer> };

const revalidate = { next: { revalidate: 900 } };

export async function sleeper<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, revalidate);
  if (!response.ok) throw new Error(`Sleeper API error: ${response.status} ${path}`);
  return response.json() as Promise<T>;
}

function playerLabel(player: SleeperPlayer | undefined, fallback: string) {
  return player?.full_name || [player?.first_name, player?.last_name].filter(Boolean).join(" ") || fallback;
}

export async function getTradeLedger(startLeagueId: string): Promise<TradeLedger> {
  const chain: SleeperLeague[] = [];
  for (let leagueId: string | null | undefined = startLeagueId; leagueId && leagueId !== "0" && chain.length < 20;) {
    const league: SleeperLeague = await sleeper<SleeperLeague>(`/league/${leagueId}`);
    chain.push(league);
    leagueId = league.previous_league_id;
  }

  const players = await getAllPlayers() as Record<string, SleeperPlayer>;
  const seasons = await Promise.all(chain.map(async (league) => {
    const [users, rosters, drafts, ...legs] = await Promise.all([
      sleeper<SleeperUser[]>(`/league/${league.league_id}/users`),
      sleeper<SleeperRoster[]>(`/league/${league.league_id}/rosters`),
      sleeper<SleeperDraft[]>(`/league/${league.league_id}/drafts`),
      ...Array.from({ length: 19 }, (_, leg) =>
        sleeper<SleeperTransaction[]>(`/league/${league.league_id}/transactions/${leg}`).catch(() => [] as SleeperTransaction[])),
    ]);
    const usersById = new Map(users.map((user) => [user.user_id, user]));
    const managers = new Map(rosters.map((roster) => {
      const user = roster.owner_id ? usersById.get(roster.owner_id) : undefined;
      // Only use the league-specific override; the generic roster fallback belongs to Redraft.
      const override = user ? null : getRosterUsername(league.league_id, roster.roster_id);
      const username = user?.username || user?.display_name || override || `Team${roster.roster_id}`;
      return [roster.roster_id, { rosterId: roster.roster_id, name: getDisplayName(username), username: normalizeUsername(username) }];
    }));
    const transactions = [...new Map(legs.flat()
      .filter((transaction) => transaction.status === "complete")
      .map((transaction) => [transaction.transaction_id, transaction])).values()];
    return { league, rosters, managers, drafts, transactions };
  }));

  const drafts: DraftData[] = [];
  const draftsBySeason = new Map<string, DraftData & { managers: Map<number, TradeManager> }>();
  await Promise.all(seasons.flatMap(({ drafts: summaries, managers }) => summaries.map(async (summary) => {
    const [draft, picks] = await Promise.all([
      sleeper<SleeperDraft>(`/draft/${summary.draft_id}`),
      sleeper<SleeperDraftPick[]>(`/draft/${summary.draft_id}/picks`),
    ]);
    drafts.push({ draft, picks });
    draftsBySeason.set(draft.season, { draft, picks, managers });
  })));

  const selectionFor = (season: string, round: number, originalRosterId: number): PickSelection | null => {
    const draft = draftsBySeason.get(season);
    if (!draft) return null;
    const slot = Object.entries(draft.draft.slot_to_roster_id ?? {}).find(([, rosterId]) => rosterId === originalRosterId)?.[0];
    const pick = slot ? draft.picks.find((candidate) => candidate.round === round && candidate.draft_slot === Number(slot)) : undefined;
    if (!pick) return null;
    const player = players[pick.player_id];
    return {
      pickLabel: `${round}.${String(pick.draft_slot).padStart(2, "0")}`,
      playerId: pick.player_id,
      playerName: playerLabel(player, [pick.metadata?.first_name, pick.metadata?.last_name].filter(Boolean).join(" ") || "Unknown player"),
      position: player?.position ?? pick.metadata?.position ?? "",
      pickedBy: draft.managers.get(pick.roster_id)?.name ?? `Team ${pick.roster_id}`,
    };
  };

  const tradeSeasons = seasons.map(({ league, managers, transactions }) => ({
    season: league.season,
    trades: transactions
      .filter((transaction) => transaction.type === "trade")
      .sort((left, right) => right.status_updated - left.status_updated)
      .map((trade): TradeRecord => {
        const playerAsset = (playerId: string): TradeAsset => ({
          kind: "player",
          playerId,
          name: playerLabel(players[playerId], `Player ${playerId}`),
          position: players[playerId]?.position ?? "",
          team: players[playerId]?.team ?? "FA",
        });
        const pickAsset = (pick: SleeperPickMove): TradeAsset => {
          const selection = selectionFor(pick.season, pick.round, pick.roster_id);
          return {
            kind: "pick", season: pick.season, round: pick.round,
            originalRosterId: pick.roster_id,
            originalOwner: managers.get(pick.roster_id)?.name ?? `Team ${pick.roster_id}`,
            selection, pending: !selection,
          };
        };
        const ownershipComplete = Object.entries(trade.adds ?? {}).every(([id, receiver]) => {
          const sender = trade.drops?.[id];
          return sender !== undefined && sender !== receiver && trade.roster_ids.includes(sender) && trade.roster_ids.includes(receiver);
        }) && Object.keys(trade.drops ?? {}).every((id) => trade.adds?.[id] !== undefined)
          && (trade.draft_picks ?? []).every((pick) => pick.owner_id !== pick.previous_owner_id
            && trade.roster_ids.includes(pick.owner_id) && trade.roster_ids.includes(pick.previous_owner_id))
          && (trade.waiver_budget ?? []).every((budget) => budget.sender !== budget.receiver
            && trade.roster_ids.includes(budget.sender) && trade.roster_ids.includes(budget.receiver));
        return {
          id: trade.transaction_id,
          leagueId: league.league_id,
          season: league.season,
          week: trade.leg,
          timestamp: trade.status_updated,
          rosterSlots: league.roster_positions.filter((slot) => slot !== "BN" && slot !== "IR"),
          teamCount: league.total_rosters,
          sides: trade.roster_ids.map((rosterId) => ({
            manager: managers.get(rosterId) ?? { rosterId, name: `Team ${rosterId}`, username: `Team${rosterId}` },
            givesUp: ownershipComplete ? [
              ...Object.entries(trade.drops ?? {}).filter(([, sender]) => sender === rosterId).map(([id]) => playerAsset(id)),
              ...(trade.draft_picks ?? []).filter((pick) => pick.previous_owner_id === rosterId).map(pickAsset),
              ...(trade.waiver_budget ?? []).filter((budget) => budget.sender === rosterId).map((budget): TradeAsset => ({ kind: "faab", amount: budget.amount })),
            ] : null,
            receives: [
              ...Object.entries(trade.adds ?? {})
                .filter(([, receiver]) => receiver === rosterId)
                .map(([playerId]) => playerAsset(playerId)),
              ...(trade.draft_picks ?? [])
                .filter((pick) => pick.owner_id === rosterId)
                .sort((left, right) => Number(left.season) - Number(right.season) || left.round - right.round)
                .map(pickAsset),
              ...(trade.waiver_budget ?? [])
                .filter((budget) => budget.receiver === rosterId)
                .map((budget): TradeAsset => ({ kind: "faab", amount: budget.amount })),
            ],
          })),
        };
      }),
  }));

  return {
    seasons: tradeSeasons,
    leagues: seasons.map(({ league, rosters, transactions, managers }) => ({ league, rosters, transactions, managers })),
    drafts,
    players,
  };
}
