"use client";

import { useProductForm } from "@/app/(dashboard)/products/use-product-form";
import { BrandDropdown } from "@/components/brands/brand-dropdown";
import { CategoryDropdown } from "@/components/categories/category-dropdown";
import { SpecsPreview } from "@/components/specs/specs-preview";
import { productStatuses } from "@/db/enum";
import { PRODUCT_STATUS_LABELS } from "@/db/label";
import type { SelectBrands } from "@/db/schema/brands";
import type { SelectCategories } from "@/db/schema/categories";
import type { SelectProducts } from "@/db/schema/products";
import { documentDownloadUrl } from "@/lib/documents";
import {
  ArrowUpDown,
  Barcode,
  Boxes,
  Coins,
  Hash,
  Layers,
  Package,
  Tag,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Controller, FormProvider } from "react-hook-form";
import {
  Button,
  Checkbox,
  Dropdown,
  FormError,
  ImageUpload,
  Input,
  MultiImageUpload,
  Textarea,
} from "ui";

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
    mode === "edit"
      ? { mode: "edit", product: props.product }
      : { mode: "add" },
  );
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = form;

  // The SKU is auto-assembled from the brand/category/series codes. We show a
  // live preview here (SEQ shown as "##" until the server assigns it on save).
  const selectedBrandCode =
    brands.find((brand) => brand.uuid === watch("brandUuid"))?.code ?? "";
  const selectedCategoryCode =
    categories.find((category) => category.uuid === watch("categoryUuid"))
      ?.code ?? "";
  const seriesCode = watch("seriesCode") ?? "";
  const existingSku = mode === "edit" ? props.product.sku : null;
  const skuPreview =
    selectedBrandCode && selectedCategoryCode
      ? `${selectedBrandCode}${selectedCategoryCode}${seriesCode}-##`.toUpperCase()
      : "Set brand & category codes first";
  const skuDisplay = existingSku ?? skuPreview;

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingSubImages, setIsUploadingSubImages] = useState(false);
  const hasSubmittedRef = useRef(false);

  const inheritCategorySpecs = (categoryUuid: string) => {
    const category = categories.find((item) => item.uuid === categoryUuid);
    setValue("highlights", category?.highlights ?? []);
    setValue("specGroups", category?.specGroups ?? []);
  };

  return (
    <FormProvider {...form}>
      <form
        onSubmit={(event) => {
          hasSubmittedRef.current = true;
          onSubmit(event);
        }}
        className="flex flex-col gap-6 rounded-card border border-hairline bg-surface p-7 shadow-[0_1px_2px_rgba(27,35,51,0.04)]"
      >
        <div className="flex items-center gap-3 border-b border-hairline pb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-control bg-primary-tint text-primary">
            <Package size={20} />
          </div>
          <h2 className="font-heading text-xl text-ink">
            {mode === "edit" ? "Edit product" : "Create product"}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Input
            label="Name"
            labelIcon={<Package size={15} />}
            type="text"
            {...register("name")}
            error={errors.name?.message}
          />
          <Input
            label="Model"
            labelIcon={<Tag size={15} />}
            type="text"
            {...register("model")}
          />
          <Input
            label="Product Family"
            labelIcon={<Layers size={15} />}
            type="text"
            placeholder="e.g. S500 Series"
            {...register("productFamily")}
          />
          <Input
            label="Series Code"
            labelIcon={<Hash size={15} />}
            type="text"
            placeholder="e.g. 50"
            {...register("seriesCode")}
            error={errors.seriesCode?.message}
          />
          <Input
            label="SKU"
            labelIcon={<Hash size={15} />}
            labelAccessory={
              <span className="text-xs text-faint">Auto-generated</span>
            }
            type="text"
            value={skuDisplay}
            readOnly
            className="bg-page text-faint"
          />
          <Input
            label="Part Number (PN)"
            labelIcon={<Barcode size={15} />}
            type="text"
            {...register("partNumber")}
          />
          <Input
            label="Model Number (MN)"
            labelIcon={<Barcode size={15} />}
            type="text"
            {...register("modelNumber")}
          />

          <CategoryDropdown
            control={control}
            name="categoryUuid"
            categories={categories}
            label="Category"
            placeholder="Select a category"
            allowEmpty={false}
            error={errors.categoryUuid?.message}
            onValueChange={inheritCategorySpecs}
          />
          <BrandDropdown
            control={control}
            name="brandUuid"
            brands={brands}
            error={errors.brandUuid?.message}
          />

          <div className="flex flex-col gap-2">
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

          <Input
            label="Currency"
            labelIcon={<Coins size={15} />}
            type="text"
            {...register("currency")}
            error={errors.currency?.message}
          />
          <Input
            label="Price (optional)"
            labelIcon={<Coins size={15} />}
            type="text"
            inputMode="decimal"
            placeholder="Set by partner"
            {...register("price")}
            error={errors.price?.message}
          />
          <Input
            label="Stock"
            labelIcon={<Boxes size={15} />}
            type="number"
            {...register("stock", { valueAsNumber: true })}
          />
          <Input
            label="Role"
            labelIcon={<Waypoints size={15} />}
            type="text"
            {...register("role")}
          />
          {mode === "edit" && (
            <Input
              label="Order"
              labelIcon={<ArrowUpDown size={15} />}
              type="number"
              {...register("order", { valueAsNumber: true })}
              error={errors.order?.message}
            />
          )}
        </div>

        <Textarea
          label="Bill of Materials (BOM)"
          rows={4}
          {...register("bom")}
        />
        <Textarea label="Description" rows={4} {...register("description")} />

        <Checkbox label="Featured product" {...register("isFeatured")} />

        <ImageUpload
          label="Main image"
          register={register("image")}
          onUploaded={(documentId) => setValue("image", documentId)}
          onUploadingChange={setIsUploadingImage}
          submittedRef={hasSubmittedRef}
          previewUrl={
            mode === "edit" && props.product.image
              ? documentDownloadUrl(props.product.image)
              : null
          }
        />

        <Controller
          control={control}
          name="images"
          render={({ field }) => (
            <MultiImageUpload
              label="Sub images"
              value={field.value ?? []}
              onChange={field.onChange}
              getPreviewUrl={documentDownloadUrl}
              onUploadingChange={setIsUploadingSubImages}
            />
          )}
        />

        <SpecsPreview />

        <FormError message={state.error} />

        <div className="flex items-center gap-3 border-t border-hairline pt-5">
          <Button
            type="submit"
            disabled={isPending || isUploadingImage || isUploadingSubImages}
          >
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
