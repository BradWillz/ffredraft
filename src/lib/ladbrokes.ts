import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SLEEPER_LEAGUE_ID } from "./config";
import { getDisplayName } from "./normalize-username";
import { getLeague, getLeagueMatchups, getLeagueRosters, getLeagueUsers } from "./sleeper";
import { sharedGet, sharedSet } from "./shared-store";

export const LADBROKES_COOKIE = "main-leagues-ladbrokes";
const ACCESS_KEY = "redraft:2026:ladbrokes:access";

export type LadbrokesOwner = {
  rosterId: number;
  ownerId: string;
  displayName: string;
  username: string;
};

export type LadbrokesMatchup = {
  id: number;
  team1: LadbrokesOwner;
  team2: LadbrokesOwner;
};

export type LadbrokesSubmission = {
  rosterId: number;
  picks: Record<string, number>;
  lockedAt: string;
};

export type LadbrokesWeeklyResult = {
  week: number;
  winners: Array<{ rosterId: number; displayName: string; correct: number }>;
  standings: Array<{ rosterId: number; displayName: string; correct: number; total: number }>;
};

type AccessRecord = { rosterId: number; ownerId: string; codeHash: string };
type SleeperRoster = { roster_id: number; owner_id?: string };
type SleeperUser = { user_id: string; username?: string; display_name?: string };
type SleeperMatchup = { roster_id: number; matchup_id: number | null; points?: number | null };

