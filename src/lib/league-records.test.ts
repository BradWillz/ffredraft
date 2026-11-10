import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildLeagueRecords, completedRecordWeeks, recordLeaders, scoringRecords, type RecordLeague, type RecordMatchup, type RecordSeason } from "./league-records";

const league = (overrides: Partial<RecordLeague> = {}): RecordLeague => ({
  league_id: "2025-league",
  season: "2025",
  status: "complete",
  roster_positions: ["QB", "FLEX", "DEF", "BN"],
  settings: { last_scored_leg: 17, leg: 17, playoff_week_start: 15 },
  ...overrides,
});
const pair = (first: number | null, second: number | null): RecordMatchup[] => [
  { roster_id: 1, matchup_id: 1, points: first },
  { roster_id: 2, matchup_id: 1, points: second },
];
const season = (weeks: RecordSeason["weeks"], overrides: Partial<RecordSeason> = {}): RecordSeason => ({
  league: league(),
  rosters: [{ roster_id: 1, owner_id: "owner-a" }, { roster_id: 2, owner_id: "owner-b" }],
  users: [
    { user_id: "owner-a", username: "BradWillz", avatar: "sleeper-avatar", metadata: { team_name: "The Winners" } },
    { user_id: "owner-b", username: "AshHarris" },
  ],
  weeks,
  ...overrides,
});

test("completed weeks exclude drafts, partial live weeks and weeks beyond the NFL schedule", () => {
  assert.equal(completedRecordWeeks(league({ status: "pre_draft" })), 0);
  assert.equal(completedRecordWeeks(league({ status: "drafting" })), 0);
  assert.equal(completedRecordWeeks(league({ status: "in_season", settings: { last_scored_leg: 9, leg: 9 } })), 8);
  assert.equal(completedRecordWeeks(league({ status: "in_season", settings: { last_scored_leg: 7, leg: 9 } })), 7);
  assert.equal(completedRecordWeeks(league({ status: "in_season", settings: { last_scored_leg: 0, leg: 1 } })), 0);
  assert.equal(completedRecordWeeks(league({ settings: { last_scored_leg: 99 } })), 18);
  assert.equal(completedRecordWeeks(league({ settings: {} })), 0);
});

test("zero and negative scores count, missing/invalid scores and unpaired teams do not", () => {
  const data = buildLeagueRecords([season([
    { week: 1, matchups: pair(0, -2) },
    { week: 2, matchups: pair(null, 50) },
    { week: 3, matchups: pair(Number.NaN, 50) },
    { week: 4, matchups: [{ roster_id: 1, matchup_id: null, points: 0 }] },
    { week: 5, matchups: [{ roster_id: 1, matchup_id: 1, points: 0 }] },
    { week: 6, matchups: [...pair(1, 2), { roster_id: 3, matchup_id: 1, points: 3 }] },
    { week: 18, matchups: pair(0, 0) },
  ])]);
  assert.equal(data.performances.length, 2);
  assert.equal(data.performances[0].points, 0);
  assert.equal(data.performances[1].points, -2);
});

test("NFL clock includes the latest finished week when the league leg lags, without including live scores", () => {
  const currentLeague = league({
    season: "2026", status: "in_season",
    settings: { last_scored_leg: 9, leg: 9, playoff_week_start: 15 },
  });
  const nflState = { season: "2026", season_type: "regular", leg: 10, week: 10 };
  assert.equal(completedRecordWeeks(currentLeague, nflState), 9);
  assert.equal(completedRecordWeeks(currentLeague, { ...nflState, leg: 9 }), 8);
  assert.equal(completedRecordWeeks(currentLeague, { season: "2026", season_type: "regular", week: 10 }), 9);
  assert.equal(completedRecordWeeks(currentLeague, { ...nflState, season: "2025" }), 8);
  assert.equal(completedRecordWeeks(currentLeague, { ...nflState, season_type: "post", leg: 1 }), 9);
  assert.equal(completedRecordWeeks(currentLeague, { ...nflState, season: "2027", season_type: "off" }), 9);
  const currentSeason = season([
    { week: 8, matchups: pair(100, 120) },
    { week: 9, matchups: pair(45.18, 110) },
    { week: 10, matchups: pair(0, 0) },
  ], {
    league: currentLeague,
    users: [{ user_id: "owner-a", username: "connorjl" }, { user_id: "owner-b", username: "AshHarris" }],
  });
  const historicalSeason = season([{ week: 10, matchups: pair(50.14, 101.87) }]);
  const data = buildLeagueRecords([currentSeason, historicalSeason], nflState);
  const lowest = scoringRecords(data.performances)[0].entries[0];
  assert.equal(lowest.team.name, "Connor");
  assert.equal(lowest.team.username, "connorjl");
  assert.equal(lowest.points, 45.18);
  assert.equal(lowest.week, 9);
  assert.equal(lowest.season, "2026");
  assert.equal(data.performances.length, 6);
});

