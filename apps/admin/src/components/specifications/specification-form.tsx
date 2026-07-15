"use client";

import { useSpecificationForm } from "@/app/(dashboard)/specifications/use-specification-form";
import { CategoryMultiSelect } from "@/components/specifications/category-multi-select";
import { RulesEditor } from "@/components/specifications/rules-editor";
import { SpecOptionList } from "@/components/specifications/spec-fields-editor";
import type { SelectCategories } from "@/db/schema/categories";
import { ListChecks, Plus, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { SpecificationFormValues } from "@/app/(dashboard)/specifications/validation";
import { measurementUnits } from "@/db/enum";
import {
  Controller,
  FormProvider,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { Button, Combobox, Dropdown, FormError, Input } from "ui";
import type {
  SelectSpecificationGroups,
  SpecificationWithCategories,
} from "services";

type SpecificationFormProps =
  | {
      mode: "add";
      categories: SelectCategories[];
      specifications: SpecificationWithCategories[];
      groups: SelectSpecificationGroups[];
    }
  | {
      mode: "edit";
      categories: SelectCategories[];
      specifications: SpecificationWithCategories[];
      groups: SelectSpecificationGroups[];
      specification: SpecificationWithCategories;
    };

// Every category in the tree of the selected ones: the categories themselves,
// their ancestors (specs there also apply here), and their descendants (specs
// there co-occur on the same products).
const categoryTree = (
  categories: SelectCategories[],
  selectedUuids: string[],
): Set<string> => {
  const parentOf = new Map(categories.map((c) => [c.uuid, c.parentUuid]));
  const childrenOf = new Map<string | null, string[]>();
  for (const category of categories) {
    const parentUuid = category.parentUuid ?? null;
    const siblings = childrenOf.get(parentUuid) ?? [];
    siblings.push(category.uuid);
    childrenOf.set(parentUuid, siblings);
  }

  const tree = new Set<string>();
  for (const uuid of selectedUuids) {
    // Walk up: the category and its ancestors.
    let current: string | null = uuid;
    while (current && !tree.has(current)) {
      tree.add(current);
      current = parentOf.get(current) ?? null;
    }
    // Walk down: all descendants.
    const stack = [uuid];
    while (stack.length > 0) {
      const parent = stack.pop();
      for (const child of childrenOf.get(parent ?? null) ?? []) {
        if (!tree.has(child)) {
          tree.add(child);
          stack.push(child);
        }
      }
    }
  }
  return tree;
};

// Chip editor for a numeric spec's fixed choices. Only parseable numbers can
// be added, so the stored values are always computable by the rule engine.
const NumericValuesEditor = () => {
  const { control, setValue } = useFormContext<SpecificationFormValues>();
  const watchedValues = useWatch({ control, name: "numericValues" });
  const values = useMemo(() => watchedValues ?? [], [watchedValues]);
  const [draft, setDraft] = useState("");

  const isValidDraft =
    draft.trim() !== "" &&
    Number.isFinite(Number(draft.trim())) &&
    !values.includes(draft.trim());

  const addDraft = () => {
    if (!isValidDraft) {
      return;
    }
    setValue("numericValues", [...values, draft.trim()], {
      shouldDirty: true,
    });
    setDraft("");
  };

  const remove = (value: string) => {
    setValue(
      "numericValues",
      values.filter((candidate) => candidate !== value),
      { shouldDirty: true },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {values.map((value) => (
        <span
          key={value}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary-tint px-3 py-1 text-xs font-medium text-primary"
        >
          {value}
          <button
            type="button"
            aria-label={`Remove ${value}`}
            onClick={() => remove(value)}
            className="text-primary hover:text-primary-hover"
          >
            <X size={12} />
          </button>
        </span>
      ))}

      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            addDraft();
          }
        }}
        type="number"
        step="any"
        placeholder="e.g. 24"
        className="w-32 rounded-control border border-hairline bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-primary"
      />
      <Button
        type="button"
        onClick={addDraft}
        disabled={!isValidDraft}
        className="flex items-center gap-1 px-3 py-1.5 text-xs"
      >
        <Plus size={13} />
        Add
      </Button>
    </div>
  );
};

