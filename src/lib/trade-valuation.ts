import { fetchValues, valueKey, type StatsGuyFormat, type ValueRequest } from "./statsguy";
import { sharedAcquireLock, sharedGet, sharedSet } from "./shared-store";
import {
  atTradeScore, isOffseasonTrade, letterGrade, lineupStrength, marketFactor, playerFactor, scoreFromDelta, scoringFactors,
  SKILL_POSITIONS, tierForRank, valueDelta,
  type Grade, type ScoringFactors, type ScoringStats, type Tier, type ValuedPlayer,
} from "./trade-grading";
import {
  sleeper,
  type LeagueData, type SleeperDraft, type SleeperRoster, type TradeAsset, type TradeLedger, type TradeRecord,
} from "./trade-history";

// basis "trade" = values on the trade date; "current" = today's values (trades before Stats Guy history).
export type SideAssessment = { rosterId: number; grade: Grade; basis: "trade" | "current"; summary: string };
export type TradeAssessment = { sides: Array<SideAssessment | null> };
export type TradeGrades = { computedAt: number; tradeIds: string[]; assessments: Record<string, TradeAssessment>; error: string | null };

const CACHE_KEY = "dynastry:trade-grades:v2";
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const VALUE_HISTORY_START = "2025-09-01";

type Lookup = (format: StatsGuyFormat, date: string | null, id: string) => { value: number; found: boolean };
type Ranks = Map<number, number> | null;

const isoDay = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);

