"use client";

import { usePasteImportForm } from "@/app/(dashboard)/imports/use-paste-import-form";
import { BrandDropdown } from "@/components/brands/brand-dropdown";
import { CategoryDropdown } from "@/components/categories/category-dropdown";
import type { SelectBrands } from "@/db/schema/brands";
import type { SelectCategories } from "@/db/schema/categories";
import { ClipboardPaste } from "lucide-react";
import { Button, FormError, Input, Textarea } from "ui";

type PasteImportFormProps = {
  categories: SelectCategories[];
  brands: SelectBrands[];
};

const EXAMPLE = `# https://ajax.systems/products/domecam-mini
Name: DomeCam Mini
Model: DomeCam Mini
Ingress protection: IP66, IK08
Power draw: 4.8 W
Operating temperature: -25 to 60 °C

# https://ajax.systems/products/motioncam
Name: MotionCam
Environmental class: ||
Radio communication range: 5550 ft`;

export const PasteImportForm = ({ categories, brands }: PasteImportFormProps) => {
  const { form, state, isPending, onSubmit } = usePasteImportForm();
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-6 rounded-card border border-hairline bg-surface p-7 shadow-[0_1px_2px_rgba(27,35,51,0.04)]"
    >
      <div className="flex items-center gap-3 border-b border-hairline pb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-control bg-primary-tint text-primary">
          <ClipboardPaste size={20} />
        </div>
        <div>
          <h2 className="font-heading text-xl text-ink">Read a source</h2>
          <p className="text-sm text-faint">
            Nothing is written to the catalogue. Every product lands in the queue
            first.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Input
          label="Source"
          placeholder="Ajax spec pages"
          error={errors.source?.message}
          {...register("source")}
        />
        {/* The category decides which attributes exist and which values each
            offers, so a paste cannot be read without one. */}
        <CategoryDropdown
          control={control}
          name="categoryUuid"
          categories={categories}
          label="Category"
          placeholder="Which category"
          error={errors.categoryUuid?.message}
        />
        <BrandDropdown
          control={control}
          name="brandUuid"
          brands={brands}
          label="Brand"
          placeholder="Which brand"
          error={errors.brandUuid?.message}
        />
      </div>

      <Textarea
        label="Source text"
        rows={14}
        placeholder={EXAMPLE}
        error={errors.text?.message}
        {...register("text")}
      />
      <p className="-mt-3 text-sm text-faint">
        One <code className="text-ink">Label: value</code> per line. A blank line
        or a <code className="text-ink">#</code> starts the next product, and what
        follows the <code className="text-ink">#</code> is the reference a second
        run recognises — so re-reading the same source updates rather than
        duplicates.
      </p>

      <FormError message={state.error} />

      <div className="flex justify-end border-t border-hairline pt-5">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Reading…" : "Read into the queue"}
        </Button>
      </div>
    </form>
  );
};
