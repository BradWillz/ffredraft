import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import headers from "next/headers";
import { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { DELETE, GET, POST } from "../app/api/ladbrokes/route";
import {
  LADBROKES_COOKIE, addLadbrokesSubmission, authenticateLadbrokesCode,
  getLadbrokesSubmissions, provisionAccessCode, resetLadbrokesSubmission,
  saveLadbrokesSubmissions, submissionsKey, type LadbrokesSubmission,
} from "./ladbrokes";
import { sharedCompareAndSet, sharedDelete, sharedGet } from "./shared-store";

const owner = { rosterId: 1, ownerId: "owner-1", displayName: "Manager One", username: "@one" };
const entry = (rosterId: number): LadbrokesSubmission => ({
  rosterId,
  picks: { "1": 1 },
  tiebreakers: { highestScorerRosterId: 1, lowestScorerRosterId: 2 },
  mutes: [2, 3, 4],
  lockedAt: "2099-10-01T12:00:00.000Z",
});
const environmentKeys = [
  "NODE_ENV", "ADMIN_PASSWORD", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL", "KV_REST_API_TOKEN",
] as const;
let savedEnvironment: Record<string, string | undefined>;
let cookieJar: RequestCookies;
let kickoff: string;

beforeEach(async () => {
  savedEnvironment = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
  for (const key of environmentKeys) delete process.env[key];
  Object.assign(process.env, { NODE_ENV: "development", ADMIN_PASSWORD: "ladbrokes-test-password" });
  cookieJar = new RequestCookies(new Headers());
  mock.method(headers, "cookies", async () => cookieJar);
  kickoff = "2099-10-01";
  mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("games.csv")) {
      return new Response(`season,week,game_type,gameday,gametime\n2099,6,REG,${kickoff},20:00\n`);
    }
    if (url.endsWith("/rosters")) {
      return Response.json([1, 2, 3, 4].map((id) => ({ roster_id: id, owner_id: `owner-${id}` })));
    }
    if (url.endsWith("/users")) {
      return Response.json([1, 2, 3, 4].map((id) => ({ user_id: `owner-${id}`, username: `manager${id}` })));
    }
    if (/\/matchups\/\d+$/.test(url)) {
      return Response.json([{ roster_id: 1, matchup_id: 1, points: 100 }, { roster_id: 2, matchup_id: 1, points: 90 }]);
    }
    if (/\/league\/\d+$/.test(url)) return Response.json({ season: "2099", settings: { last_scored_leg: 5 } });
    throw new Error(`Unexpected test request: ${url}`);
  });
  await saveLadbrokesSubmissions(6, [entry(1), entry(2)]);
  await saveLadbrokesSubmissions(5, [entry(1)]);
});

afterEach(async () => {
  await Promise.all([5, 6, 7].map((week) => sharedDelete(submissionsKey(week))));
  await sharedDelete("redraft:2026:ladbrokes:access");
  mock.restoreAll();
  for (const key of environmentKeys) {
    const value = savedEnvironment[key];
    if (value === undefined) delete process.env[key];
    else Object.assign(process.env, { [key]: value });
  }
});

function resetRequest(body: unknown = { week: 6, rosterId: 1 }) {
  return new Request("http://localhost/api/ladbrokes", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function signInOwner() {
  const code = await provisionAccessCode(owner);
  const session = await authenticateLadbrokesCode(code);
  assert.ok(session?.token);
  cookieJar.set(LADBROKES_COOKIE, session.token);
  return code;
}

test("admin reset clears only the selected current-week entry and keeps its access code", async () => {
  const code = await signInOwner();
  const response = await DELETE(resetRequest());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reset: true, week: 6, rosterId: 1 });
  assert.deepEqual(await getLadbrokesSubmissions(6), [entry(2)]);
  assert.deepEqual(await getLadbrokesSubmissions(5), [entry(1)]);
  assert.ok(await authenticateLadbrokesCode(code));

  const state = await (await GET()).json();
  assert.equal(state.ownSubmission, null);
  assert.equal(state.revealedPicks, null);
  assert.equal(state.lockStatus.find((item: { rosterId: number }) => item.rosterId === 1).locked, false);
  assert.equal(state.lockStatus.find((item: { rosterId: number }) => item.rosterId === 2).locked, true);

  const replacement = { week: 6, picks: { "1": 2 }, tiebreakers: { highestScorerRosterId: 2, lowestScorerRosterId: 1 }, mutes: [4, 3, 2] };
  const submit = () => POST(new Request("http://localhost/api/ladbrokes", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(replacement),
  }));
  assert.equal((await submit()).status, 200);
  const updated = await getLadbrokesSubmissions(6);
  assert.deepEqual(updated.find((item) => item.rosterId === 2), entry(2));
  assert.deepEqual(updated.find((item) => item.rosterId === 1)?.picks, replacement.picks);
  assert.equal((await submit()).status, 409);
});