const statsCache = new Map<number, Promise<Record<string, ScoringStats>>>();
function seasonStats(season: number) {
  if (!statsCache.has(season)) {
    // Over Next's 2MB fetch-cache limit, so keep it in memory instead.
    const request = fetch(`https://api.sleeper.app/v1/stats/nfl/regular/${season}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() as Promise<Record<string, ScoringStats>> : {}))
      .catch(() => ({}));
    statsCache.set(season, request);
  }
  return statsCache.get(season)!;
}

export function standingsRanks(rosters: SleeperRoster[]): Map<number, number> {
  const points = (roster: SleeperRoster) => (roster.settings?.fpts ?? 0) + (roster.settings?.fpts_decimal ?? 0) / 100;
  const sorted = [...rosters].sort((left, right) => (right.settings?.wins ?? 0) - (left.settings?.wins ?? 0) || points(right) - points(left));
  return new Map(sorted.map((roster, index) => [roster.roster_id, index + 1]));
}

const matchupRankCache = new Map<string, Promise<Map<number, number>>>();
function matchupRanks(leagueId: string, weeks: number) {
  const key = `${leagueId}|${weeks}`;
  if (!matchupRankCache.has(key)) {
    matchupRankCache.set(key, (async () => {
      const results = await Promise.all(Array.from({ length: weeks }, (_, index) =>
        sleeper<Array<{ roster_id: number; matchup_id: number | null; points: number }>>(`/league/${leagueId}/matchups/${index + 1}`)));
      const record = new Map<number, { wins: number; points: number }>();
      for (const week of results) {
        const games = new Map<number, Array<{ roster_id: number; points: number }>>();
        for (const entry of week) {
          const current = record.get(entry.roster_id) ?? { wins: 0, points: 0 };
          current.points += entry.points ?? 0;
          record.set(entry.roster_id, current);
          if (entry.matchup_id != null) games.set(entry.matchup_id, [...(games.get(entry.matchup_id) ?? []), entry]);
        }
        for (const [home, away] of games.values()) {
          if (!home || !away || home.points === away.points) continue;
          record.get(home.points > away.points ? home.roster_id : away.roster_id)!.wins += 1;
        }
      }
      const sorted = [...record.entries()].sort(([, left], [, right]) => right.wins - left.wins || right.points - left.points);
      return new Map(sorted.map(([rosterId], index) => [rosterId, index + 1]));
    })());
  }
  return matchupRankCache.get(key)!;
}

// Walk every roster move newest-first from today's rosters to recover each manager's roster just before a trade.
export function reconstructRosters(ledger: Pick<TradeLedger, "leagues" | "drafts">) {
  const state = new Map<number, Set<string>>(ledger.leagues[0]?.rosters.map((roster) => [roster.roster_id, new Set(roster.players ?? [])]) ?? []);
  const roster = (rosterId: number) => {
    if (!state.has(rosterId)) state.set(rosterId, new Set());
    return state.get(rosterId)!;
  };
  const events: Array<{ time: number; undo: () => void; tradeId?: string; rosterIds?: number[] }> = [];
  for (const { transactions } of ledger.leagues) {
    for (const transaction of transactions) {
      events.push({
        time: transaction.status_updated,
        undo: () => {
          for (const [playerId, rosterId] of Object.entries(transaction.adds ?? {})) roster(rosterId).delete(playerId);
          for (const [playerId, rosterId] of Object.entries(transaction.drops ?? {})) roster(rosterId).add(playerId);
        },
        ...(transaction.type === "trade" ? { tradeId: transaction.transaction_id, rosterIds: transaction.roster_ids } : {}),
      });
    }
  }
  for (const { draft, picks } of ledger.drafts) {
    const time = draft.last_picked ?? draft.start_time;
    if (!time) continue;
    events.push({ time, undo: () => picks.forEach((pick) => roster(pick.roster_id).delete(pick.player_id)) });
  }
  events.sort((left, right) => right.time - left.time);
  const before = new Map<string, Map<number, string[]>>();
  for (const event of events) {
    event.undo();
    if (event.tradeId) before.set(event.tradeId, new Map(event.rosterIds!.map((rosterId) => [rosterId, [...roster(rosterId)]])));
  }
  return before;
}

function nextDraftSeason(season: number, offseason: boolean, timestamp: number, drafts: Map<number, SleeperDraft>) {
  const draft = drafts.get(season);
  const finished = draft?.status === "complete" && (draft.last_picked ?? draft.start_time ?? 0) <= timestamp;
  return offseason && draft && !finished ? season : season + 1;
}

export function pickIds(
  pick: { season: number; round: number; originalRosterId: number },
  nextSeason: number, ranks: Ranks, teamCount: number, slotDraft: SleeperDraft | null,
) {
  const base = `pick:${pick.season}:${pick.round}`;
  const variant = pick.season > nextSeason ? "mid"
    : ({ contender: "late", middle: "mid", rebuilder: "early" } as const)[tierForRank(ranks?.get(pick.originalRosterId) ?? null, teamCount)];
  let exact: string | null = null;
  if (pick.season === nextSeason && slotDraft?.slot_to_roster_id) {
    const slot = Number(Object.entries(slotDraft.slot_to_roster_id).find(([, rosterId]) => rosterId === pick.originalRosterId)?.[0]);
    if (slot) {
      const inRound = slotDraft.type === "snake" && pick.round % 2 === 0 ? teamCount + 1 - slot : slot;
      exact = `${base}.${String(inRound).padStart(2, "0")}`;
    }
  }
  return { exact, expected: `${base}:${variant}`, low: `${base}:late`, high: `${base}:early` };
}

export function summaryFor(valueIn: number, valueOut: number, fit: { starterChange: number; tier: Tier } | null) {
  const edge = (larger: number, smaller: number) => (smaller <= 0 || larger / smaller > 3 ? "by a mile" : `by ${Math.round((larger / smaller - 1) * 100)}%`);
  const value = Math.abs(valueIn - valueOut) < 0.05 * Math.max(valueIn, valueOut) ? "Fair value"
    : valueIn > valueOut ? `Won the value ${edge(valueIn, valueOut)}` : `Overpaid ${edge(valueOut, valueIn)}`;
  if (!fit) return `${value} on today's values.`;
  const pct = Math.round(fit.starterChange * 100);
  const lineup = pct >= 2 ? `, lineup +${pct}%` : pct <= -2 ? `, lineup ${pct}%` : "";
  return `${value}${lineup} as a ${fit.tier === "middle" ? "mid-table team" : fit.tier}.`;
}

async function evaluate(ledger: TradeLedger, lookup: Lookup, now: number): Promise<Record<string, TradeAssessment>> {
  const leagueById = new Map<string, LeagueData>(ledger.leagues.map((data) => [data.league.league_id, data]));
  const drafts = new Map(ledger.drafts.map(({ draft }) => [Number(draft.season), draft]));
  const current = ledger.leagues[0];
  const positionOf = (playerId: string) => ledger.players[playerId]?.position;
  const factorsFor = async (season: number, scoring: Record<string, number>): Promise<ScoringFactors | null> => {
    const stats = await seasonStats(season);
    return Object.keys(stats).length ? scoringFactors(stats, scoring, positionOf) : null;
  };
  const rankAt = async (trade: TradeRecord): Promise<Ranks> => {
    const data = leagueById.get(trade.leagueId);
    if (!data) return null;
    const weeks = Math.min(trade.week - 1, (data.league.settings?.playoff_week_start ?? 15) - 1);
    if (!isOffseasonTrade(trade) && weeks >= 4) return matchupRanks(data.league.league_id, weeks);
    const previous = data.league.previous_league_id ? leagueById.get(data.league.previous_league_id) : undefined;
    return previous ? standingsRanks(previous.rosters) : null;
  };

  const currentSeason = Number(current.league.season);
  const todayNext = nextDraftSeason(currentSeason, true, now, drafts);
  const currentPrevious = current.league.previous_league_id ? leagueById.get(current.league.previous_league_id) : undefined;
  const todayRanks = (current.league.settings?.last_scored_leg ?? 0) >= 4 ? standingsRanks(current.rosters)
    : currentPrevious ? standingsRanks(currentPrevious.rosters) : null;
  const todaySlotDraft = drafts.get(todayNext)?.status !== "complete" ? drafts.get(todayNext) ?? null : null;
  const todayFactors = await factorsFor(currentSeason - 1, current.league.scoring_settings ?? {});

  const todayValue = (asset: TradeAsset, teamCount: number) => {
    if (asset.kind === "faab") return 0;
    const playerId = asset.kind === "player" ? asset.playerId : asset.selection?.playerId;
    if (playerId) return lookup("sf_dynasty", null, playerId).value * marketFactor(todayFactors, positionOf(playerId) ?? "");
    if (asset.kind !== "pick") return 0;
    const ids = pickIds({ season: Number(asset.season), round: asset.round, originalRosterId: asset.originalRosterId }, todayNext, todayRanks, teamCount, todaySlotDraft);
    const exact = ids.exact ? lookup("sf_dynasty", null, ids.exact) : null;
    return exact?.found ? exact.value : lookup("sf_dynasty", null, ids.expected).value;
  };

  const assessments: Record<string, TradeAssessment> = {};
  const rostersBefore = reconstructRosters(ledger);
  for (const trade of ledger.seasons.flatMap((season) => season.trades)) {
    const data = leagueById.get(trade.leagueId);
    const date = isoDay(trade.timestamp - DAY_MS);
    const historical = date >= VALUE_HISTORY_START && Boolean(data);
    const ranks = historical ? await rankAt(trade) : null;
    const factors = historical ? await factorsFor(new Date(trade.timestamp).getUTCFullYear() - 1, data!.league.scoring_settings ?? {}) : null;
    const offseason = isOffseasonTrade(trade);
    const next = nextDraftSeason(Number(trade.season), offseason, trade.timestamp, drafts);
    const slotDraft = offseason ? drafts.get(next) ?? null : null;

    const marketAt = (asset: TradeAsset) => {
      if (asset.kind === "faab") return 0;
      if (asset.kind === "player") return lookup("sf_dynasty", date, asset.playerId).value * marketFactor(factors, asset.position);
      if (Number(asset.season) < next) {
        const playerId = asset.selection?.playerId;
        return playerId ? lookup("sf_dynasty", date, playerId).value * marketFactor(factors, positionOf(playerId) ?? "") : 0;
      }
      const ids = pickIds({ season: Number(asset.season), round: asset.round, originalRosterId: asset.originalRosterId }, next, ranks, trade.teamCount, slotDraft);
      const exact = ids.exact ? lookup("sf_dynasty", date, ids.exact) : null;
      return exact?.found ? exact.value : lookup("sf_dynasty", date, ids.expected).value;
    };
    const lineup = (playerIds: Iterable<string>) => {
      const valued: ValuedPlayer[] = [];
      for (const id of playerIds) {
        const position = positionOf(id) ?? "";
        if (!SKILL_POSITIONS.has(position)) continue;
        valued.push({ id, position, value: lookup("sf_redraft", date, id).value * playerFactor(factors, id, position) });
      }
      return lineupStrength(valued, trade.rosterSlots);
    };

    const sides = trade.sides.map((side): SideAssessment | null => {
      const given = side.givesUp;
      const rosterId = side.manager.rosterId;
      if (!given) return null;

      if (historical) {
        const valueIn = side.receives.reduce((total, asset) => total + marketAt(asset), 0);
        const valueOut = given.reduce((total, asset) => total + marketAt(asset), 0);
        const incoming = side.receives.flatMap((asset) => (asset.kind === "player" ? [asset.playerId] : []));
        const outgoing = given.flatMap((asset) => (asset.kind === "player" ? [asset.playerId] : []));
        const beforeSet = new Set(rostersBefore.get(trade.id)?.get(side.manager.rosterId) ?? []);
        outgoing.forEach((id) => beforeSet.add(id));
        incoming.forEach((id) => beforeSet.delete(id));
        const afterSet = new Set([...beforeSet].filter((id) => !outgoing.includes(id)).concat(incoming));
        const tier = tierForRank(ranks?.get(rosterId) ?? null, trade.teamCount);
        // Compute lineups unconditionally so the request-collecting pass registers every redraft value.
        const before = lineup(beforeSet);
        const after = lineup(afterSet);
        if (valueIn + valueOut > 0) {
          const scored = atTradeScore({ marketIn: valueIn, marketOut: valueOut, before, after, tier });
          return { rosterId, grade: letterGrade(scored.score), basis: "trade", summary: summaryFor(valueIn, valueOut, { starterChange: scored.starterChange, tier }) };
        }
      }

      const valueIn = side.receives.reduce((total, asset) => total + todayValue(asset, trade.teamCount), 0);
      const valueOut = given.reduce((total, asset) => total + todayValue(asset, trade.teamCount), 0);
      if (valueIn + valueOut <= 0) return null;
      return { rosterId, grade: letterGrade(scoreFromDelta(valueDelta(valueIn, valueOut))), basis: "current", summary: summaryFor(valueIn, valueOut, null) };
    });
    assessments[trade.id] = { sides };
  }
  return assessments;
}

export async function computeTradeGrades(ledger: TradeLedger, now = Date.now()): Promise<Record<string, TradeAssessment>> {
  const requests = new Map<string, ValueRequest>();
  // First pass only records which values are needed, so every value can be fetched in a few batch calls.
  await evaluate(ledger, (format, date, id) => {
    const request = { format, date, id };
    requests.set(valueKey(request), request);
    return { value: 0, found: false };
  }, now);
  const values = await fetchValues([...requests.values()]);
  return evaluate(ledger, (format, date, id) => values.get(valueKey({ format, date, id })) ?? { value: 0, found: false }, now);
}

export async function getTradeGrades(ledger: TradeLedger): Promise<TradeGrades> {
  const tradeIds = ledger.seasons.flatMap((season) => season.trades.map((trade) => trade.id));
  const cached = await sharedGet<TradeGrades>(CACHE_KEY).catch(() => null);
  const covers = cached && tradeIds.every((id) => cached.assessments[id]);
  if (cached && covers && Date.now() - cached.computedAt < MAX_AGE_MS) return cached;
  if (cached && covers && !(await sharedAcquireLock(`${CACHE_KEY}:lock`, 120).catch(() => true))) return cached;
  try {
    const assessments = await computeTradeGrades(ledger);
    const result: TradeGrades = { computedAt: Date.now(), tradeIds, assessments, error: null };
    await sharedSet(CACHE_KEY, result).catch(() => undefined);
    return result;
  } catch (error) {
    console.error("Trade grading failed", error);
    const message = "Stats Guy Fantasy values are unavailable right now, so grades may be missing or out of date.";
    return cached ? { ...cached, error: message } : { computedAt: Date.now(), tradeIds, assessments: {}, error: message };
  }
}
