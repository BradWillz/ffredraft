import { strict as assert } from "node:assert";
import { mock, test } from "node:test";
import { clearNewsletterCommentary, generateNewsletterCommentary, getNewsletterCommentary, validateNewsletterCommentary } from "./newsletter-commentary";
import { sharedAcquireLock, sharedDelete } from "./shared-store";
import type { WeeklyReport } from "./weekly-report";
import { bestLegalBenchSwap, matchupSummary, waiverPickupsOfWeek, type WeeklyMatchup } from "./weekly-report-analysis";

const players = {
  quarterback: { full_name: "Starting QB", position: "QB" },
  receiver: { full_name: "Starting WR", position: "WR" },
  benchReceiver: { full_name: "Bench WR", position: "WR" },
  benchRunningBack: { full_name: "Bench RB", position: "RB" },
};
const matchup: WeeklyMatchup = {
  roster_id: 1,
  matchup_id: 1,
  points: 100,
  players: Object.keys(players),
  starters: ["quarterback", "receiver"],
  players_points: { quarterback: 2, receiver: 10, benchReceiver: 20, benchRunningBack: 30 },
};
const opponent = { roster_id: 2, matchup_id: 1, points: 109 };
const summary = (points = 109) => matchupSummary("Manager", "Rival", matchup, { ...opponent, points }, players, ["QB", "WR", "BN"], 5, 11, "Next rival");

test("bench swaps respect positions, including flex slots and empty starters", () => {
  assert.equal(bestLegalBenchSwap(matchup, players, ["QB", "WR"])?.gain, 10);
  assert.equal(bestLegalBenchSwap(matchup, players, ["QB", "FLEX"])?.incomingId, "benchRunningBack");
  assert.equal(bestLegalBenchSwap({ ...matchup, starters: ["quarterback", "0"] }, players, ["QB", "WR"])?.gain, 20);
  assert.equal(bestLegalBenchSwap(matchup, players, []), null);
});

test("summary distinguishes winning swaps, tying swaps, and insufficient swaps", () => {
  assert.match(summary().blurb, /turns the loss into a 1.00-point win/);
  assert.match(summary(110).blurb, /enough to tie, not win/);
  assert.match(summary(111).blurb, /still leaves a defeat/);
  assert.match(summary().blurb, /Starting WR led the lineup with 10.00/);
  assert.doesNotMatch(summary().blurb, /injured|Bench RB/);
  assert.doesNotMatch(summary().advice, /Start Bench WR next week/);
});

test("summary handles ties and byes without claiming a loss or win", () => {
  assert.match(summary(100).blurb, /tied Rival/);
  const bye = matchupSummary("Manager", "Bye week", matchup, undefined, players, [], 5, 11, "Next rival");
  assert.match(bye.blurb, /no head-to-head opponent/);
  assert.doesNotMatch(bye.blurb, /beat Bye|lost to Bye/);
});

test("pickup award includes completed waivers and free agents, bench scores, and ties", () => {
  const winners = waiverPickupsOfWeek([
    { type: "waiver", status: "complete", adds: { benchReceiver: 1 } },
    { type: "free_agent", status: "complete", adds: { receiver: 2 } },
    { type: "waiver", status: "complete", adds: { benchReceiver: 1 } },
    { type: "waiver", status: "failed", adds: { benchRunningBack: 1 } },
    { type: "trade", status: "complete", adds: { benchRunningBack: 1 } },
  ], [matchup, { ...opponent, players: ["receiver"], starters: ["receiver"], players_points: { receiver: 20 } }]);
  assert.deepEqual(winners.map(({ rosterId, started }) => ({ rosterId, started })), [
    { rosterId: 1, started: false }, { rosterId: 2, started: true },
  ]);
});

test("pickup award skips absent players and missing scores, but accepts zero", () => {
  const transactions = [{ type: "waiver", status: "complete", adds: { missing: 1, receiver: 1 } }];
  assert.deepEqual(waiverPickupsOfWeek(transactions, []), []);
  assert.deepEqual(waiverPickupsOfWeek(transactions, [{ ...matchup, players_points: {} }]), []);
  assert.equal(waiverPickupsOfWeek(transactions, [{ ...matchup, players_points: { receiver: 0 } }])[0].points, 0);
});

