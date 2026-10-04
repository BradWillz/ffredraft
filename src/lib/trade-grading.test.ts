import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  atTradeScore, isOffseasonTrade, leaguePoints, letterGrade, lineupStrength, scoreFromDelta, scoringFactors, tierForRank, valueDelta,
} from "./trade-grading";
import { clearStatsGuyCache, fetchValues } from "./statsguy";
import { computeTradeGrades, pickIds, reconstructRosters, standingsRanks, summaryFor } from "./trade-valuation";
import type { TradeLedger } from "./trade-history";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  clearStatsGuyCache();
});

const SLOTS = ["QB", "RB", "RB", "WR", "WR", "WR", "TE", "FLEX", "FLEX", "SUPER_FLEX"];

test("letter grades map value deltas to A-F", () => {
  assert.equal(letterGrade(scoreFromDelta(valueDelta(100, 100))), "C");
  assert.equal(letterGrade(scoreFromDelta(valueDelta(130, 100))), "A");
  assert.equal(letterGrade(scoreFromDelta(valueDelta(115, 100))), "B");
  assert.equal(letterGrade(scoreFromDelta(valueDelta(100, 115))), "D");
  assert.equal(letterGrade(scoreFromDelta(valueDelta(100, 130))), "F");
});

test("standings tiers split the league into thirds", () => {
  assert.equal(tierForRank(1, 12), "contender");
  assert.equal(tierForRank(6, 12), "middle");
  assert.equal(tierForRank(12, 12), "rebuilder");
  assert.equal(tierForRank(null, 12), "middle");
});

test("lineup fills superflex with a second QB and leaves the rest as depth", () => {
  const players = [
    { id: "qb1", position: "QB", value: 100 }, { id: "qb2", position: "QB", value: 90 },
    { id: "rb1", position: "RB", value: 50 }, { id: "rb2", position: "RB", value: 40 }, { id: "rb3", position: "RB", value: 30 },
    { id: "wr1", position: "WR", value: 60 }, { id: "wr2", position: "WR", value: 55 }, { id: "wr3", position: "WR", value: 45 },
    { id: "wr4", position: "WR", value: 35 }, { id: "te1", position: "TE", value: 20 }, { id: "te2", position: "TE", value: 5 },
    { id: "k", position: "K", value: 999 },
  ];
  const { starters, depth } = lineupStrength(players, SLOTS);
  assert.equal(starters, 100 + 90 + 50 + 40 + 60 + 55 + 45 + 20 + 35 + 30);
  assert.equal(depth, 5);
});

test("TE premium raises tight end scoring factors", () => {
  const scoring = { rec: 0.5, bonus_rec_te: 0.25, rec_yd: 0.1 };
  assert.equal(leaguePoints({ rec: 80, rec_yd: 800 }, scoring, "TE"), 140);
  const stats = {
    te: { rec: 80, rec_yd: 800, pts_half_ppr: 120 },
    wr: { rec: 80, rec_yd: 800, pts_half_ppr: 120 },
  };
  const factors = scoringFactors(stats, scoring, (id) => (id === "te" ? "TE" : "WR"));
  assert.ok(factors.byPlayer.get("te")! > factors.byPlayer.get("wr")!);
  assert.ok(factors.byPosition.get("TE")! > 1);
});

test("contenders get more credit for lineup upgrades than rebuilders", () => {
  const input = { marketIn: 100, marketOut: 100, before: { starters: 1000, depth: 100 }, after: { starters: 1080, depth: 100 } };
  assert.ok(atTradeScore({ ...input, tier: "contender" }).score > atTradeScore({ ...input, tier: "rebuilder" }).score);
});

test("offseason detection uses week and month", () => {
  assert.equal(isOffseasonTrade({ week: 1, timestamp: Date.UTC(2026, 3, 1) }), true);
  assert.equal(isOffseasonTrade({ week: 8, timestamp: Date.UTC(2025, 9, 20) }), false);
});

test("pick ids use the exact slot when known and otherwise the original team's tier", () => {
  const ranks = new Map([[1, 1], [2, 12]]);
  assert.deepEqual(pickIds({ season: 2027, round: 1, originalRosterId: 1 }, 2027, ranks, 12, null),
    { exact: null, expected: "pick:2027:1:late", low: "pick:2027:1:late", high: "pick:2027:1:early" });
  assert.equal(pickIds({ season: 2027, round: 1, originalRosterId: 2 }, 2027, ranks, 12, null).expected, "pick:2027:1:early");
  assert.equal(pickIds({ season: 2028, round: 2, originalRosterId: 2 }, 2027, ranks, 12, null).expected, "pick:2028:2:mid");
  const draft = { draft_id: "d", season: "2027", type: "snake", slot_to_roster_id: { "4": 2 } };
  assert.equal(pickIds({ season: 2027, round: 2, originalRosterId: 2 }, 2027, ranks, 12, draft).exact, "pick:2027:2.09");
});

test("standings rank by wins then points", () => {
  const ranks = standingsRanks([
    { roster_id: 1, settings: { wins: 8, fpts: 1500 } },
    { roster_id: 2, settings: { wins: 10, fpts: 1400 } },
    { roster_id: 3, settings: { wins: 8, fpts: 1600 } },
  ]);
  assert.deepEqual([...ranks.entries()], [[2, 1], [3, 2], [1, 3]]);
});

function tradeTx(id: string, time: number, adds: Record<string, number>) {
  const drops = Object.fromEntries(Object.entries(adds).map(([player, receiver]) => [player, receiver === 1 ? 2 : 1]));
  return { transaction_id: id, type: "trade", status: "complete", leg: 8, status_updated: time, roster_ids: [1, 2], adds, drops };
}

