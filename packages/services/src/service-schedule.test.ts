import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildSchedule,
  daysBetween,
  earliestDue,
  hasUnknown,
  parseDate,
  warrantyState,
  NOTICE_DAYS,
} from "./service-schedule";

const life = {
  serviceLifeYears: null,
  sensorLifeYears: null,
  batteryLifeYears: null,
};

const on = (clock: string, entries: ReturnType<typeof buildSchedule>) => {
  const entry = entries.find((item) => item.clock === clock);
  if (!entry) {
    throw new Error(`no ${clock} entry`);
  }
  return entry;
};

describe("calendar arithmetic", () => {
  it("reads an ISO date and refuses anything else", () => {
    expect(parseDate("2026-08-08")).toEqual({ year: 2026, month: 8, day: 8 });
    for (const raw of [null, "", "08/08/2026", "2026-13-01", "2026-02-30"]) {
      expect(parseDate(raw), String(raw)).toBeNull();
    }
  });

  it("accepts 29 February in a leap year and rejects it otherwise", () => {
    expect(parseDate("2028-02-29")).not.toBeNull();
    expect(parseDate("2027-02-29")).toBeNull();
  });

  it("clamps the day rather than rolling into the next month", () => {
    // 31 January plus one month is 28 February, not 3 March. Rolling over would
    // move a warranty expiry past the end of the month it belongs in.
    expect(addMonths({ year: 2026, month: 1, day: 31 }, 1)).toEqual({
      year: 2026,
      month: 2,
      day: 28,
    });
    // And into a leap February.
    expect(addMonths({ year: 2028, month: 1, day: 31 }, 1)).toEqual({
      year: 2028,
      month: 2,
      day: 29,
    });
  });

  it("counts days across leap years", () => {
    // 2026-01-01 to 2036-01-01 spans 2028 and 2032, so it is 3652 days rather
    // than 3650. 2036's own leap day falls after the end date and must not be
    // counted — which is the whole reason this is done by day count and not by
    // multiplying years.
    expect(
      daysBetween({ year: 2026, month: 1, day: 1 }, { year: 2036, month: 1, day: 1 }),
    ).toBe(3652);
    // One day later picks up 2036's.
    expect(
      daysBetween({ year: 2026, month: 1, day: 1 }, { year: 2036, month: 3, day: 1 }),
    ).toBe(3652 + 60);
  });
});

describe("the three clocks", () => {
  it("dates a ten-year sensor from its install", () => {
    // The spec's own example: a CO sensor rated 10 years is a scheduled callout.
    const entries = buildSchedule({
      installedAt: "2026-08-08",
      life: { ...life, sensorLifeYears: 10 },
      today: "2026-08-08",
    });
    expect(on("sensor_life", entries).dueOn).toBe("2036-08-08");
    expect(on("sensor_life", entries).status).toBe("ok");
  });

  it("keeps the sensor and the unit apart", () => {
    // A sensor rated 10 inside a panel rated 20 is the earlier callout, and the
    // one that matters — an expired sensor does not detect, in a housing that
    // looks fine.
    const entries = buildSchedule({
      installedAt: "2026-01-01",
      life: { ...life, sensorLifeYears: 10, serviceLifeYears: 20 },
      today: "2026-01-01",
    });
    expect(on("sensor_life", entries).dueOn).toBe("2036-01-01");
    expect(on("service_life", entries).dueOn).toBe("2046-01-01");
    expect(earliestDue(entries)?.clock).toBe("sensor_life");
  });

  it("marks a passed date overdue", () => {
    const entries = buildSchedule({
      installedAt: "2010-01-01",
      life: { ...life, sensorLifeYears: 10 },
      today: "2026-08-08",
    });
    expect(on("sensor_life", entries).status).toBe("overdue");
    expect(on("sensor_life", entries).daysUntil).toBeLessThan(0);
    expect(on("sensor_life", entries).reason).toContain("Past");
  });

  it("warns inside the notice window and not before", () => {
    // Ninety days, because a callout needs scheduling, possibly a part ordered,
    // and access arranged.
    const due = buildSchedule({
      installedAt: "2016-08-08",
      life: { ...life, sensorLifeYears: 10 },
      today: "2026-06-01",
    });
    expect(on("sensor_life", due).daysUntil).toBeLessThanOrEqual(NOTICE_DAYS);
    expect(on("sensor_life", due).status).toBe("due_soon");

    const notYet = buildSchedule({
      installedAt: "2016-08-08",
      life: { ...life, sensorLifeYears: 10 },
      today: "2026-01-01",
    });
    expect(on("sensor_life", notYet).status).toBe("ok");
  });

  it("rounds a fractional life down", () => {
    // The honest reading of a rated life is when it is no longer guaranteed, and
    // rounding up pushes the callout past that point.
    const entries = buildSchedule({
      installedAt: "2026-01-01",
      life: { ...life, serviceLifeYears: 10.9 },
      today: "2026-01-01",
    });
    expect(on("service_life", entries).dueOn).toBe("2036-01-01");
  });
});

