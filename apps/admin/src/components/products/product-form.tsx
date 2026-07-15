"use client";

import { useProductForm } from "@/app/(dashboard)/products/use-product-form";
import { DatasheetUpload } from "@/components/products/datasheet-upload";
import { TechnicalSpecsEditor } from "@/components/products/technical-specs-editor";
import { BrandDropdown } from "@/components/brands/brand-dropdown";
import { CategoryDropdown } from "@/components/categories/category-dropdown";
import { VendorDropdown } from "@/components/vendors/vendor-dropdown";
import { productStatuses } from "@/db/enum";
import { PRODUCT_STATUS_LABELS } from "@/db/label";
import type { SelectBrands } from "@/db/schema/brands";
import type { SelectCategories } from "@/db/schema/categories";
import type { SelectProducts } from "@/db/schema/products";
import type { SelectVendors } from "@/db/schema/vendors";
import { documentDownloadUrl } from "@/lib/documents";
import type { SpecificationWithCategories } from "services";
import {
  ArrowUpDown,
  Coins,
  Globe,
  Hash,
  Layers,
  Package,
  ShieldCheck,
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
  | {
      mode: "add";
      categories: SelectCategories[];
      brands: SelectBrands[];
      vendors: SelectVendors[];
      specifications: SpecificationWithCategories[];
    }
  | {
      mode: "edit";
      categories: SelectCategories[];
      brands: SelectBrands[];
      vendors: SelectVendors[];
      specifications: SpecificationWithCategories[];
      product: SelectProducts;
    };

const statusOptions = productStatuses.map((status) => ({
  value: status,
  label: PRODUCT_STATUS_LABELS[status],
}));

const availabilityOptions = [
  { value: "available", label: "Available" },
  { value: "unavailable", label: "Not available" },
];

export const ProductForm = (props: ProductFormProps) => {
  const { mode, categories, brands, vendors, specifications } = props;

  const { form, state, isPending, onSubmit } = useProductForm(
    props.mode === "edit"
      ? {
          mode: "edit",
          product: props.product,
        }
      : { mode: "add" },
  );
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form;

  // The SKU is auto-assembled from the brand/category/series codes. We show a
  // live preview here (SEQ shown as "##" until the server assigns it on save).
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingSubImages, setIsUploadingSubImages] = useState(false);
  const hasSubmittedRef = useRef(false);

  // Applicable specs depend on the category, so clear chosen values on change.
  const handleCategoryChange = () => {
    setValue("technicalAttributes", {});
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
          <CategoryDropdown
            control={control}
            name="categoryUuid"
            categories={categories}
            label="Category"
            placeholder="Select a category"
            allowEmpty={false}
            error={errors.categoryUuid?.message}
            onValueChange={handleCategoryChange}
          />
          <BrandDropdown
            control={control}
            name="brandUuid"
            brands={brands}
            error={errors.brandUuid?.message}
          />
          <VendorDropdown
            control={control}
            name="vendorUuid"
            vendors={vendors}
            placeholder="No vendor"
            allowEmpty
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
            label="MSRP (public price)"
            labelIcon={<Coins size={15} />}
            type="text"
            inputMode="decimal"
            {...register("price")}
            error={errors.price?.message}
          />
          <Input
            label="Cost price"
            labelIcon={<Coins size={15} />}
            type="text"
            inputMode="decimal"
            {...register("priceCost")}
            error={errors.priceCost?.message}
          />
          <Input
            label="System Integrator price"
            labelIcon={<Coins size={15} />}
            type="text"
            inputMode="decimal"
            {...register("priceSystemIntegrator")}
            error={errors.priceSystemIntegrator?.message}
          />
          <Input
            label="Sub-distributor price"
            labelIcon={<Coins size={15} />}
            type="text"
            inputMode="decimal"
            {...register("priceSubDistributor")}
            error={errors.priceSubDistributor?.message}
          />
          <Input
            label="End-user price"
            labelIcon={<Coins size={15} />}
            type="text"
            inputMode="decimal"
            {...register("priceEndUser")}
            error={errors.priceEndUser?.message}
          />

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-ink">
              Availability
            </label>
            <Controller
              control={control}
              name="isAvailable"
              render={({ field }) => (
                <Dropdown
                  value={field.value ? "available" : "unavailable"}
                  onChange={(value) => field.onChange(value === "available")}
                  options={availabilityOptions}
                />
              )}
            />
          </div>
          <Input
            label="Role"
            labelIcon={<Waypoints size={15} />}
            type="text"
            {...register("role")}
          />
          <Input
            label="Warranty period"
            labelIcon={<ShieldCheck size={15} />}
            type="text"
            placeholder="e.g. 24 months"
            {...register("warrantyPeriod")}
          />
          <Input
            label="Warranty region"
            labelIcon={<ShieldCheck size={15} />}
            type="text"
            placeholder="e.g. Saudi Arabia"
            {...register("warrantyRegion")}
          />
          <Input
            label="Country of origin"
            labelIcon={<Globe size={15} />}
            type="text"
            placeholder="e.g. China"
            {...register("countryOfOrigin")}
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
          label="Short description"
          rows={2}
          {...register("shortDescription")}
        />
        <Textarea label="Description" rows={4} {...register("description")} />

        <Controller
          control={control}
          name="datasheet"
          render={({ field }) => (
            <DatasheetUpload
              label="Datasheet (PDF)"
              value={field.value ?? ""}
              onChange={field.onChange}
            />
          )}
        />

        <div className="flex flex-col gap-3">
          <Checkbox label="Featured product" {...register("isFeatured")} />
          <Checkbox
            label="Warranty extendable"
            {...register("warrantyExtendable")}
          />
          <Checkbox
            label="Anchor product (needs solution review)"
            {...register("needsSolutionReview")}
          />
        </div>

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

        <TechnicalSpecsEditor
          categories={categories}
          specifications={specifications}
        />

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
