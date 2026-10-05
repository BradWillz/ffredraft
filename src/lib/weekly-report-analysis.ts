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

export function whiffOfTheWeek(
  matchups: WeeklyMatchup[],
  players: Record<string, WeeklyPlayer>,
  rosterPositions: string[],
) {
  const candidates = matchups.flatMap((matchup) => {
    const opponent = matchup.matchup_id == null
      ? undefined
      : matchups.find((candidate) => candidate.matchup_id === matchup.matchup_id && candidate.roster_id !== matchup.roster_id);
    if (!opponent || (matchup.points ?? 0) >= (opponent.points ?? 0)) return [];
    const swap = bestLegalBenchSwap(matchup, players, rosterPositions);
    if (!swap) return [];
    const winMargin = Math.round(((matchup.points ?? 0) - (opponent.points ?? 0) + swap.gain) * 100) / 100;
    return winMargin > 0 ? [{ rosterId: matchup.roster_id, opponentRosterId: opponent.roster_id, ...swap, winMargin }] : [];
  });
  return candidates.sort((left, right) => right.winMargin - left.winMargin || right.gain - left.gain || left.rosterId - right.rosterId)[0] ?? null;
}

// Fill the most restrictive slots first so flex slots get the best leftovers.
export function maxPointsFor(matchup: WeeklyMatchup, players: Record<string, WeeklyPlayer>, rosterPositions: string[]) {
  const slots = rosterPositions
    .filter((slot) => !["BN", "IR", "TAXI"].includes(slot))
    .sort((left, right) => (flexPositions[left]?.length ?? 1) - (flexPositions[right]?.length ?? 1));
  const points = matchup.players_points ?? {};
  const pool = (matchup.players ?? [])
    .filter((id) => id !== "0" && Number.isFinite(points[id]))
    .sort((left, right) => points[right] - points[left]);
  const used = new Set<string>();
  let total = 0;
  for (const slot of slots) {
    const eligible = flexPositions[slot] ?? [slot];
    const pick = pool.find((id) => {
      const player = players[id];
      const positions = player?.fantasy_positions ?? (player?.position ? [player.position] : []);
      return !used.has(id) && positions.some((position) => eligible.includes(position));
    });
    if (!pick) continue;
    used.add(pick);
    total += points[pick];
  }
  return Math.round(total * 100) / 100;
}

export type DraftPickTrade = { season: string; round: number; roster_id: number; owner_id: number; previous_owner_id: number };

// Rewinds current pick ownership by undoing trades made after the report week, newest first.
export function pickOwnersAt(currentTradedPicks: DraftPickTrade[], laterTrades: DraftPickTrade[][], season: string) {
  const owners = new Map<string, number>();
  for (const pick of currentTradedPicks) {
    if (pick.season === season) owners.set(`${pick.round}:${pick.roster_id}`, pick.owner_id);
  }
  for (const trade of [...laterTrades].reverse()) {
    for (const pick of trade) {
      if (pick.season === season) owners.set(`${pick.round}:${pick.roster_id}`, pick.previous_owner_id);
    }
  }
  return (round: number, originalRosterId: number) => owners.get(`${round}:${originalRosterId}`) ?? originalRosterId;
}

