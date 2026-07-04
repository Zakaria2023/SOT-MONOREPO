"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Controller, FormProvider } from "react-hook-form";
import { useProductForm } from "@/app/(dashboard)/products/use-product-form";
import { BrandDropdown } from "@/components/brands/brand-dropdown";
import { CategoryDropdown } from "@/components/categories/category-dropdown";
import { HighlightsEditor } from "@/components/products/highlights-editor";
import { SpecGroupsEditor } from "@/components/products/spec-groups-editor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dropdown } from "@/components/ui/dropdown";
import { FormError } from "@/components/ui/form-error";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SelectBrands } from "@/db/schema/brands";
import type { SelectCategories } from "@/db/schema/categories";
import type { SelectProducts } from "@/db/schema/products";
import { productStatuses } from "@/lib/enum";
import { PRODUCT_STATUS_LABELS } from "@/lib/label";

type ProductFormProps =
  | { mode: "add"; categories: SelectCategories[]; brands: SelectBrands[] }
  | {
      mode: "edit";
      categories: SelectCategories[];
      brands: SelectBrands[];
      product: SelectProducts;
    };

const statusOptions = productStatuses.map((status) => ({
  value: status,
  label: PRODUCT_STATUS_LABELS[status],
}));

export const ProductForm = (props: ProductFormProps) => {
  const { mode, categories, brands } = props;

  const { form, state, isPending, onSubmit } = useProductForm(
    mode === "edit" ? { mode: "edit", product: props.product } : { mode: "add" },
  );
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form;

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const hasSubmittedRef = useRef(false);

  return (
    <FormProvider {...form}>
      <form
        onSubmit={(event) => {
          hasSubmittedRef.current = true;
          onSubmit(event);
        }}
        className="flex max-w-3xl flex-col gap-5 rounded-card border border-hairline bg-surface p-6"
      >
        <Input
          label="Name"
          type="text"
          {...register("name")}
          error={errors.name?.message}
        />

        <Input
          label="Slug"
          type="text"
          {...register("slug")}
          error={errors.slug?.message}
        />

        <div className="grid grid-cols-2 gap-4">
          <CategoryDropdown
            control={control}
            name="categoryUuid"
            categories={categories}
            label="Category"
            placeholder="Select a category"
            allowEmpty={false}
            error={errors.categoryUuid?.message}
          />

          <BrandDropdown
            control={control}
            name="brandUuid"
            brands={brands}
            error={errors.brandUuid?.message}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="SKU" type="text" {...register("sku")} />
          <Input label="Model" type="text" {...register("model")} />
        </div>

        <Input label="Blurb" type="text" {...register("blurb")} />
        <Textarea label="Description" rows={4} {...register("description")} />
        <Input label="Role" type="text" {...register("role")} />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Price"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            {...register("price")}
            error={errors.price?.message}
          />
          <Input
            label="Currency"
            type="text"
            {...register("currency")}
            error={errors.currency?.message}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Stock"
            type="number"
            {...register("stock", { valueAsNumber: true })}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-ink">Status</label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Dropdown
                  value={field.value}
                  onChange={field.onChange}
                  options={statusOptions}
                />
              )}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Ribbon" type="text" {...register("ribbon")} />
          <Input label="Icon Key" type="text" {...register("iconKey")} />
        </div>

        <Checkbox label="Featured product" {...register("isFeatured")} />

        {mode === "edit" && (
          <Input
            label="Order"
            type="number"
            {...register("order", { valueAsNumber: true })}
            error={errors.order?.message}
          />
        )}

        <ImageUpload
          label="Image"
          register={register("image")}
          onUploaded={(documentId) => setValue("image", documentId)}
          onUploadingChange={setIsUploadingImage}
          submittedRef={hasSubmittedRef}
          previewUrl={
            mode === "edit" && props.product.image
              ? `/api/documents/${props.product.image}/download`
              : null
          }
        />

        <HighlightsEditor />
        <SpecGroupsEditor />

        <FormError message={state.error} />

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending || isUploadingImage}>
            {mode === "edit"
              ? isPending
                ? "Saving..."
                : "Save Changes"
              : isPending
                ? "Creating..."
                : "Create Product"}
          </Button>
          <Link
            href="/products"
            className="text-sm text-secondary hover:underline"
          >
            Cancel
          </Link>
        </div>
      </form>
    </FormProvider>
  );
};
