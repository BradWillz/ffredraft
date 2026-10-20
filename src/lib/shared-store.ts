import { Redis } from "@upstash/redis";

const memoryStore = new Map<string, unknown>();

function redisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

export async function sharedGet<T>(key: string): Promise<T | null> {
  const redis = redisClient();
  if (redis) return redis.get<T>(key);
  return (memoryStore.get(key) as T | undefined) ?? null;
}

export async function sharedSet<T>(key: string, value: T) {
  const redis = redisClient();
  if (redis) await redis.set(key, value);
  else memoryStore.set(key, value);
}

export async function sharedCompareAndSet<T>(key: string, expected: T | null, value: T) {
  const redis = redisClient();
  if (redis) {
    const result = await redis.eval<string[], number>(`
      local current = redis.call("GET", KEYS[1])
      if (not current and ARGV[1] == "null") or current == ARGV[1] then
        redis.call("SET", KEYS[1], ARGV[2])
        return 1
      end
      return 0
    `, [key], [JSON.stringify(expected), JSON.stringify(value)]);
    return result === 1;
  }
  if (JSON.stringify(memoryStore.get(key) ?? null) !== JSON.stringify(expected)) return false;
  memoryStore.set(key, value);
  return true;
}

export async function sharedDelete(key: string) {
  const redis = redisClient();
  if (redis) await redis.del(key);
  else memoryStore.delete(key);
}

export async function sharedAcquireLock(key: string, seconds: number) {
  const redis = redisClient();
  if (redis) return await redis.set(key, true, { nx: true, ex: seconds }) === "OK";
  const expiresAt = memoryStore.get(key);
  if (typeof expiresAt === "number" && expiresAt > Date.now()) return false;
  memoryStore.set(key, Date.now() + seconds * 1000);
  return true;
}