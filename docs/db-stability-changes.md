# `db-stability` branch — change summary

Everything I built on this branch for the **BOQ → Offer → Order** lifecycle and the **Service & Handover** module, no AI features. This single file replaces the two working docs I had before (`boq-lifecycle-gaps.md`, `service-handover-pages.md`).

**Status:** schema applied to the live DB (additive), full backend + frontend wired, type-check (10 projects) and tests (46) pass.

Legend: **NEW** = file created · **EDIT** = existing file changed.

---

## 1. Big picture — what this delivers

Two connected features, built as data model → services → UI:

1. **BOQ → Offer → Order** — a BOQ now carries a real lifecycle (`draft → validated → submitted → reviewed → offered → ordered → assigned → installing → installed → verified → handed_over`), BOQ lines gained **role** (anchor/peripheral/accessory) and **line type** (product/service) and **sections**, offers can **expire**, and a customer can **confirm-then-pay** to create an **Order** and an **Invoice**.
2. **Service & Handover** (stages 5–7) — the installer builds a **handover pack** (as-built devices + access credentials), the **customer confirms** their access, a **SOT operator verifies** and **releases** payment, and the partner's earnings accrue as a **payable** they cash out. Partners have a **badge** (discount ladder) and an **integrated** flag (auto-paid at handover).

---

## 2. Database — applied to the live DB additively

Applied via a one-off mysql2 script (CREATE TABLE / ADD COLUMN / MODIFY enum only). **`Products.vendor_uuid` was left untouched** — it is dead legacy data (the vendor entity was folded into Brand), and dropping it stays a manual/interactive decision. A plain `drizzle-kit push` was deliberately **not** run because it would try to drop that column and lose data.

**New tables:** `BoqSections`, `Orders`, `Invoices`, `HandoverPacks`, `HandoverAssets`, `HandoverCredentials`, `PartnerEarnings`, `PartnerPayouts`.

**New columns:** `Products.system_role`, `BoqItems.section_uuid` / `line_type` / `role` (+ `product_uuid` made nullable for service lines), `Boqs.site` / `source`, `Offers.expires_at` / `presentation_mode`, `PartnerRequests.badge` / `is_integrated`.

**Expanded enums:** `Boqs.status` (→ 11 states), `Offers.status` (+ `expired`).

---

## 3. Shared schema & enums (`db/`)

| File | Change | What |
|---|---|---|
| `db/enum.ts` | **EDIT** | Added `boqItemRoles`, `boqLineTypes`; expanded `boqStatuses`; added `orderStatuses`, `invoiceStatuses`, `partnerBadges`, `handoverStatuses`, `handoverCredentialTypes`, `partnerEarningStatuses`, `partnerPayoutStatuses`, `offerPresentationModes`; `offerStatuses` gained `expired`. |
| `db/label.ts` | **EDIT** | Label maps for every new enum above. |
| `db/schema/boqs.ts` | **EDIT** | `BoqSections` table; `BoqItems` gained `sectionUuid` / `lineType` / `role`; `productUuid` nullable; `Boqs` gained `site` / `source`. |
| `db/schema/products.ts` | **EDIT** | `systemRole` (anchor/peripheral/accessory). |
| `db/schema/offers.ts` | **EDIT** | `expiresAt`, `presentationMode`. |
| `db/schema/partner-requests.ts` | **EDIT** | `badge`, `isIntegrated`. |
| `db/schema/orders.ts` | **NEW** | `Orders` + `Invoices`. |
| `db/schema/handovers.ts` | **NEW** | `HandoverPacks`, `HandoverAssets`, `HandoverCredentials`. |
| `db/schema/payouts.ts` | **NEW** | `PartnerEarnings` (a payable ledger, not a wallet), `PartnerPayouts`. |
| `db/schema/index.ts` | **EDIT** | Export the three new schema files. |

---

## 4. Business logic (`packages/services/src/`)

| File | Change | Key functions |
|---|---|---|
| `boq.ts` | **EDIT** | On create: snapshot `role`/`lineType`, create a section. `validateBoq` (rules-engine gate → `validated`), `advanceBoqFulfilment` (guarded `ordered → … → handed_over`). |
| `offers.ts` | **EDIT** | Approving sets an expiry and moves the BOQ to `offered`; expired offers can't be selected; `expireStaleOffers`; offer carries `presentationMode`; approved partner now exposes `badge`. |
| `orders.ts` | **NEW** | `createOrderFromSelectedOffer` (confirm-then-pay), `markOrderPaid` (+ invoice), `cancelOrder`, user order/invoice reads. |
| `pricing.ts` | **NEW** | `BADGE_DISCOUNTS` ladder + `computePartnerCartPricing` (cart lump-sum discount). Percentages are placeholders. |
| `handovers.ts` | **NEW** | `createHandoverPack` (seeds an asset per device), `updateHandoverAsset`, `addHandoverCredential`, `submitHandoverPack`, `confirmHandoverByCustomer`, `verifyHandover`, `completeHandover` (escrow release), `disputeHandover`, review-queue reads. |
| `payouts.ts` | **NEW** | `accruePartnerEarning`, `settleIntegratedPartner`, earnings summary, `requestPayout`, `markPayoutPaid`, review queue. |
| `partners.ts` | **EDIT** | `setPartnerCommercialProfile` (badge + integration). |
| `index.ts` | **EDIT** | Export the new service modules. |

