# BOQ → Offer → Order — Gap Analysis

_What the SOT BOQ lifecycle brief describes vs. what the codebase actually implements today._

This document ignores everything AI-related (the AI engine that generates the BOQ). It compares the **business logic** in the "BOQ → Offer → Order — The Solution Lifecycle" brief against the current schema and services, and flags what is **missing**, **built differently**, or **only partially there**.

Legend: ✅ implemented · ⚠️ partial · 🔀 built differently · ❌ not implemented

---

## ⚑ Implementation status (updated)

The **data model + service layer** for the whole lifecycle has now been built. Type-check (all 10 workspace projects) and the test suite (46 tests) pass. What was added:

- **Enums/labels** (`db/enum.ts`, `db/label.ts`): `boqItemRoles`, `boqLineTypes`, full `boqStatuses` lifecycle (11 states), `orderStatuses`, `invoiceStatuses`, `partnerBadges`, plus `offerStatuses` gained `expired`.
- **Schema**: `Products.systemRole`; `BoqSections` table; `BoqItems` gained `sectionUuid`, `lineType`, `role` (and `productUuid` is now nullable for service lines); `Boqs` gained `site`/`source`; `Offers.expiresAt`; `PartnerRequests.badge`; new `Orders` + `Invoices` tables.
- **Services**: `boq.ts` now snapshots `role`/`lineType` and creates a section on BOQ creation, loads sections in `BoqDetail`, and adds `validateBoq` (the rules-engine gate → `validated`) and `advanceBoqFulfilment` (guarded `ordered → … → handed_over`). New `orders.ts` (`createOrderFromSelectedOffer` confirm-then-pay, `markOrderPaid` + invoicing, `cancelOrder`, user order/invoice reads). New `pricing.ts` (`BADGE_DISCOUNTS` ladder + `computePartnerCartPricing` lump-sum discount). `offers.ts` now sets expiry on approval, moves the BOQ to `offered`, blocks expired selection, and adds `expireStaleOffers`.

**What is deliberately NOT done (needs product decisions / external systems):**

1. **UI across the 5 apps** — the new service functions have no screens yet (order confirmation page, invoice view, badge/section rendering, partner cost view, verify/handover screens). Backbone only.
2. **A real payment provider** — `markOrderPaid` is the plumbing a gateway callback will call; there is no gateway wired, so payment is still not live.
3. **Real badge percentages** — `BADGE_DISCOUNTS` (reseller 20 / SI 12 / cabling 6) are **placeholders**; set the real numbers.
4. **Populating `systemRole`** on existing products, and any **service/labour lines** (schema supports them; nothing creates them yet — a labour model / service catalog is a separate decision).
5. **`db:push`** — none of this has hit the live DB. Per prior notes the push is blocked on interactive data-loss approval (the `vendor_uuid` drift); these new columns/tables must be migrated before the code runs against the real database.

The sections below are the original analysis, kept for reference.

Primary code touched:
- `db/schema/boqs.ts` (`Boqs`, `BoqItems`)
- `db/schema/offers.ts` (`Offers`)
- `db/schema/products.ts`, `db/schema/partner-requests.ts`, `db/schema/carts.ts`
- `db/enum.ts` (`boqStatuses`, `offerStatuses`)
- `packages/services/src/boq.ts`, `packages/services/src/offers.ts`

---

## 1. The core mental model: "one object, status changes through the whole lifecycle"

**Brief:** A BOQ is a single object whose `status` runs
`draft → validated → offered → ordered → assigned → installing → installed → verified → handed_over`.
The AI creates it; everything downstream **mutates the same object**.

**Reality:** 🔀 The lifecycle is split across **three separate objects**, not one:

- `Boqs` — status enum is only `draft → submitted → reviewed` (`db/enum.ts:125`).
- `Offers` — a **separate table**, one row **per partner bid**, with its own status `pending → approved → rejected → selected` (`db/enum.ts:170`).
- There is **no** Order/Invoice object at all.