test("AI commentary requires complete rosters and retrieved sources for injury context", () => {
  const team = { rosterId: 1, blurb: "Manager won by 10.", advice: "Review the lineup.", sources: [] };
  assert.equal(validateNewsletterCommentary({ teams: [team] }, [1], new Set()).length, 1);
  assert.throws(() => validateNewsletterCommentary({ teams: [team, team] }, [1, 2], new Set()));
  assert.throws(() => validateNewsletterCommentary({ teams: [team] }, [1, 2], new Set()));
  assert.throws(() => validateNewsletterCommentary({ teams: [{ ...team, blurb: "The starter left the game injured." }] }, [1], new Set()));
  const sourced = { ...team, blurb: "The starter left the game injured.", sources: [{ title: "Game report", url: "https://www.nfl.com/news/game-report" }] };
  assert.throws(() => validateNewsletterCommentary({ teams: [sourced] }, [1], new Set()));
  assert.equal(validateNewsletterCommentary({ teams: [sourced] }, [1], new Set([sourced.sources[0].url])).length, 1);
  assert.throws(() => validateNewsletterCommentary({ teams: [{ ...team, blurb: "x".repeat(601) }] }, [1], new Set()));
});

test("AI generation reuses saved copy, invalidates changed facts, and recovers after failure", async () => {
  const environmentKeys = ["OPENAI_API_KEY", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"];
  const originalEnvironment = environmentKeys.map((key) => [key, process.env[key]] as const);
  for (const key of environmentKeys) delete process.env[key];
  process.env.OPENAI_API_KEY = "test-key-not-a-real-secret";
  const report = {
    season: "2026",
    week: 1,
    powerRankings: [{ rosterId: 1, name: "Manager", opponentName: "Rival", score: 100, opponentScore: 90, nextOpponentName: "Next rival", blurb: "Manager won by 10.", starters: [] }],
  } as unknown as WeeklyReport;
  const teams = [{ rosterId: 1, blurb: "Manager won by 10.", advice: "Review the lineup.", sources: [] }];
  let fail = false;
  const fetchMock = mock.method(globalThis, "fetch", async () => fail
    ? new Response(JSON.stringify({ error: { message: "Test failure", type: "invalid_request_error" } }), { status: 401, headers: { "Content-Type": "application/json" } })
    : new Response(JSON.stringify({
      id: "test-response",
      object: "response",
      status: "completed",
      output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify({ teams }), annotations: [] }] }],
    }), { headers: { "Content-Type": "application/json" } }));
  try {
    const first = await generateNewsletterCommentary(report);
    assert.deepEqual(first.teams, teams);
    assert.deepEqual(await generateNewsletterCommentary(report), first);
    assert.equal(fetchMock.mock.callCount(), 1);
    const corrected = { ...report, powerRankings: report.powerRankings.map((team) => ({ ...team, score: 101 })) };
    assert.equal(await getNewsletterCommentary(corrected), null);
    await clearNewsletterCommentary(report);
    assert.equal(await getNewsletterCommentary(report), null);
    fail = true;
    await assert.rejects(generateNewsletterCommentary(report));
    assert.equal(await getNewsletterCommentary(report), null);
    fail = false;
    assert.deepEqual((await generateNewsletterCommentary(report)).teams, teams);
    assert.equal(fetchMock.mock.callCount(), 3);
    await clearNewsletterCommentary(report);
  } finally {
    fetchMock.mock.restore();
    for (const [key, value] of originalEnvironment) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("generation locks reject duplicate work and can be released", async () => {
  const key = "newsletter:test:generation-lock";
  assert.equal(await sharedAcquireLock(key, 180), true);
  assert.equal(await sharedAcquireLock(key, 180), false);
  await sharedDelete(key);
  assert.equal(await sharedAcquireLock(key, 180), true);
  await sharedDelete(key);
});