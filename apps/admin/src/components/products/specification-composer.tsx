"use client";

import type { ProductFormValues } from "@/app/(dashboard)/products/validation";
import { EyeOff, Zap } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import type { ProductFormAttribute } from "services";
import { Checkbox, Dropdown } from "ui";
import {
  parseSpecValues,
  serializeSpecRange,
  serializeSpecValues,
  splitSpecRange,
} from "utils";

type SpecificationComposerProps = {
  // Every category's resolved attributes, keyed by category uuid. Options are
  // already narrowed to each category's enabled slice, so this form can never
  // offer a value the category has disabled.
  attributesByCategory: Record<string, ProductFormAttribute[]>;
};

// A value the product still stores although its category no longer assigns the
// attribute — an older product, or one moved between categories. Surfaced so
// it can be seen and cleared rather than silently orphaned.
type StrandedValue = {
  key: string;
  value: string;
};

const showIfSatisfied = (
  attribute: ProductFormAttribute,
  values: Record<string, string>,
): boolean => {
  if (!attribute.showIf) {
    return true;
  }
  // A multi-select controller is stored comma-joined; the condition holds if
  // any chosen value is listed.
  const chosen = parseSpecValues(values[attribute.showIf.specKey]);
  return chosen.some((value) => attribute.showIf?.values.includes(value));
};

