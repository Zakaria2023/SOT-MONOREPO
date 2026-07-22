SOT ADMIN — END-TO-END WALKTHROUGH (FROM AN EMPTY DATABASE)

This is the ADMIN app (Stratum) test script. It covers only what an internal
staff member does inside the admin app — the catalog they author, and the sales
console where they review what customers and partners submit. There is no seed
anywhere in this repo — every catalog row below is created by hand through the
admin UI, and that is deliberate.

Each step lists every field, what it does, and what it later affects, followed
by the admin pages ("reports") that should light up.

Note: BOQs, partner requests, offers, and government requests are SUBMITTED in
the separate client app; the admin app only reviews and routes them. Those
review steps are included here (Phase 2) because they are admin actions, but the
submission itself happens outside this app.

Codes you never type: category code, brand code, and product SKU are
system-generated. Leave them alone — they appear after save.


===========================================================================
PHASE 1 — CATALOG FOUNDATION (MASTER DATA)
===========================================================================

Nothing downstream works until the catalog exists. A product can't be built
without a brand and category, compatibility can't fire without specifications
and rules, and a customer can't design a BOQ without published products. Do
these first, in order.


---------------------------------------------------------------------------
1.1 CREATE a Classification  —  /classifications/new
---------------------------------------------------------------------------

The top-level bucket that organises categories by function (e.g. "Video
Surveillance", "Access Control"). The smallest possible form on purpose.

  Name (required)
    Does   — the classification's display name.
    Affects — shown on /classifications; becomes a selectable parent when
              creating a category.

  Then check:
    - /classifications — the classification appears.


---------------------------------------------------------------------------
1.2 CREATE a Brand  —  /brands/new
---------------------------------------------------------------------------

The manufacturer/vendor a product belongs to. Brand-agnostic specs stay in the
library; the brand only labels the product's make.

  Name (required)
    Does   — brand display name.
    Affects — /brands, the brand dropdown on the product form, product cards.

  ID label
    Does   — optional label for the brand's own product-id scheme (e.g.
             "Model No.").
    Affects — titles the "brand id value" field on products of this brand.

  Note / Description
    Does   — internal note and public description.
    Affects — brand detail page.

  Parent brand
    Does   — optional parent for sub-brands.
    Affects — brand hierarchy on /brands.

  Image
    Does   — brand logo (uploaded via the documents endpoint).
    Affects — brand cards.

  Business lines (multi)
    Does   — which lines this brand sells under: Consumer, SMB/SME Channels,
             SMB/SME Projects, Enterprise. Phase 1 runs the first two.
    Affects — gates where the brand's products can surface; drives the dormant
              projects/enterprise flows.

  Code is auto-assigned on save.

  Then check:
    - /brands — the brand appears with its generated code.


---------------------------------------------------------------------------
1.3 CREATE a Category  —  /categories/new
---------------------------------------------------------------------------

A node in the product taxonomy. Categories are what specifications attach to, so
a product's category decides which attributes it can carry.

  Name (required)
    Does   — category display name.
    Affects — /categories, the category dropdown on the product form, browse nav.

  Description
    Does   — public blurb.
    Affects — category page.

  Parent category
    Does   — nests this under another category (tree).
    Affects — category hierarchy; breadcrumb/nav.

  Classification
    Does   — links the category to a 1.1 classification.
    Affects — groups categories under their classification in listings.

  Image
    Does   — category thumbnail.
    Affects — category cards.

  Code is auto-assigned on save.

  Then check:
    - /categories — the category appears, nested under its parent/classification.


===========================================================================
THE SPECIFICATION LIBRARY  —  /library  (the Builder)
===========================================================================

This is the heart of the catalog: the brand-agnostic attribute library. An
attribute is defined ONCE here, then any product can carry it, and the
compatibility rules bind to it. Get this right before building products.

The /library page is a single Builder (the earlier Templates and Database tabs
have been removed). It is a two-panel, inline editor — no separate form, every
change saves immediately and refreshes.