---

## 5. Frontend by app

### Client (customer) — `apps/client`

| Page / component | Change | What it does |
|---|---|---|
| `app/boq/[uuid]/actions.ts` | **EDIT** | Added `confirmOrder`, `confirmHandover`, `reportHandoverIssue` (with an ownership guard). |
| `components/boq/offers-section.tsx` | **EDIT** | Shows a **Confirm & order** CTA once an offer is selected. |
| `app/orders/page.tsx` | **NEW** | Customer's orders list. |
| `app/orders/[uuid]/page.tsx` | **NEW** | Order summary + payment + invoice + link to handover. |
| `app/orders/[uuid]/actions.ts` | **NEW** | `payOrder` (stand-in for the gateway callback). |
| `components/orders/order-payment.tsx` | **NEW** | The Pay button (client). |
| `app/boq/[uuid]/handover/page.tsx` | **NEW** | The handover — devices, credentials, training; permanent archive. |
| `components/handover/handover-view.tsx` | **NEW** | Customer confirms access works or reports an issue. |
| `tsconfig.json` | **EDIT** | Added the `@/db` path alias. |

### Partner (installer) — `apps/partner`

| Page / component | Change | What it does |
|---|---|---|
| `app/(dashboard)/boqs/[uuid]/actions.ts` | **EDIT** | Added `advanceStage` (install progress). |
| `app/(dashboard)/boqs/[uuid]/page.tsx` | **EDIT** | Renders the install-progress panel once past `ordered`. |
| `components/boqs/install-progress.tsx` | **NEW** | Accept → start → mark installed, plus a link to handover. |
| `app/(dashboard)/boqs/[uuid]/handover/page.tsx` | **NEW** | Open + build the handover pack. |
| `app/(dashboard)/boqs/[uuid]/handover/actions.ts` | **NEW** | `openPack`, `saveAsset`, `addCredential`, `submitPack`. |
| `components/handover/handover-builder.tsx` | **NEW** | Fill device detail, add credentials, submit (+ `OpenPackButton`). |
| `app/(dashboard)/earnings/page.tsx` | **NEW** | Owed / invoiced / paid tiles + payouts list. |
| `app/(dashboard)/earnings/actions.ts` | **NEW** | `cashOut` (request a payout). |
| `components/earnings/cash-out-button.tsx` | **NEW** | The cash-out button. |
| `tsconfig.json` | **EDIT** | Added the `@/db` path alias. |

### Operator / verifier (pre-seller) — `apps/pre-seller`

| Page / component | Change | What it does |
|---|---|---|
| `app/(dashboard)/handovers/page.tsx` | **NEW** | Verification queue. |
| `app/(dashboard)/handovers/[uuid]/page.tsx` | **NEW** | Review a pack (devices + credentials). |
| `app/(dashboard)/handovers/[uuid]/actions.ts` | **NEW** | `verify`, `complete` (escrow release), `dispute`. |
| `components/handovers/review-controls.tsx` | **NEW** | Verify / complete / dispute buttons. |
| `app/(dashboard)/payouts/page.tsx` | **NEW** | Requested payouts awaiting settlement. |
| `app/(dashboard)/payouts/actions.ts` | **NEW** | `settlePayout` (`markPayoutPaid`). |
| `components/payouts/settle-button.tsx` | **NEW** | Mark-paid button. |
| `tsconfig.json` | **EDIT** | Added the `@/db` path alias. |

### Admin — `apps/admin`

| Page / component | Change | What it does |
|---|---|---|
| `app/(dashboard)/partners/action.ts` | **EDIT** | Added `setPartnerCommercialAction`. |
| `components/partners/partner-commercial-control.tsx` | **NEW** | Badge dropdown + integrated toggle. |
| `components/partners/partner-request-details-dialog.tsx` | **EDIT** | Renders the commercial control for approved partners. |
| `components/boqs/boqs-table.tsx` | **EDIT** | Status-badge classes for the 11 BOQ states. |
| `components/offers/offers-table.tsx` | **EDIT** | Badge class for the new `expired` offer status. |

---

## 6. Not done yet (needs external input / a decision)

- **Real payment provider** — the customer "Pay" button calls `markOrderPaid` directly as a stand-in; a licensed gateway (SAMA) must be wired.
- **Credential encryption at rest** — `HandoverCredentials.secret` is stored as-is; encrypt before real use.
- **Accountant sign-off** — confirm partner earnings are modelled as a **payable**, not a wallet (SAMA).
- **`/systems` archive index** — the per-BOQ handover archive exists; a top-level customer "my systems" list does not.
- **Real badge percentages** — `BADGE_DISCOUNTS` values are placeholders.
- **Dropping `Products.vendor_uuid`** — still pending your interactive `db:push` approval.

---

## 7. Commits on this branch (mine)

- `9b056e0` — BOQ → Offer → Order lifecycle backend (data model + services).
- `9552eb9` — Service & Handover module + wired the lifecycle frontend.

_(This summary file itself is intentionally left uncommitted.)_