export const SpecificationComposer = ({
  attributesByCategory,
}: SpecificationComposerProps) => {
  const { control, setValue } = useFormContext<ProductFormValues>();
  const watchedValues = useWatch({ control, name: "technicalAttributes" });
  const categoryUuid = useWatch({ control, name: "categoryUuid" });
  const values = useMemo(() => watchedValues ?? {}, [watchedValues]);

  const assigned = useMemo(
    () => (categoryUuid ? (attributesByCategory[categoryUuid] ?? []) : []),
    [attributesByCategory, categoryUuid],
  );

  // Show-if, run to a fixed point: hiding a controller hides whatever depends
  // on it in turn. Bounded by the attribute count so a circular condition
  // settles instead of spinning.
  const visible = useMemo(() => {
    let current = assigned;
    for (let pass = 0; pass <= assigned.length; pass += 1) {
      const present = new Set(current.map((attribute) => attribute.key));
      const next = current.filter(
        (attribute) =>
          showIfSatisfied(attribute, values) &&
          (!attribute.showIf || present.has(attribute.showIf.specKey)),
      );
      if (next.length === current.length) {
        return next;
      }
      current = next;
    }
    return current;
  }, [assigned, values]);

  const visibleKeys = useMemo(
    () => visible.map((attribute) => attribute.key),
    [visible],
  );

  // Two things happen here, and the second is the one that's easy to miss.
  //
  // specKeys is derived, not picked: the category decides what a product
  // carries, so the stored list is kept equal to what the form shows.
  //
  // And a hidden attribute's value is CLEARED, not merely hidden. A PoE budget
  // left behind on a product whose PoE is now "No" would let the engine size a
  // switch off a number that no longer applies. Values whose key this category
  // never assigns are left alone — those belong to an older product, and
  // dropping them here would destroy data this form knows nothing about.
  useEffect(() => {
    const assignedKeys = new Set(assigned.map((attribute) => attribute.key));
    const shown = new Set(visibleKeys);
    const stale = Object.keys(values).filter(
      (key) => assignedKeys.has(key) && !shown.has(key),
    );

    if (stale.length > 0) {
      const next = { ...values };
      for (const key of stale) {
        delete next[key];
      }
      setValue("technicalAttributes", next, { shouldDirty: true });
    }
  }, [assigned, visibleKeys, values, setValue]);

  useEffect(() => {
    setValue("specKeys", visibleKeys, { shouldDirty: false });
  }, [visibleKeys, setValue]);

  const stranded: StrandedValue[] = useMemo(() => {
    const assignedKeys = new Set(assigned.map((attribute) => attribute.key));
    return Object.entries(values)
      .filter(([key]) => !assignedKeys.has(key))
      .map(([key, value]) => ({ key, value }));
  }, [assigned, values]);

  const setValueFor = (key: string, value: string) => {
    const next = { ...values };
    if (value) {
      next[key] = value;
    } else {
      delete next[key];
    }
    setValue("technicalAttributes", next, { shouldDirty: true });
  };

  const toggleMulti = (key: string, option: string, checked: boolean) => {
    const current = parseSpecValues(values[key]);
    const selected = checked
      ? [...current, option]
      : current.filter((value) => value !== option);
    setValueFor(key, selected.length > 0 ? serializeSpecValues(selected) : "");
  };

  const setRange = (key: string, part: "from" | "to", value: string) => {
    const [from, to] = splitSpecRange(values[key]);
    const nextFrom = part === "from" ? value : from;
    const nextTo = part === "to" ? value : to;
    setValueFor(
      key,
      nextFrom.trim() === "" && nextTo.trim() === ""
        ? ""
        : serializeSpecRange(nextFrom, nextTo),
    );
  };

  const renderInput = (attribute: ProductFormAttribute) => {
    if (attribute.valueType === "number") {
      if (attribute.allowRange) {
        const [from, to] = splitSpecRange(values[attribute.key]);
        return (
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="any"
              value={from}
              onChange={(event) =>
                setRange(attribute.key, "from", event.target.value)
              }
              placeholder="From"
              className="w-full flex-1 rounded-control border border-hairline bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
            />
            <span className="text-sm text-faint">–</span>
            <div className="relative flex-1">
              <input
                type="number"
                step="any"
                value={to}
                onChange={(event) =>
                  setRange(attribute.key, "to", event.target.value)
                }
                placeholder="To"
                className="w-full rounded-control border border-hairline bg-surface px-4 py-2.5 pr-14 text-sm text-ink outline-none focus:border-primary"
              />
              {attribute.unit && (
                <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs font-medium text-faint">
                  {attribute.unit}
                </span>
              )}
            </div>
          </div>
        );
      }
      return (
        <div className="relative">
          <input
            type="number"
            step="any"
            value={values[attribute.key] ?? ""}
            onChange={(event) => setValueFor(attribute.key, event.target.value)}
            placeholder="0"
            className="w-full rounded-control border border-hairline bg-surface px-4 py-2.5 pr-14 text-sm text-ink outline-none focus:border-primary"
          />
          {attribute.unit && (
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs font-medium text-faint">
              {attribute.unit}
            </span>
          )}
        </div>
      );
    }

    if (attribute.allowMultiple) {
      const selected = parseSpecValues(values[attribute.key]);
      return (
        <div className="flex flex-col gap-2 rounded-control border border-hairline bg-surface p-3">
          {attribute.options.length === 0 ? (
            <span className="text-sm text-faint">
              This category enables no values for this attribute.
            </span>
          ) : (
            attribute.options.map((option) => (
              <Checkbox
                key={option}
                label={option}
                checked={selected.includes(option)}
                onChange={(event) =>
                  toggleMulti(attribute.key, option, event.target.checked)
                }
              />
            ))
          )}
        </div>
      );
    }

    // A select with no options is free text in the library's model — without
    // this branch it would render as a dropdown containing only "—".
    if (attribute.options.length === 0) {
      return (
        <input
          type="text"
          value={values[attribute.key] ?? ""}
          onChange={(event) => setValueFor(attribute.key, event.target.value)}
          placeholder="Type a value"
          className="w-full rounded-control border border-hairline bg-surface px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
        />
      );
    }

    return (
      <Dropdown
        value={values[attribute.key] ?? ""}
        onChange={(value) => setValueFor(attribute.key, value)}
        placeholder="Select"
        options={[
          { value: "", label: "—" },
          ...attribute.options.map((option) => ({
            value: option,
            label: option,
          })),
        ]}
      />
    );
  };

  const hiddenCount = assigned.length - visible.length;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-sm font-semibold text-ink">
          Technical specifications
        </label>
        <p className="mt-1 text-xs text-muted">
          These come from the product&apos;s category — every attribute it is
          assigned, offering only the values that category enables. Change what
          appears here in Assignments, not on the product.
          {hiddenCount > 0 && (
            <span className="ml-1 font-semibold text-amber-700">
              {hiddenCount} hidden by a show-if condition.
            </span>
          )}
        </p>
      </div>

      {!categoryUuid ? (
        <p className="rounded-control border border-dashed border-hairline p-6 text-center text-sm text-faint">
          Pick a category first — it decides which attributes this product
          carries.
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-control border border-dashed border-hairline p-6 text-center text-sm text-faint">
          This category assigns no attributes yet. Assign some in Assignments
          and they appear here.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((attribute) => (
            <div key={attribute.key} className="flex flex-col gap-1.5">
              <label className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-ink">
                <span className="line-clamp-1">{attribute.label}</span>
                {attribute.unit && (
                  <span className="text-xs font-normal text-faint">
                    ({attribute.unit})
                  </span>
                )}
                {attribute.groupName && (
                  <span className="rounded bg-page px-1 py-0.5 text-[10px] font-medium text-muted">
                    {attribute.groupName}
                  </span>
                )}
                {!attribute.isFilter && attribute.isRule && (
                  <span
                    title="The engine reads this value; no shopper filters by it"
                    className="flex items-center gap-0.5 rounded bg-primary-tint px-1 py-0.5 text-[10px] font-medium text-primary"
                  >
                    <Zap size={9} />
                    rules only
                  </span>
                )}
                {attribute.showIf && (
                  <span className="flex items-center gap-0.5 text-[10px] text-faint">
                    <EyeOff size={9} />
                    conditional
                  </span>
                )}
              </label>
              {renderInput(attribute)}
            </div>
          ))}
        </div>
      )}

      {stranded.length > 0 && (
        <div className="rounded-control border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-800">
            Values this category no longer assigns
          </p>
          <p className="mt-0.5 text-[11px] text-amber-700">
            Left over from an earlier category or an older product. Nothing
            reads them; they are kept until you clear them.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {stranded.map((entry) => (
              <li key={entry.key}>
                <button
                  type="button"
                  onClick={() => setValueFor(entry.key, "")}
                  className="rounded-md border border-amber-300 bg-surface px-2 py-1 text-[11px] text-amber-800 transition-colors hover:border-amber-500"
                >
                  {entry.key}: {entry.value} ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