describe("what it will not pretend to know", () => {
  it("is unknown, not ok, when the product has no life recorded", () => {
    const entries = buildSchedule({
      installedAt: "2026-01-01",
      life,
      today: "2026-01-01",
    });
    for (const entry of entries) {
      expect(entry.status, entry.clock).toBe("unknown");
      expect(entry.dueOn, entry.clock).toBeNull();
    }
    expect(hasUnknown(entries)).toBe(true);
  });

  it("is unknown, not ok, when nobody recorded the install date", () => {
    const entries = buildSchedule({
      installedAt: null,
      life: { ...life, sensorLifeYears: 10 },
      today: "2026-01-01",
    });
    expect(on("sensor_life", entries).status).toBe("unknown");
    // And says which half is missing, so somebody can fix it.
    expect(on("sensor_life", entries).reason).toContain("installed");
    expect(on("sensor_life", entries).reason).toContain("10 years");
  });

  it("distinguishes an unreadable install date from an absent one", () => {
    const entries = buildSchedule({
      installedAt: "not a date",
      life: { ...life, sensorLifeYears: 10 },
      today: "2026-01-01",
    });
    expect(on("sensor_life", entries).reason).toContain("could not be read");
  });

  it("returns a clock with nothing recorded rather than dropping it", () => {
    // Dropping it would make a product nobody filled in look like a product with
    // nothing due.
    const entries = buildSchedule({
      installedAt: "2026-01-01",
      life: { ...life, sensorLifeYears: 10 },
      today: "2026-01-01",
    });
    expect(entries).toHaveLength(3);
  });

  it("has no earliest date when every clock is unknown", () => {
    const entries = buildSchedule({
      installedAt: null,
      life,
      today: "2026-01-01",
    });
    expect(earliestDue(entries)).toBeNull();
    expect(hasUnknown(entries)).toBe(true);
  });

  it("ignores a zero or negative life rather than dating it today", () => {
    for (const years of [0, -5]) {
      const entries = buildSchedule({
        installedAt: "2026-01-01",
        life: { ...life, serviceLifeYears: years },
        today: "2026-01-01",
      });
      expect(on("service_life", entries).status, `${years}`).toBe("unknown");
    }
  });
});

describe("warranty, which is a different question", () => {
  it("runs from the install date", () => {
    const state = warrantyState({
      installedAt: "2026-08-08",
      warrantyMonths: 24,
      today: "2026-08-08",
    });
    expect(state.endsOn).toBe("2028-08-08");
    expect(state.active).toBe(true);
  });

  it("expires", () => {
    const state = warrantyState({
      installedAt: "2020-01-01",
      warrantyMonths: 24,
      today: "2026-08-08",
    });
    expect(state.active).toBe(false);
    expect(state.reason).toContain("ended");
  });

  it("is not active when it cannot be dated", () => {
    // A warranty nobody can date cannot be claimed on, and showing it in force
    // would promise something nobody could honour.
    const state = warrantyState({
      installedAt: null,
      warrantyMonths: 24,
      today: "2026-08-08",
    });
    expect(state.active).toBe(false);
    expect(state.endsOn).toBeNull();
    expect(state.reason).toContain("cannot be dated");
  });

  it("stays out of the service schedule entirely", () => {
    // Out of warranty and due for replacement are different facts, and a device
    // is very often the first without being near the second.
    const entries = buildSchedule({
      installedAt: "2020-01-01",
      life: { ...life, serviceLifeYears: 20 },
      today: "2026-08-08",
    });
    expect(entries.map((entry) => entry.clock)).not.toContain("warranty");
    expect(on("service_life", entries).status).toBe("ok");
  });
});