export const SpecificationForm = (props: SpecificationFormProps) => {
  const { mode, categories, specifications, groups } = props;
  const editingUuid = props.mode === "edit" ? props.specification.uuid : null;

  const { form, state, isPending, onSubmit } = useSpecificationForm(
    mode === "edit"
      ? { mode: "edit", specification: props.specification }
      : { mode: "add" },
  );
  const {
    register,
    control,
    formState: { errors },
  } = form;

  const watchedCategoryUuids = useWatch({ control, name: "categoryUuids" });
  const valueType = useWatch({ control, name: "valueType" });

  // The numericValues error may sit on the array itself or on one entry.
  const numericValuesError = Array.isArray(errors.numericValues)
    ? errors.numericValues.find((entry) => entry?.message)?.message
    : errors.numericValues?.message;
  // Stable fallback so the memo deps don't churn on every render.
  const selectedCategoryUuids = useMemo(
    () => watchedCategoryUuids ?? [],
    [watchedCategoryUuids],
  );

  // Rules reference OTHER specifications from the same category tree as the
  // categories selected above — not every specification in the system.
  const eligibleSpecifications = useMemo(() => {
    if (selectedCategoryUuids.length === 0) {
      return [];
    }
    const tree = categoryTree(categories, selectedCategoryUuids);
    return specifications.filter(
      (specification) =>
        specification.uuid !== editingUuid &&
        specification.categoryUuids.some((uuid) => tree.has(uuid)),
    );
  }, [selectedCategoryUuids, categories, specifications, editingUuid]);

  return (
    <FormProvider {...form}>
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-6 rounded-card border border-hairline bg-surface p-7 shadow-[0_1px_2px_rgba(27,35,51,0.04)]"
      >
        <div className="flex items-center gap-3 border-b border-hairline pb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-control bg-primary-tint text-primary">
            <ListChecks size={20} />
          </div>
          <h2 className="font-heading text-xl text-ink">
            {mode === "edit" ? "Edit specification" : "Create specification"}
          </h2>
        </div>

        <Input
          label="Label"
          placeholder="e.g. PoE"
          {...register("label")}
          error={errors.label?.message}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-ink">Group</label>
            <Controller
              control={control}
              name="groupUuid"
              render={({ field }) => (
                <Dropdown
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="No group"
                  options={[
                    { value: "", label: "No group" },
                    ...groups.map((group) => ({
                      value: group.uuid,
                      label: group.name,
                    })),
                  ]}
                />
              )}
            />
            <Input
              placeholder="...or create a new group"
              {...register("newGroupName")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-ink">Value type</label>
            <Controller
              control={control}
              name="valueType"
              render={({ field }) => (
                <Dropdown
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: "select", label: "Dropdown options" },
                    { value: "number", label: "Number (for rules)" },
                  ]}
                />
              )}
            />
          </div>

          {valueType === "number" && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-ink">Unit</label>
              <Controller
                control={control}
                name="unit"
                render={({ field }) => (
                  <Combobox
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Pick a unit"
                    searchPlaceholder="Search units..."
                    options={measurementUnits.map((unit) => ({
                      value: unit,
                      label: unit,
                    }))}
                  />
                )}
              />
              <FormError message={errors.unit?.message} />
            </div>
          )}
        </div>

        <CategoryMultiSelect control={control} categories={categories} />

        {valueType === "select" && (
          <>
            <div className="flex flex-col gap-2 border-t border-hairline pt-6">
              <label className="text-sm font-semibold text-ink">Options</label>
              <p className="text-xs text-muted">
                Dropdown values products pick from. An option can reveal its
                own sub-fields when selected.
              </p>
              <SpecOptionList name="options" depth={0} />
            </div>

            <div className="border-t border-hairline pt-6">
              <RulesEditor
                specifications={eligibleSpecifications}
                hasCategories={selectedCategoryUuids.length > 0}
              />
            </div>
          </>
        )}

        {valueType === "number" && (
          <>
            <div className="flex flex-col gap-2 border-t border-hairline pt-6">
              <label className="text-sm font-semibold text-ink">
                Allowed values (optional)
              </label>
              <p className="text-xs text-muted">
                Fixed numeric choices products pick from — e.g. 24 / 32 / 52
                ports. Leave empty to let products type any number. Either
                way, compatibility rules can compute with the value.
              </p>
              <NumericValuesEditor />
              <FormError message={numericValuesError} />
            </div>

            <p className="rounded-control border border-dashed border-hairline p-4 text-xs text-muted">
              Products enter a numeric value for this specification (in the
              unit above). Numeric specifications are what compatibility rules
              aggregate and compare — e.g. summing every device&apos;s power
              consumption against a switch&apos;s PoE budget.
            </p>
          </>
        )}

        <FormError message={state.error} />

        <div className="flex items-center gap-3 border-t border-hairline pt-5">
          <Button type="submit" disabled={isPending}>
            {mode === "edit"
              ? isPending
                ? "Saving..."
                : "Save Changes"
              : isPending
                ? "Creating..."
                : "Create Specification"}
          </Button>
          <Link
            href="/specifications"
            className="text-sm text-secondary hover:underline"
          >
            Cancel
          </Link>
        </div>
      </form>
    </FormProvider>
  );
};
