# Service & Handover — Page-by-Page Build Guide

_What each screen does, who uses it, and which service functions it calls._

This is the UI plan for the **Service & Handover** module (BOQ lifecycle stages 5–7) plus the order/payment steps that feed into it. Each page stays thin — a page calls **one** service function per action through a Server Action, never business logic inline.

> **Implementation status (updated):** The backend (`packages/services`) **and** the pages/components below are now built and type-check clean across all apps. The schema has been applied to the live DB (additively — `vendor_uuid` left untouched). What is **not** done: a real payment provider (the client "Pay" button calls `markOrderPaid` directly as a stand-in), credential encryption at rest, and a full customer "my systems" archive index (the per-BOQ handover archive at A4 exists; a top-level `/systems` list is the small remaining piece). Pages marked ✅ below are wired; the file names are the real paths.

Actors: **Customer** (client app) · **Partner** (partner app) · **SOT operator / verifier** (pre-seller or admin app) · **Admin**.

The lifecycle a BOQ walks through these pages:
`ordered → assigned → installing → installed → verified → handed_over`, with money released at `handed_over`.

---

## A. Client app — the Customer

### A1. BOQ offers → confirm order  ·  `/boq/[uuid]`  _(extends existing offers page)_
- **What it does:** Shows the approved offers on the customer's BOQ. Customer picks one (`selectOffer`), then presses **Confirm order** to lock it in. Confirming creates the order and moves the BOQ `offered → ordered`.
- **Calls:** `getApprovedOffersForUser`, `selectOffer`, `createOrderFromSelectedOffer`.
- **Notes:** Respects the offer's `presentationMode` — render **all-in** as one total, **itemized** as products + service, **products-only** with no service line and a "no handover guarantee" note.

### A2. Order & payment  ·  `/orders/[uuid]`  _(new)_
- **What it does:** Shows the confirmed order total and a **Pay** button. Payment runs through SOT's gateway — 100% of the money (products + service) flows to SOT and is held. On success the order becomes `paid` and an invoice is raised.
- **Calls:** `getUserOrder`, `markOrderPaid` _(gateway callback plumbing — no live provider yet)_, `getInvoiceForOrder`.
- **Notes:** This is the "all money through SOT" rule made real. There is no path where the customer pays the partner directly.

### A3. Order list  ·  `/orders`  _(new)_
- **What it does:** All the customer's orders with status (awaiting payment / paid) and their BOQ reference.
- **Calls:** `getUserOrders`.

### A4. Handover — confirm my access  ·  `/boq/[uuid]/handover`  _(new)_
- **What it does:** Once the partner submits the pack, the customer sees the as-built asset list, their access credentials, and training notes. They **test each access** (offline login, cloud admin, each device responds) and press **Confirm** — the primary verification, because the point is that _they_ hold control.
- **Calls:** `getCustomerHandover`, `confirmHandoverByCustomer`. Optionally `disputeHandover` if something doesn't work.

### A5. My systems — the permanent archive  ·  `/systems` (or `/handovers`)  _(new)_
- **What it does:** The "good lock-in." Every handed-over system, stored forever in the customer's SOT account: as-built assets (make/model, location, IP, port, photo) and credentials (offline user/password, cloud admin, device access). They never lose their passwords or configs, even if they change installers.
- **Calls:** `getCustomerHandover` per system (list from `getUserBoqs` filtered to `handed_over`).

---

## B. Partner app — the Installer

### B1. Assigned BOQ work list  ·  `/boqs/[uuid]`  _(extends existing partner BOQ page)_
- **What it does:** The BOQ becomes the installer's work list. Partner marks progress: **Start install** and **Mark installed**, stepping the BOQ `assigned → installing → installed`.
- **Calls:** `getPartnerBoq`, `advanceBoqFulfilment`.

