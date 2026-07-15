"use client";

import { RuleRowActions } from "@/components/rules/rule-row-actions";
import { RULE_KIND_LABELS, RULE_SEVERITY_LABELS } from "@/db/label";
import { Table } from "ui";
import type { TableColumn } from "ui";
import type { CompatibilityRuleListItem } from "services";

type RulesTableProps = {
  rules: CompatibilityRuleListItem[];
};

const specLabel = (label: string | null, unit: string | null): string =>
  label ? (unit ? `${label} (${unit})` : label) : "—";

const columns: TableColumn<CompatibilityRuleListItem>[] = [
  {
    key: "name",
    header: "Rule",
    render: (rule) => (
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-ink">{rule.name}</span>
        {rule.description && (
          <span className="text-xs text-muted">{rule.description}</span>
        )}
      </div>
    ),
  },
  {
    key: "kind",
    header: "Type",
    render: (rule) => (
      <span className="rounded-full bg-hover px-2 py-0.5 text-xs font-medium text-secondary">
        {RULE_KIND_LABELS[rule.kind]}
      </span>
    ),
  },
  {
    key: "binding",
    header: "Checks",
    render: (rule) => (
      <span className="text-muted">
        {specLabel(rule.consumerSpecLabel, rule.consumerSpecUnit)}{" "}
        {rule.comparator === "lte" ? "≤" : "≥"}{" "}
        {rule.headroomPercent < 100 ? `${rule.headroomPercent}% of ` : ""}
        {specLabel(rule.providerSpecLabel, rule.providerSpecUnit)}
      </span>
    ),
  },
  {
    key: "condition",
    header: "Condition",
    render: (rule) =>
      rule.condition ? (
        <span className="text-muted">
          {rule.condition.specKey} = {rule.condition.values.join(" / ")}
        </span>
      ) : (
        <span className="text-faint">—</span>
      ),
  },
  {
    key: "severity",
    header: "On violation",
    render: (rule) => (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          rule.severity === "block"
            ? "bg-red-50 text-red-700"
            : "bg-amber-50 text-amber-700"
        }`}
      >
        {RULE_SEVERITY_LABELS[rule.severity]}
      </span>
    ),
  },
  {
    key: "enabled",
    header: "Status",
    render: (rule) => (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          rule.enabled
            ? "bg-emerald-50 text-emerald-700"
            : "bg-hover text-faint"
        }`}
      >
        {rule.enabled ? "Enabled" : "Disabled"}
      </span>
    ),
  },
  {
    key: "actions",
    header: "Action",
    align: "right",
    render: (rule) => <RuleRowActions uuid={rule.uuid} name={rule.name} />,
  },
];

export const RulesTable = ({ rules }: RulesTableProps) => (
  <Table
    columns={columns}
    data={rules}
    emptyMessage="No compatibility rules yet."
  />
);