test("live and future weeks cannot become low-scoring records", () => {
  const data = buildLeagueRecords([season([
    { week: 1, matchups: pair(100, 101) },
    { week: 2, matchups: pair(0, 0) },
    { week: 3, matchups: pair(0, 0) },
  ], { league: league({ status: "in_season", settings: { last_scored_leg: 2, leg: 2 } }) })]);
  assert.equal(data.performances.length, 2);
  assert.equal(scoringRecords(data.performances)[0].entries[0].points, 100);
});

test("all eight scoring records use exact margins, correct directions and unique games", () => {
  const data = buildLeagueRecords([season([
    { week: 1, matchups: pair(40, 50) },
    { week: 2, matchups: pair(200, 201) },
    { week: 3, matchups: pair(80, 10) },
    { week: 4, matchups: pair(100.1, 100.2) },
    { week: 5, matchups: pair(120, 120) },
    { week: 15, matchups: pair(250, 300) },
  ])]);
  const records = new Map(scoringRecords(data.performances).map((record) => [record.id, record]));
  assert.equal(records.size, 8);
  assert.equal(records.get("lowest")?.entries[0].points, 10);
  assert.equal(records.get("highest")?.entries[0].points, 300);
  assert.equal(records.get("blowout")?.entries[0].margin, 70);
  assert.equal(records.get("closest")?.entries[0].margin, 0.1);
  assert.equal(records.get("unlucky")?.entries[0].points, 250);
  assert.equal(records.get("scrappy")?.entries[0].points, 50);
  assert.equal(records.get("shootout")?.entries[0].combined, 550);
  assert.equal(records.get("snoozefest")?.entries[0].combined, 90);
  assert.equal(records.get("shootout")?.entries.length, 6);
  assert.ok(records.get("closest")?.entries.every((entry) => entry.margin > 0));
  assert.ok(records.get("unlucky")?.entries.every((entry) => entry.margin < 0));
});

test("commissioner overrides, lineup order, empty slots, missing points and profile metadata survive", () => {
  const matchups = pair(30, 50);
  matchups[0] = {
    ...matchups[0], custom_points: 0,
    starters: ["qb", "0", "def", "unknown"],
    starters_points: [10, null, -2, null],
    players_points: { qb: 99, def: -2 },
  };
  const entry = buildLeagueRecords([season([{ week: 1, matchups }])]).performances[0];
  assert.equal(entry.points, 0);
  assert.equal(entry.margin, -50);
  assert.deepEqual(entry.lineup, [
    { playerId: "qb", slot: "QB", points: 10 },
    { playerId: "0", slot: "FLEX", points: 0 },
    { playerId: "def", slot: "DEF", points: -2 },
    { playerId: "unknown", slot: "Starter", points: null },
  ]);
  assert.equal(entry.team.name, "Brad");
  assert.equal(entry.team.teamName, "The Winners");
  assert.equal(entry.team.avatar, "https://sleepercdn.com/avatars/sleeper-avatar");
  assert.equal(entry.season, "2025");
  assert.equal(entry.week, 1);
});