---------------------------------------------------------------------------
1.4 Shape the groups  —  /library, left "Groups" panel
---------------------------------------------------------------------------

Groups are the functional buckets attributes sit in (e.g. "Power", "Network",
"Imaging"). The panel lists every group with its attribute count.

  New group
    Does   — adds a functional group by name.
    Affects — a new bucket attributes can be added to; appears everywhere the
              library is grouped.

  Select a group
    Does   — makes it the active group; its attributes show in the right panel.
    Affects — which attributes you're editing.

  Rename  (pencil, active group)
    Does   — renames the selected group.
    Affects — the label shown across the library.

  Move up / Move down  (arrows, active group)
    Does   — reorders the group.
    Affects — the display order of groups in the library and pickers.

  Delete  (trash, active group)
    Does   — removes the group.
    Affects — its attributes; handle/move them first.

  Then check:
    - /library — the group appears in the left panel with a 0 count, ready for
      attributes.


---------------------------------------------------------------------------
1.5 Add attributes to a group  —  /library, right "Attributes" panel
---------------------------------------------------------------------------

With a group selected, "Add attribute" opens the inline form. Each row also has
edit, move-to-group, and delete actions. A small link-badge on a row shows how
many compatibility rules reference that attribute.

  Name (required)
    Does   — the attribute label (e.g. "PoE draw", "Ports"). Its stable key is
             derived from the label on save.
    Affects — shown in the library and product composer; is the spec key that
              rules bind to.

  Type
    Does   — Number / Single-select / Multi-select / Yes-No / Text.
    Affects — how a product enters the value; only Number attributes feed
              sum/count/ratio rules, selects feed spec-match rules.

  Unit  (Number only)
    Does   — measurement unit (e.g. W, ports, Mbps).
    Affects — displayed next to values; the unit the engine reasons in.

  Options — separate with |  (Single/Multi-select only)
    Does   — the dropdown choices, pipe-separated (e.g. AC|DC|PoE).
    Affects — the values a product can pick and a rule clause can match.

  Move to group  (arrow action)
    Does   — reassigns the attribute to another group.
    Affects — where it lives in the library.

  Link badge  (read-only)
    Does   — shows the count of compatibility rules using this attribute.
    Affects — nothing directly; a warning that deleting/editing it touches rules.

  Then check:
    - /library — the attribute appears in the group with its type badge, unit,
      and generated key.
    - /specifications — the same attribute is listed in the browse view, and the
      group filter beside the search finds it.


---------------------------------------------------------------------------
1.5b Full attribute detail (optional)  —  /specifications/new
---------------------------------------------------------------------------

The /library Builder covers the fast path (name, type, unit, options). For the
richer settings — which CATEGORIES an attribute is offered to, in-form "force
this value" rules, fixed numeric choices, and nested sub-fields — use the full
form at /specifications/new (or edit a row from the /specifications browse
list). These extra fields:

  Categories (required, at least one)
    Does   — which categories this attribute is offered to.
    Affects — determines which products can select this spec key.

  Numeric values (Number attributes)
    Does   — optional fixed numeric choices (e.g. 24 / 32 / 52 ports) instead of
             a free number.
    Affects — turns the numeric field into a dropdown on the product.

  Options with nested sub-fields (Select attributes)
    Does   — each option can carry its own nested numeric/select sub-fields.
    Affects — the values a product can choose; the values a rule clause can
              force/require.

  Rules (inline)
    Does   — conditional "force this value" clauses (match all/any, then force
             key/value).
    Affects — in-form spec-level constraints applied when a product is composed.

  Then check:
    - /specifications — the attribute shows its categories and any inline rules.
    - /library — it still appears in its group in the Builder.


---------------------------------------------------------------------------
1.6 CREATE a Compatibility Rule  —  /rules/new
---------------------------------------------------------------------------

