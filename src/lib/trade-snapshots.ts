import { readFile } from "node:fs/promises";
import { parseTradeSnapshots, type TradeSnapshot } from "./trade-grading";

export async function loadTradeSnapshots(): Promise<{ snapshots: TradeSnapshot[]; error: string | null }> {
  const path = process.env.DYNASTY_TRADE_SNAPSHOTS_PATH;
  if (!path) return { snapshots: [], error: null };
  try {
    const input: unknown = JSON.parse(await readFile(path, "utf8"));
    return { snapshots: parseTradeSnapshots(input), error: null };
  } catch (error) {
    console.error("[trade-grading] Could not load valuation snapshots", error);
    return { snapshots: [], error: "Valuation snapshots could not be loaded. Check the server configuration and snapshot data. No grades have been calculated." };
  }
}
