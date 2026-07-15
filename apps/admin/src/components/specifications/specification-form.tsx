"use client";

import { useSpecificationForm } from "@/app/(dashboard)/specifications/use-specification-form";
import { CategoryMultiSelect } from "@/components/specifications/category-multi-select";
import { RulesEditor } from "@/components/specifications/rules-editor";
import { SpecOptionList } from "@/components/specifications/spec-fields-editor";
import type { SelectCategories } from "@/db/schema/categories";
import { ListChecks } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { measurementUnits } from "@/db/enum";
import { Controller, FormProvider, useWatch } from "react-hook-form";
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
          <p className="rounded-control border border-dashed border-hairline p-4 text-xs text-muted">
            Products type a numeric value for this specification (in the unit
            above). Numeric specifications are what compatibility rules
            aggregate and compare — e.g. summing every device&apos;s power
            consumption against a switch&apos;s PoE budget.
          </p>
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