test("streaks span seasons and roster changes, normalize aliases and ignore postseason", () => {
  const older = season([
    { week: 14, matchups: pair(100, 90) },
    { week: 15, matchups: pair(1, 300) },
  ], {
    league: league({ season: "2024", league_id: "2024-league" }),
    users: [{ user_id: "old-owner-a", username: "BradKane" }, { user_id: "old-owner-b", username: "AshHarris" }],
    rosters: [{ roster_id: 1, owner_id: "old-owner-a" }, { roster_id: 2, owner_id: "old-owner-b" }],
  });
  const newer = season([
    { week: 2, matchups: pair(5, 6) },
    { week: 1, matchups: pair(90, 100) },
  ], {
    rosters: [{ roster_id: 2, owner_id: "owner-a" }, { roster_id: 1, owner_id: "owner-b" }],
  });
  const data = buildLeagueRecords([newer, older]);
  const brad = data.streaks.find((entry) => entry.team.name === "Brad");
  assert.equal(brad?.length, 3);
  assert.deepEqual(brad?.start, { season: "2024", week: 14 });
  assert.deepEqual(brad?.end, { season: "2025", week: 2 });
  const cup = data.streaks.find((entry) => entry.team.name === "Cup");
  assert.equal(cup?.length, 3);
  assert.equal(cup?.result, "loss");
});

test("ties break streaks and a departed owner does not inherit or resume another owner's run", () => {
  const first = season([
    { week: 1, matchups: pair(10, 5) },
    { week: 2, matchups: pair(10, 5) },
    { week: 3, matchups: pair(5, 5) },
    { week: 4, matchups: pair(10, 5) },
  ], { league: league({ season: "2023" }) });
  const absent = season([{ week: 1, matchups: pair(10, 5) }], {
    league: league({ season: "2024" }),
    users: [{ user_id: "new-owner", username: "NewManager" }, { user_id: "owner-b", username: "AshHarris" }],
    rosters: [{ roster_id: 1, owner_id: "new-owner" }, { roster_id: 2, owner_id: "owner-b" }],
  });
  const returned = season([{ week: 1, matchups: pair(10, 5) }]);
  const brad = buildLeagueRecords([first, absent, returned]).streaks.filter((entry) => entry.team.name === "Brad");
  assert.deepEqual(brad.map((entry) => entry.length), [2, 1, 1]);
});

test("a username change on the same Sleeper account preserves streak continuity", () => {
  const before = season([{ week: 14, matchups: pair(10, 5) }], {
    league: league({ season: "2024" }),
    users: [{ user_id: "owner-a", username: "OldUsername" }, { user_id: "owner-b", username: "AshHarris" }],
  });
  const after = season([{ week: 1, matchups: pair(10, 5) }], {
    users: [{ user_id: "owner-a", username: "NewUsername" }, { user_id: "owner-b", username: "AshHarris" }],
  });
  const streaks = buildLeagueRecords([after, before]).streaks;
  assert.equal(streaks.find((entry) => entry.team.key === "NewUsername")?.length, 2);
});

test("historical missing owners use repository identity mappings, unknown teams stay separate", () => {
  const old = season([{ week: 1, matchups: [{ roster_id: 8, matchup_id: 1, points: 1 }, { roster_id: 9, matchup_id: 1, points: 10 }] }], {
    league: league({ league_id: "726147812953296896", season: "2021" }),
    rosters: [{ roster_id: 8, owner_id: null }, { roster_id: 9, owner_id: null }], users: [],
  });
  const entries = buildLeagueRecords([old]).performances;
  assert.equal(entries[0].team.name, "Tommy Mac");
  assert.equal(entries[1].team.key, "726147812953296896:9");
});

test("leaderboards keep five entries and all ties at the cutoff without mutating input", () => {
  const values = [10, 9, 8, 7, 6, 6, 6, 5];
  assert.deepEqual(recordLeaders(values, (value) => value), [10, 9, 8, 7, 6, 6, 6]);
  assert.deepEqual(recordLeaders([5, 5, 5, 5, 5, 5], (value) => value), [5, 5, 5, 5, 5, 5]);
  assert.deepEqual(recordLeaders([], (value: number) => value), []);
  assert.equal(values.length, 8);
  const empty = buildLeagueRecords([]);
  assert.ok(scoringRecords(empty.performances).every((record) => record.entries.length === 0));
});
