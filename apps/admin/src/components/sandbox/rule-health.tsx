import { getRuleReachabilityAction } from "@/app/(dashboard)/sandbox/actions";
import type { RuleReach, RuleReachStatus } from "services";
import { CircleCheck, CircleSlash, Package, PencilLine, Ban } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// WHICH RULES ARE ACTUALLY GUARDING ANYTHING.
//
// The sandbox answers "what happens to this basket". It cannot answer this one,
// because a rule that engaged with nothing produces exactly the same silence as
// a rule that passed. Only a static read of the catalogue separates them.
//
// Ordered worst-first, and the ones that work are collapsed to a count. A health
// screen that lists twenty green rows above the one red one has buried its own
// finding.
// ---------------------------------------------------------------------------

type StatusMeta = {
  label: string;
  // Who has to do something about it. The whole point of the split.
  owner: string;
  icon: LucideIcon;
  style: string;
};

type RuleHealthRowProps = {
  rule: RuleReach;
};

const STATUS: Record<RuleReachStatus, StatusMeta> = {
  unassigned: {
    label: "Guards nothing",
    owner: "Authoring mistake — permanent until fixed",
    icon: Ban,
    style: "border-red-500/30 bg-red-500/10 text-red-400",
  },
  value_disabled: {
    label: "Dead by configuration",
    owner: "The rule and the assignment disagree",
    icon: CircleSlash,
    style: "border-red-500/30 bg-red-500/10 text-red-400",
  },
  no_values: {
    label: "Waiting on data",
    owner: "Products are there; the values are blank",
    icon: PencilLine,
    style: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  },
  no_products: {
    label: "Waiting on stock",
    owner: "Set up correctly; the shelves are empty",
    icon: Package,
    style: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  },
  reachable: {
    label: "Guarding",
    owner: "Assigned, stocked and filled in",
    icon: CircleCheck,
    style: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
};

// Worst first. `reachable` is last because it is the only one nobody acts on.
const ORDER: RuleReachStatus[] = [
  "unassigned",
  "value_disabled",
  "no_values",
  "no_products",
  "reachable",
];

const RuleHealthRow = ({ rule }: RuleHealthRowProps) => {
  const meta = STATUS[rule.status];
  const Icon = meta.icon;

  return (
    <div className={`flex flex-col gap-1.5 rounded-card border px-3 py-2.5 ${meta.style}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-sm font-medium line-clamp-1">
          {rule.name}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase">
          <Icon size={12} />
          {meta.label}
        </span>
      </div>

      <p className="text-xs">{rule.reason}</p>

      {/* The counts behind the verdict, so nobody has to take it on trust. */}
      <div className="flex flex-col gap-0.5">
        {rule.attributes.map((attribute) => (
          <p
            key={attribute.specUuid}
            className="flex items-baseline justify-between gap-2 text-[11px] opacity-80"
          >
            <span className="min-w-0 line-clamp-1">{attribute.label}</span>
            <span className="shrink-0 font-mono">
              {attribute.liveCategories} live · {attribute.categoriesWithProducts}{" "}
              stocked · {attribute.productsAnswering} answered
            </span>
          </p>
        ))}
      </div>
    </div>
  );
};

export const RuleHealth = async () => {
  const rules = await getRuleReachabilityAction();

  if (rules.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-hairline px-4 py-8 text-center text-xs text-faint">
        No rules authored yet.
      </p>
    );
  }

  const ranked = [...rules].sort(
    (a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status),
  );
  const actionable = ranked.filter((rule) => rule.status !== "reachable");
  const guarding = ranked.length - actionable.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-hairline bg-base px-3 py-2.5 text-xs">
        <span className="text-secondary">
          <span className="font-medium text-emerald-400">{guarding}</span> of{" "}
          <span className="font-medium text-ink">{ranked.length}</span> rules are
          guarding something
        </span>
        {actionable.length > 0 && (
          <span className="text-secondary">
            <span className="font-medium text-amber-500">
              {actionable.length}
            </span>{" "}
            need attention
          </span>
        )}
      </div>

      {actionable.map((rule) => (
        <RuleHealthRow key={rule.uuid} rule={rule} />
      ))}

      {guarding > 0 && (
        <details className="rounded-card border border-hairline bg-base px-3 py-2.5">
          <summary className="cursor-pointer text-xs text-secondary">
            {guarding} rule{guarding === 1 ? "" : "s"} working as intended
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {ranked
              .filter((rule) => rule.status === "reachable")
              .map((rule) => (
                <RuleHealthRow key={rule.uuid} rule={rule} />
              ))}
          </div>
        </details>
      )}
    </div>
  );
};
