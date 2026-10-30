import type { Redis } from 'ioredis';

/**
 * Read-through cache over Redis. A miss runs the loader, stores the result with a TTL and
 * returns it. `invalidate` deletes keys so the next read goes back to Postgres.
 * A Redis error on a read falls back to the loader, so a cache outage costs speed only.
 */
export class ReadThroughCache {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds: number,
    private readonly prefix = 'saas:',
  ) {}

  async get<T>(key: string, loader: () => Promise<T | null>): Promise<T | null> {
    const full = this.prefix + key;
    try {
      const hit = await this.redis.get(full);
      if (hit !== null) return JSON.parse(hit) as T;
    } catch {
      return loader();
    }
    const value = await loader();
    if (value !== null) {
      try {
        await this.redis.set(full, JSON.stringify(value), 'EX', this.ttlSeconds);
      } catch {
        // the value is still correct, it just is not cached
      }
    }
    return value;
  }

  async invalidate(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.redis.del(...keys.map((k) => this.prefix + k));
  }
}
