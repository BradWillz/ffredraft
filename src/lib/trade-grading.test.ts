import { strict as assert } from "node:assert";
import { mock, test } from "node:test";
import { assessTrade, assetKey, letterGrade, parseTradeSnapshots, type TradeSnapshot, type Valuation } from "./trade-grading";
import { loadTradeSnapshots } from "./trade-snapshots";
import type { TradeAsset, TradeRecord } from "./trade-history";
import { getTradeHistory } from "./trade-history";

const player = (id: string): TradeAsset => ({ kind: "player", playerId: id, name: id, position: "WR", team: "NFL" });
const value = (amount: number, position: Valuation["position"] = "WR", starterValue = amount): Valuation => ({
  value: amount, starterValue, position, futureLow: amount, futureHigh: amount,
  downside: "production stays flat", upside: "production stays flat",
});
const trade: TradeRecord = {
  id: "trade", season: "2026", week: 4, timestamp: Date.parse("2026-10-01T12:00:00Z"),
  rosterSlots: ["WR"], teamCount: 12,
  sides: [
    { manager: { rosterId: 1, name: "One", username: "one" }, receives: [player("b")], givesUp: [player("a")] },
    { manager: { rosterId: 2, name: "Two", username: "two" }, receives: [player("a")], givesUp: [player("b")] },
  ],
};
const snapshot = (): TradeSnapshot => ({
  tradeId: "trade", leagueId: "league", asOf: "2026-10-01T11:00:00Z", source: "Authorised test data",
  futureHorizon: "End of the 2027 season",
  format: "1qb", slots: ["WR"], teamCount: 12, faabValuePerDollar: 1,
  teams: [{ rosterId: 1, rank: 1, playersBefore: ["a"] }, { rosterId: 2, rank: 12, playersBefore: ["b"] }],
  assets: { "player:a": value(100), "player:b": value(100) },
});

test("grade thresholds use exact required boundaries", () => {
  for (const [score, grade] of [[0, "F"], [29.999, "F"], [30, "D"], [44.999, "D"], [45, "C"], [64.999, "C"], [65, "B"], [79.999, "B"], [80, "A"], [100, "A"]] as const) {
    assert.equal(letterGrade(score), grade);
  }
});

test("an even trade is C for both participants with zero component deltas", () => {
  const result = assessTrade(trade, snapshot(), "league");
  for (const side of result.sides) {
    assert.equal(side.status, "rated");
    assert.equal(side.now, "C");
    assert.equal(side.future, "C");
    assert.equal(side.score, 50);
    assert.equal(side.marketDelta, 0);
    assert.equal(side.lineupDelta, 0);
    assert.equal(side.depthDelta, 0);
  }
});

test("large overpayment grades F and recipient grades A, independently", () => {
  const data = snapshot();
  data.assets["player:b"] = value(1);
  const result = assessTrade(trade, data, "league");
  assert.equal(result.sides[0].now, "F");
  assert.equal(result.sides[1].now, "A");
  assert.equal(result.sides[0].given, 100);
  assert.equal(result.sides[1].received, 100);
});

test("rank changes strategy weights without changing the raw valuations", () => {
  const data = snapshot();
  data.assets["player:b"] = value(50, "WR", 100);
  const contender = assessTrade(trade, data, "league").sides[0];
  data.teams[0].rank = 12;
  const rebuilder = assessTrade(trade, data, "league").sides[0];
  assert.equal(contender.score, 36.25);
  assert.equal(rebuilder.score, 30);
  assert.equal(contender.marketDelta, rebuilder.marketDelta);
  assert.match(rebuilder.strategy!, /Rebuilding/);
});

test("missing, future, stale and mismatched inputs are explicitly not rated", () => {
  assert.match(assessTrade(trade, undefined, "league").sides[0].reason!, /No authorised/);
  for (const asOf of ["2026-10-02T00:00:00Z", "2026-09-23T00:00:00Z"]) {
    assert.equal(assessTrade(trade, { ...snapshot(), asOf }, "league").sides[0].status, "unrated");
  }
  assert.equal(assessTrade(trade, snapshot(), "different").sides[0].status, "unrated");
  assert.equal(assessTrade({ ...trade, rosterSlots: ["QB"] }, snapshot(), "league").sides[0].status, "unrated");
  const data = snapshot();
  delete data.assets["player:b"];
  assert.match(assessTrade(trade, data, "league").sides[0].reason!, /Missing valuations/);
  assert.equal(assessTrade({ ...trade, sides: [{ ...trade.sides[0], givesUp: null }] }, snapshot(), "league").sides[0].status, "unrated");
});

