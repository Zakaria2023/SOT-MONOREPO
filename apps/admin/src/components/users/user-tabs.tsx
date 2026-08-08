"use client";

import type { AdminUserDetail } from "services";
import type { SelectCatalogAudit } from "services";
import {
  CATALOG_AUDIT_ACTION_LABELS,
  CATALOG_AUDIT_TARGET_LABELS,
  USER_TYPE_LABELS,
} from "@/db/label";
import { useState } from "react";
import { formatMoney } from "utils";

// ---------------------------------------------------------------------------
// ONE PERSON, IN TABS.
//
// Six answers to six different questions, and only one of them is wanted at a
// time. Stacked on one page they compete: somebody looking for an order scrolls
// past a basket, and somebody chasing a partner decision scrolls past both.
//
// The tab lives in component state and not the URL. It is a reading position
// rather than a place — a colleague pasting a link means "look at this person",
// not "look at their fourth tab" — and every tab's data is already loaded.
// ---------------------------------------------------------------------------

type UserTabsProps = {
  detail: AdminUserDetail;
  audit: SelectCatalogAudit[];
};

type TabKey =
  | "profile"
  | "orders"
  | "boqs"
  | "cart"
  | "activity"
  | "audit";

type FieldProps = {
  label: string;
  value: string | null | undefined;
};

const Field = ({ label, value }: FieldProps) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[11px] tracking-wide text-faint uppercase">
      {label}
    </span>
    <span className="text-sm text-ink">
      {value === null || value === undefined || value === "" ? (
        <span className="text-faint">—</span>
      ) : (
        value
      )}
    </span>
  </div>
);

