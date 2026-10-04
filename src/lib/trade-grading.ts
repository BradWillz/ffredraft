export type Grade = "A" | "B" | "C" | "D" | "F";
export type Tier = "contender" | "middle" | "rebuilder";
export type ValuedPlayer = { id: string; position: string; value: number };

export const SKILL_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);
const SLOT_ELIGIBILITY: Record<string, string[]> = {
  QB: ["QB"], RB: ["RB"], WR: ["WR"], TE: ["TE"],
  WRRB_FLEX: ["RB", "WR"], REC_FLEX: ["WR", "TE"],
  FLEX: ["RB", "WR", "TE"], SUPER_FLEX: ["QB", "RB", "WR", "TE"],
};
const DEPTH_SIZE = 6;

// Weights for market value / starting lineup / bench depth.
export const TIER_WEIGHTS: Record<Tier, [number, number, number]> = {
  contender: [0.55, 0.35, 0.1],
  middle: [0.65, 0.25, 0.1],
  rebuilder: [0.8, 0.1, 0.1],
};

export function isOffseasonTrade(trade: { week: number; timestamp: number }) {
  const month = new Date(trade.timestamp).getUTCMonth();
  return trade.week <= 1 && month >= 1 && month <= 7;
}

export function letterGrade(score: number): Grade {
  if (score >= 80) return "A";
  if (score >= 62) return "B";
  if (score >= 38) return "C";
  if (score >= 20) return "D";
  return "F";
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Share of the larger side: +0.13 is roughly "won by 15%", +0.23 roughly "won by 30%".
export function valueDelta(received: number, given: number) {
  const larger = Math.max(received, given);
  return larger > 0 ? (received - given) / larger : 0;
}

export function scoreFromDelta(delta: number) {
  return clamp(50 + 150 * delta, 0, 100);
}

export function tierForRank(rank: number | null, teamCount: number): Tier {
  if (!rank) return "middle";
  if (rank <= Math.ceil(teamCount / 3)) return "contender";
  if (rank > teamCount - Math.ceil(teamCount / 3)) return "rebuilder";
  return "middle";
}

// Fill the most restrictive slots first; optimal for nested slot sets like FLEX within SUPER_FLEX.
export function lineupStrength(players: ValuedPlayer[], slots: string[]) {
  const pool = players.filter((player) => SKILL_POSITIONS.has(player.position)).sort((left, right) => right.value - left.value);
  const used = new Set<string>();
  const ordered = slots.filter((slot) => Object.prototype.hasOwnProperty.call(SLOT_ELIGIBILITY, slot))
    .sort((left, right) => SLOT_ELIGIBILITY[left].length - SLOT_ELIGIBILITY[right].length);
  let starters = 0;
  for (const slot of ordered) {
    const pick = pool.find((player) => !used.has(player.id) && SLOT_ELIGIBILITY[slot].includes(player.position));
    if (!pick) continue;
    used.add(pick.id);
    starters += pick.value;
  }
  const depth = pool.filter((player) => !used.has(player.id)).slice(0, DEPTH_SIZE).reduce((total, player) => total + player.value, 0);
  return { starters, depth };
}

export type ScoringStats = Record<string, number | undefined>;

// League points relative to half-PPR, so TE premium and first-down scoring lift the players they favour.
export function leaguePoints(stats: ScoringStats, scoring: Record<string, number>, position: string) {
  let total = 0;
  for (const [key, points] of Object.entries(scoring)) {
    let amount = stats[key];
    if (amount === undefined && key === "bonus_rec_te" && position === "TE") amount = stats.rec;
    if (typeof amount === "number" && Number.isFinite(amount)) total += amount * points;
  }
  return total;
}

export type ScoringFactors = { byPlayer: Map<string, number>; byPosition: Map<string, number> };

export function scoringFactors(
  stats: Record<string, ScoringStats>,
  scoring: Record<string, number>,
  positionOf: (playerId: string) => string | undefined,
): ScoringFactors {
  const ratios: Array<{ id: string; position: string; ratio: number }> = [];
  for (const [id, line] of Object.entries(stats)) {
    const position = positionOf(id);
    const halfPpr = line.pts_half_ppr;
    if (!position || !SKILL_POSITIONS.has(position) || typeof halfPpr !== "number" || halfPpr < 50) continue;
    ratios.push({ id, position, ratio: leaguePoints(line, scoring, position) / halfPpr });
  }
  const average = ratios.reduce((total, entry) => total + entry.ratio, 0) / Math.max(ratios.length, 1) || 1;
  const byPlayer = new Map(ratios.map((entry) => [entry.id, clamp(entry.ratio / average, 0.85, 1.25)]));
  const byPosition = new Map<string, number>();
  for (const position of SKILL_POSITIONS) {
    const group = ratios.filter((entry) => entry.position === position);
    byPosition.set(position, group.length ? clamp(group.reduce((total, entry) => total + entry.ratio, 0) / group.length / average, 0.85, 1.25) : 1);
  }
  return { byPlayer, byPosition };
}

export function playerFactor(factors: ScoringFactors | null, playerId: string, position: string) {
  return factors?.byPlayer.get(playerId) ?? factors?.byPosition.get(position) ?? 1;
}

// Dynasty market values already price part of TE premium, so only half the positional factor is applied.
export function marketFactor(factors: ScoringFactors | null, position: string) {
  return 1 + ((factors?.byPosition.get(position) ?? 1) - 1) / 2;
}

export type AtTradeInputs = {
  marketIn: number;
  marketOut: number;
  before: { starters: number; depth: number };
  after: { starters: number; depth: number };
  tier: Tier;
};

export function atTradeScore({ marketIn, marketOut, before, after, tier }: AtTradeInputs) {
  const starterChange = before.starters > 0 ? (after.starters - before.starters) / before.starters : 0;
  const depthChange = before.depth > 0 ? (after.depth - before.depth) / before.depth : 0;
  // Convert each component to a market-delta equivalent: a 10% better lineup counts like winning by ~30%.
  const components = [
    valueDelta(marketIn, marketOut),
    clamp(starterChange * 2.5, -0.5, 0.5),
    clamp(depthChange * 0.3, -0.3, 0.3),
  ];
  const combined = TIER_WEIGHTS[tier].reduce((total, weight, index) => total + weight * components[index], 0);
  return { score: scoreFromDelta(combined), starterChange, depthChange };
}
