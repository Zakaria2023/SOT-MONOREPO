// ---------------------------------------------------------------------------
// 6.2 — WHEN DOES THIS NEED TOUCHING AGAIN?
//
// The Space carries `installedAt`. The catalogue already carries the lives:
// `sys.service_life_years`, `sys.sensor_life_years` and `pwr.battery_life_years`
// have been in the specification library since it was built, and nothing has ever
// read them. Put together they answer the question that turns a sale into a
// relationship — a CO sensor rated ten years, fitted in 2026, is a scheduled
// callout in 2036, and until now nobody would have known.
//
// THREE CLOCKS, NOT ONE, AND THEY MEAN DIFFERENT THINGS.
//
//   service life  the whole unit's rated life. When it is up, the device is
//                 replaced.
//   sensor life   the SENSING ELEMENT's life. A CO sensor rated 10 years inside a
//                 panel rated 20 is the earlier callout, and the one that matters
//                 — a detector whose sensor has expired is a detector that does
//                 not detect, in a housing that looks perfectly fine.
//   battery life  routine, short, and the one a customer can often do themselves.
//
// Collapsing them into a single "replace by" date would lose exactly the
// distinction the customer is paying for.
//
// WARRANTY IS NOT ON THIS LIST. It is computed here, in the same file, and
// deliberately kept out of the schedule: warranty says when SOT stops paying, not
// when the equipment stops working. Mixing the two would let a screen tell
// somebody their detector is "due" when the only thing that expired was our
// obligation to fix it for free.
//
// UNKNOWN IS NEVER OK. An item with no install date, or a product whose life
// nobody recorded, comes back `unknown` with a sentence saying which is missing.
// Reporting it as fine would be the same failure this codebase keeps finding: a
// check that could not run, presented as a check that passed.
//
// Pure, and date arithmetic is done on the string parts rather than through
// `Date`. A ten-year replacement date computed by adding milliseconds crosses
// leap days and daylight saving, and a calendar date has no time zone to be
// shifted by.
// ---------------------------------------------------------------------------

export type ServiceClock = "service_life" | "sensor_life" | "battery_life";

export type DueStatus =
  // Past its date. Somebody should already have been.
  | "overdue"
  // Inside the notice window below.
  | "due_soon"
  // Dated, and not yet near.
  | "ok"
  // Could not be worked out. Never counted as ok.
  | "unknown";

export type LifeFacts = {
  serviceLifeYears: number | null;
  sensorLifeYears: number | null;
  batteryLifeYears: number | null;
};

export type ScheduleEntry = {
  clock: ServiceClock;
  label: string;
  // ISO calendar date, or null when it could not be worked out.
  dueOn: string | null;
  daysUntil: number | null;
  status: DueStatus;
  // What is due, or which fact was missing. Always something to read.
  reason: string;
};

// Ninety days. A callout is not a notification — somebody has to be scheduled, a
// part may have to be ordered and a site visit arranged with whoever holds the
// keys. A week's warning on a fire system is a week of nothing happening.
export const NOTICE_DAYS = 90;

const CLOCK_LABEL: Record<ServiceClock, string> = {
  service_life: "Replace the unit",
  sensor_life: "Replace the sensing element",
  battery_life: "Replace the battery",
};

const CLOCK_WHY: Record<ServiceClock, string> = {
  service_life: "its rated service life",
  sensor_life:
    "the life of its sensing element — the housing outlasts the sensor, and an expired sensor does not detect",
  battery_life: "its stated battery life",
};

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const isLeap = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const daysInMonth = (year: number, month: number): number =>
  month === 2 && isLeap(year) ? 29 : DAYS_IN_MONTH[month - 1];

type CalendarDate = { year: number; month: number; day: number };

/** Read an ISO calendar date. Null for anything that is not one. */
export const parseDate = (raw: string | null): CalendarDate | null => {
  if (raw === null) {
    return null;
  }
  const match = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  return { year, month, day };
};

const format = ({ year, month, day }: CalendarDate): string =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/**
 * Add whole months to a calendar date, clamping the day.
 *
 * The clamp is the interesting part: 31 January plus one month is 28 February,
 * not 3 March. Rolling over would quietly move a warranty expiry past the end of
 * the month it belongs in.
 */
