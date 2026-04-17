import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 60, checkperiod: 30, useClones: false });

export function getCached<T>(key: string): T | undefined {
    return cache.get<T>(key);
}

export function setCached<T>(key: string, value: T, ttlSeconds = 60): void {
    cache.set(key, value, ttlSeconds);
}

export function deleteCached(key: string): void {
    cache.del(key);
}

export function clearCache(): void {
    cache.flushAll();
}