A cross-product constraint that binds to specifications, never to products: any
product carrying the consumer spec participates, any carrying the provider spec
supplies capacity. This is what guards a customer's BOQ later.

  Name (required)
    Does   — rule display name.
    Affects — /rules, and the message surfaced in the customer's Design Check.

  Description
    Does   — explains the rule to staff.
    Affects — rule detail / playground.

  Kind
    Does   — the family: Budget (sum vs capacity), Count (items vs slots),
             Per-item threshold, Ratio (demand / supply), Spec match.
    Affects — which math the engine runs.

  Consumed specification
    Does   — the spec on demanding items (e.g. camera PoE draw).
    Affects — the consumer side of the aggregation.

  Capacity specification
    Does   — the spec on supplying items (e.g. switch PoE budget).
    Affects — the provider side of the aggregation.

  Comparator
    Does   — must be <= / >= / = / one of / intersects. Numeric for
             sum/count/ratio; set operators for spec-match.
    Affects — the pass/fail test.

  Allocation
    Does   — pooled (all providers as one pool) or per_provider (each unit is
             its own bin).
    Affects — how provider capacity is split across units.

  Headroom % (1-100)
    Does   — safety margin applied to capacity.
    Affects — tightens the threshold (e.g. only 80% of PoE budget usable).

  Ratio limit
    Does   — target contention ratio for the "ratio" kind (e.g. 20 = 20:1).
             Ignored otherwise.
    Affects — the oversubscription cap.

  Condition spec key / value
    Does   — optional consumer filter; only items matching it are counted. Both
             empty means no condition.
    Affects — scopes the rule to a subset of items.

  Severity
    Does   — block (hard fail) or warn (soft advisory).
    Affects — whether the BOQ is blocked or merely flagged.

  Enabled
    Does   — on/off without deleting.
    Affects — whether the engine evaluates it.

  Tip: validate rules in isolation on /rules/playground before enabling.

  Then check:
    - /rules — the rule appears with its kind and severity.
    - /rules/playground — the rule evaluates against sample items.


---------------------------------------------------------------------------
1.7 CREATE a Product  —  /products/new
---------------------------------------------------------------------------

The sellable item. It pulls together a brand and category, then selects the spec
keys (from 1.5) it carries and gives each a value — those values are what the
1.6 rules and the presence engine read.

  Category (required)
    Does   — the taxonomy node; gates which spec keys are offered.
    Affects — browse nav; available specs in the composer.

  Brand (required)
    Does   — the manufacturer.
    Affects — brand label; brand-scoped listings.

  Name (required)
    Does   — product name.
    Affects — everywhere the product shows.

  Model / Brand id value
    Does   — the vendor's model and id under the brand's ID label.
    Affects — product detail; search.

  Series code (max 4)
    Does   — short series token.
    Affects — feeds the generated SKU.

  Warranty period / region, Country of origin
    Does   — commercial metadata.
    Affects — product detail.

  Short description / Description
    Does   — marketing copy.
    Affects — product card / detail.

  Datasheet
    Does   — uploaded PDF (documents endpoint).
    Affects — download link on product detail.

  Image / Images
    Does   — primary and gallery images.
    Affects — product cards and gallery.

  Price + Currency (required)
    Does   — public MSRP.
    Affects — cart/BOQ pricing, revenue rollups.

  Availability
    Does   — Available / Not available.
    Affects — whether customers can add it.

  Spec keys (multi)
    Does   — which library attributes this product carries.
    Affects — the attributes shown; what rules/presence can read.

  Technical attributes
    Does   — the value for each chosen spec key.
    Affects — the actual numbers/values the compatibility engine aggregates.

  Status
    Does   — In stock / Out of stock / Limited / Pre-order / In order / EOS /
             EOL.
    Affects — availability badge; purchase gating.

  Order
    Does   — manual sort weight.
    Affects — ordering in listings.

  SKU is generated from brand + series + sequence on save.

  Then check:
    - /products — the product appears with its SKU and status.


===========================================================================
PHASE 2 — SALES CONSOLE (REVIEW AND ROUTE)
===========================================================================

The admin app does not create BOQs, offers, or partner/government accounts — the
client app submits those. Here the admin reviews and routes them. Each item
below is an admin action on an admin page.