export const UserTabs = ({ detail, audit }: UserTabsProps) => {
  const [tab, setTab] = useState<TabKey>("profile");
  const { user, orders, boqs, cart, events, partner } = detail;

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "profile", label: "Profile" },
    { key: "orders", label: "Orders", count: orders.length },
    { key: "boqs", label: "BOQs", count: boqs.length },
    { key: "cart", label: "Basket", count: cart.length },
    { key: "activity", label: "Activity", count: events.length },
    { key: "audit", label: "Changes", count: audit.length },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1 border-b border-hairline">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === entry.key
                ? "border-primary font-medium text-ink"
                : "border-transparent text-secondary hover:text-ink"
            }`}
          >
            {entry.label}
            {entry.count !== undefined && (
              <span className="ml-1.5 text-[11px] text-faint">
                {entry.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4 rounded-card border border-hairline bg-surface p-5 sm:grid-cols-3">
            <Field label="Full name" value={user.fullName} />
            <Field
              label="Type"
              value={user.type ? USER_TYPE_LABELS[user.type] : null}
            />
            <Field label="Email" value={user.email} />
            <Field label="Phone" value={user.phone} />
            <Field label="Company" value={user.companyName} />
            <Field label="Location" value={user.location} />
            <Field
              label="Joined"
              value={new Date(user.createdAt).toLocaleDateString()}
            />
            {/* Shown because support needs it to match an account against Clerk
                when somebody cannot sign in. */}
            <Field label="Clerk id" value={user.clerkUserId} />
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-card border border-hairline bg-surface p-5 sm:grid-cols-3">
            <Field label="Unified number" value={user.unifiedNumber} />
            <Field label="CR number" value={user.crNumber} />
            <Field label="VAT number" value={user.vatNumber} />
            <Field label="Representative" value={user.representativeName} />
            <Field label="Rep. mobile" value={user.representativeMobile} />
            <Field label="Rep. email" value={user.representativeEmail} />
            <Field label="National address" value={user.nationalAddress} />
          </div>

          {partner && (
            <div className="flex flex-col gap-2 rounded-card border border-primary/30 bg-primary-tint p-5">
              <p className="text-sm font-medium text-ink">
                Partner · {partner.status}
                {partner.isIntegrated && " · integrated"}
              </p>
              <p className="text-xs text-secondary">
                Approved for:{" "}
                {partner.capabilities.length > 0
                  ? partner.capabilities.join(", ")
                  : "nothing — approved but unable to act"}
              </p>
            </div>
          )}
        </div>
      )}

      {tab === "orders" && (
        <div className="flex flex-col gap-2">
          {orders.length === 0 ? (
            <p className="rounded-card border border-dashed border-hairline px-4 py-8 text-center text-sm text-faint">
              Nothing ordered yet.
            </p>
          ) : (
            orders.map((order) => (
              <div
                key={order.uuid}
                className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-ink">{order.reference}</p>
                  <p className="text-[11px] text-muted">
                    {new Date(order.createdAt).toLocaleDateString()} ·{" "}
                    {order.itemCount} item{order.itemCount === 1 ? "" : "s"} ·{" "}
                    {order.status}
                    {order.invoiceNumber && ` · ${order.invoiceNumber}`}
                  </p>
                  {/* Recorded on the order itself. An override is the most
                      important thing on this screen when one exists. */}
                  {order.designOverrideReason && (
                    <p className="text-[11px] text-amber-500">
                      Overridden: {order.designOverrideReason}
                    </p>
                  )}
                </div>
                <span className="font-heading text-lg text-ink">
                  {formatMoney(
                    Number(order.grandTotal),
                    order.currency ?? "SAR",
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "boqs" && (
        <div className="flex flex-col gap-2">
          {boqs.length === 0 ? (
            <p className="rounded-card border border-dashed border-hairline px-4 py-8 text-center text-sm text-faint">
              No BOQs raised.
            </p>
          ) : (
            boqs.map((boq) => (
              <div
                key={boq.uuid}
                className="flex items-center justify-between gap-3 rounded-card border border-hairline bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-ink">{boq.reference}</p>
                  <p className="text-[11px] text-muted">
                    {new Date(boq.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs text-secondary">{boq.status}</span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "cart" && (
        <div className="flex flex-col gap-2">
          {cart.length === 0 ? (
            <p className="rounded-card border border-dashed border-hairline px-4 py-8 text-center text-sm text-faint">
              Their basket is empty.
            </p>
          ) : (
            cart.map((line) => (
              <div
                key={line.uuid}
                className="flex items-center justify-between gap-3 rounded-card border border-hairline bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  {/* A product deleted since it was added. Said plainly rather
                      than rendered blank — a nameless row reads as a bug. */}
                  <p className="text-sm text-ink">
                    {line.name ?? (
                      <span className="text-amber-500">
                        This product has been deleted
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted">
                    Added {new Date(line.addedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-sm text-secondary">
                  {line.quantity} ×{" "}
                  {line.unitPrice
                    ? formatMoney(
                        Number(line.unitPrice),
                        line.currency ?? "SAR",
                      )
                    : "no price"}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "activity" && (
        <div className="flex flex-col gap-2">
          {events.length === 0 ? (
            <p className="rounded-card border border-dashed border-hairline px-4 py-8 text-center text-sm text-faint">
              Nothing has happened on this account yet.
            </p>
          ) : (
            events.map((event, index) => (
              <div
                key={`${event.kind}-${index}`}
                className="flex items-start justify-between gap-3 rounded-card border border-hairline bg-surface px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm text-ink">{event.summary}</p>
                  {event.detail && (
                    <p className="text-[11px] text-muted">{event.detail}</p>
                  )}
                </div>
                <span className="shrink-0 text-[11px] text-faint">
                  {new Date(event.at).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "audit" && (
        <div className="flex flex-col gap-2">
          {/* Deliberately separate from Activity. That tab is what this person
              did; this one is what staff did TO their record, which is an
              accountability question and not a history. */}
          <p className="text-xs text-muted">
            Changes made to this record by staff.
          </p>
          {audit.length === 0 ? (
            <p className="rounded-card border border-dashed border-hairline px-4 py-8 text-center text-sm text-faint">
              Nobody has changed this record.
            </p>
          ) : (
            audit.map((entry) => (
              <div
                key={entry.uuid}
                className="flex flex-col gap-0.5 rounded-card border border-hairline bg-surface px-4 py-2.5"
              >
                <p className="text-sm text-ink">
                  {CATALOG_AUDIT_ACTION_LABELS[entry.action]}{" "}
                  {CATALOG_AUDIT_TARGET_LABELS[entry.target].toLowerCase()}
                </p>
                <p className="text-[11px] text-faint">
                  {entry.actorName ?? "System"} ·{" "}
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
                {(entry.changes ?? []).map((change) => (
                  <p key={change.field} className="text-[11px] text-secondary">
                    {change.field}:{" "}
                    <span className="font-mono">
                      {String(change.from ?? "—")} → {String(change.to ?? "—")}
                    </span>
                  </p>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
