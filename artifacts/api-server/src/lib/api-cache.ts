import { LRUCache } from "lru-cache";

const FIVE_MINUTES = 5 * 60 * 1000;

const cache = new LRUCache<string, object>({
  max: 200,
  ttl: FIVE_MINUTES,
});

export function getCached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setCached<T extends object>(key: string, value: T): void {
  cache.set(key, value);
}

export function clearApiCache(): void {
  cache.clear();
}
