import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LIMIT,
  DEFAULT_WINDOW_MS,
  checkRateLimit,
  rateLimitHeaders,
  rateLimitIdentity,
  rateLimitResponse,
} from "./limiter";
import { createMemoryStore } from "./store";

// ---------------------------------------------------------------------------
// RATE LIMITING — the ceiling that has to hold under a burst, because a burst is
// the only thing it was written for. A client that loops does not ramp up
// politely; it arrives all at once. Every case below is either "does the wall
// exist" or "does the wall stand in the place we think it does".
//
// `checkRateLimit` shares one process-wide counter, so each test uses its own
// identity rather than resetting global state — which is also how the real thing
// keeps two callers apart.
// ---------------------------------------------------------------------------

let seq = 0;
const identity = (label: string) => `${label}-${++seq}`;

const drain = async (id: string, times: number) => {
  const results = [];
  for (let i = 0; i < times; i += 1) {
    results.push(await checkRateLimit(id));
  }
  return results;
};

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows exactly the limit and refuses the next one", async () => {
    const id = identity("exact");

    const allowed = await drain(id, DEFAULT_LIMIT);
    expect(allowed.every((d) => d.allowed)).toBe(true);

    const overflow = await checkRateLimit(id);
    expect(overflow.allowed).toBe(false);
  });

  it("counts remaining down and floors it at zero rather than going negative", async () => {
    const id = identity("remaining");

    const first = await checkRateLimit(id, { limit: 3 });
    expect(first.remaining).toBe(2);

    await checkRateLimit(id, { limit: 3 });
    await checkRateLimit(id, { limit: 3 });

    // Two past the ceiling. A negative remaining would be sent to clients in a
    // RateLimit-Remaining header, where it means nothing.
    const over = await checkRateLimit(id, { limit: 3 });
    const wellOver = await checkRateLimit(id, { limit: 3 });
    expect(over.remaining).toBe(0);
    expect(wellOver.remaining).toBe(0);
    expect(wellOver.allowed).toBe(false);
  });

  it("gives each identity its own budget", async () => {
    const mine = identity("mine");
    const yours = identity("yours");

    await drain(mine, 5);
    const exhausted = await checkRateLimit(mine, { limit: 5 });
    expect(exhausted.allowed).toBe(false);

    // Someone else spending their allowance must not spend mine — the whole
    // point of keying on a caller.
    const untouched = await checkRateLimit(yours, { limit: 5 });
    expect(untouched.allowed).toBe(true);
    expect(untouched.remaining).toBe(4);
  });

  it("keeps separate buckets separate for the same caller", async () => {
    const id = identity("buckets");

    await drain(id, 2);
    const sameBucket = await checkRateLimit(id, { limit: 2 });
    expect(sameBucket.allowed).toBe(false);

    // A second limit on the same person is a different question; sharing the
    // tally would let a cheap endpoint lock someone out of an expensive one.
    const other = await checkRateLimit(id, { limit: 2, bucket: "other" });
    expect(other.allowed).toBe(true);
  });

  it("counts concurrent hits without losing any", async () => {
    const id = identity("concurrent");

    // The failure this guards: two requests both read 99, both write 100, and
    // 101 got through. Sequential tests never catch it.
    const decisions = await Promise.all(
      Array.from({ length: 120 }, () => checkRateLimit(id)),
    );

    expect(decisions.filter((d) => d.allowed)).toHaveLength(DEFAULT_LIMIT);
    expect(decisions.filter((d) => !d.allowed)).toHaveLength(
      120 - DEFAULT_LIMIT,
    );
  });

  it("reports a retry-after inside the window, never zero", async () => {
    const id = identity("retry");
    const decision = await checkRateLimit(id, { limit: 1 });

    expect(decision.retryAfter).toBeGreaterThan(0);
    expect(decision.retryAfter).toBeLessThanOrEqual(DEFAULT_WINDOW_MS / 1000);
  });
});

