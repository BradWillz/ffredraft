const BASE_URL = "https://api.statsguyfantasy.com/api/v1";
const USER_AGENT = "FourthAndForever/1.0 (+https://github.com/BradWillz/ffredraft)";
const ASSETS_PER_SIDE = 20;
const TRADES_PER_BATCH = 25;
const CURRENT_TTL_MS = 6 * 60 * 60 * 1000;

export type StatsGuyFormat = "sf_dynasty" | "non_sf_dynasty" | "sf_redraft" | "non_sf_redraft";
// date null = current values. Historical dates resolve to the latest snapshot on or before that day.
export type ValueRequest = { format: StatsGuyFormat; date: string | null; id: string };
export type AssetValue = { value: number; found: boolean };

type BatchAsset = { id: string; value: number; found: boolean };
type BatchResult = { sideA: { assets: BatchAsset[] }; sideB: { assets: BatchAsset[] } };

const cache = new Map<string, AssetValue & { expires: number }>();

export const valueKey = (request: ValueRequest) => `${request.format}|${request.date ?? "now"}|${request.id}`;

export function clearStatsGuyCache() {
  cache.clear();
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function post(body: unknown): Promise<{ results: BatchResult[] }> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${BASE_URL}/trades/evaluate/batch`, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": USER_AGENT },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (response.status === 429 && attempt === 0) {
      const retryAfter = Number(response.headers.get("retry-after") ?? 5);
      await wait(Math.min(Math.max(retryAfter, 1), 15) * 1000);
      continue;
    }
    if (!response.ok) throw new Error(`Stats Guy Fantasy API error: ${response.status}`);
    return response.json() as Promise<{ results: BatchResult[] }>;
  }
}

export async function fetchValues(requests: ValueRequest[]): Promise<Map<string, AssetValue>> {
  const now = Date.now();
  const values = new Map<string, AssetValue>();
  const groups = new Map<string, { format: StatsGuyFormat; date: string | null; ids: Set<string> }>();
  for (const request of requests) {
    const key = valueKey(request);
    const cached = cache.get(key);
    if (cached && cached.expires > now) {
      values.set(key, { value: cached.value, found: cached.found });
      continue;
    }
    const groupKey = `${request.format}|${request.date ?? "now"}`;
    const group = groups.get(groupKey) ?? { format: request.format, date: request.date, ids: new Set<string>() };
    group.ids.add(request.id);
    groups.set(groupKey, group);
  }

  // The batch endpoint is the only date-aware bulk lookup; each "trade" carries up to 40 assets.
  const entries = [...groups.values()].flatMap(({ format, date, ids }) => {
    const list = [...ids];
    const chunks: Array<{ format: StatsGuyFormat; date: string | null; sideA: string[]; sideB: string[] }> = [];
    for (let index = 0; index < list.length; index += ASSETS_PER_SIDE * 2) {
      const chunk = list.slice(index, index + ASSETS_PER_SIDE * 2);
      const sideA = chunk.slice(0, ASSETS_PER_SIDE);
      const sideB = chunk.length > ASSETS_PER_SIDE ? chunk.slice(ASSETS_PER_SIDE) : [chunk[0]];
      chunks.push({ format, date, sideA, sideB });
    }
    return chunks;
  });

  for (let index = 0; index < entries.length; index += TRADES_PER_BATCH) {
    const batch = entries.slice(index, index + TRADES_PER_BATCH);
    const { results } = await post({
      trades: batch.map(({ format, date, sideA, sideB }) => ({ format, ...(date ? { date } : {}), sideA, sideB })),
    });
    if (!Array.isArray(results) || results.length !== batch.length) throw new Error("Stats Guy Fantasy API returned an unexpected batch response");
    batch.forEach((entry, position) => {
      const assets = [...results[position].sideA.assets, ...results[position].sideB.assets];
      for (const asset of assets) {
        const key = valueKey({ format: entry.format, date: entry.date, id: asset.id });
        const value = { value: asset.found && Number.isFinite(asset.value) ? asset.value : 0, found: Boolean(asset.found) };
        values.set(key, value);
        cache.set(key, { ...value, expires: entry.date ? Number.POSITIVE_INFINITY : now + CURRENT_TTL_MS });
      }
    });
  }
  return values;
}
