import { readBody, tooManyRequests } from "@/lib/helpers";
import { NextResponse } from "next/server";
import { checkDesign, type SelectionInput } from "services";
import { clientAddress, withinRateLimit } from "utils";
import { projectAnswersSchema } from "validators";

/**
 * Run the design check over a selection — requires-companion gaps and
 * compatibility conflicts, split into blockers and warnings.
 *
 * The mobile cart had no gate at all before this: a buyer could order a design
 * whose PoE draw exceeded the switch, while the same basket was blocked on the
 * web. Same service function behind both, so the two can't disagree.
 *
 * No auth: the check reads the catalog and the rules, never the caller's data,
 * and a guest building a basket needs the same warnings a signed-in user gets.
 * It is rate limited instead — this is the one endpoint where an unauthenticated
 * caller can make the server do real work, and the connection pool is shared
 * with every other app.
 */
export const POST = async (request: Request) => {
  // Generous for a cart that re-checks on every quantity change, tight enough
  // that a loop cannot monopolise the pool.
  const caller = clientAddress(
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
  );
  const limit = withinRateLimit(caller, { limit: 60, windowMs: 60_000 });
  if (!limit.ok) {
    return tooManyRequests(limit.retryAfterSeconds);
  }

  const body = await readBody(request);

  if (!body || typeof body !== "object" || !("selection" in body)) {
    return NextResponse.json(
      { error: "Expected a `selection` array of { productUuid, quantity }" },
      { status: 400 },
    );
  }

  const raw = (body as { selection: unknown }).selection;
  if (!Array.isArray(raw)) {
    return NextResponse.json(
      { error: "`selection` must be an array" },
      { status: 400 },
    );
  }

  // Drop anything malformed rather than failing the whole basket — a design
  // check is advisory, and a bad line should not cost the buyer the warnings
  // about the good ones.
  const selection: SelectionInput[] = raw.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) {
      return [];
    }
    const { productUuid, quantity } = entry as Record<string, unknown>;
    if (typeof productUuid !== "string" || productUuid.length === 0) {
      return [];
    }
    const count = Number(quantity);
    if (!Number.isFinite(count) || count <= 0) {
      return [];
    }
    return [{ productUuid, quantity: Math.floor(count) }];
  });

  // Buyer answers to the project questions a previous check asked for. Strict
  // here, unlike the web form's hidden field: that one is our own JSON and
  // dropping it silently is better than costing the buyer their checkout, while a
  // body an app composed by hand is a bug worth reporting — and an answer quietly
  // ignored turns into a check that reports "we could not run this" forever.
  const answers = projectAnswersSchema.safeParse(
    (body as { variables?: unknown }).variables ?? {},
  );
  if (!answers.success) {
    return NextResponse.json(
      {
        error:
          "`variables` must map a project question's uuid to a number or a boolean",
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    await checkDesign({ selection, variables: answers.data }),
  );
};