// Non-playoff teams pick 1-6 by lowest max PF; playoff teams pick 7-12 by seed until the bracket decides it (champion picks last).
export function rookieDraftOrder(
  teams: Array<{ rosterId: number; wins: number; ties: number; points: number; maxPoints: number }>,
  byRecord = 5,
  playoffTeams = 6,
) {
  const { recordSeeds, pointsSeeds } = playoffField(teams, byRecord, playoffTeams);
  const seeds = [...recordSeeds, ...pointsSeeds];
  const lottery = teams
    .filter((team) => !seeds.includes(team.rosterId))
    .sort((left, right) => left.maxPoints - right.maxPoints || left.rosterId - right.rosterId)
    .map((team) => ({ rosterId: team.rosterId, seed: null as number | null }));
  const playoff = [...seeds].reverse().map((rosterId) => ({ rosterId, seed: seeds.indexOf(rosterId) + 1 }));
  return [...lottery, ...playoff].map((entry, index) => ({ ...entry, pick: index + 1 }));
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
export function allPlayCredit(score: number, weekScores: number[]) {
  // weekScores includes this team's own score once; exact ties are worth half an all-play win.
  let credit = 0;
  let selfSkipped = false;
  for (const other of weekScores) {
    if (other === score && !selfSkipped) { selfSkipped = true; continue; }
    if (score > other) credit += 1;
    else if (score === other) credit += 0.5;
  }
  return credit;
}

export type ScheduleLuckTeam = {
  rosterId: number;
  wins: number;
  losses: number;
  ties: number;
  allPlayWins: number;
  allPlayLosses: number;
  allPlayPossible: number;
  expectedWins: number;
  expectedLosses: number;
  scheduleLuck: number;
  pointsFor: number;
  completedWeeks: number;
};

export function scheduleLuck(weeklyMatchups: WeeklyMatchup[][]): ScheduleLuckTeam[] {
  const teams = new Map<number, ScheduleLuckTeam>();
  for (const week of weeklyMatchups) {
    if (week.length < 2) continue;
    const scores = week.map((matchup) => matchup.points ?? 0);
    const rivals = week.length - 1;
    for (const matchup of week) {
      const team = teams.get(matchup.roster_id) ?? {
        rosterId: matchup.roster_id, wins: 0, losses: 0, ties: 0, allPlayWins: 0, allPlayLosses: 0, allPlayPossible: 0,
        expectedWins: 0, expectedLosses: 0, scheduleLuck: 0, pointsFor: 0, completedWeeks: 0,
      };
      const credit = allPlayCredit(matchup.points ?? 0, scores);
      team.allPlayWins += credit;
      team.allPlayLosses += rivals - credit;
      team.allPlayPossible += rivals;
      team.expectedWins += credit / rivals;
      team.pointsFor += matchup.points ?? 0;
      team.completedWeeks += 1;
      teams.set(matchup.roster_id, team);
    }
    const pairs = new Map<number, WeeklyMatchup[]>();
    for (const matchup of week) {
      if (matchup.matchup_id == null) continue;
      pairs.set(matchup.matchup_id, [...(pairs.get(matchup.matchup_id) ?? []), matchup]);
    }
    for (const pair of pairs.values()) {
      if (pair.length !== 2) continue;
      const [first, second] = pair.map((matchup) => teams.get(matchup.roster_id)!);
      const firstScore = pair[0].points ?? 0;
      const secondScore = pair[1].points ?? 0;
      if (firstScore > secondScore) { first.wins += 1; second.losses += 1; }
      else if (secondScore > firstScore) { second.wins += 1; first.losses += 1; }
      else { first.ties += 1; second.ties += 1; }
    }
  }
  return [...teams.values()].map((team) => {
    const actualWins = team.wins + team.ties / 2;
    return {
      ...team,
      expectedLosses: team.completedWeeks - team.expectedWins,
      scheduleLuck: actualWins - team.expectedWins,
    };
  });
}

export const FRAUD_WATCH_THRESHOLD = 0.1;
const LUCK_EPSILON = 1e-9;

export function fraudWatchSelection<T extends ScheduleLuckTeam>(teams: T[], threshold = FRAUD_WATCH_THRESHOLD) {
  const suspects = teams
    .filter((team) => team.scheduleLuck > LUCK_EPSILON)
    .sort((left, right) => (Math.abs(right.scheduleLuck - left.scheduleLuck) > LUCK_EPSILON ? right.scheduleLuck - left.scheduleLuck : 0)
      || left.pointsFor - right.pointsFor
      || left.allPlayWins - right.allPlayWins
      || left.rosterId - right.rosterId);
  const robbed = teams
    .filter((team) => team.scheduleLuck < -LUCK_EPSILON)
    .sort((left, right) => (Math.abs(right.scheduleLuck - left.scheduleLuck) > LUCK_EPSILON ? left.scheduleLuck - right.scheduleLuck : 0)
      || right.pointsFor - left.pointsFor
      || right.allPlayWins - left.allPlayWins
      || left.rosterId - right.rosterId);
  const primary = suspects[0] && suspects[0].scheduleLuck > threshold + LUCK_EPSILON ? suspects[0] : null;
  return {
    primary,
    alsoUnderInvestigation: primary ? suspects.slice(1, 3) : [],
    mostRobbed: robbed[0] ?? null,
  };
}
