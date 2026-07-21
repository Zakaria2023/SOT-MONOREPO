"use client";

import { SpecificationRowActions } from "@/components/specifications/specification-row-actions";
import type { SpecificationDomain } from "@/db/enum";
import { SPECIFICATION_DOMAIN_LABELS } from "@/db/label";
import type { LibraryDomain, SelectSpecifications } from "services";
import { Hash, List, ListChecks, ToggleLeft } from "lucide-react";
import { useMemo, useState } from "react";

type LibraryViewProps = {
  domains: LibraryDomain[];
};

const domainLabel = (domain: string | null): string =>
  domain
    ? (SPECIFICATION_DOMAIN_LABELS[domain as SpecificationDomain] ?? domain)
    : "Other";

// A short human summary of an attribute's value type and options.
const attributeMeta = (spec: SelectSpecifications): string => {
  if (spec.valueType === "number") {
    return spec.unit ? `Number · ${spec.unit}` : "Number";
  }
  const options = spec.options ?? [];
  const isYesNo =
    options.length === 2 &&
    options.every((option) => ["Yes", "No"].includes(option.value));
  if (isYesNo) {
    return "Yes / No";
  }
  const kind = spec.allowMultiple ? "Multi-select" : "Single-select";
  return `${kind} · ${options.length} option${options.length === 1 ? "" : "s"}`;
};

const AttributeIcon = ({ spec }: { spec: SelectSpecifications }) => {
  if (spec.valueType === "number") {
    return <Hash size={15} className="text-faint" />;
  }
  const options = spec.options ?? [];
  const isYesNo =
    options.length === 2 &&
    options.every((option) => ["Yes", "No"].includes(option.value));
  if (isYesNo) {
    return <ToggleLeft size={15} className="text-faint" />;
  }
  return spec.allowMultiple ? (
    <ListChecks size={15} className="text-faint" />
  ) : (
    <List size={15} className="text-faint" />
  );
};

export const LibraryView = ({ domains }: LibraryViewProps) => {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return domains;
    }
    return domains
      .map((domain) => ({
        ...domain,
        groups: domain.groups
          .map((group) => ({
            ...group,
            attributes: group.attributes.filter(
              (attribute) =>
                attribute.label.toLowerCase().includes(term) ||
                group.group.name.toLowerCase().includes(term),
            ),
          }))
          .filter((group) => group.attributes.length > 0),
      }))
      .filter((domain) => domain.groups.length > 0);
  }, [domains, query]);

  const totalAttributes = domains.reduce(
    (sum, domain) =>
      sum +
      domain.groups.reduce((groupSum, group) => groupSum + group.attributes.length, 0),
    0,
  );

  return (
    <div className="flex flex-col gap-5">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`Search ${totalAttributes} attributes...`}
        className="w-full rounded-control border border-search-border bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
      />

      {filtered.length === 0 ? (
        <p className="rounded-card border border-hairline bg-surface p-10 text-center text-sm text-faint">
          No attributes match your search.
        </p>
      ) : (
        filtered.map((domain, domainIndex) => (
          <section
            key={domain.domain ?? `other-${domainIndex}`}
            className="flex flex-col gap-3"
          >
            <h2 className="text-xs font-bold uppercase tracking-wider text-faint">
              {domainLabel(domain.domain)}
            </h2>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {domain.groups.map((group) => (
                <div
                  key={group.group.uuid || group.group.name}
                  className="flex flex-col overflow-hidden rounded-card border border-hairline bg-surface"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-hairline bg-hover/40 px-4 py-3">
                    <h3 className="font-heading text-sm text-ink">
                      {group.group.name}
                    </h3>
                    <span className="rounded-full bg-primary-tint px-2 py-0.5 text-xs font-semibold text-primary">
                      {group.attributes.length}
                    </span>
                  </div>

                  {group.attributes.length === 0 ? (
                    <p className="px-4 py-4 text-xs text-faint">
                      No attributes in this group yet.
                    </p>
                  ) : (
                    <ul className="divide-y divide-hairline">
                      {group.attributes.map((attribute) => (
                        <li
                          key={attribute.uuid}
                          className="flex items-center gap-3 px-4 py-2.5"
                        >
                          <AttributeIcon spec={attribute} />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-sm font-medium text-ink">
                              {attribute.label}
                            </p>
                            <p className="text-xs text-faint">
                              {attributeMeta(attribute)}
                            </p>
                          </div>
                          <SpecificationRowActions
                            uuid={attribute.uuid}
                            label={attribute.label}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
};
