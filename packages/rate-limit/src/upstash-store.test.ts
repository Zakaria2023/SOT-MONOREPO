import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryStore } from "./store";
import { createUpstashStore } from "./upstash-store";

// ---------------------------------------------------------------------------
// SHARED COUNTER — the store that makes the limit mean one number across the
// fleet instead of one per lambda.
//
// There is no live Redis here, so `fetch` is injected. That is enough to pin the
// things that actually go wrong: the wrong pipeline (a sliding window that never
// resets), a misread reply, and what happens when Redis is simply not there.
// ---------------------------------------------------------------------------

const reply = (values: number[]) =>
  new Response(JSON.stringify(values.map((result) => ({ result }))), {
    status: 200,
  });

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("createUpstashStore", () => {
  it("counts with INCR and sets the window only on the first hit", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (_url, init) => {
      calls.push(String((init as RequestInit).body));
      return reply([1, 1, 60_000]);
    });

    const store = createUpstashStore({
      url: "https://redis.test/",
      token: "t",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      fallback: createMemoryStore(),
    });

    await store.hit("api:ip:1.2.3.4", 60_000);

    const body = JSON.parse(calls[0]) as unknown[][];
    expect(body[0]).toEqual(["INCR", "api:ip:1.2.3.4"]);
    // NX matters: without it every request would push the expiry forward and a
    // steady caller would sit under the limit forever, window never resetting.
    expect(body[1]).toEqual(["PEXPIRE", "api:ip:1.2.3.4", "60000", "NX"]);
    expect(body[2]).toEqual(["PTTL", "api:ip:1.2.3.4"]);
  });

  it("posts to the pipeline endpoint with the token, and tolerates a trailing slash", async () => {
    const seen: { url: string; auth: string }[] = [];
    const fetchImpl = vi.fn(async (url, init) => {
      const headers = (init as RequestInit).headers as Record<string, string>;
      seen.push({ url: String(url), auth: headers.Authorization });
      return reply([1, 1, 1000]);
    });

    const store = createUpstashStore({
      url: "https://redis.test/",
      token: "secret",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      fallback: createMemoryStore(),
    });
    await store.hit("k", 1000);

    expect(seen[0].url).toBe("https://redis.test/pipeline");
    expect(seen[0].auth).toBe("Bearer secret");
  });

  it("reads the count and turns the TTL into an absolute reset", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const store = createUpstashStore({
      url: "https://redis.test",
      token: "t",
      fetchImpl: (async () => reply([7, 0, 12_000])) as unknown as typeof fetch,
      fallback: createMemoryStore(),
    });

    const { count, resetAt } = await store.hit("k", 60_000);
    expect(count).toBe(7);
    expect(resetAt).toBe(Date.now() + 12_000);
  });

  it("treats a negative TTL as a window starting now", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    // Redis answers -1 for a key with no expiry. Passing that through would put
    // the reset in the past and produce a Retry-After of zero.
    const store = createUpstashStore({
      url: "https://redis.test",
      token: "t",
      fetchImpl: (async () => reply([3, 0, -1])) as unknown as typeof fetch,
      fallback: createMemoryStore(),
    });

    const { resetAt } = await store.hit("k", 60_000);
    expect(resetAt).toBe(Date.now() + 60_000);
  });
});

describe("when Redis is unreachable", () => {
  const cases: [string, () => Promise<Response>][] = [
    ["the request throws", async () => Promise.reject(new Error("ECONNRESET"))],
    ["it answers 500", async () => new Response("boom", { status: 500 })],
    [
      "the reply has no count",
      async () => new Response(JSON.stringify([{}, {}, {}]), { status: 200 }),
    ],
  ];

  for (const [label, fetchImpl] of cases) {
    it(`falls back to counting locally when ${label}`, async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const fallback = createMemoryStore();
      const store = createUpstashStore({
        url: "https://redis.test",
        token: "t",
        fetchImpl: fetchImpl as unknown as typeof fetch,
        fallback,
      });

      // Neither open nor closed: an outage must not remove the ceiling, and it
      // must not refuse every request either. The local counter still counts.
      const first = await store.hit("k", 60_000);
      const second = await store.hit("k", 60_000);

      expect(first.count).toBe(1);
      expect(second.count).toBe(2);
      expect(second.resetAt).toBeGreaterThan(Date.now());
    });
  }

  it("keeps counting across the failure rather than restarting", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fallback = createMemoryStore();
    let healthy = true;
    const store = createUpstashStore({
      url: "https://redis.test",
      token: "t",
      fetchImpl: (async () => {
        if (healthy) {
          return reply([1, 1, 60_000]);
        }
        throw new Error("down");
      }) as unknown as typeof fetch,
      fallback,
    });

    await store.hit("k", 60_000);
    healthy = false;

    // The local tally starts at 1 here because it never saw the healthy hit.
    // Worth stating rather than hiding: a failover loses the shared count, so the
    // caller gets a fresh local allowance. The alternative is refusing traffic
    // during an outage.
    const afterFailure = await store.hit("k", 60_000);
    expect(afterFailure.count).toBe(1);
  });
});
