import type { CounterStore } from "./store";

type Fetcher = typeof fetch;

export type UpstashStoreOptions = {
  url: string;
  token: string;
  /** Injectable so the pipeline can be tested without a live Redis. */
  fetchImpl?: Fetcher;
  /**
   * Where to count when Redis cannot be reached. Passing the in-process store
   * keeps a ceiling in place during an outage instead of removing it.
   */
  fallback: CounterStore;
};

type PipelineResult = { result: number }[];

/**
 * Fixed-window counter in Upstash Redis, over its REST API.
 *
 * REST rather than a TCP client because this runs in middleware, on the edge
 * runtime, where raw sockets are not available.
 *
 * The point of it is that the in-process store cannot enforce a real limit: each
 * lambda keeps its own tally and a cold start begins at zero, so the effective
 * ceiling is roughly instances x limit and it drifts with traffic. One shared
 * counter makes the number mean what it says.
 */
export const createUpstashStore = ({
  url,
  token,
  fetchImpl = fetch,
  fallback,
}: UpstashStoreOptions): CounterStore => {
  const endpoint = `${url.replace(/\/$/, "")}/pipeline`;

  return {
    hit: async (key, windowMs) => {
      try {
        // One round trip, and INCR is atomic — two concurrent requests cannot
        // both read the same count. PEXPIRE with NX sets the window only on the
        // first hit, so the window does not slide forward on every request and
        // let a steady caller stay permanently just under the limit.
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify([
            ["INCR", key],
            ["PEXPIRE", key, String(windowMs), "NX"],
            ["PTTL", key],
          ]),
        });

        if (!response.ok) {
          throw new Error(`Upstash responded ${response.status}`);
        }

        const [incr, , pttl] = (await response.json()) as PipelineResult;
        const count = Number(incr?.result ?? 0);
        const ttl = Number(pttl?.result ?? windowMs);

        if (!Number.isFinite(count) || count < 1) {
          throw new Error("Upstash returned no count");
        }

        return {
          count,
          // A negative TTL means no expiry was recorded; treat the window as
          // starting now rather than reporting a reset in the past.
          resetAt: Date.now() + (ttl > 0 ? ttl : windowMs),
        };
      } catch (error) {
        // Falls back rather than failing open. Letting every request through
        // while Redis is unreachable turns a cache outage into an open door, and
        // refusing every request turns it into an outage of our own. The local
        // counter is weaker but it is still a ceiling.
        console.error("Rate limit store unavailable, counting locally:", error);
        return fallback.hit(key, windowMs);
      }
    },
  };
};
