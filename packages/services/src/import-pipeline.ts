import type { ImportIssueStatus, ImportIssueType } from "../../../db/enum";
import type { ImportPayload, ImportProposal } from "../../../db/schema/imports";
import type { ProductValue, ProductValues, SpecRange } from "../../../db/types";
import { resolveAttributeByText, resolveOptionByText } from "./library-options";
import { convert, type AttributeMeta } from "./spec-values";

// THE DRY RUN — one source product in, a draft and a list of questions out.
//
// The single rule this file exists to keep: IT NEVER INVENTS. Every value it
// cannot resolve with certainty becomes an issue for a human, and a value it is
// unsure about is worth less than no value at all — a wrong number reads as
// entered and is invisible to the engine, while an empty one is visible to the
// completeness check.
//
// Pure on purpose. No database, no writes, no clock: given the same row and the
// same targets it returns the same draft, which is what lets the K.4 defect list
// serve as the test suite before a single real datasheet exists.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One label/value pair as harvested — "Ingress protection" / "IP66, IK08". */
export type SourceField = {
  label: string;
  text: string;
};

/** One source product, parsed as far as the extractor could take it. */
export type SourceRow = {
  // The vendor's own handle — a URL or page id. Never the slug: brands reuse one
  // slug across a variant family, and a slug-keyed import overwrites in silence.
  sourceRef: string;
  name?: string;
  model?: string;
  fields: SourceField[];
};

/**
 * An attribute this category will accept, with the switches that govern it.
 *
 * The category's slice is carried here because "not a value at all" and "not a
 * value HERE" are different questions with different answers: the first may
 * warrant a controlled-add to the master list, the second means either the
 * product is filed in the wrong category or the slice is too tight. Collapsing
 * them would hide the second behind the first.
 */
export type ImportTarget = {
  meta: AttributeMeta;
  key: string;
  labelAliases?: string[] | null;
  enabledValues?: string[] | null;
};

/** An issue as the pipeline emits it, before it has a row to belong to. */
export type DraftIssue = {
  type: ImportIssueType;
  groupKey: string;
  specificationUuid?: string;
  sourceText: string;
  proposedValue?: ImportProposal;
};

export type ParsedRow = {
  name?: string;
  model?: string;
  specValues: Record<string, ProductValue>;
  issues: DraftIssue[];
};

// ---------------------------------------------------------------------------
// Source units
// ---------------------------------------------------------------------------

/**
 * How a SOURCE spells a quantity, and what it is in the unit we store.
 *
 * Deliberately NOT in UNIT_DIMENSIONS. That table governs whether two STORED
 * values may be compared, and the catalogue stores metric only — the engine
 * should never learn that feet exist. Imperial is a fact about vendor documents,
 * so it is converted on the way in and never seen again.
 *
 * Temperature carries an offset, not a factor, which is why this is a function
 * per unit rather than a number: (°F − 32) × 5/9. A factor-only table would turn
 * 32 °F into 17.8 °C and nothing would look wrong.
 */
export const SOURCE_UNITS: Record<
  string,
  { unit: string; toCanonical: (value: number) => number }
> = {
  ft: { unit: "m", toCanonical: (v) => v * 0.3048 },
  feet: { unit: "m", toCanonical: (v) => v * 0.3048 },
  in: { unit: "mm", toCanonical: (v) => v * 25.4 },
  inch: { unit: "mm", toCanonical: (v) => v * 25.4 },
  inches: { unit: "mm", toCanonical: (v) => v * 25.4 },
  oz: { unit: "g", toCanonical: (v) => v * 28.349523125 },
  lb: { unit: "g", toCanonical: (v) => v * 453.59237 },
  lbs: { unit: "g", toCanonical: (v) => v * 453.59237 },
  "°f": { unit: "°C", toCanonical: (v) => ((v - 32) * 5) / 9 },
  f: { unit: "°C", toCanonical: (v) => ((v - 32) * 5) / 9 },
};

