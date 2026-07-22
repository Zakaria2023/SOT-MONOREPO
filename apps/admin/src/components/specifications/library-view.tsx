"use client";

import { SpecificationRowActions } from "@/components/specifications/specification-row-actions";
import type { SpecificationDomain } from "@/db/enum";
import { SPECIFICATION_DOMAIN_LABELS } from "@/db/label";
import type { LibraryDomain, SelectSpecifications } from "services";
import { Hash, List, ListChecks, ToggleLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { Dropdown } from "ui";
import type { DropdownOption } from "ui";

type LibraryViewProps = {
  domains: LibraryDomain[];
};

// The group filter is keyed either by "domain:<domain>" (the whole domain) or
// by a single group's stable key.
const ALL_GROUPS = "__all__";

const domainKey = (domain: string | null): string => `domain:${domain ?? "other"}`;

const groupKey = (group: LibraryDomain["groups"][number]["group"]): string =>
  group.uuid || `ungrouped:${group.name}`;

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
  const [groupFilter, setGroupFilter] = useState(ALL_GROUPS);

  // One entry per group, grouped under its domain as a searchable, indented
  // tree so the filter reads the same way the library does.
  const groupOptions = useMemo<DropdownOption[]>(() => {
    const options: DropdownOption[] = [{ value: ALL_GROUPS, label: "All groups" }];
    for (const domain of domains) {
      options.push({
        value: domainKey(domain.domain),
        label: domainLabel(domain.domain),
        depth: 0,
      });
      for (const group of domain.groups) {
        options.push({
          value: groupKey(group.group),
          label: group.group.name,
          depth: 1,
        });
      }
    }
    return options;
  }, [domains]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return domains
      .filter(
        (domain) =>
          groupFilter === ALL_GROUPS ||
          !groupFilter.startsWith("domain:") ||
          domainKey(domain.domain) === groupFilter,
      )
      .map((domain) => ({
        ...domain,
        groups: domain.groups
          .filter(
            (group) =>
              groupFilter === ALL_GROUPS ||
              groupFilter.startsWith("domain:") ||
              groupKey(group.group) === groupFilter,
          )
          .map((group) => ({
            ...group,
            attributes: term
              ? group.attributes.filter(
                  (attribute) =>
                    attribute.label.toLowerCase().includes(term) ||
                    group.group.name.toLowerCase().includes(term),
                )
              : group.attributes,
          }))
          .filter((group) => group.attributes.length > 0),
      }))
      .filter((domain) => domain.groups.length > 0);
  }, [domains, query, groupFilter]);

  const totalAttributes = domains.reduce(
    (sum, domain) =>
      sum +
      domain.groups.reduce((groupSum, group) => groupSum + group.attributes.length, 0),
    0,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-64">
          <Dropdown
            value={groupFilter}
            onChange={setGroupFilter}
            options={groupOptions}
            searchable
            placeholder="All groups"
            searchPlaceholder="Filter groups..."
            emptyMessage="No groups"
          />
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${totalAttributes} attributes...`}
          className="w-full flex-1 rounded-control border border-search-border bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
        />
      </div>

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
