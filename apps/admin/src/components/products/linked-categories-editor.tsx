"use client";

import type { ProductFormValues } from "@/app/(dashboard)/products/validation";
import { CategoryDropdown } from "@/components/categories/category-dropdown";
import type { SelectCategories } from "@/db/schema/categories";
import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Button } from "ui";

type LinkedCategoriesEditorProps = {
  categories: SelectCategories[];
};

export const LinkedCategoriesEditor = ({
  categories,
}: LinkedCategoriesEditorProps) => {
  const { control } = useFormContext<ProductFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "linkedCategories",
  });

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-sm font-semibold text-ink">
          Linked categories
        </label>
        <p className="mt-1 text-xs text-muted">
          Extra shelves this product also appears on, beyond its home category.
          One record, never copied.
        </p>
      </div>

      {fields.map((field, index) => (
        <div key={field.id} className="flex items-end gap-2">
          <div className="flex-1">
            <CategoryDropdown
              control={control}
              name={`linkedCategories.${index}.categoryUuid`}
              categories={categories}
              label=""
              placeholder="Select a category"
              allowEmpty={false}
            />
          </div>
          <Button
            type="button"
            variant="icon"
            className="shrink-0"
            onClick={() => remove(index)}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => append({ categoryUuid: "" })}
      >
        <Plus size={16} />
        Add Linked Category
      </Button>
    </div>
  );
};
