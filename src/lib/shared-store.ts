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

export async function sharedDelete(key: string) {
  const redis = redisClient();
  if (redis) await redis.del(key);
  else memoryStore.delete(key);
}