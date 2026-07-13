"use client";

import { useProductForm } from "@/app/(dashboard)/products/use-product-form";
import { AliasesEditor } from "@/components/products/aliases-editor";
import { DatasheetUpload } from "@/components/products/datasheet-upload";
import { LinkedCategoriesEditor } from "@/components/products/linked-categories-editor";
import { BrandDropdown } from "@/components/brands/brand-dropdown";
import { CategoryDropdown } from "@/components/categories/category-dropdown";
import { SpecsPreview } from "@/components/specs/specs-preview";
import { businessLines, productStatuses } from "@/db/enum";
import { BUSINESS_LINE_LABELS, PRODUCT_STATUS_LABELS } from "@/db/label";
import type { SelectBrands } from "@/db/schema/brands";
import type { SelectCategories } from "@/db/schema/categories";
import type { SelectProductAliases } from "@/db/schema/product-aliases";
import type { SelectProductCategories } from "@/db/schema/product-categories";
import type { SelectProducts } from "@/db/schema/products";
import { documentDownloadUrl } from "@/lib/documents";
import {
  ArrowUpDown,
  Boxes,
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
  | { mode: "add"; categories: SelectCategories[]; brands: SelectBrands[] }
  | {
      mode: "edit";
      categories: SelectCategories[];
      brands: SelectBrands[];
      product: SelectProducts;
      aliases: SelectProductAliases[];
      linkedCategories: SelectProductCategories[];
    };

const statusOptions = productStatuses.map((status) => ({
  value: status,
  label: PRODUCT_STATUS_LABELS[status],
}));

const businessLineOptions = businessLines.map((line) => ({
  value: line,
  label: BUSINESS_LINE_LABELS[line],
}));

export const ProductForm = (props: ProductFormProps) => {
  const { mode, categories, brands } = props;

  const { form, state, isPending, onSubmit } = useProductForm(
    props.mode === "edit"
      ? {
          mode: "edit",
          product: props.product,
          aliases: props.aliases,
          linkedCategories: props.linkedCategories,
        }
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
            label="Sub-distributor price (later)"
            labelIcon={<Coins size={15} />}
            type="text"
            inputMode="decimal"
            {...register("priceSubDistributor")}
            error={errors.priceSubDistributor?.message}
          />
          <Input
            label="End-user price (later)"
            labelIcon={<Coins size={15} />}
            type="text"
            inputMode="decimal"
            {...register("priceEndUser")}
            error={errors.priceEndUser?.message}
          />

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-ink">
              Business line
            </label>
            <Controller
              control={control}
              name="businessLine"
              render={({ field }) => (
                <Dropdown
                  value={field.value}
                  onChange={field.onChange}
                  options={businessLineOptions}
                />
              )}
            />
          </div>
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
          <Input
            label="Vendor node"
            labelIcon={<Waypoints size={15} />}
            type="text"
            placeholder="e.g. Huawei › eKit › Datacom"
            {...register("vendorNode")}
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

        <AliasesEditor />

        <LinkedCategoriesEditor categories={categories} />

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
            label="Available for purchase"
            {...register("isAvailable")}
          />
          <Checkbox
            label="Warranty extendable"
            {...register("warrantyExtendable")}
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