test("trade-time roster conflicts are rejected, rather than counted twice", () => {
  const data = snapshot();
  data.teams[0].playersBefore.push("b");
  assert.match(assessTrade(trade, data, "league").sides[0].reason!, /conflicts/);
});

test("superflex legal lineup and positional depth affect the grade", () => {
  const data = snapshot();
  data.format = "superflex";
  data.slots = ["SUPER_FLEX", "QB"];
  data.teams[0].playersBefore = ["a", "qb"];
  data.assets = { "player:a": value(100, "QB", 80), "player:b": value(100, "WR", 100), "player:qb": value(100, "QB", 90) };
  const result = assessTrade({ ...trade, rosterSlots: data.slots }, data, "league");
  assert.ok(result.sides[0].lineupDelta! > 0);
  assert.equal(result.sides[0].lineupDelta, (190 - 170) / 190);
});

test("an F now can be A conditionally if a future pick hits its upside", () => {
  const pick: TradeAsset = {
    kind: "pick", season: "2027", round: 1, originalRosterId: 3, originalOwner: "Three", selection: null, pending: true,
  };
  const data = snapshot();
  data.assets["player:a"] = value(1000);
  data.assets[assetKey(pick)] = {
    value: 100, starterValue: 0, futureLow: 50, futureHigh: 5000,
    downside: "the original team finishes late and the rookie class disappoints",
    upside: "the original team earns 1.01 and the top prospect becomes elite",
  };
  const result = assessTrade({ ...trade, sides: [{ ...trade.sides[0], receives: [pick] }] }, data, "league").sides[0];
  assert.equal(result.now, "F");
  assert.equal(result.downside, "F");
  assert.equal(result.upside, "A");
  assert.match(result.scenarios!.join(" "), /1.01.*elite/);
});

test("pick provenance is stable and known selections never influence trade-time grades", () => {
  const pick: TradeAsset = { kind: "pick", season: "2027", round: 1, originalRosterId: 3, originalOwner: "Three", selection: null, pending: true };
  const data = snapshot();
  data.assets[assetKey(pick)] = { ...value(100), position: undefined, starterValue: 0 };
  const changed: TradeAsset = { ...pick, originalOwner: "Renamed", pending: false, selection: { pickLabel: "1.01", playerName: "Hindsight star", position: "WR", pickedBy: "Four" } };
  assert.equal(assetKey(pick), assetKey(changed));
  const grade = (asset: TradeAsset) => assessTrade({ ...trade, sides: [{ ...trade.sides[0], receives: [asset] }] }, data, "league").sides[0].score;
  assert.equal(grade(pick), grade(changed));
});

test("each participant in a three-way trade uses their own outgoing package", () => {
  const data = snapshot();
  data.assets["player:c"] = value(200);
  data.teams.push({ rosterId: 3, rank: 6, playersBefore: ["c"] });
  const result = assessTrade({
    ...trade, sides: [
      trade.sides[0],
      { ...trade.sides[1], receives: [player("c")] },
      { manager: { rosterId: 3, name: "Three", username: "three" }, receives: [player("a")], givesUp: [player("c")] },
    ],
  }, data, "league");
  assert.deepEqual(result.sides.map((side) => [side.received, side.given]), [[100, 100], [200, 100], [100, 200]]);
});

test("FAAB uses explicit exchange value and does not affect lineup", () => {
  const data = snapshot();
  const result = assessTrade({ ...trade, sides: [{ ...trade.sides[0], receives: [{ kind: "faab", amount: 20 }] }] }, data, "league").sides[0];
  assert.equal(result.received, 20);
  assert.equal(result.lineupDelta, -1);
});