describe("window expiry", () => {
  it("hands the budget back once the window passes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const id = identity("expiry");
    await drain(id, 3);
    expect((await checkRateLimit(id, { limit: 3 })).allowed).toBe(false);

    // One second past the window. A fixed window forgives all at once, which is
    // the known trade: a caller can spend the ceiling either side of the
    // boundary and briefly push through twice the rate.
    vi.setSystemTime(Date.now() + DEFAULT_WINDOW_MS + 1000);

    const afterReset = await checkRateLimit(id, { limit: 3 });
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(2);
  });
});

describe("createMemoryStore", () => {
  it("starts a fresh window instead of resurrecting an expired one", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const store = createMemoryStore();
    const first = await store.hit("k", 1000);
    expect(first.count).toBe(1);

    const second = await store.hit("k", 1000);
    expect(second.count).toBe(2);
    expect(second.resetAt).toBe(first.resetAt);

    vi.setSystemTime(Date.now() + 1001);
    const afterExpiry = await store.hit("k", 1000);
    expect(afterExpiry.count).toBe(1);
    expect(afterExpiry.resetAt).toBeGreaterThan(first.resetAt);
  });

  it("drops keys for callers that have gone away", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const store = createMemoryStore();
    for (let i = 0; i < 500; i += 1) {
      await store.hit(`visitor-${i}`, 1000);
    }
    expect(store.size()).toBe(500);

    // Asserting the map shrinks, not that a counter restarts. An expired window
    // restarts the count whether or not the key was ever removed, so the obvious
    // version of this test passes with the sweep deleted — it did, until this one
    // replaced it. Without a working sweep an instance holds a key per caller
    // forever.
    vi.setSystemTime(Date.now() + 61_000);
    await store.hit("newcomer", 1000);

    expect(store.size()).toBe(1);
  });
});

describe("rateLimitResponse", () => {
  it("is a 429 carrying Retry-After and a readable body", async () => {
    const id = identity("response");
    await checkRateLimit(id, { limit: 1 });
    const decision = await checkRateLimit(id, { limit: 1 });

    const response = rateLimitResponse(decision);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe(
      String(decision.retryAfter),
    );
    expect(response.headers.get("RateLimit-Remaining")).toBe("0");

    const body = (await response.json()) as {
      error: string;
      retryAfter: number;
    };
    expect(body).toMatchObject({ retryAfter: decision.retryAfter });
    expect(typeof body.error).toBe("string");
  });

  it("advertises the allowance on allowed responses too", async () => {
    const decision = await checkRateLimit(identity("headers"), { limit: 10 });
    const headers = rateLimitHeaders(decision);

    // Sent while the caller still has room, because that is the only point at
    // which it can choose to slow down.
    expect(headers["RateLimit-Limit"]).toBe("10");
    expect(headers["RateLimit-Remaining"]).toBe("9");
  });
});

describe("rateLimitIdentity", () => {
  const request = (headers: Record<string, string> = {}) =>
    new Request("https://example.test/api/v1/products", { headers });

  it("prefers a verified user id over the network address", () => {
    expect(
      rateLimitIdentity(request({ "x-forwarded-for": "1.2.3.4" }), "user_abc"),
    ).toBe("user:user_abc");
  });

  it("takes the client from the front of x-forwarded-for", () => {
    // The chain is client, then each proxy. Reading the last entry would key
    // every request on our own edge and give the whole internet one budget.
    expect(
      rateLimitIdentity(
        request({ "x-forwarded-for": "203.0.113.9, 70.41.3.18, 10.0.0.1" }),
      ),
    ).toBe("ip:203.0.113.9");
  });

  it("falls back to a named unknown rather than an empty key", () => {
    expect(rateLimitIdentity(request())).toBe("ip:unknown");
    expect(rateLimitIdentity(request({ "x-forwarded-for": "" }))).toBe(
      "ip:unknown",
    );
  });

  it("treats a missing user id the same as none", () => {
    expect(rateLimitIdentity(request({ "x-forwarded-for": "9.9.9.9" }), null)).toBe(
      "ip:9.9.9.9",
    );
  });
});