So the "one object living from draft to handover" model is **not** how it's built. The BOQ stops at `reviewed`; the offer is a distinct marketplace bid; nothing represents `ordered`/`assigned`/`installing`/`installed`/`verified`/`handed_over`.

> This is the single biggest structural divergence and everything below flows from it.

---

## 2. Point (a) — the BOQ data structure

### 2.1 BOQ header (metadata)

| Brief field | Status | Notes |
|---|---|---|
| `boq_id` | ✅ | `Boqs.uuid` + human `reference` (`boqs.ts:20,27`) |
| `customer` | ✅ | `Boqs.userUuid` (`boqs.ts:23`) |
| `site / project` | ❌ | No site/project/location field on the BOQ. |
| `source` (`ai_generated` / `self_selected`) | ❌ | No `source` column. Every BOQ is built the same way (from cart). |
| `status` (full 9-state lifecycle) | ⚠️ | Only `draft / submitted / reviewed` exists. |
| `timestamps + expiry` | ⚠️ | `createdAt` / `updatedAt` / `submittedAt` exist; **no offer expiry** ("draft expires if unpaid" is not implemented). |

### 2.2 Sections — grouped by system, each with a subtotal

**Brief:** A BOQ has **sections = systems** (CCTV, Alarm, Network, IP Telephony), each with its **own subtotal**, and this section structure is what later enables **milestone / staged-escrow billing**.

**Reality:** ❌ **Not implemented.** `BoqItems` is a **flat list** of lines (`boqs.ts:45`). There is:
- no section/system grouping column,
- no per-section subtotal,
- no milestone-billing anchor.

The only grouping that exists is upstream in the **cart**: a "solution" `CartItems.kind` = a whole category added at once (`carts.ts:43`), and `createBoqFromCart` turns **one category** into one BOQ (`boq.ts:57`). So a BOQ is effectively "one system" already — but there's no first-class **section** concept, and a BOQ can't hold multiple sectioned systems with subtotals the way the brief describes.

### 2.3 Line items — `role` and `line_type`

**Brief:** Each line carries two fields **beyond a basic parts list** that make it a real BOQ:
- `role` — `anchor` / `peripheral` / `accessory` (drives completeness validation + the purchase gate)
- `line_type` — `product` **or** `service` (service = labour; the second revenue stream)

**Reality:** ❌ **Both missing on `BoqItems`.** A BOQ line has `product`, `quantity`, `unitPrice`, `currency` (`boqs.ts:45–66`). It has:
- **no `role`** field, and
- **no `line_type`** field — and critically, **no service/labour lines at all**. Every BOQ line is a product.

Related bits that exist but don't satisfy this:
- `Products.needsSolutionReview` is an **anchor flag** ("the brain of a system") (`products.ts:69`) — but it's boolean on the product, not the `anchor/peripheral/accessory` enum, and it is **not copied onto the BOQ line**.
- `Products.role` is a **free-text marketing string** ("role in your network", `products.ts:48`) — not the structured enum the brief means.
- There is **no `db/enum.ts` enum** for BOQ-line role or line type.

**Consequence:** the "products + labour, together" two-stream model — the thing the brief says is *what makes a BOQ a BOQ and not a BOM* — is **not represented inside the BOQ**. Service/labour pricing only appears **later**, on the partner's `Offer` (`installPrice`, `programmingPrice`), not as line items in the BOQ.

---

## 3. Point (b) — the offer workflow

**Brief:** Seven stages, one growing object: `draft → validated → offered → ordered → assigned → installing → installed → verified → handed_over`. The "offer" = the BOQ **priced (MSRP + service) and presented to the customer**, which **expires if unpaid**, then becomes an **order** via **confirm-then-pay**.

**Reality:** 🔀 The offer is modelled as a **partner tender/bid**, not "the priced BOQ". The actual flow implemented:

1. Customer builds a cart → `checkout` turns one solution into a **draft BOQ** (`apps/client/src/app/cart/actions.ts:116`).
2. A **pre-seller** reviews the draft and **dispatches it to partners** (`submitReviewedBoq`, `boq.ts:315`) → BOQ status `submitted`.
3. Each **partner submits an `Offer`** (their `productPrice` / `installPrice` / `programmingPrice` + description) — `createOrUpdateOffer` (`offers.ts:95`).
4. **Admin approves/rejects** each offer (`approveOffer`/`rejectOffer`, `offers.ts:211,238`).
5. **Customer selects** one approved offer — `selectOffer` (`offers.ts:320`). Selecting **just reserves the choice**; the UI literally says _"Payment is coming soon"_ (`apps/client/src/components/offers/offers-list.tsx:68`, `offer-card.tsx:103`).

Stage-by-stage against the brief:

| Brief stage | Status | Notes |
|---|---|---|
| 1 `draft` | ✅ | `createBoqFromCart` |
| 2 `validated` (rules engine + requires-companion gate) | ❌ | A `rule-engine` exists (`packages/services/src/rule-engine.ts`) and runs as a **cart compatibility warning**, but it is **not** wired as a BOQ **validation gate**, and there is no `validated` status. The brief itself notes the requires-companion check "is not yet built". |
| 3 `offered` (priced MSRP+service, **expires if unpaid**, review-cap) | 🔀 / ⚠️ | Offers exist but as **partner bids**, not a single priced BOQ. **No expiry.** No review-cap. |
| 4 `ordered` (accept → **confirm-then-pay** → payment → invoice) | ❌ | **No payment, no order, no invoice.** Selecting an offer only reserves it. No `Orders` table, no `Invoices` table, no confirm-then-pay. |
| 5 `assigned → installing → installed` | ❌ | Not implemented (brief marks this future "Service & Handover"). |
| 6 `verified` (QA/verifier actor, escrow release) | ❌ | Not implemented. No verifier role, no escrow. |
| 7 `handed_over` (accounts/passwords/as-built, escrow release) | ❌ | Not implemented. |

**Extra divergences worth noting:**
- The brief has **one** offer per BOQ (the BOQ priced). The code allows **many** offers per BOQ (one per partner), enforced by `unique(boqUuid, partnerClerkUserId)` (`offers.ts:69`). This is a **richer marketplace model** than the brief — but it means "the offer is the BOQ" is not true here.
- `boqStatuses` needs `validated`, `offered`, `ordered`, (+ install/verify/handover) added before the lifecycle can be represented.

---

## 4. Point (c) — the offer pricing & the badge-discount ladder

### 4.1 "Who sees what" — cart-level lump-sum partner discount

**Brief:** End users see MSRP only. Partners browsing see MSRP too, but **at the cart/checkout** they see the **discount as one lump sum** ("you saved SAR 1,800"), plus fees and final total.

**Reality:** ❌ **Not implemented.** The cart shows MSRP only for everyone. There is:
- no partner-vs-end-user price divergence at the cart,
- no lump-sum discount line,
- no delivery/pickup fee lines.

### 4.2 The badge-discount ladder

**Brief:** Each partner **badge** (Stock partner/Reseller · System Integrator · Cabling/Technician) carries a **discount % off MSRP**, and this same number **is** the margin pool. One ladder drives both price and margin.

**Reality:** ❌ **Not implemented.**
- There is **no badge concept** anywhere — no badge field on `PartnerRequests` or `Users`, no badge enum in `db/enum.ts`.
- There is **no discount %** and **no margin-pool** wiring.
- `Products` carries **dormant price tiers** — `priceCost`, `priceSystemIntegrator`, `priceSubDistributor`, `priceEndUser` (`products.ts:77–86`) — explicitly commented as _"dormant structure (not used in Phase 1)"_. These are raw tier prices, **not** a badge→discount ladder, and nothing reads them.
- The only partner attribute that affects pricing is `serviceScope` (`install-program` vs `installation`), which only gates whether a **programming price** may be quoted (`offers.ts:116`). It is not a discount.

