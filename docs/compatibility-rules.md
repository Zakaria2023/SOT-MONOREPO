# Compatibility Rule Engine

The compatibility rule engine is the "brain" that knows whether a set of
products works together — e.g. that 20 IP cameras drawing 12 W each cannot run
on a switch with a 130 W PoE budget. It is a **deterministic, data-driven rule
engine**: no AI, no hardcoded product logic. Rules are database rows created
from admin forms; one generic evaluator interprets them.

## The core idea: rules bind specifications, never products or categories

A rule never says "camera X needs switch Y". It says:

> anything carrying spec **A** (consumer) draws from anything carrying spec
> **B** (provider)

Because of that:

- **New products join existing rules automatically.** A new intercom with a
  `power-consumption` value participates in the PoE budget rule with zero
  changes.
- **Rules span category trees.** `Power Consumption` lives on IP Cameras
  (Security tree); `PoE Power Budget` lives on Switches (Networking tree). One
  rule connects them. Categories only decide which fields a product's entry
  form shows — they never decide who participates in a rule.
- **The key is the identity, the unit is only the dimension.** Four different
  specs can all be measured in W (consumption, budget, per-port max, UPS
  output) — matching by unit would confuse giving with taking. This was
  considered and rejected; do not reintroduce it.

## Data model

| Table | Purpose |
| --- | --- |
| `Specifications` | One row per spec. `valueType` is `select` (dropdown options) or `number` (value + `unit`). Numeric specs are what rules compute over. A numeric spec may optionally carry **allowed values** (fixed choices like 24 / 32 / 52, stored flat in the same `options` column) — the product form then shows a dropdown instead of a free number input, so no typo can reach the engine. |
| `SpecificationGroups` | Folders for the spec library (Power, Connectivity, ...). Organizational only — no behavior. Created inline from the spec form. |
| `SpecificationCategories` | Which categories (and their descendants) show a spec on the product form. |
| `CompatibilityRules` | One row per rule — the whole rule engine's content. |
| `Products.technicalAttributes` | JSON map `specKey → value` holding each product's spec values (numbers stored as strings). |

Measurement units are a fixed const list in code
(`measurementUnits` in `db/enum.ts`), picked via a searchable dropdown on the
spec form — never free text, so `W` / `w` / `Watt` drift cannot happen. Adding
an exotic unit is a one-line code change.

## Anatomy of a rule (`CompatibilityRules` row)

| Field | Meaning | Example (PoE budget) |
| --- | --- | --- |
| `kind` | Rule family (see below) | `sum_budget` |
| `consumerSpecUuid` | The measured spec on consuming items | Power Consumption (W) |
| `providerSpecUuid` | The capacity spec | PoE Power Budget (W) |
| `comparator` | `lte` (must fit within) or `gte` (must be at least) | `lte` |
| `headroomPercent` | Usable share of capacity — real designs never load 100% | `90` |
| `condition` | Optional consumer filter `{ specKey, values }` | only items with `poe-powered = Yes` |
| `severity` | `block` or `warn` on violation | `block` |
| `enabled` | Rule on/off | `true` |

## Rule families (`kind`)

- **`sum_budget`** — SUM(consumer value × qty) vs pooled provider capacity.
  *Total camera draw ≤ 90% of switch PoE budget.*
- **`count_limit`** — SUM(qty) of consumer items vs pooled capacity.
  *Device count ≤ switch port count.*
- **`per_item_threshold`** — each item's own value vs the best provider value.
  *One camera's draw ≤ the per-port maximum.*

Validation: `sum_budget` and `per_item_threshold` require both specs to share
one unit (enforced in the service and hinted live in the form). `count_limit`
is exempt — devices vs ports is a legitimate cross-unit comparison.

More families (match, coverage/reach, topology-conditional) are added as new
`kind` options when a real vendor needs them — same table, same form.

## The evaluator

- `packages/services/src/rule-engine.ts` — **pure core**, no I/O. Resolves
  participants by spec key, applies the condition filter, aggregates,
  compares, and composes human-readable messages with real numbers. Unit
  tested (`rule-engine.test.ts`).
- `packages/services/src/check-compatibility.ts` — the DB wrapper
  `checkCompatibility(selection)`: loads enabled rules, specs, and products,
  then runs the core.

Each result carries: `status` (`pass` / `warn` / `fail` / `not_applicable`),
demand, capacity, effective capacity (after headroom), the consumer/provider
breakdowns, a message, and **suggestions** — the smallest catalog products
whose provider value satisfies the failed demand (the "recommend" direction of
the same rule).

## Admin workflow (two pages)

1. **Specifications** — the dictionary. Create numeric specs (label, group,
   unit) and assign categories so product forms show them. Products then type
   real values (6.5 W, 370 W, 24 ports).
2. **Compatibility Rules** (`/rules`) — the grammar. One form = one rule: five
   dropdowns plus optional condition and severity. Test immediately in the
   **Playground** (`/rules/playground`): pick products + quantities, run the
   check, see pass/fail with numbers and suggested alternatives.

Rules are written rarely — mostly during vendor enrollment sessions. A domain
like CCTV + networking needs a few dozen rules, ever.

## Client cart flow (advisory, never a wall)

Implemented in `apps/client`:

- **A single product alone is never questioned.** Rule results whose provider
  side is absent from the cart are filtered out — a customer buying only
  cameras may already own the switch.
- **Multi-product carts** run the check (debounced, via the
  `checkCartCompatibility` server action) and show an **amber advisory
  banner** listing each violated rule, its numbers, and fitting alternatives.
  Signed-in and guest carts both have it.
- **Before checkout** ("Send as BOQ"), a confirmation modal shows the
  warnings one final time — *Continue anyway* or *Review my cart*. The
  purchase is always allowed; the check failing internally also never breaks
  the cart.

## Worked example (real data in the DB)

Cart: 1 × EKI-2708P switch (130 W budget, 8 ports, 30 W/port) + 20 × HWC-B4080
camera (12 W, PoE = Yes):

- **PoE power budget** — FAIL: 240 W exceeds 117 W usable (130 W × 90%), over
  by 123 W → suggests the 24-port (370 W) and 48-port (740 W) switches.
- **Switch port capacity** — FAIL: 20 devices vs 8 ports.
- **Per-port PoE limit** — PASS: highest draw 12 W ≤ 30 W.

Swap in the EKI-2728P (370 W, 24 ports): everything passes. Add the DC-NVR5232
(PoE = No): excluded from the PoE budget by the condition, still counted
against ports.

## What remains

- More rule families, added one at a time as vendor needs appear.
- Per-vendor population sessions (data work, not code).
- The AI solution builder consumes `checkCompatibility` as its ground truth —
  the rules table is the contract with that layer.