---------------------------------------------------------------------------
2.1 Assign a pre-seller to a BOQ  —  /boqs
---------------------------------------------------------------------------

BOQs that customers submit land here. Assign a pre-seller (a Clerk user with the
pre-seller role) to a draft/submitted BOQ, or clear the assignment.

  Assign pre-seller
    Does   — puts the BOQ in that pre-seller's queue to review, price-check, and
             dispatch.
    Affects — the BOQ's owner; who can advance it to partners.

  Then check:
    - /boqs — the BOQ shows the assigned pre-seller. Once reviewed and
      dispatched, its status advances (reviewed to offered) and it becomes
      visible to matched partners for pricing.


---------------------------------------------------------------------------
2.2 Review an Offer  —  /offers
---------------------------------------------------------------------------

Partner offers on dispatched BOQs land here as "pending".

  Approve
    Does   — records reviewer and time, moves the offer to approved.
    Affects — the offer becomes selectable by the customer in the client app.

  Reject (reason required)
    Does   — records reviewer and reason.
    Affects — offer moves to rejected; partner is notified.

  Then check:
    - /offers — status flips to approved/rejected with the reviewer stamped.


---------------------------------------------------------------------------
2.3 Approve a Partner request  —  /partners
---------------------------------------------------------------------------

Partner applications (individual / facility / government applicant types, each
choosing capabilities) land here.

  Approve (plus integration toggle)
    Does   — invites the email to set up a partner account (or sets the role on
             an existing Clerk user), records reviewer, and sets whether the
             partner is integrated.
    Affects — applicant gains the partner role and can log in to the partner
              surface.

  Reject (reason required)
    Does   — records reviewer and reason.
    Affects — request moves to rejected.

  Then check:
    - /partners — status flips to approved/rejected.


---------------------------------------------------------------------------
2.4 Set the Partner Discount matrix  —  /partner-discounts
---------------------------------------------------------------------------

A single central matrix of percentage discounts per capability. All six take a
whole-number percent (0-100), and they stack per the partner's held
capabilities.

  System Integrator           — discount applied when this capability participates.
  Have stock                  — same.
  Install and program network — same.
  Install network only        — same.
  Pre-sell partner            — same.
  Post-sell partner           — same.

  Then check:
    - /partner-discounts — the saved percentages persist and drive partner
      pricing.


---------------------------------------------------------------------------
2.5 Review Government requests  —  /government
---------------------------------------------------------------------------

Government account applications need admin approval before the user exists.

  Approve / Reject
    Does   — same invite/role pattern as partners; rejection needs a reason.
    Affects — a government-type client account is created on approval.

  Then check:
    - /government — status updates; approved applicants can sign in.


===========================================================================
QUICK DEPENDENCY MAP (CHEAT SHEET)
===========================================================================

  Catalog (all authored in admin):

    Classification  -> Category  -+
    Brand  -----------------------+
    Spec Library attributes  -----+--> PRODUCT
    Compatibility Rules  ---------+

    (Spec Library = /library is the Builder where groups and attributes are
     created inline; /specifications is the browse list + full-detail form.)

  Sales console (admin reviews client submissions):

    BOQ (submitted by customer)  -> assign pre-seller -> dispatch
    Offer (submitted by partner) -> approve / reject
    Partner request              -> approve / reject   (+ Partner Discounts)
    Government request           -> approve / reject


===========================================================================
GOLDEN PATH (THE ADMIN STEPS THAT EXERCISE THE CATALOG)
===========================================================================

  1. Classification, then Category and Brand
  2. Spec Library: build groups + attributes on /library (browse on /specifications)
  3. Compatibility Rule
  4. Product (with spec values)
  5. Assign pre-seller to an incoming BOQ, dispatch
  6. Approve a partner request, set Partner Discounts
  7. Approve an offer

After these, the catalog listings, /library, /boqs, /offers, /partners, and
/partner-discounts all carry live data — with no seed involved anywhere.
