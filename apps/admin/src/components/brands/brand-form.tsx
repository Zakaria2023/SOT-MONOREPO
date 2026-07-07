"use client";

import { useBrandForm } from "@/app/(dashboard)/brands/use-brand-form";
import { BrandDropdown } from "@/components/brands/brand-dropdown";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SelectBrands } from "@/db/schema/brands";
import { documentDownloadUrl } from "@/lib/documents";
import { ArrowUpDown, Award } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

type BrandFormProps =
  | { mode: "add"; brands: SelectBrands[] }
  | { mode: "edit"; brands: SelectBrands[]; brand: SelectBrands };

export const BrandForm = (props: BrandFormProps) => {
  const { mode, brands } = props;

  const { form, state, isPending, onSubmit } = useBrandForm(
    mode === "edit" ? { mode: "edit", brand: props.brand } : { mode: "add" },
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
    <form
      onSubmit={(event) => {
        hasSubmittedRef.current = true;
        onSubmit(event);
      }}
      className="flex flex-col gap-6 rounded-card border border-hairline bg-surface p-7 shadow-[0_1px_2px_rgba(27,35,51,0.04)]"
    >
      <div className="flex items-center gap-3 border-b border-hairline pb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-control bg-primary-tint text-primary">
          <Award size={20} />
        </div>
        <h2 className="font-heading text-xl text-ink">
          {mode === "edit" ? "Edit brand" : "Create brand"}
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Input
          label="Name"
          labelIcon={<Award size={15} />}
          type="text"
          {...register("name")}
          error={errors.name?.message}
        />

        <BrandDropdown
          control={control}
          name="parentUuid"
          brands={brands}
          label="Parent Brand"
          placeholder="No parent"
          allowEmpty
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

      <Textarea label="Description" rows={3} {...register("description")} />

      <ImageUpload
        label="Image"
        register={register("image")}
        onUploaded={(documentId) => setValue("image", documentId)}
        onUploadingChange={setIsUploadingImage}
        submittedRef={hasSubmittedRef}
        previewUrl={
          mode === "edit" && props.brand.image
            ? documentDownloadUrl(props.brand.image)
            : null
        }
      />

      <FormError message={state.error} />

      <div className="flex items-center gap-3 border-t border-hairline pt-5">
        <Button type="submit" disabled={isPending || isUploadingImage}>
          {mode === "edit"
            ? isPending
              ? "Saving..."
              : "Save Changes"
            : isPending
              ? "Creating..."
              : "Create Brand"}
        </Button>
        <Link href="/brands" className="text-sm text-secondary hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
};