### B2. Build the handover pack  ·  `/boqs/[uuid]/handover`  _(new)_
- **What it does:** Once installed, the partner opens the pack (auto-seeded with one asset row per installed device from the BOQ product lines) and fills in the as-built reality: **location, local IP, port, MAC, serial, photo** per device, and adds **access credentials** (offline user/password, cloud-admin ownership, device logins) plus training notes. Then **Submit** for the customer to confirm.
- **Calls:** `createHandoverPack`, `updateHandoverAsset`, `addHandoverCredential`, `submitHandoverPack`.
- **Notes:** Submit is blocked until at least one credential exists — a handover with no way to reach the system isn't a handover. Secrets must be **encrypted at rest** by the storage layer.

### B3. Earnings — money owed to me  ·  `/earnings`  _(new)_
- **What it does:** The partner's payable balance: **Owed** (accrued on verified handover), **Invoiced**, **Paid**. A non-integrated partner presses **Cash out**, uploads their ZATCA invoice, and the accrued amount becomes a payout request.
- **Calls:** `getPartnerEarningsSummary`, `listPartnerEarnings`, `requestPayout`.
- **Notes:** This is a **payable ledger** (money SOT owes), **not a wallet** — the copy must not imply SOT is holding the partner's funds (SAMA). Integrated partners see amounts already `Paid` here (auto-settled at handover).

### B4. Payouts history  ·  `/payouts`  _(new)_
- **What it does:** Every cash-out — requested vs paid, with reference and the invoice document.
- **Calls:** `listPartnerPayouts`.

---

## C. SOT operator / verifier app — the Quality Gate

> The **verifier** is a distinct actor (Phase 1: a SOT operator). Put these in the pre-seller app or a dedicated operator surface.

### C1. Verification queue  ·  `/handovers`  _(new)_
- **What it does:** Lists packs the customer has confirmed (`customer_confirmed`) and are awaiting SOT's **remote completeness check** — credentials present, cloud admin transferred, sign-off recorded. This is a light digital check, not a site visit.
- **Calls:** a list query over `HandoverPacks` by status _(add `listHandoversByStatus` if a list is wanted)_.

### C2. Handover detail — verify / release / dispute  ·  `/handovers/[boqUuid]`  _(new)_
- **What it does:** The operator reviews the full pack, then:
  - **Verify** → pack `verified`, BOQ `installed → verified`.
  - **Complete handover** → BOQ `verified → handed_over`; this is the **escrow release**: the partner's service earning accrues as a payable, and integrated partners are auto-invoiced and paid instantly.
  - **Dispute** → routes to the physical-inspection path (disputes only).
- **Calls:** `verifyHandover`, `completeHandover`, `disputeHandover`.
- **Notes:** `completeHandover` refuses to release unless the order is `paid` — SOT only pays out money it has received.

### C3. Payout settlement  ·  `/payouts`  _(new)_
- **What it does:** Requested payouts from non-integrated partners; operator confirms the bank transfer, clearing the ledger.
- **Calls:** `markPayoutPaid`.

---

## D. Admin app — Configuration & Oversight

### D1. Offers review  ·  `/offers`  _(exists — extend)_
- **What it does:** Approve/reject partner offers (already built). Extend with the **presentation mode** (all-in / itemized / products-only) shown per offer. Approving sets the offer's expiry and moves the BOQ to `offered`.
- **Calls:** `listOffers`, `approveOffer`, `rejectOffer`.

### D2. Partner management  ·  `/partners`  _(exists — extend)_
- **What it does:** Set each partner's **badge** (reseller / system integrator / cabling — the discount ladder) and the **Integrated** toggle (auto-pay-at-handover path). These drive both partner pricing and how fast they get paid.
- **Calls:** partner update actions _(add `setPartnerBadge` / `setPartnerIntegration` if not present)_.

### D3. Orders & invoices overview  ·  `/orders`  _(new)_
- **What it does:** Cross-customer view of orders and invoices for finance/audit — every money movement is on-book.
- **Calls:** order/invoice list queries _(add admin-scoped list if wanted)_.

