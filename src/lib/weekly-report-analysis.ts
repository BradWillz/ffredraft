export type WeeklyMatchup = {
  roster_id: number;
  matchup_id: number | null;
  points?: number | null;
  players?: string[];
  starters?: string[];
  players_points?: Record<string, number>;
};

export type WeeklyPlayer = {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  fantasy_positions?: string[];
  team?: string;
};

export type WeeklyTransaction = {
  type: string;
  status: string;
  adds?: Record<string, number> | null;
  drops?: Record<string, number> | null;
  settings?: { waiver_bid?: number } | null;
};

export function reportPlayerName(playerId: string, players: Record<string, WeeklyPlayer>) {
  const player = players[playerId];
  return player?.full_name
    || [player?.first_name, player?.last_name].filter(Boolean).join(" ")
    || playerId;
}

const flexPositions: Record<string, string[]> = {
  FLEX: ["RB", "WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
  REC_FLEX: ["WR", "TE"],
  WRRB_FLEX: ["WR", "RB"],
  IDP_FLEX: ["DL", "LB", "DB", "DE", "DT", "CB", "S"],
};

export function bestLegalBenchSwap(
  matchup: WeeklyMatchup,
  players: Record<string, WeeklyPlayer>,
  rosterPositions: string[],
) {
  const slots = rosterPositions.filter((slot) => !["BN", "IR", "TAXI"].includes(slot));
  const starters = matchup.starters ?? [];
  const points = matchup.players_points ?? {};
  let best: { incomingId: string; outgoingId: string; incomingPoints: number; outgoingPoints: number; gain: number } | null = null;
  for (const incomingId of matchup.players ?? []) {
    if (incomingId === "0" || starters.includes(incomingId) || !Number.isFinite(points[incomingId])) continue;
    const player = players[incomingId];
    const positions = player?.fantasy_positions ?? (player?.position ? [player.position] : []);
    for (const [index, outgoingId] of starters.entries()) {
      const slot = slots[index];
      if (!slot || !positions.some((position) => (flexPositions[slot] ?? [slot]).includes(position))) continue;
      const outgoingPoints = outgoingId === "0" ? 0 : points[outgoingId];
      if (!Number.isFinite(outgoingPoints)) continue;
      const gain = Math.round((points[incomingId] - outgoingPoints) * 100) / 100;
      if (gain > (best?.gain ?? 0)) {
        best = { incomingId, outgoingId, incomingPoints: points[incomingId], outgoingPoints, gain };
      }
    }
  }
  return best;
}

export function matchupSummary(
  name: string,
  opponentName: string,
  matchup: WeeklyMatchup,
  opponent: WeeklyMatchup | undefined,
  players: Record<string, WeeklyPlayer>,
  rosterPositions: string[],
  allPlayWins: number,
  otherTeams: number,
  nextOpponentName: string,
) {
  const score = matchup.points ?? 0;
  const opponentScore = opponent?.points ?? 0;
  const margin = Math.round((score - opponentScore) * 100) / 100;
  const result = !opponent
    ? `${name} scored ${score.toFixed(2)} with no head-to-head opponent.`
    : margin === 0
      ? `${name} tied ${opponentName}, ${score.toFixed(2)} apiece.`
      : `${name} ${margin > 0 ? "beat" : "lost to"} ${opponentName} ${score.toFixed(2)} to ${opponentScore.toFixed(2)}.`;
  const topStarter = (matchup.starters ?? [])
    .filter((playerId) => playerId !== "0" && Number.isFinite(matchup.players_points?.[playerId]))
    .map((playerId) => ({ playerId, points: matchup.players_points![playerId] }))
    .sort((left, right) => right.points - left.points)[0];
  const leader = topStarter ? `${reportPlayerName(topStarter.playerId, players)} led the lineup with ${topStarter.points.toFixed(2)}.` : "";
  const swap = bestLegalBenchSwap(matchup, players, rosterPositions);
  let verdict = `That score beat ${allPlayWins} of the other ${otherTeams} teams this week.`;
  if (swap) {
    const incoming = reportPlayerName(swap.incomingId, players);
    const outgoing = swap.outgoingId === "0" ? "the empty slot" : reportPlayerName(swap.outgoingId, players);
    const swapResult = Math.round((margin + swap.gain) * 100) / 100;
    verdict = `In hindsight, starting ${incoming} (${swap.incomingPoints.toFixed(2)}) instead of ${outgoing} (${swap.outgoingPoints.toFixed(2)}) adds ${swap.gain.toFixed(2)}`;
    verdict += opponent && margin <= 0
      ? swapResult > 0
        ? ` and turns the ${margin === 0 ? "tie" : "loss"} into a ${swapResult.toFixed(2)}-point win.`
        : swapResult === 0
          ? "; enough to tie, not win."
          : ", but still leaves a defeat."
      : "; points left unused despite the result.";
  }
  const advice = swap
    ? `Next up: ${nextOpponentName}. Review the ${reportPlayerName(swap.incomingId, players)} decision, but check availability and the matchup before chasing last week's points.`
    : `Next up: ${nextOpponentName}. No higher-scoring direct bench swap was found in the available lineup data; check injuries and byes before setting the next lineup.`;
  return {
    blurb: [result, leader, verdict].filter(Boolean).join(" "),
    advice,
    commentaryFacts: {
      result: !opponent ? "bye" : margin === 0 ? "tie" : margin > 0 ? "win" : "loss",
      margin,
      leadingScorer: topStarter ? { name: reportPlayerName(topStarter.playerId, players), points: topStarter.points } : null,
      bestDirectSwap: swap ? {
        incoming: reportPlayerName(swap.incomingId, players),
        outgoing: swap.outgoingId === "0" ? "the empty slot" : reportPlayerName(swap.outgoingId, players),
        incomingPoints: swap.incomingPoints,
        outgoingPoints: swap.outgoingPoints,
        gain: swap.gain,
        resultingMargin: opponent ? Math.round((margin + swap.gain) * 100) / 100 : null,
        effect: !opponent ? "bye" : margin > 0 ? "won_despite_unused_points"
          : Math.round((margin + swap.gain) * 100) > 0 ? "would_win"
            : Math.round((margin + swap.gain) * 100) === 0 ? "would_tie" : "still_loses",
      } : null,
      lineupAssessment: swap ? "higher_scoring_direct_swap_available" : "no_higher_scoring_direct_swap_found",
    },
  };
}

export function waiverPickupsOfWeek(transactions: WeeklyTransaction[], matchups: WeeklyMatchup[]) {
  const candidates = new Map<string, { rosterId: number; playerId: string; points: number; started: boolean }>();
  for (const transaction of transactions) {
    if (transaction.status !== "complete" || !["waiver", "free_agent"].includes(transaction.type)) continue;
    for (const [playerId, rosterId] of Object.entries(transaction.adds ?? {})) {
      const matchup = matchups.find((candidate) => candidate.roster_id === rosterId);
      const points = matchup?.players_points?.[playerId];
      if (!matchup?.players?.includes(playerId) || points == null || !Number.isFinite(points)) continue;
      candidates.set(`${rosterId}:${playerId}`, { rosterId, playerId, points, started: matchup.starters?.includes(playerId) ?? false });
    }
  }
  const ranked = [...candidates.values()].sort((left, right) => right.points - left.points || left.rosterId - right.rosterId || left.playerId.localeCompare(right.playerId));
  return ranked.filter((candidate) => candidate.points === ranked[0].points);
}

export function leagueScoredPoints(stats: Record<string, number> | undefined, scoring: Record<string, number>) {
  if (!stats) return null;
  const total = Object.entries(scoring).reduce((sum, [key, value]) => sum + (Number(stats[key]) || 0) * value, 0);
  return Math.round(total * 100) / 100;
}

export function dumbestDropsOfWeek(transactions: WeeklyTransaction[], playerPoints: Record<string, number>) {
  const candidates = new Map<string, { rosterId: number; playerId: string; points: number }>();
  for (const transaction of transactions) {
    if (transaction.status !== "complete" || !["waiver", "free_agent"].includes(transaction.type)) continue;
    for (const [playerId, rosterId] of Object.entries(transaction.drops ?? {})) {
      const points = playerPoints[playerId];
      if (points == null || !Number.isFinite(points)) continue;
      candidates.set(`${rosterId}:${playerId}`, { rosterId, playerId, points });
    }
  }
  const ranked = [...candidates.values()].sort((left, right) => right.points - left.points || left.rosterId - right.rosterId || left.playerId.localeCompare(right.playerId));
  return ranked.filter((candidate) => candidate.points === ranked[0].points);
}

// Points only count while the player sat in the buying team's starting lineup, from the waiver week onward.
export function faabBreakdown(transactionsByWeek: WeeklyTransaction[][], weeklyMatchups: WeeklyMatchup[][]) {
  const buys = new Map<string, { rosterId: number; playerId: string; bid: number; week: number }>();
  transactionsByWeek.forEach((transactions, index) => {
    for (const transaction of transactions) {
      if (transaction.status !== "complete" || transaction.type !== "waiver") continue;
      const bid = Number(transaction.settings?.waiver_bid ?? 0);
      if (bid <= 0) continue;
      for (const [playerId, rosterId] of Object.entries(transaction.adds ?? {})) {
        const key = `${rosterId}:${playerId}`;
        const existing = buys.get(key);
        buys.set(key, existing ? { ...existing, bid: existing.bid + bid } : { rosterId, playerId, bid, week: index + 1 });
      }
    }
  });
  const teams = new Map<number, { rosterId: number; spent: number; startedPoints: number; players: Array<{ playerId: string; bid: number; week: number; startedPoints: number }> }>();
  for (const buy of buys.values()) {
    const startedPoints = weeklyMatchups.slice(buy.week - 1).reduce((total, matchups) => {
      const matchup = matchups.find((candidate) => candidate.roster_id === buy.rosterId);
      return matchup?.starters?.includes(buy.playerId) ? total + (matchup.players_points?.[buy.playerId] ?? 0) : total;
    }, 0);
    const team = teams.get(buy.rosterId) ?? { rosterId: buy.rosterId, spent: 0, startedPoints: 0, players: [] };
    team.spent += buy.bid;
    team.startedPoints += startedPoints;
    team.players.push({ playerId: buy.playerId, bid: buy.bid, week: buy.week, startedPoints: Math.round(startedPoints * 100) / 100 });
    teams.set(buy.rosterId, team);
  }
  return [...teams.values()].map((team) => ({
    ...team,
    startedPoints: Math.round(team.startedPoints * 100) / 100,
    players: team.players.sort((left, right) => right.bid - left.bid || right.startedPoints - left.startedPoints),
  }));
}

export type PlayoffSimTeam = { rosterId: number; wins: number; losses: number; ties: number; points: number; scores: number[] };
export type PlayoffOdds = { playoff: number; byRecord: number; byPoints: number };

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

// Seeds 1..byRecord go to the best records (points for breaks ties); the last spot goes to the highest points for among the rest.
export function playoffField(teams: Array<{ rosterId: number; wins: number; ties: number; points: number }>, byRecord = 5, playoffTeams = 6) {
  const ranked = [...teams].sort((left, right) =>
    (right.wins + right.ties * 0.5) - (left.wins + left.ties * 0.5) || right.points - left.points || left.rosterId - right.rosterId);
  const recordSeeds = ranked.slice(0, byRecord).map((team) => team.rosterId);
  const pointsSeeds = ranked.slice(byRecord)
    .sort((left, right) => right.points - left.points || left.rosterId - right.rosterId)
    .slice(0, playoffTeams - byRecord)
    .map((team) => team.rosterId);
  return { recordSeeds, pointsSeeds };
}

// Monte Carlo: each team's weekly score is drawn from a normal distribution around its season average,
// shrunk toward the league average so a hot or cold start does not dominate early-season odds.
export function simulatePlayoffOdds(
  teams: PlayoffSimTeam[],
  remainingWeeks: Array<Array<[number, number]>>,
  { simulations = 10000, seed = 1, byRecord = 5, playoffTeams = 6, shrinkWeeks = 3 } = {},
) {
  const allScores = teams.flatMap((team) => team.scores);
  const leagueMean = allScores.reduce((total, score) => total + score, 0) / Math.max(1, allScores.length);
  const variance = allScores.reduce((total, score) => total + (score - leagueMean) ** 2, 0) / Math.max(1, allScores.length - 1);
  const spread = Math.max(15, Math.sqrt(variance));
  const means = new Map(teams.map((team) => [
    team.rosterId,
    (team.scores.reduce((total, score) => total + score, 0) + leagueMean * shrinkWeeks) / (team.scores.length + shrinkWeeks),
  ]));
  const random = seededRandom(seed);
  const normal = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  const tallies = new Map(teams.map((team) => [team.rosterId, { byRecord: 0, byPoints: 0 }]));

  for (let run = 0; run < simulations; run += 1) {
    const state = new Map(teams.map((team) => [team.rosterId, { rosterId: team.rosterId, wins: team.wins, ties: team.ties, points: team.points }]));
    for (const games of remainingWeeks) {
      for (const [homeId, awayId] of games) {
        const home = state.get(homeId);
        const away = state.get(awayId);
        if (!home || !away) continue;
        const homeScore = Math.max(0, (means.get(homeId) ?? leagueMean) + normal() * spread);
        const awayScore = Math.max(0, (means.get(awayId) ?? leagueMean) + normal() * spread);
        home.points += homeScore;
        away.points += awayScore;
        if (homeScore > awayScore) home.wins += 1;
        else if (awayScore > homeScore) away.wins += 1;
        else { home.ties += 1; away.ties += 1; }
      }
    }
    const { recordSeeds, pointsSeeds } = playoffField([...state.values()], byRecord, playoffTeams);
    for (const rosterId of recordSeeds) tallies.get(rosterId)!.byRecord += 1;
    for (const rosterId of pointsSeeds) tallies.get(rosterId)!.byPoints += 1;
  }

  return new Map<number, PlayoffOdds>([...tallies.entries()].map(([rosterId, tally]) => [rosterId, {
    playoff: (tally.byRecord + tally.byPoints) / simulations * 100,
    byRecord: tally.byRecord / simulations * 100,
    byPoints: tally.byPoints / simulations * 100,
  }]));
}