import { createMemoryStore, type CounterStore } from "./store";
import { createUpstashStore } from "./upstash-store";

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the current window ends. */
  resetAt: number;
  /** Whole seconds until the window ends, for Retry-After. */
  retryAfter: number;
};

export type RateLimitOptions = {
  /** Requests permitted per window. */
  limit?: number;
  /** Window length in ms. */
  windowMs?: number;
  /** Namespace, so two different limits on one caller do not share a tally. */
  bucket?: string;
};

/** 100 requests a minute — comfortably above human use, far below a runaway loop. */
export const DEFAULT_LIMIT = 100;

export const DEFAULT_WINDOW_MS = 60_000;

/**
 * Shared Redis when it is configured, in-process otherwise.
 *
 * Chosen once at module load rather than per request: reading env on every hit
 * buys nothing, and the choice cannot change while the process lives.
 *
 * Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to make the limit
 * global. Without them the limiter still works and still stops a client looping
 * — it just counts per instance, so on Vercel the real ceiling is roughly
 * instances x limit. Enough for a runaway client, not enough for a quota.
 */
const selectStore = (): CounterStore => {
  const memory = createMemoryStore();
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return memory;
  }

  return createUpstashStore({ url, token, fallback: memory });
};

const store: CounterStore = selectStore();

/**
 * Counts one request against `identity` and says whether to serve it.
 *
 * `identity` should be the most specific stable thing available — a Clerk user
 * id when signed in, falling back to client IP. Prefer the user id: IP buckets
 * everyone behind one office NAT or mobile carrier gateway into a single tally,
 * so a shared limit punishes bystanders.
 */
export const checkRateLimit = async (
  identity: string,
  { limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW_MS, bucket = "default" }:
    RateLimitOptions = {},
): Promise<RateLimitDecision> => {
  const { count, resetAt } = await store.hit(`${bucket}:${identity}`, windowMs);

  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
    retryAfter: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
  };
};

/**
 * The headers that belong on every rate-limited response, not just rejected
 * ones — a client can only back off before being cut off if it is told how much
 * room is left while it still has some.
 */
export const rateLimitHeaders = (
  decision: RateLimitDecision,
): Record<string, string> => ({
  "RateLimit-Limit": String(decision.limit),
  "RateLimit-Remaining": String(decision.remaining),
  "RateLimit-Reset": String(decision.retryAfter),
});

/** The 429 to return when a decision comes back disallowed. */
export const rateLimitResponse = (decision: RateLimitDecision): Response =>
  Response.json(
    {
      error: "Too many requests. Please slow down and try again shortly.",
      retryAfter: decision.retryAfter,
    },
    {
      status: 429,
      headers: {
        ...rateLimitHeaders(decision),
        "Retry-After": String(decision.retryAfter),
      },
    },
  );

/**
 * Picks the identity to count against, given a request and an optional resolved
 * user id.
 *
 * The forwarded-for header is only trustworthy because Vercel overwrites it at
 * the edge; taken from an arbitrary origin it is caller-controlled and a limiter
 * keyed on it can be bypassed by anyone willing to send a different value.
 */
export const rateLimitIdentity = (
  request: Request,
  userId?: string | null,
): string => {
  if (userId) {
    return `user:${userId}`;
  }
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  return `ip:${ip || "unknown"}`;
};