---

## E. Flexible offer presentation — where it lives

Not its own page — a rendering rule applied on **A1** (customer offer view) and the offer editor in the partner app, driven by `Offers.presentationMode`:

| Mode | Shown as | Money |
|---|---|---|
| `all_in` | One total | All to SOT; service released on verified handover |
| `itemized` | Products + service broken out | Same transaction as all-in |
| `products_only` | Products only, "no handover guarantee" | Products to SOT; no SOT service, no handover pack |

---

## F. Build order (suggested)

1. **A1 + A2 + A3** — confirm-then-pay, so a BOQ can actually reach `ordered`/`paid`.
2. **B1** — partner walks the BOQ to `installed`.
3. **B2 + A4** — the pack itself: partner builds → customer confirms.
4. **C1 + C2** — verification and the escrow release (the crown jewel).
5. **B3 + B4 + C3** — the money: earnings, cash-out, settlement.
6. **A5** — the permanent customer archive.
7. **D1–D3** — admin config and oversight.

## H. What was actually wired (files)

**Client (customer)**
- ✅ Confirm order — `apps/client/src/app/boq/[uuid]/actions.ts` (`confirmOrder`), `components/boq/offers-section.tsx` (Confirm & order CTA)
- ✅ Order & payment — `apps/client/src/app/orders/[uuid]/page.tsx` + `actions.ts` (`payOrder`), `components/orders/order-payment.tsx`
- ✅ Orders list — `apps/client/src/app/orders/page.tsx`
- ✅ Handover confirm / archive — `apps/client/src/app/boq/[uuid]/handover/page.tsx`, `components/handover/handover-view.tsx`, actions `confirmHandover` / `reportHandoverIssue`

**Partner**
- ✅ Install progress — `components/boqs/install-progress.tsx`, action `advanceStage` (in `boqs/[uuid]/actions.ts`)
- ✅ Build handover pack — `apps/partner/src/app/(dashboard)/boqs/[uuid]/handover/page.tsx` + `actions.ts`, `components/handover/handover-builder.tsx` (+ `OpenPackButton`)
- ✅ Earnings & cash-out — `apps/partner/src/app/(dashboard)/earnings/page.tsx` + `actions.ts`, `components/earnings/cash-out-button.tsx`

**Operator (pre-seller)**
- ✅ Verification queue — `apps/pre-seller/src/app/(dashboard)/handovers/page.tsx`
- ✅ Verify / complete / dispute — `handovers/[uuid]/page.tsx` + `actions.ts`, `components/handovers/review-controls.tsx`
- ✅ Payout settlement — `payouts/page.tsx` + `actions.ts`, `components/payouts/settle-button.tsx`

**Admin**
- ✅ Partner badge + integration — `components/partners/partner-commercial-control.tsx`, action `setPartnerCommercialAction`, wired into `partner-request-details-dialog.tsx`

**Supporting service additions:** `listHandoversForReview`, `getHandoverForReview` (handovers), `listPayoutsForReview` (payouts), `setPartnerCommercialProfile` (partners). The `@/db` path alias was added to the client, partner, and pre-seller apps.

## G. Before any of this ships (blockers carried over)

- **Payment provider** — `markOrderPaid` is callback plumbing; wire a licensed gateway (SAMA).
- **Credential encryption at rest** — `HandoverCredentials.secret` must never be stored plaintext.
- **Accountant sign-off** — partner balance structured as a **payable, not a wallet**; payouts via a licensed provider. Settle before build (same priority as the ZATCA wave).
- **`db:push`** — the new tables (`HandoverPacks`, `HandoverAssets`, `HandoverCredentials`, `PartnerEarnings`, `PartnerPayouts`) and columns (`Offers.presentation_mode`, `PartnerRequests.is_integrated`) have not hit the live DB yet.