test("rosters are rebuilt to just before each trade", () => {
  const before = reconstructRosters({
    leagues: [{
      league: { league_id: "L", season: "2025", roster_positions: SLOTS, total_rosters: 2 },
      rosters: [{ roster_id: 1, players: ["a", "x"] }, { roster_id: 2, players: ["b"] }],
      transactions: [
        tradeTx("t1", 100, { a: 1, b: 2 }),
        { transaction_id: "w1", type: "free_agent", status: "complete", leg: 9, status_updated: 200, roster_ids: [1], adds: { x: 1 }, drops: null },
      ],
      managers: new Map(),
    }],
    drafts: [],
  });
  assert.deepEqual(before.get("t1")!.get(1)!.sort(), ["b"]);
  assert.deepEqual(before.get("t1")!.get(2)!.sort(), ["a"]);
});

test("Stats Guy client batches requests, packs sides and caches results", async () => {
  const bodies: unknown[] = [];
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    bodies.push(body);
    return new Response(JSON.stringify({
      results: body.trades.map((trade: { sideA: string[]; sideB: string[] }) => ({
        sideA: { assets: trade.sideA.map((id) => ({ id, value: id.length * 10, found: true })) },
        sideB: { assets: trade.sideB.map((id) => ({ id, value: id.length * 10, found: true })) },
      })),
    }));
  }) as typeof fetch;
  const values = await fetchValues([
    { format: "sf_dynasty", date: "2025-10-01", id: "123" },
    { format: "sf_dynasty", date: null, id: "pick:2027:1:mid" },
  ]);
  assert.equal(values.get("sf_dynasty|2025-10-01|123")?.value, 30);
  assert.equal(values.get("sf_dynasty|now|pick:2027:1:mid")?.value, 150);
  const trades = (bodies[0] as { trades: Array<{ date?: string; sideB: string[] }> }).trades;
  assert.equal(trades.length, 2);
  assert.deepEqual(trades[0].sideB, ["123"]);
  await fetchValues([{ format: "sf_dynasty", date: "2025-10-01", id: "123" }]);
  assert.equal(bodies.length, 1);
});

test("a lopsided trade grades the winner A and the loser F", async () => {
  const values: Record<string, number> = { star: 8000, scrub: 1000, "pick:2027:1:late": 1500, "pick:2027:1:mid": 2000, "pick:2027:1:early": 3000 };
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (String(url).includes("statsguyfantasy")) {
      const body = JSON.parse(String(init!.body));
      const side = (ids: string[]) => ({ assets: ids.map((id) => ({ id, value: values[id] ?? 500, found: true })) });
      return new Response(JSON.stringify({ results: body.trades.map((trade: { sideA: string[]; sideB: string[] }) => ({ sideA: side(trade.sideA), sideB: side(trade.sideB) })) }));
    }
    return new Response("{}");
  }) as typeof fetch;
  const pick = { kind: "pick" as const, season: "2027", round: 1, originalRosterId: 2, originalOwner: "Two", selection: null, pending: true };
  const ledger: TradeLedger = {
    players: { star: { position: "WR", age: 23, full_name: "Star" }, scrub: { position: "RB", age: 30, full_name: "Scrub" } },
    drafts: [],
    leagues: [{
      league: { league_id: "L", season: "2025", roster_positions: SLOTS, total_rosters: 12, scoring_settings: {}, settings: { last_scored_leg: 1 } },
      rosters: [{ roster_id: 1, players: ["star"] }, { roster_id: 2, players: ["scrub"] }],
      transactions: [{ ...tradeTx("t1", Date.UTC(2025, 10, 1), { star: 1, scrub: 2 }), leg: 1, draft_picks: [] }],
      managers: new Map(),
    }],
    seasons: [{
      season: "2025",
      trades: [{
        id: "t1", leagueId: "L", season: "2025", week: 1, timestamp: Date.UTC(2025, 10, 1), rosterSlots: SLOTS, teamCount: 12,
        sides: [
          { manager: { rosterId: 1, name: "One", username: "one" }, receives: [{ kind: "player", playerId: "star", name: "Star", position: "WR", team: "X" }], givesUp: [{ kind: "player", playerId: "scrub", name: "Scrub", position: "RB", team: "Y" }, pick] },
          { manager: { rosterId: 2, name: "Two", username: "two" }, receives: [{ kind: "player", playerId: "scrub", name: "Scrub", position: "RB", team: "Y" }, pick], givesUp: [{ kind: "player", playerId: "star", name: "Star", position: "WR", team: "X" }] },
        ],
      }],
    }],
  };
  const grades = await computeTradeGrades(ledger, Date.UTC(2026, 0, 1));
  const [one, two] = grades.t1.sides;
  assert.equal(one?.grade, "A");
  assert.equal(one?.basis, "trade");
  assert.equal(two?.grade, "F");
  assert.match(one?.summary ?? "", /^Won the value by .*, lineup \+/);
  assert.match(two?.summary ?? "", /^Overpaid by/);
});

test("summaries are one short line", () => {
  assert.equal(summaryFor(100, 100, { starterChange: 0, tier: "middle" }), "Fair value as a mid-table team.");
  assert.equal(summaryFor(100, 120, { starterChange: 0.08, tier: "contender" }), "Overpaid by 20%, lineup +8% as a contender.");
  assert.equal(summaryFor(1000, 100, null), "Won the value by a mile on today's values.");
});
