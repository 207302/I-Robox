type MemoryEntry<T> = { expiresAt: number; value: T };

/**
 * Coalesce concurrent loads of the same key and optionally keep a short
 * in-process copy. Used in front of `unstable_cache` so a cold key under
 * traffic becomes one database read instead of a stampede.
 */
export function createSingleflightCache<T>(options: { maxEntries: number }) {
  const inflight = new Map<string, Promise<T>>();
  const memory = new Map<string, MemoryEntry<T>>();
  let generation = 0;

  function remember(key: string, value: T, ttlMs: number) {
    if (ttlMs <= 0) return;
    if (memory.size >= options.maxEntries) {
      const oldest = memory.keys().next().value;
      if (oldest !== undefined) memory.delete(oldest);
    }
    memory.delete(key);
    memory.set(key, { expiresAt: Date.now() + ttlMs, value });
  }

  function read(key: string): T | undefined {
    const hit = memory.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      memory.delete(key);
      return undefined;
    }
    return hit.value;
  }

  async function load(
    key: string,
    ttlMs: number,
    fn: () => Promise<T>,
    shouldStore: (value: T) => boolean = () => true
  ): Promise<T> {
    const cached = read(key);
    if (cached !== undefined) return cached;

    const pending = inflight.get(key);
    if (pending) return pending;

    const gen = generation;
    const promise = fn()
      .then((value) => {
        if (gen === generation && shouldStore(value)) remember(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        if (inflight.get(key) === promise) inflight.delete(key);
      });
    inflight.set(key, promise);
    return promise;
  }

  function clear() {
    generation += 1;
    memory.clear();
  }

  return { load, clear };
}
