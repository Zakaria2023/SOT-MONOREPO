import { describe, expect, it } from "vitest";
import { clientAddress, withinRateLimit } from "./index";

// A fresh key per test — the limiter is module state by design, so tests that
// shared a key would depend on their own order.
let counter = 0;
const key = () => `caller-${(counter += 1)}`;

describe("withinRateLimit", () => {
  it("allows exactly the limit, then refuses", () => {
    const caller = key();
    for (let n = 0; n < 5; n += 1) {
      expect(
        withinRateLimit(caller, { limit: 5, windowMs: 60_000 }).ok,
      ).toBe(true);
    }
    expect(withinRateLimit(caller, { limit: 5, windowMs: 60_000 }).ok).toBe(
      false,
    );
  });

  it("says how long to wait, so a 429 is actionable", () => {
    const caller = key();
    withinRateLimit(caller, { limit: 1, windowMs: 30_000 });
    const over = withinRateLimit(caller, { limit: 1, windowMs: 30_000 });
    expect(over.retryAfterSeconds).toBeGreaterThan(0);
    expect(over.retryAfterSeconds).toBeLessThanOrEqual(30);
  });

  it("never reports a zero wait while refusing", () => {
    // Rounding a sub-second remainder down would tell the caller to retry
    // immediately, which is the one answer a 429 must not give.
    const caller = key();
    const now = 1_000_000;
    withinRateLimit(caller, { limit: 1, windowMs: 100 }, now);
    const over = withinRateLimit(caller, { limit: 1, windowMs: 100 }, now + 50);
    expect(over.ok).toBe(false);
    expect(over.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("counts callers independently", () => {
    const a = key();
    const b = key();
    withinRateLimit(a, { limit: 1, windowMs: 60_000 });
    expect(withinRateLimit(a, { limit: 1, windowMs: 60_000 }).ok).toBe(false);
    expect(withinRateLimit(b, { limit: 1, windowMs: 60_000 }).ok).toBe(true);
  });

  it("reopens once the window has passed", () => {
    const caller = key();
    const now = 2_000_000;
    withinRateLimit(caller, { limit: 1, windowMs: 1_000 }, now);
    expect(
      withinRateLimit(caller, { limit: 1, windowMs: 1_000 }, now + 999).ok,
    ).toBe(false);
    expect(
      withinRateLimit(caller, { limit: 1, windowMs: 1_000 }, now + 1_001).ok,
    ).toBe(true);
  });

  it("does not extend the window on a refused request", () => {
    // A caller who keeps hammering must not push their own reset further out.
    const caller = key();
    const now = 3_000_000;
    withinRateLimit(caller, { limit: 1, windowMs: 1_000 }, now);
    withinRateLimit(caller, { limit: 1, windowMs: 1_000 }, now + 500);
    expect(
      withinRateLimit(caller, { limit: 1, windowMs: 1_000 }, now + 1_001).ok,
    ).toBe(true);
  });
});

describe("clientAddress", () => {
  it("takes the client from a proxy chain, not the last hop", () => {
    expect(clientAddress("5.5.5.5, 10.0.0.1, 10.0.0.2", null)).toBe("5.5.5.5");
  });

  it("gives one caller the same key however it is routed", () => {
    expect(clientAddress("5.5.5.5, 10.0.0.1", null)).toBe(
      clientAddress("5.5.5.5, 10.9.9.9", null),
    );
  });

  it("falls back to x-real-ip, then a constant", () => {
    expect(clientAddress(null, "8.8.8.8")).toBe("8.8.8.8");
    expect(clientAddress(null, null)).toBe("unknown");
  });
});
