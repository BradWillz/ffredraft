import type { TradeAsset, TradeRecord } from "./trade-history";

export type Grade = "A" | "B" | "C" | "D" | "F";
type Position = "QB" | "RB" | "WR" | "TE";
export type Valuation = {
  value: number;
  starterValue: number;
  position?: Position;
  futureLow: number;
  futureHigh: number;
  downside: string;
  upside: string;
};
export type TradeSnapshot = {
  tradeId: string;
  leagueId: string;
  asOf: string;
  source: string;
  futureHorizon: string;
  format: "1qb" | "superflex";
  slots: string[];
  teamCount: number;
  teams: Array<{ rosterId: number; rank: number; playersBefore: string[] }>;
  assets: Record<string, Valuation>;
  faabValuePerDollar: number;
};
export type SideGrade = {
  rosterId: number;
  status: "rated" | "unrated";
  reason?: string;
  now?: Grade;
  future?: Grade;
  downside?: Grade;
  upside?: Grade;
  score?: number;
  received?: number;
  given?: number;
  marketDelta?: number;
  lineupDelta?: number;
  depthDelta?: number;
  strategy?: string;
  scenarios?: string[];
};
export type TradeAssessment = {
  source: string | null;
  asOf: string | null;
  futureHorizon: string | null;
  sides: SideGrade[];
};

const positions: Position[] = ["QB", "RB", "WR", "TE"];
const eligible: Record<string, Position[]> = {
  QB: ["QB"], RB: ["RB"], WR: ["WR"], TE: ["TE"],
  FLEX: ["RB", "WR", "TE"], SUPER_FLEX: positions,
  WRRB_FLEX: ["RB", "WR"], REC_FLEX: ["WR", "TE"],
};

export function assetKey(asset: TradeAsset): string {
  if (asset.kind === "player") return `player:${asset.playerId}`;
  if (asset.kind === "pick") return `pick:${asset.season}:${asset.round}:${asset.originalRosterId}`;
  return "faab";
}

