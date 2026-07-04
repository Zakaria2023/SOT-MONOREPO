"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useBrandForm } from "@/app/(dashboard)/brands/use-brand-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SelectBrands } from "@/db/schema/brands";

type BrandFormProps =
  | { mode: "add" }
  | { mode: "edit"; brand: SelectBrands };

export const BrandForm = (props: BrandFormProps) => {
  const { mode } = props;

  const { form, state, isPending, onSubmit } = useBrandForm(
    mode === "edit" ? { mode: "edit", brand: props.brand } : { mode: "add" },
  );
  const {
    register,
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
      className="flex max-w-xl flex-col gap-5 rounded-card border border-hairline bg-surface p-6"
    >
      <Input
        label="Name"
        type="text"
        {...register("name")}
        error={errors.name?.message}
      />

      <Textarea label="Description" rows={3} {...register("description")} />

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
          mode === "edit" && props.brand.image
            ? `/api/documents/${props.brand.image}/download`
            : null
        }
      />

      <FormError message={state.error} />

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending || isUploadingImage}>
          {mode === "edit"
            ? isPending
              ? "Saving..."
              : "Save Changes"
            : isPending
              ? "Creating..."
              : "Create Brand"}
        </Button>
        <Link
          href="/brands"
          className="text-sm text-secondary hover:underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
};
