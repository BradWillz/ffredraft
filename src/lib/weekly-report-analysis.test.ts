import { strict as assert } from "node:assert";
import { mock, test } from "node:test";
import { clearNewsletterCommentary, generateNewsletterCommentary, getNewsletterCommentary, validateNewsletterCommentary } from "./newsletter-commentary";
import { sharedAcquireLock, sharedDelete } from "./shared-store";
import type { WeeklyReport } from "./weekly-report";
import { bestLegalBenchSwap, matchupSummary, waiverPickupsOfWeek, type WeeklyMatchup } from "./weekly-report-analysis";
import { CommentaryDiagnosticError, diagnosticStep, logCommentaryDiagnostic, safeDiagnosticException } from "./newsletter-diagnostics";

test("diagnostics retain exception stacks and causes but redact secrets", async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-diagnostic-secret";
  const logger = mock.method(console, "error", () => {});
  try {
    const cause = Object.assign(new Error("Provider rejected test-diagnostic-secret"), {
      headers: { authorization: "Bearer private", "set-cookie": "session=private" },
      status: 401,
    });
    const error = new Error("Operation failed", { cause });
    const serialized = JSON.stringify(safeDiagnosticException(error));
    assert.match(serialized, /Operation failed|stack/);
    assert.match(serialized, /401/);
    assert.doesNotMatch(serialized, /test-diagnostic-secret|Bearer private|session=private/);
    await assert.rejects(diagnosticStep({ requestId: "test", week: 2 }, "openai", "OpenAI request failed", async () => { throw error; }), (failure: unknown) => {
      assert.ok(failure instanceof CommentaryDiagnosticError);
      assert.equal(failure.stage, "openai");
      assert.equal(failure.reason, "OpenAI request failed");
      return true;
    });
    logCommentaryDiagnostic({ requestId: "test", week: 2 }, "route", "failed", {}, error);
    assert.equal(logger.mock.callCount(), 2);
    assert.doesNotMatch(JSON.stringify(logger.mock.calls), /test-diagnostic-secret|Bearer private|session=private/);
  } finally {
    logger.mock.restore();
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

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

test("validation diagnostics identify every roster and citation failure without changing rejection rules", () => {
  const errors = mock.method(console, "error", () => {});
  const info = mock.method(console, "info", () => {});
  const team = { rosterId: 1, blurb: "Manager won.", advice: "Review the lineup.", sources: [] };
  try {
    assert.throws(() => validateNewsletterCommentary({ teams: [
      { ...team, blurb: "x".repeat(601) },
      { ...team, rosterId: 2 },
      { ...team, rosterId: 3, sources: [{ title: "Report", url: "https://example.com/unretrieved?token=private" }] },
      { ...team, rosterId: 4, blurb: "The starter was injured." },
    ] }, [1, 2, 3, 4, 5], new Set(), { requestId: "validation-test", week: 2 }, new Map([[1, 3]])), (error: unknown) => {
      assert.ok(error instanceof CommentaryDiagnosticError);
      assert.equal(error.stage, "validation");
      assert.equal(error.reason, "matchup 3, roster 1: blurb length 601 exceeds 600 characters");
      return true;
    });
    const entries = [...errors.mock.calls, ...info.mock.calls].map((call) => JSON.parse(call.arguments[0] as string));
    assert.ok(entries.some((entry) => entry.rosterId === 2 && entry.event === "passed"));
    for (const rosterId of [1, 3, 4, 5]) assert.ok(entries.some((entry) => entry.rosterId === rosterId && entry.event === "failed"));
    assert.ok(entries.some((entry) => entry.stage === "citations" && entry.reason.includes("not present in retrieved citations")));
    assert.ok(entries.some((entry) => entry.reason?.includes("unverifiable injury claim")));
    assert.doesNotMatch(JSON.stringify(entries), /example.com|token=private/);
  } finally {
    errors.mock.restore();
    info.mock.restore();
  }
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
  let outputText = JSON.stringify({ teams });
  let responseStatus = "completed";
  const diagnostics = { requestId: "generation-test", week: 1 };
  const info = mock.method(console, "info", () => {});
  const errors = mock.method(console, "error", () => {});
  const fetchMock = mock.method(globalThis, "fetch", async () => fail
    ? new Response(JSON.stringify({ error: { message: "Test failure", type: "invalid_request_error" } }), { status: 401, headers: { "Content-Type": "application/json" } })
    : new Response(JSON.stringify({
      id: "test-response",
      object: "response",
      status: responseStatus,
      text: { format: { type: "json_schema" } },
      output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: outputText, annotations: [] }] }],
    }), { headers: { "Content-Type": "application/json" } }));
  try {
    const first = await generateNewsletterCommentary(report, diagnostics);
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
    for (const [text, stage, reason] of [
      ["not JSON", "json_parse", "OpenAI output_text was not valid JSON"],
      ["{}", "validation", "Expected a JSON object with a teams array"],
      [JSON.stringify({ teams: [{ ...teams[0], advice: "x".repeat(261) }] }), "validation", "roster 1: advice length 261 exceeds 260 characters"],
    ]) {
      outputText = text;
      await assert.rejects(generateNewsletterCommentary(report, diagnostics), (error: unknown) => {
        assert.ok(error instanceof CommentaryDiagnosticError);
        assert.equal(error.stage, stage);
        assert.equal(error.reason, reason);
        return true;
      });
      assert.equal(await getNewsletterCommentary(report), null);
    }
    responseStatus = "incomplete";
    await assert.rejects(generateNewsletterCommentary(report, diagnostics), (error: unknown) => error instanceof CommentaryDiagnosticError && error.stage === "openai_response");
    const entries = [...info.mock.calls, ...errors.mock.calls].map((call) => JSON.parse(call.arguments[0] as string));
    assert.ok(entries.some((entry) => entry.requestId === "generation-test" && entry.event === "response" && entry.responseId === "test-response" && entry.httpStatus === 200 && entry.outputTextLength > 0));
    assert.ok(entries.some((entry) => entry.stage === "openai" && entry.httpStatus === 401 && entry.event === "failed"));
    assert.ok(entries.some((entry) => entry.stage === "json_parse" && entry.event === "failed" && entry.exception.name === "SyntaxError"));
    assert.ok(entries.some((entry) => entry.stage === "cache_write" && entry.event === "success"));
    assert.ok(entries.some((entry) => entry.stage === "cache_read" && entry.hit === true));
    assert.ok(entries.some((entry) => entry.stage === "validation" && entry.expectedStructuredJson === false));
    assert.ok(entries.some((entry) => entry.stage === "generation" && entry.event === "end"));
    assert.doesNotMatch(JSON.stringify(entries), /test-key-not-a-real-secret/);
  } finally {
    fetchMock.mock.restore();
    info.mock.restore();
    errors.mock.restore();
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