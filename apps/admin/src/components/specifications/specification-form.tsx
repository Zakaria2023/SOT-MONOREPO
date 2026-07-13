"use client";

import { useSpecificationForm } from "@/app/(dashboard)/specifications/use-specification-form";
import { CategoryMultiSelect } from "@/components/specifications/category-multi-select";
import { SpecOptionList } from "@/components/specifications/spec-fields-editor";
import type { SelectCategories } from "@/db/schema/categories";
import { ListChecks } from "lucide-react";
import Link from "next/link";
import { FormProvider } from "react-hook-form";
import { Button, FormError, Input } from "ui";
import type { SpecificationWithCategories } from "services";

type SpecificationFormProps =
  | { mode: "add"; categories: SelectCategories[] }
  | {
      mode: "edit";
      categories: SelectCategories[];
      specification: SpecificationWithCategories;
    };

export const SpecificationForm = (props: SpecificationFormProps) => {
  const { mode, categories } = props;

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

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-ink">Options</label>
          <p className="text-xs text-muted">
            Dropdown values products pick from. An option can reveal its own
            sub-fields when selected.
          </p>
          <SpecOptionList name="options" depth={0} />
        </div>

        <CategoryMultiSelect control={control} categories={categories} />

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