### 4.3 One discount used in two situations (partner's own projects / quoting tool)

**Brief:** The badge discount applies both to SOT-assigned projects **and** the partner's **own private projects** — the cart doubles as the partner's **quoting tool** (build cart → read total as cost → quote client → buy).

**Reality:** ❌ **Not implemented.** No discount exists, so neither use exists. Partners have a BOQ/offer flow (`apps/partner`), but no "buy through SOT as supplier / cart-as-quoting-tool" path and no cost-vs-MSRP view.

---

## 5. Price-leak protection (§5 of the brief)

**Brief:** Leak protection = (1) login-gating so prices never appear publicly, (2) individual pricing so a leaked total reveals nothing about others, (3) contractual confidentiality.

**Reality:** ⚠️ Partially applicable, mostly N/A today. Prices are behind login on the client/partner apps (login-gating ✅ in spirit), but because **there are no per-partner/badge prices at all** (§4), points (2) and (3) have nothing to protect yet.

---

## 6. Summary — what to build (non-AI)

Ordered roughly by how foundational it is:

1. **BOQ line `line_type` (`product` | `service`) + service/labour lines.** Add the enum to `db/enum.ts`, add the column to `BoqItems`, and let a BOQ carry service lines. Without this the BOQ is a BOM, not a BOQ. _(brief §2.3, §1)_
2. **BOQ line `role` (`anchor` | `peripheral` | `accessory`).** Add the enum + column on `BoqItems`; snapshot it from the product at `createBoqFromCart`. This is the field the completeness/requires-companion validation depends on. _(brief §2.3, §6)_
3. **Sections (systems) with subtotals.** A first-class section grouping on BOQ lines, each with its own subtotal — the anchor for milestone billing. _(brief §2.2)_
4. **Expand `boqStatuses`** to the full lifecycle (`validated`, `offered`, `ordered`, and later `assigned`/`installing`/`installed`/`verified`/`handed_over`). _(brief §1, §3)_
5. **`validated` gate:** wire the existing `rule-engine` requires-companion check into a BOQ validation step (currently only a cart warning). _(brief §3 stage 2, §6)_
6. **Order + payment + invoice** (confirm-then-pay). New `Orders`/`Invoices` objects; today selecting an offer only "reserves". _(brief §3 stage 4)_
7. **Offer expiry** ("draft/offer expires if unpaid"). _(brief §2.1, §3 stage 3)_
8. **Badge-discount ladder** — badge on the partner, a single discount ladder that drives both partner price and margin pool, surfaced as a **lump-sum discount at the cart**. _(brief §4)_
9. **Partner-as-buyer / cart-as-quoting-tool** path (uses the same discount). _(brief §4.3)_
10. **BOQ header fields:** `site/project`, `source`. _(brief §2.1)_

**Deferred by the brief itself (Service & Handover module — stages 5–7):** partner assignment/installation tracking, the `verified` QA/verifier actor, escrow release, and handover records. Not expected yet, but the status enum and the section/milestone structure above should anticipate them.

---

### Not-a-gap notes (already there, don't rebuild)

- BOQ creation from cart, one solution → one draft BOQ. (`boq.ts:57`)
- Pre-seller review + dispatch-to-partners with same-city matching. (`boq.ts:315`, `partners.ts`)
- Partner offer submission + admin approve/reject + customer select. (`offers.ts`)
- Compatibility rule engine (spec-bound, pooled/per-provider capacity). (`rule-engine.ts`) — exists as a **cart warning**; just not yet a BOQ gate.
- MSRP as the single public price (`Products.price`); internal tiers already stubbed as dormant columns.