/** Spellings of a unit we already store, normalised to its canonical form. */
export const UNIT_SPELLINGS: Record<string, string> = {
  w: "W",
  watt: "W",
  watts: "W",
  v: "V",
  volt: "V",
  volts: "V",
  a: "A",
  ma: "mA",
  mah: "mAh",
  ah: "Ah",
  m: "m",
  metre: "m",
  metres: "m",
  meter: "m",
  meters: "m",
  mm: "mm",
  cm: "cm",
  km: "km",
  g: "g",
  kg: "kg",
  "°c": "°C",
  c: "°C",
  hz: "Hz",
  mhz: "MHz",
  ghz: "GHz",
  mbps: "Mbps",
  gbps: "Gbps",
  mb: "MB",
  gb: "GB",
  tb: "TB",
};

// ---------------------------------------------------------------------------
// Reading a quantity out of source text
// ---------------------------------------------------------------------------

export type Quantity = {
  value: number;
  // Null when the source stated a bare number. Not an error — plenty of
  // attributes are counts.
  unit: string | null;
};

const NUMBER = String.raw`[-−+]?\d[\d,  ]*(?:\.\d+)?`;
// A span, in any of the spellings vendors actually use.
const RANGE_SEPARATOR = String.raw`\s*(?:\.\.\.|\.\.|–|—|to|-)\s*`;
// A trailing unit — `W`, `°C`, `mm`.
//
// It has to refuse the separator spellings. Left as `[^\s\d]+`, the first
// number's unit group swallows `to` in `60 to -20 °C`, which leaves the bare `-`
// acting as the separator and `20` as the second number: the span reads 20..60
// instead of −20..60. A sub-zero operating range silently becomes a warm one,
// every comparison against it still returns a number, and nothing errors.
const UNIT_TOKEN = String.raw`(?!to\b)[^\s\d,;–—-]+`;