test("snapshot schema rejects malformed values, formats and duplicates", () => {
  assert.equal(parseTradeSnapshots([snapshot()])[0].assets["player:a"].value, 100);
  for (const input of [
    {}, [{ ...snapshot(), teamCount: 0 }], [{ ...snapshot(), slots: ["UNKNOWN"] }],
    [{ ...snapshot(), slots: ["toString"] }],
    [{ ...snapshot(), slots: ["SUPER_FLEX"] }], [snapshot(), snapshot()],
    [{ ...snapshot(), assets: { "player:a": { ...value(100), value: -1 } } }],
    [{ ...snapshot(), assets: { "player:a": { ...value(100), futureLow: 200, futureHigh: 100 } } }],
    [{ ...snapshot(), assets: { "player:a": { ...value(100), position: "K" } } }],
  ]) assert.throws(() => parseTradeSnapshots(input));
});

test("an unconfigured snapshot source is explicitly empty, not fabricated data", async () => {
  const previous = process.env.DYNASTY_TRADE_SNAPSHOTS_PATH;
  delete process.env.DYNASTY_TRADE_SNAPSHOTS_PATH;
  try {
    assert.deepEqual(await loadTradeSnapshots(), { snapshots: [], error: null });
  } finally {
    if (previous !== undefined) process.env.DYNASTY_TRADE_SNAPSHOTS_PATH = previous;
  }
});

test("snapshot read failures are logged and surfaced, not treated as successful loads", async () => {
  const previous = process.env.DYNASTY_TRADE_SNAPSHOTS_PATH;
  process.env.DYNASTY_TRADE_SNAPSHOTS_PATH = "C:\\repos\\ffredraft\\nonexistent-trade-test-snapshot.json";
  const logger = mock.method(console, "error", () => {});
  try {
    const result = await loadTradeSnapshots();
    assert.deepEqual(result.snapshots, []);
    assert.match(result.error!, /could not be loaded/);
    assert.equal(logger.mock.callCount(), 1);
  } finally {
    logger.mock.restore();
    if (previous === undefined) delete process.env.DYNASTY_TRADE_SNAPSHOTS_PATH;
    else process.env.DYNASTY_TRADE_SNAPSHOTS_PATH = previous;
  }
});

test("Sleeper history wires outgoing ownership for players, third-party picks and FAAB in multi-way trades", async () => {
  const transaction = {
    transaction_id: "multi", type: "trade", status: "complete", leg: 4, status_updated: trade.timestamp,
    roster_ids: [1, 2, 3], adds: { a: 2, b: 3, c: 1 }, drops: { a: 1, b: 2, c: 3 },
    draft_picks: [{ season: "2027", round: 1, roster_id: 3, owner_id: 2, previous_owner_id: 1 }],
    waiver_budget: [{ sender: 3, receiver: 1, amount: 20 }],
  };
  const fetchMock = mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const path = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url).pathname;
    if (path === "/v1/players/nfl") return Response.json({ a: { full_name: "A", position: "WR" }, b: { full_name: "B", position: "QB" }, c: { full_name: "C", position: "RB" } });
    if (path === "/v1/league/test-history") return Response.json({ league_id: "test-history", season: "2026", previous_league_id: null, roster_positions: ["QB", "WR", "BN"], total_rosters: 3 });
    if (path.endsWith("/users")) return Response.json([]);
    if (path.endsWith("/rosters")) return Response.json([1, 2, 3].map((roster_id) => ({ roster_id })));
    if (path.endsWith("/drafts")) return Response.json([]);
    if (path.endsWith("/transactions/4")) return Response.json([transaction, { ...transaction, transaction_id: "missing", drops: null }]);
    if (/\/transactions\/\d+$/.test(path)) return Response.json([]);
    throw new Error(`Unexpected test fetch ${path}`);
  });
  try {
    const history = await getTradeHistory("test-history");
    const result = history[0].trades.find((item) => item.id === "multi")!;
    assert.deepEqual(result.rosterSlots, ["QB", "WR"]);
    assert.deepEqual(result.sides.map((side) => side.givesUp!.map(assetKey)), [
      ["player:a", "pick:2027:1:3"], ["player:b"], ["player:c", "faab"],
    ]);
    assert.deepEqual(result.sides.map((side) => side.receives.map(assetKey)), [
      ["player:c", "faab"], ["player:a", "pick:2027:1:3"], ["player:b"],
    ]);
    assert.ok(history[0].trades.find((item) => item.id === "missing")!.sides.every((side) => side.givesUp === null));
  } finally {
    fetchMock.mock.restore();
  }
});
