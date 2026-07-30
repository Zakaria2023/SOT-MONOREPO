import type { CatalogAuditEntry } from "@/app/(dashboard)/activity/action";
import type { CatalogAuditAction } from "@/db/enum";
import {
  CATALOG_AUDIT_ACTION_LABELS,
  CATALOG_AUDIT_TARGET_LABELS,
} from "@/db/label";
import { filterHref } from "@/lib/filter-href";
import { History, User } from "lucide-react";
import Link from "next/link";

type ActivityFeedProps = {
  entries: CatalogAuditEntry[];
  filters: Record<string, string | undefined>;
  // True when the feed is empty because a filter excluded everything rather than
  // because nothing has happened. Telling someone who narrowed to deletions that
  // nothing has ever changed would be a lie about the rest of the trail.
  filtered: boolean;
};

type DaySection = {
  day: string;
  entries: CatalogAuditEntry[];
};

const ACTION_CLASSES: Record<CatalogAuditAction, string> = {
  create: "bg-success-tint text-success",
  update: "bg-primary-tint text-primary",
  delete: "bg-danger-tint text-danger",
  publish: "bg-warning-tint text-warning",
};

// A change value is typed `unknown` because the trail records whatever the field
// held. Rendering it has to survive an object without printing "[object Object]",
// which would be worse than saying nothing.
const describeChangeValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  const encoded = JSON.stringify(value);
  return encoded.length > 60 ? `${encoded.slice(0, 60)}…` : encoded;
};

const sectionByDay = (entries: CatalogAuditEntry[]): DaySection[] => {
  const sections: DaySection[] = [];
  for (const entry of entries) {
    const day = new Date(entry.createdAt).toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const current = sections.find((section) => section.day === day);
    if (current) {
      current.entries.push(entry);
    } else {
      sections.push({ day, entries: [entry] });
    }
  }
  return sections;
};

export const ActivityFeed = ({
  entries,
  filters,
  filtered,
}: ActivityFeedProps) => {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-card border border-hairline bg-surface p-10 text-center shadow-[0_1px_2px_rgba(27,35,51,0.04)]">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-hover text-faint">
          <History size={20} />
        </span>
        <p className="text-sm font-semibold text-ink">
          {filtered ? "Nothing matches these filters." : "Nothing recorded yet."}
        </p>
        <p className="max-w-md text-xs leading-relaxed text-faint">
          {filtered
            ? "Clear a filter above to see the rest of the trail."
            : "Every change to a library attribute, an assignment, a rule or a project input is recorded here as it happens."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {sectionByDay(entries).map((section) => (
        <div key={section.day} className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-wide text-faint uppercase">
            {section.day}
          </span>

          <ul className="flex flex-col gap-2">
            {section.entries.map((entry) => (
              <li
                key={entry.uuid}
                className="flex flex-col gap-2 rounded-card border border-hairline bg-surface p-4 shadow-[0_1px_2px_rgba(27,35,51,0.04)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ACTION_CLASSES[entry.action]}`}
                  >
                    {CATALOG_AUDIT_ACTION_LABELS[entry.action]}
                  </span>
                  <span className="rounded-full bg-hover px-2 py-0.5 text-[11px] font-semibold text-faint">
                    {CATALOG_AUDIT_TARGET_LABELS[entry.target]}
                  </span>
                  {/* The label as it was AT THE TIME, which is why a deleted or
                      renamed thing still reads correctly here. */}
                  <span className="text-sm font-medium text-ink">
                    {entry.targetLabel}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
                  <span className="flex items-center gap-1">
                    <User size={12} />
                    {entry.actorName ?? "System"}
                  </span>
                  <span>
                    {new Date(entry.createdAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <Link
                    href={filterHref("/activity", filters, {
                      target: "",
                      action: "",
                      search: "",
                      item: entry.targetUuid,
                    })}
                    className="font-semibold text-primary hover:underline"
                  >
                    Only this item
                  </Link>
                </div>

                {entry.changes && entry.changes.length > 0 && (
                  <ul className="flex flex-col gap-0.5 border-t border-hairline pt-2">
                    {entry.changes.map((change) => (
                      <li key={change.field} className="text-xs text-muted">
                        <span className="text-faint">{change.field}</span>{" "}
                        {describeChangeValue(change.from)}
                        <span className="text-faint"> → </span>
                        <span className="font-medium text-ink">
                          {describeChangeValue(change.to)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};