function accessCodeHash(code: string) {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

function sessionSecret() {
  return process.env.ADMIN_PASSWORD || null;
}

function signSession(rosterId: number, ownerId: string, codeHash: string) {
  const secret = sessionSecret();
  if (!secret) return null;
  const payload = Buffer.from(JSON.stringify({ rosterId, ownerId, codeHash })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readSignedSession(value?: string) {
  const secret = sessionSecret();
  const [payload, signature] = value?.split(".") ?? [];
  if (!secret || !payload || !signature) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as { rosterId: number; ownerId: string; codeHash: string };
  } catch {
    return null;
  }
}

async function accessRecords() {
  return (await sharedGet<AccessRecord[]>(ACCESS_KEY)) ?? [];
}

export async function authenticateLadbrokesCode(code: string) {
  const codeHash = accessCodeHash(code);
  const record = (await accessRecords()).find((item) => item.codeHash === codeHash);
  if (!record) return null;
  return { ...record, token: signSession(record.rosterId, record.ownerId, record.codeHash) };
}

export async function getLadbrokesSession() {
  const signed = readSignedSession((await cookies()).get(LADBROKES_COOKIE)?.value);
  if (!signed) return null;
  const active = (await accessRecords()).some((record) => record.rosterId === signed.rosterId && record.ownerId === signed.ownerId && record.codeHash === signed.codeHash);
  return active ? signed : null;
}

export async function provisionAccessCode(owner: LadbrokesOwner) {
  const code = `${owner.displayName.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase()}-${randomBytes(6).toString("hex").toUpperCase()}`;
  const records = await accessRecords();
  const next = records.filter((record) => record.rosterId !== owner.rosterId);
  next.push({ rosterId: owner.rosterId, ownerId: owner.ownerId, codeHash: accessCodeHash(code) });
  await sharedSet(ACCESS_KEY, next);
  return code;
}

export async function revokeAccessCode(rosterId: number) {
  await sharedSet(ACCESS_KEY, (await accessRecords()).filter((record) => record.rosterId !== rosterId));
}

export async function getProvisionedRosterIds() {
  return (await accessRecords()).map((record) => record.rosterId);
}

export function submissionsKey(week: number) {
  return `redraft:2026:ladbrokes:week:${week}:submissions`;
}

export async function getLadbrokesSubmissions(week: number) {
  return (await sharedGet<LadbrokesSubmission[]>(submissionsKey(week))) ?? [];
}

export async function saveLadbrokesSubmissions(week: number, submissions: LadbrokesSubmission[]) {
  await sharedSet(submissionsKey(week), submissions);
}

function buildMatchups(rawMatchups: SleeperMatchup[], owners: LadbrokesOwner[]) {
  const ownersByRoster = new Map(owners.map((owner) => [owner.rosterId, owner]));
  const grouped = new Map<number, SleeperMatchup[]>();
  for (const matchup of rawMatchups) {
    if (matchup.matchup_id == null) continue;
    grouped.set(matchup.matchup_id, [...(grouped.get(matchup.matchup_id) ?? []), matchup]);
  }
  return Array.from(grouped.entries()).flatMap(([id, pair]) => {
    const team1 = ownersByRoster.get(pair[0]?.roster_id);
    const team2 = ownersByRoster.get(pair[1]?.roster_id);
    return team1 && team2 ? [{ id, team1, team2 }] : [];
  }).sort((left, right) => left.id - right.id);
}

export function scoreLadbrokesWeek(week: number, rawMatchups: SleeperMatchup[], submissions: LadbrokesSubmission[], owners: LadbrokesOwner[]): LadbrokesWeeklyResult {
  const ownersByRoster = new Map(owners.map((owner) => [owner.rosterId, owner]));
  const grouped = new Map<number, SleeperMatchup[]>();
  for (const matchup of rawMatchups) {
    if (matchup.matchup_id == null) continue;
    grouped.set(matchup.matchup_id, [...(grouped.get(matchup.matchup_id) ?? []), matchup]);
  }
  const winnersByMatchup = new Map<number, number | null>();
  for (const [matchupId, pair] of grouped) {
    const [team1, team2] = pair;
    if (!team1 || !team2 || team1.points == null || team2.points == null || team1.points === team2.points) {
      winnersByMatchup.set(matchupId, null);
    } else {
      winnersByMatchup.set(matchupId, team1.points > team2.points ? team1.roster_id : team2.roster_id);
    }
  }
  const standings = submissions.map((submission) => ({
    rosterId: submission.rosterId,
    displayName: ownersByRoster.get(submission.rosterId)?.displayName ?? `Team ${submission.rosterId}`,
    correct: Array.from(winnersByMatchup).filter(([matchupId, winner]) => winner != null && submission.picks[String(matchupId)] === winner).length,
    total: winnersByMatchup.size,
  })).sort((left, right) => right.correct - left.correct || left.displayName.localeCompare(right.displayName));
  const topScore = standings[0]?.correct;
  return {
    week,
    standings,
    winners: topScore == null ? [] : standings.filter((entry) => entry.correct === topScore).map(({ rosterId, displayName, correct }) => ({ rosterId, displayName, correct })),
  };
}

export async function getLadbrokesHistory(lastCompletedWeek: number, owners: LadbrokesOwner[]) {
  const weeks = Array.from({ length: lastCompletedWeek }, (_, index) => index + 1);
  const history = await Promise.all(weeks.map(async (week) => {
    const [matchups, submissions] = await Promise.all([
      getLeagueMatchups(SLEEPER_LEAGUE_ID, week) as Promise<SleeperMatchup[]>,
      getLadbrokesSubmissions(week),
    ]);
    return scoreLadbrokesWeek(week, matchups, submissions, owners);
  }));
  return history.reverse();
}

export async function getLadbrokesContext() {
  const league = await getLeague(SLEEPER_LEAGUE_ID);
  const lastCompletedWeek = Number(league.settings?.last_scored_leg ?? 0);
  const week = Math.max(1, lastCompletedWeek + 1);
  const [rawRosters, rawUsers, rawMatchups] = await Promise.all([
    getLeagueRosters(SLEEPER_LEAGUE_ID),
    getLeagueUsers(SLEEPER_LEAGUE_ID),
    getLeagueMatchups(SLEEPER_LEAGUE_ID, week),
  ]);
  const rosters = rawRosters as SleeperRoster[];
  const users = rawUsers as SleeperUser[];
  const usersById = new Map(users.map((user) => [user.user_id, user]));
  const owners = rosters.filter((roster) => roster.owner_id).map((roster) => {
    const user = usersById.get(roster.owner_id!);
    const username = user?.username || user?.display_name || user?.user_id || `Team ${roster.roster_id}`;
    return { rosterId: roster.roster_id, ownerId: roster.owner_id!, displayName: getDisplayName(username), username: `@${username.replace(/^@/, "")}` };
  });
  const matchups = buildMatchups(rawMatchups as SleeperMatchup[], owners);
  return { week, lastCompletedWeek, owners, matchups };
}