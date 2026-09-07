import { sharedDelete, sharedGet, sharedSet } from "./shared-store";

export const LOWEST_SCORER_STATE_KEY = "redraft:2026:lowest-scorer";

export type DanceForfeit = {
  week: number;
  dancerName: string;
  opponentName: string;
  score: number;
  dance: string;
};

export type LowestScorerState = { forfeits: DanceForfeit[] };

const DEFAULT_LOWEST_SCORER_STATE: LowestScorerState = { forfeits: [] };

export async function getLowestScorerState() {
  return (await sharedGet<LowestScorerState>(LOWEST_SCORER_STATE_KEY)) ?? DEFAULT_LOWEST_SCORER_STATE;
}

export async function setLowestScorerState(state: LowestScorerState) {
  await sharedSet(LOWEST_SCORER_STATE_KEY, state);
}

export async function resetLowestScorerState() {
  await sharedDelete(LOWEST_SCORER_STATE_KEY);
}