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