const toNumber = (raw: string): number | null => {
  // Thousands separators vary (comma, space, non-breaking space) and the unicode
  // minus is not the ASCII one. Normalise before Number() rather than after: a
  // stray separator makes Number() return NaN, which is indistinguishable from
  // "there was no number here".
  const cleaned = raw
    .replace(/[,  ]/g, "")
    .replace(/[−]/g, "-")
    .trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeUnit = (raw: string | undefined): string | null => {
  const token = raw?.trim().toLowerCase();
  if (!token) {
    return null;
  }
  return UNIT_SPELLINGS[token] ?? SOURCE_UNITS[token]?.unit ?? raw?.trim() ?? null;
};

const sourceUnitFor = (raw: string | undefined) =>
  raw ? SOURCE_UNITS[raw.trim().toLowerCase()] : undefined;

/**
 * The single quantity in a piece of source text, or null.
 *
 * Anchored to the WHOLE string rather than searching inside it. "Up to 8 cameras
 * over 4 channels" holds two numbers and no way to know which is meant, so it
 * must reach a human — and a search-anywhere regex would confidently return 8.
 */
export const parseQuantity = (text: string): Quantity | null => {
  const match = new RegExp(`^(${NUMBER})\\s*(${UNIT_TOKEN})?$`).exec(text.trim());
  if (!match) {
    return null;
  }
  const value = toNumber(match[1] ?? "");
  if (value === null) {
    return null;
  }
  const source = sourceUnitFor(match[2]);
  return source
    ? { value: source.toCanonical(value), unit: source.unit }
    : { value, unit: normalizeUnit(match[2]) };
};

/** A span in source text — "−20 to 60 °C", "2.8–12.0 mm" — or null. */
export const parseSpan = (
  text: string,
): { range: SpecRange; unit: string | null } | null => {
  const match = new RegExp(
    `^(${NUMBER})\\s*(${UNIT_TOKEN})?${RANGE_SEPARATOR}(${NUMBER})\\s*(${UNIT_TOKEN})?$`,
  ).exec(text.trim());
  if (!match) {
    return null;
  }
  const min = toNumber(match[1] ?? "");
  const max = toNumber(match[3] ?? "");
  if (min === null || max === null) {
    return null;
  }
  // The unit is usually written once, after the second number.
  const rawUnit = match[4] ?? match[2];
  const source = sourceUnitFor(rawUnit);
  const lo = source ? source.toCanonical(min) : min;
  const hi = source ? source.toCanonical(max) : max;
  return {
    // A source may write a span backwards. min/max are a claim about ordering,
    // and storing them the wrong way round inverts every comparison silently.
    range: { min: Math.min(lo, hi), max: Math.max(lo, hi) },
    unit: source ? source.unit : normalizeUnit(rawUnit),
  };
};

const BOOLEAN_WORDS: Record<string, boolean> = {
  yes: true,
  true: true,
  supported: true,
  available: true,
  y: true,
  no: false,
  false: false,
  unsupported: false,
  unavailable: false,
  none: false,
  n: false,
};

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/** The text of an issue, reduced to what makes two of them the same question. */
const groupText = (text: string): string =>
  text.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * What makes one decision resolve 68 products.
 *
 * Two issues share a key when they are the same question — `unknown_value` on
 * the same attribute with the same source spelling. Answer it once and every
 * member of the group takes the answer.
 *
 * The attribute is part of the key on purpose. `Auto` under Frame Rate and
 * `Auto` under White Balance look identical as text and are two different
 * questions; merging them would apply one reviewer's answer to a field they
 * never looked at.
 */
export const issueGroupKey = (
  type: ImportIssueType,
  text: string,
  specificationUuid?: string,
): string => `${type}:${specificationUuid ?? "-"}:${groupText(text)}`;

const draft = (
  type: ImportIssueType,
  sourceText: string,
  specificationUuid?: string,
  proposedValue?: ImportProposal,
): DraftIssue => ({
  type,
  groupKey: issueGroupKey(type, sourceText, specificationUuid),
  specificationUuid,
  sourceText,
  proposedValue,
});

// ---------------------------------------------------------------------------
// Coercing one field
// ---------------------------------------------------------------------------

type Coerced =
  | { ok: true; value: ProductValue }
  | { ok: false; issue: DraftIssue };

const coerceNumber = (target: ImportTarget, text: string): Coerced => {
  const { meta } = target;

  const span = parseSpan(text);
  if (span) {
    const scaled = scaleToTarget(span.range.min, span.unit, meta);
    const scaledMax = scaleToTarget(span.range.max, span.unit, meta);
    if (scaled === null || scaledMax === null) {
      return {
        ok: false,
        issue: draft("unit_ambiguity", text, meta.uuid, {
          note: `Source is in ${span.unit ?? "no unit"}, the attribute stores ${meta.unit ?? "no unit"}.`,
        }),
      };
    }
    return { ok: true, value: { min: scaled, max: scaledMax } };
  }

  const quantity = parseQuantity(text);
  if (!quantity) {
    return { ok: false, issue: draft("unparseable", text, meta.uuid) };
  }
  const scaled = scaleToTarget(quantity.value, quantity.unit, meta);
  if (scaled === null) {
    return {
      ok: false,
      issue: draft("unit_ambiguity", text, meta.uuid, {
        note: `Source is in ${quantity.unit ?? "no unit"}, the attribute stores ${meta.unit ?? "no unit"}.`,
      }),
    };
  }
  return { ok: true, value: scaled };
};

/**
 * A parsed number in the unit the attribute stores, or null when it will not go.
 *
 * A bare source number is taken at face value — vendors omit the unit constantly
 * and the attribute's own unit is the better authority. A source unit that is
 * present and does not convert is refused rather than assumed: watts read as
 * kilowatts is a 1000x error that every downstream check reports as a pass.
 */
const scaleToTarget = (
  value: number,
  sourceUnit: string | null,
  meta: AttributeMeta,
): number | null => {
  if (!sourceUnit || sourceUnit === meta.unit) {
    return value;
  }
  return convert(value, sourceUnit, meta.unit);
};

const coerceOption = (target: ImportTarget, text: string): Coerced => {
  const { meta, enabledValues } = target;
  const option = resolveOptionByText(text, meta.options);
  if (!option) {
    return {
      ok: false,
      issue: draft("unknown_value", text, meta.uuid, { note: meta.label }),
    };
  }
  // Resolved, but this category does not offer it. A different question from
  // "unknown", and a different fix: the product may be in the wrong category, or
  // the slice may be narrower than the catalogue really is.
  if (enabledValues?.length && !enabledValues.includes(option.value)) {
    return {
      ok: false,
      issue: draft("outside_vocabulary", text, meta.uuid, {
        option: option.value,
      }),
    };
  }
  return {
    ok: true,
    value: meta.type === "multi_select" ? [option.value] : option.value,
  };
};

const coerce = (target: ImportTarget, text: string): Coerced => {
  const { meta } = target;
  switch (meta.type) {
    case "number":
      return coerceNumber(target, text);
    case "single_select":
    case "multi_select":
      return coerceOption(target, text);
    case "boolean": {
      const word = BOOLEAN_WORDS[text.trim().toLowerCase()];
      return word === undefined
        ? { ok: false, issue: draft("unparseable", text, meta.uuid) }
        : { ok: true, value: word };
    }
    case "text":
      return { ok: true, value: text.trim() };
    case "group":
      // A group is rows of sub-fields; a flat label/value pair cannot carry one.
      // Queued rather than dropped, because dropping it loses the source text
      // that a human needs in order to enter the rows by hand.
      return {
        ok: false,
        issue: draft("unparseable", text, meta.uuid, {
          note: `${meta.label} is a repeatable group — its rows have to be entered by hand.`,
        }),
      };
  }
};

// ---------------------------------------------------------------------------
// Splitting a fused field
// ---------------------------------------------------------------------------

const SPLIT_ON = /\s*[,;/]\s*|\s+·\s+/;

/**
 * `IP66, IK08` is two attributes in one field. So is `5 MP CMOS, 1/2.7" type`.
 *
 * The order matters: the WHOLE text is tried first, and splitting is only
 * attempted once the whole has failed. A value that legitimately contains a
 * comma — an option named `Grade 2, Class II` — would otherwise be torn into two
 * halves that each resolve to nothing, turning one good value into two issues.
 *
 * And a split only counts if EVERY part lands on a different target. A partial
 * match means the guess was wrong, so the original text goes to a human whole.
 */
const trySplit = (
  text: string,
  targets: ImportTarget[],
  taken: Set<string>,
): { uuid: string; value: ProductValue }[] | null => {
  const parts = text
    .split(SPLIT_ON)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  const found: { uuid: string; value: ProductValue }[] = [];
  const claimed = new Set(taken);
  for (const part of parts) {
    const hit = targets.find((candidate) => {
      if (claimed.has(candidate.meta.uuid)) {
        return false;
      }
      const attempt = coerce(candidate, part);
      return attempt.ok;
    });
    if (!hit) {
      return null;
    }
    const attempt = coerce(hit, part);
    if (!attempt.ok) {
      return null;
    }
    claimed.add(hit.meta.uuid);
    found.push({ uuid: hit.meta.uuid, value: attempt.value });
  }
  return found;
};

// ---------------------------------------------------------------------------
// The pipeline
// ---------------------------------------------------------------------------

const sameValue = (a: ProductValue, b: ProductValue): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * One source product, resolved as far as it can be resolved without guessing.
 *
 * Returns the draft alongside every question it could not answer. A row with any
 * issue is not committable — that gate lives on the queue, not here, because
 * this function has no idea whether a human has since answered.
 */
export const parseSourceRow = (
  row: SourceRow,
  targets: ImportTarget[],
): ParsedRow => {
  const specValues: Record<string, ProductValue> = {};
  const issues: DraftIssue[] = [];
  const nameable = targets.map((target) => ({
    uuid: target.meta.uuid,
    key: target.key,
    label: target.meta.label,
    labelAliases: target.labelAliases,
  }));
  const byUuid = new Map(targets.map((target) => [target.meta.uuid, target]));

  for (const field of row.fields) {
    const text = field.text.trim();
    if (!text) {
      // Empty is empty. Not zero, not "N/A", and not an issue either — the
      // source simply did not state it, and the completeness check will say so
      // with far better context than the importer can.
      continue;
    }

    const attribute = resolveAttributeByText(field.label, nameable);
    if (!attribute) {
      issues.push(
        draft("unknown_attribute", field.label, undefined, { note: text }),
      );
      continue;
    }
    const target = byUuid.get(attribute.uuid);
    if (!target) {
      continue;
    }

    const attempt = coerce(target, text);
    if (attempt.ok) {
      const existing = specValues[attribute.uuid];
      // Two places in the source answering the same attribute differently.
      // DoorProtect U says CR123A in its body and CR131A in its table; the
      // importer must not prefer whichever it read second.
      if (existing !== undefined && !sameValue(existing, attempt.value)) {
        issues.push(
          draft("contradiction", text, attribute.uuid, {
            note: `Already read as ${JSON.stringify(existing)} from another part of the source.`,
            value: attempt.value,
          }),
        );
        continue;
      }
      specValues[attribute.uuid] = attempt.value;
      continue;
    }

    // The whole failed. Only now is it worth asking whether the field was two
    // attributes fused into one.
    const split = trySplit(text, targets, new Set(Object.keys(specValues)));
    if (split) {
      for (const part of split) {
        specValues[part.uuid] = part.value;
      }
      continue;
    }
    issues.push(attempt.issue);
  }

  return {
    name: row.name?.trim() || undefined,
    model: row.model?.trim() || undefined,
    specValues,
    issues,
  };
};

// ---------------------------------------------------------------------------
// Laying the reviewer's answers over the parser's draft
// ---------------------------------------------------------------------------

/** An answered issue, reduced to what the commit step reads. */
export type ResolvedIssue = {
  status: ImportIssueStatus;
  specificationUuid: string | null;
  resolvedValue: ImportProposal | null;
};

/**
 * The parser's draft with the reviewer's answers laid over it.
 *
 * Applied at commit rather than written back into the payload, so changing one's
 * mind re-answers an issue instead of rewriting every row that shares it. The
 * payload stays exactly what the parser produced — which is what makes keeping
 * the source text worthwhile: draft plus answer explains any stored value.
 *
 * A `rejected` issue contributes nothing, and that IS the answer: the field
 * stays empty. Empty is empty — never zero, never "N/A", never "None" unless the
 * source said so.
 *
 * An `open` issue contributes nothing either, but a row carrying one must never
 * reach here — the commit path refuses first. This is a second line, not the
 * gate: a half-answered row committing quietly is the one outcome worth two
 * checks.
 */
export const applyResolutions = (
  payload: ImportPayload | null,
  issues: ResolvedIssue[],
): ProductValues => {
  const values: ProductValues = { ...(payload?.specValues ?? {}) };

  for (const issue of issues) {
    if (issue.status === "rejected" || issue.status === "open") {
      continue;
    }
    const answer = issue.resolvedValue;
    if (!answer) {
      continue;
    }
    const uuid = answer.specificationUuid ?? issue.specificationUuid;
    if (!uuid) {
      continue;
    }
    // `value` wins over `option` when both are present: it is the typed form,
    // and a multi-select answer has to arrive as an array rather than one
    // string. `option` is the convenience for the ordinary single-select case.
    const resolved = answer.value ?? answer.option;
    if (resolved !== undefined) {
      values[uuid] = resolved;
    }
  }

  return values;
};

// ---------------------------------------------------------------------------
// Reading pasted source
// ---------------------------------------------------------------------------

/**
 * Source text a person pasted, split into products.
 *
 * A real import route, not a stopgap. Most of what a catalogue clerk has is a
 * block of text off a spec page, and the alternative — wait for an extractor per
 * vendor — leaves the whole queue untestable until the last vendor is written.
 * Every other producer (a file, a crawler) lands on the same `stageImportRow`.
 *
 * The format is the one the text is already in: `Label: value` per line, blank
 * line or a `#` between products. `#` names the product's source reference,
 * which is what a second run recognises — a paste with no `#` gets its name,
 * because two runs of the same paste should update rather than pile up.
 */
export const parsePastedSource = (text: string): SourceRow[] => {
  const rows: SourceRow[] = [];
  let current: SourceRow | null = null;

  const flush = () => {
    // A block that produced nothing at all is whitespace, not a product.
    if (current && (current.name || current.fields.length > 0)) {
      rows.push({ ...current, sourceRef: current.sourceRef || (current.name ?? "") });
    }
    current = null;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();

    if (line === "") {
      flush();
      continue;
    }
    if (line.startsWith("#")) {
      flush();
      current = { sourceRef: line.slice(1).trim(), fields: [] };
      continue;
    }

    const separator = line.indexOf(":");
    if (separator < 1) {
      // A line with no label is not a field. Skipped rather than guessed at —
      // a heading or a stray sentence turned into a value would be a field
      // nobody wrote, queued as a question nobody can answer.
      continue;
    }
    const label = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    current ??= { sourceRef: "", fields: [] };

    if (label.toLowerCase() === "name") {
      current.name = value;
      continue;
    }
    if (label.toLowerCase() === "model") {
      current.model = value;
      continue;
    }
    current.fields.push({ label, text: value });
  }
  flush();

  return rows;
};