export const addMonths = (
  date: CalendarDate,
  months: number,
): CalendarDate => {
  const total = date.year * 12 + (date.month - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
};

// Days between two calendar dates, via day counts rather than milliseconds. No
// clock, so no daylight saving and no time zone.
const toDayNumber = ({ year, month, day }: CalendarDate): number => {
  let days = day;
  for (let m = 1; m < month; m += 1) {
    days += daysInMonth(year, m);
  }
  for (let y = 1970; y < year; y += 1) {
    days += isLeap(y) ? 366 : 365;
  }
  return days;
};

export const daysBetween = (from: CalendarDate, to: CalendarDate): number =>
  toDayNumber(to) - toDayNumber(from);

const statusFor = (days: number): DueStatus =>
  days < 0 ? "overdue" : days <= NOTICE_DAYS ? "due_soon" : "ok";

const entryFor = (
  clock: ServiceClock,
  years: number | null,
  installed: CalendarDate | null,
  today: CalendarDate,
  hasInstallDate: boolean,
): ScheduleEntry => {
  const base: Omit<ScheduleEntry, "dueOn" | "daysUntil" | "status" | "reason"> =
    { clock, label: CLOCK_LABEL[clock] };

  if (years === null || !Number.isFinite(years) || years <= 0) {
    return {
      ...base,
      dueOn: null,
      daysUntil: null,
      status: "unknown",
      reason: `Nobody has recorded ${CLOCK_WHY[clock].split(" — ")[0]} for this product, so no date can be worked out.`,
    };
  }

  if (!installed) {
    return {
      ...base,
      dueOn: null,
      daysUntil: null,
      status: "unknown",
      reason: hasInstallDate
        ? "The recorded install date could not be read, so no date can be worked out."
        : `Rated for ${years} years, but nobody recorded when it was installed — so there is nothing to count from.`,
    };
  }

  // Whole years only. A life stated as 10.5 is rounded down rather than
  // interpolated: the honest reading of a rated life is the point at which it is
  // no longer guaranteed, and rounding up would push a callout past it.
  const due = addMonths(installed, Math.floor(years) * 12);
  const daysUntil = daysBetween(today, due);
  const status = statusFor(daysUntil);

  return {
    ...base,
    dueOn: format(due),
    daysUntil,
    status,
    reason:
      status === "overdue"
        ? `Past ${CLOCK_WHY[clock]}. Due ${format(due)}.`
        : `Reaches ${CLOCK_WHY[clock]} on ${format(due)}.`,
  };
};

export type ScheduleInput = {
  // The item's install date, as an ISO calendar date.
  installedAt: string | null;
  life: LifeFacts;
  // Passed in rather than read from the clock, so this stays pure and testable.
  today: string;
};

/**
 * Every clock that applies to one item.
 *
 * A clock with no life value on the product is still returned, as `unknown`.
 * Dropping it would make a product nobody has filled in look like a product with
 * nothing due.
 */
export const buildSchedule = ({
  installedAt,
  life,
  today,
}: ScheduleInput): ScheduleEntry[] => {
  const installed = parseDate(installedAt);
  const now = parseDate(today);
  if (!now) {
    throw new Error(`"${today}" is not a calendar date.`);
  }

  return [
    entryFor("service_life", life.serviceLifeYears, installed, now, installedAt !== null),
    entryFor("sensor_life", life.sensorLifeYears, installed, now, installedAt !== null),
    entryFor("battery_life", life.batteryLifeYears, installed, now, installedAt !== null),
  ];
};

/**
 * The one that matters — the earliest real date.
 *
 * `unknown` entries are excluded from the comparison but NOT from the caller's
 * attention: an item whose every clock is unknown returns null here, and a screen
 * showing null as "nothing due" would be repeating the mistake this file exists to
 * avoid. Callers ask `hasUnknown` as well.
 */
export const earliestDue = (
  entries: ScheduleEntry[],
): ScheduleEntry | null => {
  const dated = entries.filter((entry) => entry.daysUntil !== null);
  if (dated.length === 0) {
    return null;
  }
  return dated.reduce((earliest, entry) =>
    (entry.daysUntil ?? 0) < (earliest.daysUntil ?? 0) ? entry : earliest,
  );
};

export const hasUnknown = (entries: ScheduleEntry[]): boolean =>
  entries.some((entry) => entry.status === "unknown");

export type WarrantyState = {
  endsOn: string | null;
  daysRemaining: number | null;
  active: boolean;
  reason: string;
};

/**
 * When SOT's obligation ends.
 *
 * Counted from the INSTALL date rather than the order date, and that is a choice
 * worth naming. It is more generous — an order can sit for weeks before a partner
 * is on site — and it is the date the customer can point at: they were there when
 * it was fitted, and they have the handover pack that says so. A warranty a buyer
 * cannot work out the start of is a warranty they will argue about.
 *
 * Never merged into the service schedule. "Out of warranty" and "due for
 * replacement" are different facts, and a device is very often the first without
 * being anywhere near the second.
 */
export const warrantyState = ({
  installedAt,
  warrantyMonths,
  today,
}: {
  installedAt: string | null;
  warrantyMonths: number | null;
  today: string;
}): WarrantyState => {
  const now = parseDate(today);
  if (!now) {
    throw new Error(`"${today}" is not a calendar date.`);
  }

  if (warrantyMonths === null || !Number.isFinite(warrantyMonths) || warrantyMonths <= 0) {
    return {
      endsOn: null,
      daysRemaining: null,
      active: false,
      reason: "No warranty period is recorded for this product.",
    };
  }

  const installed = parseDate(installedAt);
  if (!installed) {
    return {
      endsOn: null,
      daysRemaining: null,
      // NOT active. A warranty that cannot be dated cannot be claimed on, and
      // showing it as in force would promise something nobody could honour.
      active: false,
      reason: `Covered for ${warrantyMonths} months, but nobody recorded when it was installed — so the cover cannot be dated.`,
    };
  }

  const endsOn = addMonths(installed, Math.floor(warrantyMonths));
  const daysRemaining = daysBetween(now, endsOn);

  return {
    endsOn: format(endsOn),
    daysRemaining,
    active: daysRemaining >= 0,
    reason:
      daysRemaining >= 0
        ? `Under warranty until ${format(endsOn)}.`
        : `Warranty ended ${format(endsOn)}.`,
  };
};