export function letterGrade(score: number): Grade {
  if (score >= 80) return "A";
  if (score >= 65) return "B";
  if (score >= 45) return "C";
  if (score >= 30) return "D";
  return "F";
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function number(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function position(value: unknown): value is Position {
  return value === "QB" || value === "RB" || value === "WR" || value === "TE";
}

export function parseTradeSnapshots(input: unknown): TradeSnapshot[] {
  if (!Array.isArray(input)) throw new Error("Trade snapshots must be a JSON array");
  const seen = new Set<string>();
  return input.map((item: unknown, index) => {
    const fail = () => { throw new Error(`Invalid trade snapshot at index ${index}`); };
    if (!object(item)) return fail();
    const { tradeId, leagueId, asOf, source, futureHorizon, format, slots, teamCount, teams, assets, faabValuePerDollar } = item;
    if (!text(tradeId) || !text(leagueId) || !text(asOf)
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(asOf) || !Number.isFinite(Date.parse(asOf))
      || !text(source) || !text(futureHorizon) || (format !== "1qb" && format !== "superflex")
      || !Array.isArray(slots) || !slots.length || slots.length > 20
      || !slots.every((slot) => text(slot) && Object.prototype.hasOwnProperty.call(eligible, slot))
      || (slots.includes("SUPER_FLEX") !== (format === "superflex"))
      || !number(teamCount) || !Number.isInteger(teamCount) || teamCount < 2
      || !Array.isArray(teams) || !object(assets) || !number(faabValuePerDollar)) return fail();
    const key = `${leagueId}:${tradeId}`;
    if (seen.has(key)) throw new Error(`Duplicate trade snapshot ${key}`);
    seen.add(key);
    const parsedTeams: TradeSnapshot["teams"] = [];
    for (const team of teams) {
      if (!object(team) || !number(team.rosterId) || !Number.isInteger(team.rosterId) || team.rosterId < 1
        || !number(team.rank) || !Number.isInteger(team.rank) || team.rank < 1 || team.rank > teamCount
        || !Array.isArray(team.playersBefore) || !team.playersBefore.every(text)
        || new Set(team.playersBefore).size !== team.playersBefore.length
        || parsedTeams.some((other) => other.rosterId === team.rosterId)) return fail();
      parsedTeams.push({ rosterId: team.rosterId, rank: team.rank, playersBefore: team.playersBefore });
    }
    const parsedAssets: Record<string, Valuation> = {};
    for (const [key, value] of Object.entries(assets)) {
      if (!/^(player:[^:]+|pick:\d{4}:[1-9]\d*:[1-9]\d*)$/.test(key) || !object(value)
        || !number(value.value) || !number(value.starterValue) || !number(value.futureLow) || !number(value.futureHigh)
        || value.futureLow > value.futureHigh || !text(value.downside) || !text(value.upside)
        || (key.startsWith("player:") && !position(value.position))
        || (key.startsWith("pick:") && (value.starterValue !== 0 || value.position !== undefined))) return fail();
      parsedAssets[key] = {
        value: value.value, starterValue: value.starterValue,
        futureLow: value.futureLow, futureHigh: value.futureHigh,
        downside: value.downside, upside: value.upside,
        ...(position(value.position) ? { position: value.position } : {}),
      };
    }
    return { tradeId, leagueId, asOf, source, futureHorizon, format, slots, teamCount, teams: parsedTeams, assets: parsedAssets, faabValuePerDollar };
  });
}

function change(before: number, after: number) {
  return before === 0 && after === 0 ? 0 : (after - before) / Math.max(before, after);
}

// Solve legal starter assignments exactly; a flexible slot must not steal a needed QB.
function rosterStrength(players: Valuation[], slots: string[]) {
  const pools = positions.map((position) => players.filter((player) => player.position === position)
    .map((player) => player.starterValue).sort((a, b) => b - a));
  const memo = new Map<string, number>();
  const best = (slot: number, used: number[]): number => {
    if (slot === slots.length) return 0;
    const key = `${slot}:${used.join(",")}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let result = best(slot + 1, used);
    for (const position of eligible[slots[slot]]) {
      const index = positions.indexOf(position);
      const value = pools[index][used[index]];
      if (value === undefined) continue;
      const next = [...used];
      next[index]++;
      result = Math.max(result, value + best(slot + 1, next));
    }
    memo.set(key, result);
    return result;
  };
  const lineup = best(0, [0, 0, 0, 0]);
  const total = pools.flat().reduce((sum, value) => sum + value, 0);
  return { lineup, depth: total - lineup };
}

export function assessTrade(trade: TradeRecord, snapshot: TradeSnapshot | undefined, leagueId: string): TradeAssessment {
  const unavailable = (reason: string): TradeAssessment => ({
    source: snapshot?.source ?? null, asOf: snapshot?.asOf ?? null,
    futureHorizon: snapshot?.futureHorizon ?? null,
    sides: trade.sides.map((side) => ({ rosterId: side.manager.rosterId, status: "unrated", reason })),
  });
  if (!snapshot) return unavailable("No authorised trade-time valuation snapshot.");
  if (snapshot.leagueId !== leagueId || snapshot.tradeId !== trade.id) return unavailable("Snapshot does not match this league and trade.");
  if (snapshot.teamCount !== trade.teamCount || [...snapshot.slots].sort().join(",") !== [...trade.rosterSlots].sort().join(",")) {
    return unavailable("Snapshot lineup slots or team count do not match the Sleeper league.");
  }
  const age = trade.timestamp - Date.parse(snapshot.asOf);
  if (age < 0 || age > 7 * 86400000) return unavailable("Snapshot must be from the seven days before the trade, not after it.");

  const sides = trade.sides.map((side): SideGrade => {
    const unrated = (reason: string): SideGrade => ({ rosterId: side.manager.rosterId, status: "unrated", reason });
    const team = snapshot.teams.find((candidate) => candidate.rosterId === side.manager.rosterId);
    if (!team || !side.givesUp) return unrated("Missing pre-trade roster, standings or outgoing asset ownership.");
    const allAssets = [...side.receives, ...side.givesUp];
    const missing = allAssets.filter((asset) => asset.kind !== "faab" && !snapshot.assets[assetKey(asset)]);
    const missingPlayers = team.playersBefore.filter((id) => !snapshot.assets[`player:${id}`]);
    if (missing.length || missingPlayers.length) return unrated(`Missing valuations: ${[...missing.map(assetKey), ...missingPlayers.map((id) => `player:${id}`)].join(", ")}.`);
    const outgoingIds = side.givesUp.filter((asset) => asset.kind === "player").map((asset) => asset.playerId);
    const incomingIds = side.receives.filter((asset) => asset.kind === "player").map((asset) => asset.playerId);
    if (outgoingIds.some((id) => !team.playersBefore.includes(id)) || incomingIds.some((id) => team.playersBefore.includes(id))) {
      return unrated("Pre-trade roster conflicts with the player transfers.");
    }
    const sum = (assets: TradeAsset[], field: "value" | "futureLow" | "futureHigh") =>
      assets.reduce((total, asset) => total + (asset.kind === "faab" ? asset.amount * snapshot.faabValuePerDollar : snapshot.assets[assetKey(asset)][field]), 0);
    const received = sum(side.receives, "value");
    const given = sum(side.givesUp, "value");
    if (received === 0 && given === 0) return unrated("Both packages have zero value; there is no meaningful valuation basis.");
    const before = team.playersBefore.map((id) => snapshot.assets[`player:${id}`]);
    const after = [...team.playersBefore.filter((id) => !outgoingIds.includes(id)), ...incomingIds]
      .map((id) => snapshot.assets[`player:${id}`]);
    const beforeStrength = rosterStrength(before, snapshot.slots);
    const afterStrength = rosterStrength(after, snapshot.slots);
    const marketDelta = change(given, received);
    const lineupDelta = change(beforeStrength.lineup, afterStrength.lineup);
    const depthDelta = change(beforeStrength.depth, afterStrength.depth);
    const contender = team.rank <= Math.ceil(snapshot.teamCount / 3);
    const rebuilder = team.rank > Math.ceil(snapshot.teamCount * 2 / 3);
    const weights = contender ? [0.55, 0.35, 0.10] : rebuilder ? [0.80, 0.10, 0.10] : [0.65, 0.25, 0.10];
    const score = Math.max(0, Math.min(100, 50 + 50 * (weights[0] * marketDelta + weights[1] * lineupDelta + weights[2] * depthDelta)));
    const futureScore = (incoming: number, outgoing: number) => 50 + 50 * change(outgoing, incoming);
    const future = letterGrade(futureScore((sum(side.receives, "futureLow") + sum(side.receives, "futureHigh")) / 2,
      (sum(side.givesUp, "futureLow") + sum(side.givesUp, "futureHigh")) / 2));
    const scenarios = allAssets.filter((asset) => asset.kind !== "faab").map((asset) => {
      const value = snapshot.assets[assetKey(asset)];
      const name = asset.kind === "player" ? asset.name : `${asset.season} round ${asset.round} (${asset.originalOwner})`;
      const direction = side.receives.includes(asset) ? "Received" : "Gave up";
      return `${direction} ${name}: ${value.futureLow.toLocaleString("en-GB")} if ${value.downside}; ${value.futureHigh.toLocaleString("en-GB")} if ${value.upside}.`;
    });
    return {
      rosterId: side.manager.rosterId, status: "rated", now: letterGrade(score), future,
      downside: letterGrade(futureScore(sum(side.receives, "futureLow"), sum(side.givesUp, "futureHigh"))),
      upside: letterGrade(futureScore(sum(side.receives, "futureHigh"), sum(side.givesUp, "futureLow"))),
      score, received, given, marketDelta, lineupDelta, depthDelta,
      strategy: `${contender ? "Contender" : rebuilder ? "Rebuilding" : "Balanced"} weighting (rank ${team.rank}/${snapshot.teamCount})`,
      scenarios,
    };
  });
  return { source: snapshot.source, asOf: snapshot.asOf, futureHorizon: snapshot.futureHorizon, sides };
}
