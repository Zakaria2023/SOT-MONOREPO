export type CounterStore = {
  /**
   * Adds one hit for `key` and returns the running count plus when the current
   * window ends. Must be atomic per key — two concurrent requests that both read
   * 99 and both write 100 have let 101 through.
   */
  hit: (
    key: string,
    windowMs: number,
  ) => Promise<{ count: number; resetAt: number }>;
};

type Window = {
  count: number;
  resetAt: number;
};

/**
 * In-process fixed-window counter.
 *
 * Read this before trusting a number: the counter lives in one process's memory,
 * so the limit is enforced per instance, not globally. On Vercel that means each
 * warm lambda has its own tally and a cold start begins at zero — with N
 * instances live the effective ceiling is roughly N x limit, and it moves with
 * traffic.
 *
 * That is still worth having. It stops one client looping on one instance, which
 * is the failure this was written for — a mobile screen that fired ~1950
 * requests at /auth/me in a few seconds would have been cut off after the first
 * hundred. What it cannot do is enforce a contractual quota or resist a spread
 * attack.
 *
 * Swap in a shared store (Upstash Redis, Vercel KV) behind the CounterStore
 * interface when the limit has to mean one number across the fleet. Nothing
 * above this line changes when that happens.
 */
export type MemoryStore = CounterStore & {
  /**
   * Live key count. Not part of CounterStore: "how many keys" is meaningless for
   * a shared backend. It exists so the sweep can be asserted — without it a test
   * cannot tell a swept map from an expired window, and a leak test that cannot
   * fail is worse than none.
   */
  size: () => number;
};

export const createMemoryStore = (): MemoryStore => {
  const windows = new Map<string, Window>();
  let lastSweep = 0;

  // Expired keys are dropped on the way past rather than on a timer, so an
  // idle process holds nothing and there is no interval to clean up in a
  // serverless runtime that may be frozen mid-tick.
  const sweep = (now: number) => {
    if (now - lastSweep < 60_000) {
      return;
    }
    lastSweep = now;
    for (const [key, window] of windows) {
      if (window.resetAt <= now) {
        windows.delete(key);
      }
    }
  };

  return {
    size: () => windows.size,

    hit: async (key, windowMs) => {
      const now = Date.now();
      sweep(now);

      const existing = windows.get(key);
      if (!existing || existing.resetAt <= now) {
        const fresh = { count: 1, resetAt: now + windowMs };
        windows.set(key, fresh);
        return { count: fresh.count, resetAt: fresh.resetAt };
      }

      existing.count += 1;
      return { count: existing.count, resetAt: existing.resetAt };
    },
  };
};
