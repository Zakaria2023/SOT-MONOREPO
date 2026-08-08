import { describe, expect, it } from "vitest";
import {
  availableDestinations,
  canSendTo,
  cartDestinations,
  type DestinationInput,
} from "./cart-destinations";

const input = (over: Partial<DestinationInput> = {}): DestinationInput => ({
  viewer: { isPartner: false, capabilities: [] },
  lineCount: 3,
  hasBlockers: false,
  hasUnpricedLines: false,
  ...over,
});

const partner = (...capabilities: DestinationInput["viewer"]["capabilities"]) => ({
  isPartner: true,
  capabilities,
});

const offer = (result: ReturnType<typeof cartDestinations>, name: string) =>
  result.find((entry) => entry.destination === name);

describe("a customer", () => {
  it("can check out and send a BOQ", () => {
    expect(availableDestinations(input()).sort()).toEqual(["boq", "order"]);
  });

  it("cannot quote — that is a partner acting for a client", () => {
    const quote = offer(cartDestinations(input()), "quote");
    expect(quote?.available).toBe(false);
    expect(quote?.reason).toContain("partners");
  });

  it("is offered Check out, not Buy this as stock", () => {
    expect(offer(cartDestinations(input()), "order")?.label).toBe("Check out");
  });
});

describe("a partner and the stock capability", () => {
  it("CANNOT buy stock without it", () => {
    // The rule that was missing entirely: `stock` means "may hold stock", it
    // prices their account, and nothing consulted it. A partner approved only to
    // install could place a stock order.
    const result = cartDestinations(
      input({ viewer: partner("install_only") }),
    );
    expect(offer(result, "order")?.available).toBe(false);
    expect(offer(result, "order")?.reason).toContain("may hold stock");
  });

  it("can once it is granted", () => {
    const result = cartDestinations(input({ viewer: partner("stock") }));
    expect(offer(result, "order")?.available).toBe(true);
  });

  it("names the capability rather than saying not allowed", () => {
    // "Not allowed" sends a partner to support. Naming it sends them to the
    // person who can grant it.
    const reason = offer(
      cartDestinations(input({ viewer: partner("pre_sell") })),
      "order",
    )?.reason;
    expect(reason).toContain("capability");
  });

  it("can always quote, whatever else they hold", () => {
    expect(
      offer(cartDestinations(input({ viewer: partner("install_only") })), "quote")
        ?.available,
    ).toBe(true);
  });
});

describe("a design the engine refuses", () => {
  it("stops the two destinations that commit money", () => {
    const result = cartDestinations(
      input({ viewer: partner("stock"), hasBlockers: true }),
    );
    expect(offer(result, "order")?.available).toBe(false);
    expect(offer(result, "boq")?.available).toBe(false);
  });

  it("does NOT stop a quote", () => {
    // A partner asking what something would cost is asking a question, and
    // refusing at the moment the answer is most useful is the wrong call.
    const result = cartDestinations(
      input({ viewer: partner("stock"), hasBlockers: true }),
    );
    expect(offer(result, "quote")?.available).toBe(true);
  });

  it("tells a BOQ sender it would come straight back", () => {
    const reason = offer(
      cartDestinations(input({ hasBlockers: true })),
      "boq",
    )?.reason;
    expect(reason).toContain("comes straight back");
  });
});

describe("unpriced lines", () => {
  it("stop an order but not a BOQ", () => {
    // A BOQ is a request for a price. An order is payment of one.
    const result = cartDestinations(input({ hasUnpricedLines: true }));
    expect(offer(result, "order")?.available).toBe(false);
    expect(offer(result, "boq")?.available).toBe(true);
  });

  it("point at the quote as the way forward", () => {
    expect(
      offer(cartDestinations(input({ hasUnpricedLines: true })), "order")?.reason,
    ).toContain("quote");
  });
});

describe("an empty basket", () => {
  it("closes everything, for one reason", () => {
    const result = cartDestinations(
      input({ lineCount: 0, viewer: partner("stock") }),
    );
    expect(result.every((entry) => !entry.available)).toBe(true);
    expect(new Set(result.map((entry) => entry.reason)).size).toBe(1);
  });
});

describe("canSendTo", () => {
  it("agrees with what the screen offered", () => {
    const shared = input({ viewer: partner("install_only") });
    expect(canSendTo("order", shared).allowed).toBe(false);
    expect(canSendTo("quote", shared).allowed).toBe(true);
  });

  it("refuses a destination that does not exist", () => {
    expect(canSendTo("elsewhere" as never, input()).allowed).toBe(false);
  });

  it("is the server's check, not the button's", () => {
    // A rule enforced only where the button is drawn is bypassed by anything
    // posting directly — the same reason the design gate lives inside order
    // creation rather than in the cart UI.
    const blocked = input({ viewer: partner("stock"), hasBlockers: true });
    expect(canSendTo("order", blocked).allowed).toBe(false);
    expect(canSendTo("order", blocked).reason).toBeTruthy();
  });
});
