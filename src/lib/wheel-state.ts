import { sharedDelete, sharedGet, sharedSet } from "./shared-store";

export const WHEEL_STATE_KEY = "redraft:2026:wheel";

export type WheelResult = { week: number; scenario: string; date: string };
export type WheelWinner = { week: number; scenario: string; winnerName: string; winnerValue: number; details: string };
export type WheelState = {
  currentWeek: number;
  availableScenarios: string[];
  weekResults: WheelResult[];
  weekWinners: WheelWinner[];
};

export const WHEEL_SCENARIOS = [
  "Highest Scoring Starting QB", "Highest Scoring Kicker", "Highest Scoring Defense",
  "Highest Scoring RB", "Highest Scoring WR", "Highest Scoring TE",
  "Most Total Touchdowns (Team)", "Highest Bench Score", "Biggest Blowout Win",
  "Closest Matchup Winner", "Highest Scoring Flex Player", "Most Receiving Yards (Single Player)",
  "Most Rushing Yards (Single Player)", "Most Sacks from a D/ST",
];

export const DEFAULT_WHEEL_STATE: WheelState = {
  currentWeek: 1,
  availableScenarios: WHEEL_SCENARIOS,
  weekResults: [],
  weekWinners: [],
};

export async function getWheelState() {
  return (await sharedGet<WheelState>(WHEEL_STATE_KEY)) ?? DEFAULT_WHEEL_STATE;
}

export async function setWheelState(state: WheelState) {
  await sharedSet(WHEEL_STATE_KEY, state);
}

export async function resetWheelState() {
  await sharedDelete(WHEEL_STATE_KEY);
}