test("a signed-in owner without admin permissions cannot reset picks", async () => {
  await signInOwner();
  Object.assign(process.env, { NODE_ENV: "production" });
  assert.equal((await DELETE(resetRequest())).status, 401);
  assert.deepEqual(await getLadbrokesSubmissions(6), [entry(1), entry(2)]);
});

test("resets and replacement submissions are blocked after first kickoff", async () => {
  await signInOwner();
  kickoff = "2000-10-01";
  assert.equal((await DELETE(resetRequest())).status, 423);
  assert.equal((await POST(new Request("http://localhost/api/ladbrokes", { method: "POST", body: "{}" }))).status, 423);
  assert.deepEqual(await getLadbrokesSubmissions(6), [entry(1), entry(2)]);
});

test("expired weeks, unknown owners and missing submissions do not modify any entries", async () => {
  for (const [body, status] of [
    [{ week: 5, rosterId: 1 }, 400],
    [{ week: 6, rosterId: 99 }, 404],
    [{ week: 6, rosterId: 3 }, 409],
  ] as const) {
    assert.equal((await DELETE(resetRequest(body))).status, status);
    assert.deepEqual(await getLadbrokesSubmissions(6), [entry(1), entry(2)]);
    assert.deepEqual(await getLadbrokesSubmissions(5), [entry(1)]);
  }
});

test("invalid reset bodies are rejected without modifying entries", async () => {
  for (const body of [null, [], {}, { week: 6 }, { week: "6", rosterId: 1 }, { week: 6, rosterId: 1.5 }]) {
    assert.equal((await DELETE(resetRequest(body))).status, 400);
  }
  const malformed = new Request("http://localhost/api/ladbrokes", { method: "DELETE", body: "{" });
  assert.equal((await DELETE(malformed)).status, 400);
  assert.deepEqual(await getLadbrokesSubmissions(6), [entry(1), entry(2)]);
});

test("concurrent resets and submissions preserve unrelated entries", async () => {
  const results = await Promise.all([
    resetLadbrokesSubmission(6, 1),
    addLadbrokesSubmission(6, entry(3)),
    addLadbrokesSubmission(6, entry(4)),
  ]);
  assert.deepEqual(results, [true, true, true]);
  const remaining = await getLadbrokesSubmissions(6);
  assert.deepEqual(remaining.sort((a, b) => a.rosterId - b.rosterId), [entry(2), entry(3), entry(4)]);
  assert.equal(await resetLadbrokesSubmission(6, 1), false);
});

test("concurrent duplicate submissions create only one entry", async () => {
  assert.deepEqual(await Promise.all([
    addLadbrokesSubmission(7, entry(1)),
    addLadbrokesSubmission(7, entry(1)),
  ]), [true, false]);
  assert.deepEqual(await getLadbrokesSubmissions(7), [entry(1)]);
});

test("compare-and-set rejects stale snapshots without overwriting changes", async () => {
  const key = submissionsKey(7);
  assert.equal(await sharedCompareAndSet(key, null, [entry(1)]), true);
  assert.equal(await sharedCompareAndSet(key, null, [entry(2)]), false);
  assert.deepEqual(await sharedGet(key), [entry(1)]);
});
